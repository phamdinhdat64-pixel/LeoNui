#pragma once

#include <cstdint>
#include <string>
#include <vector>

enum class GamePhase : std::uint8_t {
  Setup,
  WaitingRoll,
  Moving,
  Minigame,
  GameOver
};

struct Player {
  std::uint8_t id = 0;                  // 0, 1, 2, 3
  std::string name;                     // Tên người chơi
  std::string deviceId;                 // ID thiết bị nếu là người thật
  std::uint32_t clientId = 0;           // WebSocket client ID
  std::string color;                    // Màu nhận diện
  std::string avatarIcon;               // Icon đại diện
  std::uint8_t position = 0;            // Vị trí (0 -> 50)
  bool isBot = false;                   // Điều khiển bởi AI hay người thật
  bool connected = false;               // Trạng thái kết nối
  std::uint16_t totalRolls = 0;         // Tổng số lần tung xúc xắc
  std::uint16_t minigameScore = 0;      // Điểm minigame vòng hiện tại (dùng xếp thứ tự lượt)
  std::uint32_t totalMinigameScore = 0; // Tổng điểm minigame tích lũy
  bool skipNextTurn = false;            // Bị choáng do trúng bom (mất 1 lượt)
  bool hasDoubleDice = false;           // Bùa nhân đôi bước đi
};

class GameCore {
 public:
  static constexpr std::uint8_t kBoardLength = 50;
  static constexpr std::size_t kMaxPlayers = 6;

  // Lối tắt leo núi (17 -> 24, 37 -> 42) và Trượt dốc đá (47 -> 32, 29 -> 11)
  static std::uint8_t getSpecialPathTarget(std::uint8_t pos) {
    switch (pos) {
      case 17: return 24;
      case 37: return 42;
      case 47: return 32;
      case 29: return 11;
      default: return pos;
    }
  }

  GameCore();

  // Khởi động lại trận đấu (giữ nguyên hoặc xóa liên kết thiết bị người chơi)
  void resetGame(bool keepPlayers = true);

  // Quản lý người chơi
  bool registerPlayer(const std::string& deviceId, std::uint32_t clientId, const std::string& name, const std::string& avatar = "", const std::string& color = "", bool isHost = false);
  bool setPlayerInfo(std::uint8_t index, const std::string& name, const std::string& avatar = "", const std::string& color = "", bool isBot = false);
  std::uint8_t countConnectedHumans() const;
  void updatePlayerClient(const std::string& deviceId, std::uint32_t clientId);
  void disconnectClient(std::uint32_t clientId);
  void removePlayerByDeviceId(const std::string& deviceId);
  int findPlayerByClient(std::uint32_t clientId) const;
  int findPlayerByDeviceId(const std::string& deviceId) const;

  // Điều hành trận đấu
  void setPlayerCount(std::uint8_t count);
  bool startGame(std::uint8_t count, const std::vector<bool>& botFlags, const std::vector<std::string>& names, std::uint32_t now = 0,
                 const std::vector<std::string>& avatars = {}, const std::vector<std::string>& colors = {});
  bool rollDice(std::uint8_t explicitRoll = 0, std::uint32_t now = 0);
  void nextTurn(std::uint32_t now = 0);

  // Cập nhật trạng thái theo thời gian (hoạt ảnh chuyển động, bot)
  // Trả về true nếu có sự thay đổi trạng thái cần broadcast
  bool update(std::uint32_t now);

  // Truy vấn trạng thái
  GamePhase phase() const { return phase_; }
  const char* phaseString() const;
  std::uint16_t currentRound() const { return currentRound_; }
  std::uint8_t playerCount() const { return playerCount_; }
  const std::vector<Player>& players() const { return players_; }
  const std::vector<std::uint8_t>& turnOrder() const { return turnOrder_; }
  std::uint8_t currentTurnIndex() const { return currentTurnIndex_; }
  int activePlayerIndex() const;
  std::uint8_t lastRoll() const { return lastRoll_; }
  int winnerIndex() const { return winnerIndex_; }

  // Minigame tính điểm & xếp thứ tự lượt
  bool submitMinigameScore(std::uint8_t playerIdx, std::uint16_t score, std::uint32_t now);
  void setPlayerMinigameScore(std::uint8_t playerIdx, std::uint16_t score);
  bool advanceRoundWithNewOrder(const std::vector<std::uint8_t>& newOrder, std::uint32_t now);
  void sortTurnOrderByScores();

  // Hỗ trợ Bot AI
  bool isBotTurn() const;

 private:
  void startNewRound(std::uint32_t now = 0);
  void shuffleTurns();

  GamePhase phase_ = GamePhase::Setup;
  GamePhase postMovePhase_ = GamePhase::WaitingRoll;
  std::uint16_t currentRound_ = 1;
  std::uint8_t playerCount_ = 2;
  std::vector<Player> players_;
  std::vector<std::uint8_t> turnOrder_;
  std::uint8_t currentTurnIndex_ = 0;
  std::uint8_t lastRoll_ = 0;
  int winnerIndex_ = -1;
  std::uint32_t turnStartTime_ = 0;
  std::uint32_t moveEndTime_ = 0;
  std::uint32_t minigameStartTime_ = 0;
  std::uint32_t lastBotActionTime_ = 0;
};
