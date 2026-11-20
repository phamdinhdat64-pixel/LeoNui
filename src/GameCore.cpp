#include "GameCore.h"

#include <algorithm>
#include <cstdlib>

namespace {

struct PlayerPreset {
  const char* name;
  const char* color;
  const char* avatar;
};

const PlayerPreset kPresets[6] = {
    {"Mèo Mướp", "#fb7185", "🐱"},
    {"Cún Cưng", "#f59e0b", "🐶"},
    {"Chuột Tí", "#38bdf8", "🐭"},
    {"Hổ Con", "#f97316", "🐯"},
    {"Trâu Bé", "#10b981", "🐮"},
    {"Rồng Nhí", "#a855f7", "🐲"}
};

}  // namespace

GameCore::GameCore() {
  resetGame(false);
}

void GameCore::resetGame(bool keepPlayers) {
  phase_ = GamePhase::Setup;
  postMovePhase_ = GamePhase::WaitingRoll;
  currentRound_ = 1;
  currentTurnIndex_ = 0;
  lastRoll_ = 0;
  winnerIndex_ = -1;
  turnStartTime_ = 0;
  moveEndTime_ = 0;
  lastBotActionTime_ = 0;

  if (!keepPlayers || players_.empty()) {
    players_.clear();
    playerCount_ = 2;
    for (std::uint8_t i = 0; i < kMaxPlayers; ++i) {
      Player p;
      p.id = i;
      p.name = kPresets[i].name;
      p.color = kPresets[i].color;
      p.avatarIcon = kPresets[i].avatar;
      p.position = 0;
      p.isBot = (i > 0);
      p.connected = false;
      p.totalRolls = 0;
      p.minigameScore = 0;
      p.totalMinigameScore = 0;
      p.skipNextTurn = false;
      p.hasDoubleDice = false;
      players_.push_back(p);
    }
  } else {
    for (auto& p : players_) {
      p.position = 0;
      p.totalRolls = 0;
      p.minigameScore = 0;
      p.totalMinigameScore = 0;
      p.skipNextTurn = false;
      p.hasDoubleDice = false;
    }
    playerCount_ = 2;
  }

  turnOrder_.clear();
  for (std::uint8_t i = 0; i < playerCount_; ++i) {
    turnOrder_.push_back(i);
  }
}

std::uint8_t GameCore::countConnectedHumans() const {
  std::uint8_t count = 0;
  for (std::size_t i = 0; i < players_.size() && i < kMaxPlayers; ++i) {
    if (!players_[i].deviceId.empty() && players_[i].connected && !players_[i].isBot) {
      count++;
    }
  }
  return count;
}

void GameCore::setPlayerCount(std::uint8_t count) {
  if (count < 2) count = 2;
  if (count > kMaxPlayers) count = kMaxPlayers;

  // Tự động đảm bảo số lượng người chơi không nhỏ hơn số người thật đang vào phòng
  std::uint8_t connectedHumans = countConnectedHumans();
  if (count < connectedHumans) {
    count = connectedHumans;
  }
  playerCount_ = count;

  // Với các slot ngoài số người thật thì mặc định là Bot
  for (std::size_t i = 0; i < players_.size(); ++i) {
    if (i < playerCount_) {
      if (players_[i].deviceId.empty() || !players_[i].connected) {
        players_[i].isBot = true;
      }
    }
  }

  turnOrder_.clear();
  for (std::uint8_t i = 0; i < playerCount_; ++i) {
    turnOrder_.push_back(i);
  }
}

const char* GameCore::phaseString() const {
  switch (phase_) {
    case GamePhase::Setup: return "SETUP";
    case GamePhase::WaitingRoll: return "WAITING_ROLL";
    case GamePhase::Moving: return "MOVING";
    case GamePhase::Minigame: return "MINIGAME";
    case GamePhase::GameOver: return "GAME_OVER";
  }
  return "SETUP";
}

int GameCore::findPlayerByClient(std::uint32_t clientId) const {
  if (clientId == 0) return -1;
  for (std::size_t i = 0; i < players_.size(); ++i) {
    if (players_[i].connected && players_[i].clientId == clientId) {
      return static_cast<int>(i);
    }
  }
  return -1;
}

int GameCore::findPlayerByDeviceId(const std::string& deviceId) const {
  if (deviceId.empty()) return -1;
  for (std::size_t i = 0; i < players_.size(); ++i) {
    if (players_[i].deviceId == deviceId) {
      return static_cast<int>(i);
    }
  }
  return -1;
}

bool GameCore::registerPlayer(const std::string& deviceId, std::uint32_t clientId, const std::string& name,
                              const std::string& avatar, const std::string& color, bool isHost) {
  if (deviceId.empty() || clientId == 0) return false;

  int existing = findPlayerByDeviceId(deviceId);
  if (existing >= 0) {
    players_[existing].clientId = clientId;
    players_[existing].connected = true;
    players_[existing].isBot = false;
    if (!name.empty()) players_[existing].name = name;
    if (!avatar.empty()) players_[existing].avatarIcon = avatar;
    if (!color.empty()) players_[existing].color = color;
    std::uint8_t connectedHumans = countConnectedHumans();
    if (playerCount_ < connectedHumans) {
      setPlayerCount(connectedHumans);
    }
    return true;
  }

  // Nếu là máy Host: luôn ưu tiên gán vào slot 0 (Player 1)
  if (isHost) {
    auto& p = players_[0];
    p.deviceId = deviceId;
    p.clientId = clientId;
    p.connected = true;
    p.isBot = false;
    if (!name.empty()) p.name = name;
    if (!avatar.empty()) p.avatarIcon = avatar;
    if (!color.empty()) p.color = color;
    std::uint8_t connectedHumans = countConnectedHumans();
    if (playerCount_ < connectedHumans) {
      setPlayerCount(connectedHumans);
    }
    return true;
  }

  // Nếu là máy khách: tìm slot trống tiếp theo từ slot 1 trở đi (tránh slot 0 của Host)
  for (std::size_t i = 1; i < players_.size() && i < kMaxPlayers; ++i) {
    auto& p = players_[i];
    if (p.deviceId.empty() || p.isBot || !p.connected) {
      p.deviceId = deviceId;
      p.clientId = clientId;
      p.connected = true;
      p.isBot = false;
      if (!name.empty()) p.name = name;
      if (!avatar.empty()) p.avatarIcon = avatar;
      if (!color.empty()) p.color = color;

      // Khi thêm người chơi mới vào: mở rộng nếu số người kết nối thật vượt quá playerCount hiện tại
      std::uint8_t connectedHumans = countConnectedHumans();
      if (playerCount_ < connectedHumans) {
        setPlayerCount(connectedHumans);
      }
      return true;
    }
  }
  return false;
}

bool GameCore::setPlayerInfo(std::uint8_t index, const std::string& name, const std::string& avatar, const std::string& color, bool isBot) {
  if (index >= players_.size()) return false;
  auto& p = players_[index];
  if (!name.empty()) p.name = name;
  if (!avatar.empty()) p.avatarIcon = avatar;
  if (!color.empty()) p.color = color;
  // Chỉ cho phép chỉnh isBot nếu slot đó KHÔNG PHẢI là người thật đang kết nối
  if (p.deviceId.empty() || !p.connected) {
    p.isBot = isBot;
  }
  return true;
}

void GameCore::updatePlayerClient(const std::string& deviceId, std::uint32_t clientId) {
  int idx = findPlayerByDeviceId(deviceId);
  if (idx >= 0) {
    players_[idx].clientId = clientId;
    players_[idx].connected = true;
  }
}

void GameCore::disconnectClient(std::uint32_t clientId) {
  int idx = findPlayerByClient(clientId);
  if (idx >= 0) {
    players_[idx].connected = false;
  }
}

void GameCore::removePlayerByDeviceId(const std::string& deviceId) {
  int idx = findPlayerByDeviceId(deviceId);
  if (idx >= 0) {
    players_[idx].deviceId.clear();
    players_[idx].clientId = 0;
    players_[idx].connected = false;
    players_[idx].isBot = (idx > 0);
  }
}

void GameCore::shuffleTurns() {
  if (turnOrder_.empty()) return;
  for (std::size_t i = turnOrder_.size() - 1; i > 0; --i) {
    std::size_t j = static_cast<std::size_t>(std::rand()) % (i + 1);
    std::swap(turnOrder_[i], turnOrder_[j]);
  }
}

void GameCore::startNewRound(std::uint32_t now) {
  // KHÔNG tráo ngẫu nhiên ở các vòng sau - Giữ nguyên thứ tự lượt đi cố định
  currentTurnIndex_ = 0;
  phase_ = GamePhase::WaitingRoll;
  turnStartTime_ = now;
  lastBotActionTime_ = now;
}

bool GameCore::startGame(std::uint8_t count, const std::vector<bool>& botFlags,
                         const std::vector<std::string>& names, std::uint32_t now,
                         const std::vector<std::string>& avatars, const std::vector<std::string>& colors) {
  if (count < 2) count = 2;
  if (count > kMaxPlayers) count = kMaxPlayers;
  playerCount_ = count;

  turnOrder_.clear();
  for (std::uint8_t i = 0; i < playerCount_; ++i) {
    turnOrder_.push_back(i);
  }

  // CHỈ NGẪU NHIÊN LƯỢT ĐẦU TIÊN (Round 1) khi bắt đầu ván đấu!
  shuffleTurns();

  for (auto& p : players_) {
    p.position = 0;
    p.totalRolls = 0;
    p.minigameScore = 0;
    p.totalMinigameScore = 0;
    p.skipNextTurn = false;
    p.hasDoubleDice = false;
  }

  for (std::uint8_t i = 0; i < playerCount_; ++i) {
    // Đảm bảo slot có người thật kết nối KHÔNG BAO GIỜ bị biến thành bot!
    if (i == 0 || (!players_[i].deviceId.empty() && players_[i].connected)) {
      players_[i].isBot = false;
    } else if (i < botFlags.size()) {
      players_[i].isBot = botFlags[i];
    } else {
      players_[i].isBot = true;
    }
    if (i < names.size() && !names[i].empty()) {
      players_[i].name = names[i];
    }
    if (i < avatars.size() && !avatars[i].empty()) {
      players_[i].avatarIcon = avatars[i];
    }
    if (i < colors.size() && !colors[i].empty()) {
      players_[i].color = colors[i];
    }
  }

  currentRound_ = 1;
  winnerIndex_ = -1;
  startNewRound(now);
  return true;
}

int GameCore::activePlayerIndex() const {
  if (turnOrder_.empty() || currentTurnIndex_ >= turnOrder_.size()) return -1;
  return turnOrder_[currentTurnIndex_];
}

bool GameCore::isBotTurn() const {
  int active = activePlayerIndex();
  if (active < 0 || active >= static_cast<int>(players_.size())) return false;
  return players_[active].isBot;
}

bool GameCore::rollDice(std::uint8_t explicitRoll, std::uint32_t now) {
  if (phase_ != GamePhase::WaitingRoll) return false;

  int active = activePlayerIndex();
  if (active < 0 || active >= static_cast<int>(players_.size())) return false;

  Player& p = players_[active];
  std::uint8_t roll = explicitRoll;
  if (roll < 1 || roll > 6) {
    roll = static_cast<std::uint8_t>((std::rand() % 6) + 1);
  }
  std::uint8_t effectiveSteps = roll;
  if (p.hasDoubleDice) {
    effectiveSteps = roll * 2;
    p.hasDoubleDice = false;
  }
  lastRoll_ = roll;
  p.totalRolls++;

  std::uint8_t initialPos = p.position;
  std::uint8_t landPos = std::min<std::uint8_t>(kBoardLength, initialPos + effectiveSteps);
  std::uint8_t specialTarget = getSpecialPathTarget(landPos);
  bool hasSpecial = (specialTarget != landPos);

  // Vị trí cuối cùng sau khi kết thúc lượt di chuyển
  p.position = specialTarget;
  phase_ = GamePhase::Moving;

  const std::uint32_t stepCount = landPos - initialPos;
  const std::uint32_t rollAndMoveAnimationMs =
      3100 + (stepCount + 1) * 180 + 400 + (hasSpecial ? 1500 : 0);
  moveEndTime_ = now + rollAndMoveAnimationMs;

  if (p.position >= kBoardLength) {
    postMovePhase_ = GamePhase::GameOver;
    winnerIndex_ = active;
  } else {
    // Nếu vẫn còn người chơi trong lượt tung xúc xắc của vòng này:
    if (currentTurnIndex_ + 1 < turnOrder_.size()) {
      postMovePhase_ = GamePhase::WaitingRoll;
    } else {
      // Khi toàn bộ người chơi trong vòng đã tung xúc xắc xong -> Tiến vào Minigame!
      postMovePhase_ = GamePhase::Minigame;
    }
  }

  return true;
}

bool GameCore::activateDoubleDice(std::uint8_t playerIdx) {
  if (phase_ != GamePhase::WaitingRoll ||
      activePlayerIndex() != static_cast<int>(playerIdx) ||
      playerIdx >= players_.size()) {
    return false;
  }
  players_[playerIdx].hasDoubleDice = true;
  return true;
}

void GameCore::nextTurn(std::uint32_t now) {
  if (phase_ == GamePhase::GameOver) return;

  currentTurnIndex_++;
  if (currentTurnIndex_ >= turnOrder_.size()) {
    sortTurnOrderByScores();
    currentRound_++;
    startNewRound(now);
  } else {
    phase_ = GamePhase::WaitingRoll;
    turnStartTime_ = now;
    lastBotActionTime_ = now;
  }
}

bool GameCore::update(std::uint32_t now) {
  if (phase_ == GamePhase::Moving) {
    if (now >= moveEndTime_) {
      if (postMovePhase_ == GamePhase::GameOver) {
        phase_ = GamePhase::GameOver;
        return true;
      } else if (postMovePhase_ == GamePhase::WaitingRoll) {
        currentTurnIndex_++;
        phase_ = GamePhase::WaitingRoll;
        turnStartTime_ = now;
        lastBotActionTime_ = now;
        return true;
      } else {
        phase_ = GamePhase::Minigame;
        minigameStartTime_ = now;
        lastBotActionTime_ = now;
        return true;
      }
    }
    return false;
  }

  if (phase_ == GamePhase::Minigame) {
    // Minigame của vòng được thực hiện tương tác trên web client (Roulette -> Chơi minigame -> Bảng xếp hạng).
    // ESP32 giữ phase = Minigame và chờ client gửi kết quả minigame_finish lên để sang vòng mới.
    // Timeout bảo vệ 120s nếu client ngắt kết nối:
    if (minigameStartTime_ > 0 && now - minigameStartTime_ >= 120000) {
      currentRound_++;
      startNewRound(now);
      return true;
    }
    return false;
  }

  if (phase_ == GamePhase::WaitingRoll && isBotTurn()) {
    if (now - lastBotActionTime_ >= 1400) {
      lastBotActionTime_ = now;
      rollDice(0, now);
      return true;
    }
  }

  return false;
}

void GameCore::setPlayerMinigameScore(std::uint8_t playerIdx, std::uint16_t score) {
  if (playerIdx >= players_.size()) return;
  players_[playerIdx].minigameScore = score;
  players_[playerIdx].totalMinigameScore += score;
}

bool GameCore::advanceRoundWithNewOrder(const std::vector<std::uint8_t>& newOrder, std::uint32_t now) {
  if (!newOrder.empty()) {
    turnOrder_ = newOrder;
  }
  currentRound_++;
  startNewRound(now);
  return true;
}

bool GameCore::submitMinigameScore(std::uint8_t playerIdx, std::uint16_t score, std::uint32_t now) {
  if (playerIdx >= players_.size()) return false;
  players_[playerIdx].minigameScore = score;
  players_[playerIdx].totalMinigameScore += score;

  // Hoàn thành Minigame của vòng này:
  // Sắp xếp lại thứ tự tung xúc xắc cho vòng tiếp theo từ điểm minigame cao nhất đến thấp nhất!
  sortTurnOrderByScores();
  currentRound_++;
  startNewRound(now);
  return true;
}

void GameCore::sortTurnOrderByScores() {
  if (turnOrder_.empty()) return;
  std::stable_sort(turnOrder_.begin(), turnOrder_.end(), [this](std::uint8_t a, std::uint8_t b) {
    if (a >= players_.size() || b >= players_.size()) return false;
    if (players_[a].minigameScore != players_[b].minigameScore) {
      return players_[a].minigameScore > players_[b].minigameScore; // Điểm cao đứng trước
    }
    return a < b;
  });
}