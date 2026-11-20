#include <Arduino.h>
#include <ArduinoJson.h>
#include <DNSServer.h>
#include <ESPAsyncWebServer.h>
#include <LittleFS.h>
#include <WiFi.h>
#include <esp_system.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>

#include <cstring>
#include <string>
#include <vector>

#include "ConnectionCore.h"
#include "GameCore.h"
#include "WebPage.h"

namespace {

constexpr char kSsid[] = "BOARD GAME";
constexpr char kPortalUrl[] = "http://192.168.4.1/game/";
constexpr std::size_t kMaxMessage = 1024;
constexpr std::uint32_t kHeartbeatTimeoutMs = 10000;
const IPAddress kApIp(192, 168, 4, 1);
const IPAddress kSubnet(255, 255, 255, 0);

enum class EventKind : std::uint8_t { Connect, Disconnect, Message, Invalid };

struct SocketEvent {
  EventKind kind;
  std::uint32_t clientId;
  char observedIp[16];
  std::uint16_t length;
  char payload[kMaxMessage + 1];
};

DNSServer dns;
AsyncWebServer server(80);
AsyncWebSocket webSocket("/ws");
QueueHandle_t eventQueue = nullptr;
ConnectionCore room("");
GameCore game;
std::string selectedMinigame;
std::uint16_t selectedMinigameRound = 0;

bool validMinigame(const std::string& gameId) {
  static const char* const ids[] = {
      "game-1", "game-2", "game-3", "game-4", "game-5",
      "game-6", "game-7", "game-8", "game-9"};
  for (const char* id : ids) {
    if (gameId == id) return true;
  }
  return false;
}

std::string makeBootId() {
  static const char hex[] = "0123456789abcdef";
  char result[33];
  for (std::size_t i = 0; i < 16; ++i) {
    const std::uint8_t value = static_cast<std::uint8_t>(esp_random());
    result[i * 2] = hex[value >> 4];
    result[i * 2 + 1] = hex[value & 15];
  }
  result[32] = '\0';
  return result;
}

void sendJson(std::uint32_t clientId, JsonDocument& document) {
  String output;
  serializeJson(document, output);
  webSocket.text(clientId, output);
}

void sendSession(std::uint32_t clientId) {
  JsonDocument document;
  document["t"] = "session";
  document["bootId"] = room.bootId().c_str();
  sendJson(clientId, document);
}

void sendIdentity(std::uint32_t clientId) {
  if (!room.byClient(clientId)) return;
  const bool isHost = room.isHost(clientId);
  JsonDocument document;
  document["t"] = "identity";
  document["role"] = isHost ? "HOST" : "GUEST";
  document["host"] = isHost;
  document["bootId"] = room.bootId().c_str();
  if (isHost) document["hostIp"] = room.host().ip.c_str();
  sendJson(clientId, document);
}

void sendError(std::uint32_t clientId, const char* code) {
  JsonDocument document;
  document["t"] = "error";
  document["code"] = code;
  document["bootId"] = room.bootId().c_str();
  sendJson(clientId, document);
}

const char* errorCode(Result result) {
  switch (result) {
    case Result::StaleBoot: return "STALE_BOOT";
    case Result::Full: return "ROOM_FULL";
    case Result::NotJoined: return "NOT_JOINED";
    case Result::WrongIp: return "WRONG_IP";
    case Result::Invalid:
    case Result::Ok: return "INVALID_MESSAGE";
  }
  return "INVALID_MESSAGE";
}

void sendState(std::uint32_t clientId) {
  unsigned onlineCount = 0;
  for (const auto& device : room.devices()) {
    if (device.online) ++onlineCount;
  }
  JsonDocument document;
  document["t"] = "state";
  document["bootId"] = room.bootId().c_str();
  document["hostOnline"] = room.host().online;
  document["hostAssigned"] = !room.host().deviceId.empty();
  document["onlineCount"] = onlineCount;
  document["deviceCount"] = room.devices().size();
  sendJson(clientId, document);
}

void broadcastState() {
  for (const auto& device : room.devices()) {
    if (device.online) sendState(device.clientId);
  }
}

void sendGameState(std::uint32_t clientId) {
  JsonDocument doc;
  doc["t"] = "game_state";
  doc["bootId"] = room.bootId().c_str();
  doc["phase"] = game.phaseString();
  doc["round"] = game.currentRound();
  if (game.phase() == GamePhase::Minigame &&
      selectedMinigameRound == game.currentRound() &&
      !selectedMinigame.empty()) {
    doc["minigame"] = selectedMinigame.c_str();
  }
  doc["turnIndex"] = game.currentTurnIndex();
  doc["activePlayer"] = game.activePlayerIndex();
  doc["lastRoll"] = game.lastRoll();
  doc["winner"] = game.winnerIndex();
  doc["playerCount"] = game.playerCount();

  const bool isHost = room.isHost(clientId);
  doc["isHost"] = isHost;
  if (isHost) {
    doc["hostIp"] = room.host().ip.c_str();
  }

  JsonArray orderArray = doc["order"].to<JsonArray>();
  for (std::uint8_t id : game.turnOrder()) {
    orderArray.add(id);
  }

  JsonArray playersArray = doc["players"].to<JsonArray>();
  const auto& allPlayers = game.players();
  std::size_t activeCount = game.playerCount();
  for (std::size_t i = 0; i < activeCount && i < allPlayers.size(); ++i) {
    const auto& p = allPlayers[i];
    JsonObject obj = playersArray.add<JsonObject>();
    obj["id"] = p.id;
    obj["name"] = p.name.c_str();
    obj["color"] = p.color.c_str();
    obj["avatar"] = p.avatarIcon.c_str();
    obj["pos"] = p.position;
    obj["isBot"] = p.isBot;
    obj["conn"] = p.connected;
    obj["rolls"] = p.totalRolls;
    obj["score"] = p.minigameScore;
    obj["totalScore"] = p.totalMinigameScore;
    obj["minigameSubmitted"] = p.minigameSubmitted;
    obj["doubleDice"] = p.hasDoubleDice;
    obj["isYou"] = (p.connected && p.clientId == clientId);
  }

  sendJson(clientId, doc);
}

void broadcastGameState() {
  for (const auto& device : room.devices()) {
    if (device.online) {
      sendGameState(device.clientId);
    }
  }
}

void broadcastAction(JsonDocument& doc) {
  String output;
  serializeJson(doc, output);
  for (const auto& device : room.devices()) {
    if (device.online) {
      webSocket.text(device.clientId, output);
    }
  }
}

void broadcastDiceRoll(std::uint8_t playerIdx, std::uint8_t roll,
                       std::uint8_t initialPos, bool isDouble) {
  const auto& players = game.players();
  if (playerIdx >= players.size()) return;

  const std::uint8_t effectiveSteps = isDouble ? roll * 2 : roll;
  const std::uint8_t landPos =
      std::min<std::uint8_t>(GameCore::kBoardLength, initialPos + effectiveSteps);
  const std::uint8_t specialTarget = GameCore::getSpecialPathTarget(landPos);

  JsonDocument actionDoc;
  actionDoc["t"] = "dice_roll";
  actionDoc["player"] = playerIdx;
  actionDoc["roll"] = roll;
  actionDoc["effectiveSteps"] = effectiveSteps;
  actionDoc["isDouble"] = isDouble;
  actionDoc["from"] = initialPos;
  actionDoc["to"] = landPos;
  actionDoc["special"] = (specialTarget != landPos) ? specialTarget : 0;
  actionDoc["finalPos"] = players[playerIdx].position;
  broadcastAction(actionDoc);
}

bool jsonString(JsonDocument& document, const char* key,
                std::size_t maxLength, std::string& output) {
  if (!document[key].is<const char*>()) return false;
  const char* value = document[key].as<const char*>();
  const std::size_t length = std::strlen(value);
  if (length == 0 || length > maxLength) return false;
  output.assign(value, length);
  return true;
}

void processMessage(const SocketEvent& event) {
  JsonDocument document;
  const DeserializationError parseError =
      deserializeJson(document, event.payload, event.length);
  if (parseError || !document.is<JsonObject>()) {
    sendError(event.clientId, "INVALID_JSON");
    return;
  }

  std::string type;
  if (!jsonString(document, "t", 24, type)) {
    sendError(event.clientId, "INVALID_MESSAGE");
    return;
  }

  if (type == "ping") {
    room.touch(event.clientId, millis());
    JsonDocument answer;
    answer["t"] = "pong";
    answer["bootId"] = room.bootId().c_str();
    sendJson(event.clientId, answer);
    return;
  }

  if (type == "hello") {
    std::string deviceId;
    std::string bootId;
    if (!jsonString(document, "deviceId", 71, deviceId) ||
        !jsonString(document, "bootId", 40, bootId)) {
      sendError(event.clientId, "INVALID_MESSAGE");
      return;
    }
    const Result result = room.hello(deviceId, bootId, event.observedIp,
                                     event.clientId, millis());
    if (result != Result::Ok) {
      sendError(event.clientId, errorCode(result));
      return;
    }

    const bool isHost = room.isHost(event.clientId);
    if (isHost) {
      game.removePlayerByDeviceId(deviceId);
    } else {
      game.updatePlayerClient(deviceId, event.clientId);
      if (game.findPlayerByDeviceId(deviceId) < 0 &&
          game.phase() == GamePhase::Setup) {
        game.registerPlayer(deviceId, event.clientId, "");
      }
    }

    sendIdentity(event.clientId);
    broadcastState();
    sendGameState(event.clientId);
    broadcastGameState();
    return;
  }

  if (type == "claim_host") {
    if (game.phase() != GamePhase::Setup) {
      sendError(event.clientId, "HOST_CLAIM_ONLY_SETUP");
      return;
    }
    std::string enteredIp;
    if (!jsonString(document, "hostIp", 15, enteredIp)) {
      sendError(event.clientId, "INVALID_MESSAGE");
      return;
    }
    const std::uint32_t oldHostClientId = room.host().clientId;
    const Result result = room.claimHost(event.clientId, enteredIp);
    if (result != Result::Ok) {
      sendError(event.clientId, errorCode(result));
      return;
    }
    room.touch(event.clientId, millis());

    // The new Host becomes an observer; the previous Host joins as a player.
    const auto* newHostDev = room.byClient(event.clientId);
    if (newHostDev) {
      game.removePlayerByDeviceId(newHostDev->deviceId);
    }

    if (oldHostClientId != 0 && oldHostClientId != event.clientId) {
      sendIdentity(oldHostClientId);
      const auto* oldHostDev = room.byClient(oldHostClientId);
      if (oldHostDev) {
        game.registerPlayer(oldHostDev->deviceId, oldHostClientId, "");
      }
    }

    sendIdentity(event.clientId);
    broadcastState();
    broadcastGameState();
    return;
  }

  if (type == "join_game") {
    std::string playerName;
    jsonString(document, "name", 60, playerName);
    std::string avatar;
    jsonString(document, "avatar", 16, avatar);
    std::string color;
    jsonString(document, "color", 16, color);
    const auto* dev = room.byClient(event.clientId);
    if (dev && !room.isHost(event.clientId) &&
        game.phase() == GamePhase::Setup) {
      game.registerPlayer(dev->deviceId, event.clientId, playerName, avatar,
                          color);
      broadcastGameState();
    }
    return;
  }

  if (type == "set_player_info") {
    if (game.phase() != GamePhase::Setup) {
      return;
    }
    const bool isHost = room.isHost(event.clientId);
    const int clientSlot = game.findPlayerByClient(event.clientId);
    std::uint8_t index = document["index"] | 0;

    // Host được sửa mọi slot; Khách chỉ được sửa slot của chính mình
    if (!isHost && clientSlot != static_cast<int>(index)) {
      return;
    }

    std::string playerName;
    std::string avatar;
    std::string color;
    jsonString(document, "name", 60, playerName);
    jsonString(document, "avatar", 16, avatar);
    jsonString(document, "color", 16, color);
    bool isBot = document["isBot"] | false;
    if (!isHost) isBot = false; // Khách không thể tự biến mình thành bot

    game.setPlayerInfo(index, playerName, avatar, color, isBot);
    broadcastGameState();
    return;
  }

  if (type == "set_player_count") {
    if (room.isHost(event.clientId) && game.phase() == GamePhase::Setup) {
      std::uint8_t count = document["count"] | 2;
      game.setPlayerCount(count);
      broadcastGameState();
    }
    return;
  }

  if (type == "start_game") {
    if (!room.isHost(event.clientId)) {
      sendError(event.clientId, "NOT_HOST");
      return;
    }
    std::uint8_t count = document["count"] | 2;
    std::vector<bool> botFlags;
    std::vector<std::string> names;
    std::vector<std::string> avatars;
    std::vector<std::string> colors;
    if (document["bots"].is<JsonArray>()) {
      for (bool b : document["bots"].as<JsonArray>()) {
        botFlags.push_back(b);
      }
    }
    if (document["names"].is<JsonArray>()) {
      for (const char* n : document["names"].as<JsonArray>()) {
        names.push_back(n ? n : "");
      }
    }
    if (document["avatars"].is<JsonArray>()) {
      for (const char* a : document["avatars"].as<JsonArray>()) {
        avatars.push_back(a ? a : "");
      }
    }
    if (document["colors"].is<JsonArray>()) {
      for (const char* c : document["colors"].as<JsonArray>()) {
        colors.push_back(c ? c : "");
      }
    }
    const auto& players = game.players();
    for (std::size_t i = 0; i < count && i < players.size(); ++i) {
      const bool configuredAsBot = i >= botFlags.size() || botFlags[i];
      if (!configuredAsBot && !players[i].connected) {
        sendError(event.clientId, "PLAYER_NOT_CONNECTED");
        return;
      }
    }
    selectedMinigame.clear();
    selectedMinigameRound = 0;
    game.startGame(count, botFlags, names, millis(), avatars, colors);
    broadcastGameState();
    return;
  }

  if (type == "select_minigame") {
    if (!room.isHost(event.clientId)) {
      sendError(event.clientId, "NOT_HOST");
      return;
    }
    if (game.phase() != GamePhase::Minigame ||
        (document["round"] | 0) != game.currentRound()) {
      sendError(event.clientId, "MINIGAME_NOT_ACTIVE");
      return;
    }
    std::string gameId;
    if (!jsonString(document, "game", 8, gameId) ||
        !validMinigame(gameId)) {
      sendError(event.clientId, "INVALID_MINIGAME");
      return;
    }
    if (selectedMinigameRound == game.currentRound()) {
      return;
    }
    selectedMinigame = gameId;
    selectedMinigameRound = game.currentRound();
    broadcastGameState();
    return;
  }

  if (type == "roll_dice") {
    int activeIdx = game.activePlayerIndex();
    const auto& players = game.players();
    bool isAllowed = false;
    if (activeIdx >= 0 && activeIdx < static_cast<int>(players.size())) {
      if (players[activeIdx].connected && players[activeIdx].clientId == event.clientId) {
        isAllowed = true;
      }
    }
    if (!isAllowed || game.phase() != GamePhase::WaitingRoll) {
      sendError(event.clientId, "NOT_YOUR_TURN");
      return;
    }

    std::uint8_t roll = static_cast<std::uint8_t>((esp_random() % 6) + 1);
    std::uint8_t initialPos = players[activeIdx].position;
    const bool isDouble = players[activeIdx].hasDoubleDice;
    game.rollDice(roll, millis());
    broadcastDiceRoll(static_cast<std::uint8_t>(activeIdx), roll, initialPos,
                      isDouble);

    broadcastGameState();
    return;
  }

  if (type == "use_item") {
    static const char* const itemIds[] = {
        "rocket", "bomber", "double_dice", "hook", "teleport"};
    std::string itemId;
    if (!jsonString(document, "item", 16, itemId)) {
      sendError(event.clientId, "INVALID_ITEM");
      return;
    }
    bool validItem = false;
    for (const char* id : itemIds) {
      if (itemId == id) {
        validItem = true;
        break;
      }
    }

    const int playerIdx = game.findPlayerByClient(event.clientId);
    const int targetIdx = document["target"] | -1;
    if (!validItem || game.phase() != GamePhase::WaitingRoll ||
        playerIdx < 0 || game.activePlayerIndex() != playerIdx ||
        (targetIdx >= static_cast<int>(game.playerCount())) ||
        (targetIdx < -1) ||
        (targetIdx == playerIdx) ||
        ((itemId == "bomber" || itemId == "hook") && targetIdx < 0)) {
      sendError(event.clientId, "CANNOT_USE_ITEM");
      return;
    }

    JsonDocument actionDoc;
    actionDoc["t"] = "item_used";
    actionDoc["player"] = playerIdx;
    actionDoc["item"] = itemId.c_str();
    actionDoc["target"] = targetIdx;
    broadcastAction(actionDoc);
    return;
  }

  if (type == "minigame_score") {
    const int playerIdx = game.findPlayerByClient(event.clientId);
    if (!document["score"].is<std::uint16_t>() || playerIdx < 0) {
      sendError(event.clientId, "CANNOT_SUBMIT_MINIGAME_SCORE");
      return;
    }
    const std::uint16_t score = document["score"].as<std::uint16_t>();
    if (!game.submitMinigameScore(static_cast<std::uint8_t>(playerIdx), score)) {
      sendError(event.clientId, "CANNOT_SUBMIT_MINIGAME_SCORE");
      return;
    }
    broadcastGameState();
    return;
  }

  if (type == "activate_double_dice") {
    const int playerIdx = game.findPlayerByClient(event.clientId);
    if (playerIdx < 0 ||
        !game.activateDoubleDice(static_cast<std::uint8_t>(playerIdx))) {
      sendError(event.clientId, "CANNOT_USE_ITEM");
      return;
    }
    broadcastGameState();
    return;
  }

  if (type == "minigame_finish") {
    if (!room.isHost(event.clientId) ||
        game.phase() != GamePhase::Minigame) {
      return;
    }
    for (std::size_t i = 0; i < game.playerCount(); ++i) {
      const auto& player = game.players()[i];
      if (player.connected && !player.isBot && !player.minigameSubmitted) {
        sendError(event.clientId, "MINIGAME_PLAYERS_PENDING");
        return;
      }
    }

    // Cập nhật điểm các người chơi nếu client gửi lên
    if (document["scores"].is<JsonObject>()) {
      JsonObject scoresObj = document["scores"].as<JsonObject>();
      for (JsonPair kv : scoresObj) {
        int pIdx = atoi(kv.key().c_str());
        if (pIdx >= 0 && pIdx < static_cast<int>(game.players().size())) {
          game.setPlayerMinigameScore(static_cast<std::uint8_t>(pIdx), kv.value().as<std::uint16_t>());
        }
      }
    } else if (document["score"].is<std::uint16_t>()) {
      int activeIdx = game.activePlayerIndex();
      if (activeIdx >= 0 && activeIdx < static_cast<int>(game.players().size())) {
        game.setPlayerMinigameScore(static_cast<std::uint8_t>(activeIdx), document["score"].as<std::uint16_t>());
      }
    }

    // Cập nhật thứ tự lượt đi mới dựa trên xếp hạng nếu client gửi kèm
    std::vector<std::uint8_t> newOrder;
    if (document["order"].is<JsonArray>()) {
      for (int pid : document["order"].as<JsonArray>()) {
        if (pid >= 0 && pid < static_cast<int>(game.players().size())) {
          newOrder.push_back(static_cast<std::uint8_t>(pid));
        }
      }
    }

    game.advanceRoundWithNewOrder(newOrder, millis());
    selectedMinigame.clear();
    selectedMinigameRound = 0;
    broadcastGameState();
    return;
  }

  if (type == "restart_game") {
    if (!room.isHost(event.clientId)) {
      sendError(event.clientId, "NOT_HOST");
      return;
    }
    game.resetGame(true);
    selectedMinigame.clear();
    selectedMinigameRound = 0;
    broadcastGameState();
    return;
  }

  if (type == "get_game_state") {
    sendGameState(event.clientId);
    return;
  }

  sendError(event.clientId, "UNKNOWN_TYPE");
}

void processEvent(const SocketEvent& event) {
  switch (event.kind) {
    case EventKind::Connect:
      sendSession(event.clientId);
      break;
    case EventKind::Disconnect: {
      const bool wasJoined = room.byClient(event.clientId) != nullptr;
      const std::uint32_t currentHostClient = room.host().clientId;
      room.disconnect(event.clientId);
      game.disconnectClient(event.clientId);
      if (wasJoined) {
        if (room.host().online && room.host().clientId != 0 && room.host().clientId != currentHostClient) {
          const auto* promotedHost = room.byClient(room.host().clientId);
          if (promotedHost) {
            game.removePlayerByDeviceId(promotedHost->deviceId);
          }
          sendIdentity(room.host().clientId);
        }
        broadcastState();
        broadcastGameState();
      }
      break;
    }
    case EventKind::Invalid:
      sendError(event.clientId, "INVALID_MESSAGE");
      break;
    case EventKind::Message:
      processMessage(event);
      break;
  }
}

void onSocketEvent(AsyncWebSocket*, AsyncWebSocketClient* client,
                   AwsEventType type, void* arg, std::uint8_t* data,
                   std::size_t length) {
  SocketEvent event{};
  event.clientId = client->id();
  if (type == WS_EVT_CONNECT) {
    event.kind = EventKind::Connect;
  } else if (type == WS_EVT_DISCONNECT) {
    event.kind = EventKind::Disconnect;
  } else if (type == WS_EVT_DATA) {
    const auto* frame = static_cast<const AwsFrameInfo*>(arg);
    if (!frame || frame->opcode != WS_TEXT || !frame->final ||
        frame->index != 0 || frame->len != length ||
        length == 0 || length > kMaxMessage) {
      event.kind = EventKind::Invalid;
    } else {
      event.kind = EventKind::Message;
      event.length = static_cast<std::uint16_t>(length);
      std::memcpy(event.payload, data, length);
      event.payload[length] = '\0';
      const String ip = client->remoteIP().toString();
      ip.toCharArray(event.observedIp, sizeof(event.observedIp));
    }
  } else {
    return;
  }
  if (xQueueSend(eventQueue, &event, 0) != pdTRUE) {
    client->close(1013, "busy");
  }
}

void servePage(AsyncWebServerRequest* request) {
  request->redirect(kPortalUrl);
}

void redirectToPortal(AsyncWebServerRequest* request) {
  request->redirect(kPortalUrl);
}

void serveGameUnavailable(AsyncWebServerRequest* request) {
  request->send(503, "text/plain; charset=utf-8",
                "Game files are unavailable. Upload the LittleFS image.");
}

}  // namespace

void setup() {
  Serial.begin(115200);
  const bool gameFilesReady = LittleFS.begin(false);
  if (!gameFilesReady) Serial.println("Cannot mount LittleFS game files");

  eventQueue = xQueueCreate(32, sizeof(SocketEvent));
  if (!eventQueue) {
    Serial.println("Cannot create WebSocket event queue");
    ESP.restart();
  }

  WiFi.mode(WIFI_AP);
  if (!WiFi.softAPConfig(kApIp, kApIp, kSubnet) ||
      !WiFi.softAP(kSsid, nullptr, 1, 0, 12)) {
    Serial.println("Cannot start Wi-Fi AP");
    ESP.restart();
  }
  room = ConnectionCore(makeBootId());

  if (!dns.start(53, "*", kApIp)) {
    Serial.println("Cannot start captive DNS");
    ESP.restart();
  }

  webSocket.onEvent(onSocketEvent);
  server.addHandler(&webSocket);
  server.on("/", HTTP_GET, servePage);
  server.on("/host", HTTP_GET, servePage);
  if (gameFilesReady) {
    server.serveStatic("/game/", LittleFS, "/game/")
        .setDefaultFile("index.html")
        .setCacheControl("no-cache, no-store, must-revalidate");
  } else {
    server.on("/game/", HTTP_GET, serveGameUnavailable);
  }
  server.on("/generate_204", HTTP_ANY, redirectToPortal);
  server.on("/hotspot-detect.html", HTTP_ANY, redirectToPortal);
  server.on("/connecttest.txt", HTTP_ANY, redirectToPortal);
  server.on("/ncsi.txt", HTTP_ANY, redirectToPortal);
  server.onNotFound(redirectToPortal);
  server.begin();

  Serial.printf("AP %s at %s, bootId %s\n", kSsid,
                WiFi.softAPIP().toString().c_str(), room.bootId().c_str());
}

void loop() {
  dns.processNextRequest();

  SocketEvent event{};
  for (unsigned i = 0; i < 8 &&
                       xQueueReceive(eventQueue, &event, 0) == pdTRUE; ++i) {
    processEvent(event);
  }

  const std::uint32_t now = millis();
  const bool botRollPending =
      game.phase() == GamePhase::WaitingRoll && game.isBotTurn();
  const int botPlayerIdx = botRollPending ? game.activePlayerIndex() : -1;
  std::uint8_t botInitialPos = 0;
  bool botHadDouble = false;
  if (botPlayerIdx >= 0 &&
      botPlayerIdx < static_cast<int>(game.players().size())) {
    const auto& bot = game.players()[botPlayerIdx];
    botInitialPos = bot.position;
    botHadDouble = bot.hasDoubleDice;
  }
  if (game.update(now)) {
    if (botRollPending && game.phase() == GamePhase::Moving && botPlayerIdx >= 0) {
      broadcastDiceRoll(static_cast<std::uint8_t>(botPlayerIdx), game.lastRoll(),
                        botInitialPos, botHadDouble);
    }
    broadcastGameState();
  }

  static std::uint32_t lastMaintenance = 0;
  if (now - lastMaintenance >= 1000) {
    lastMaintenance = now;
    const auto expired = room.expireStale(now, kHeartbeatTimeoutMs);
    for (std::uint32_t clientId : expired) webSocket.close(clientId);
    if (!expired.empty()) {
      broadcastState();
      broadcastGameState();
    }
    webSocket.cleanupClients(24);
  }
  delay(1);
}
