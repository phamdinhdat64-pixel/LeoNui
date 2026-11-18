#pragma once

#include <cstdint>
#include <string>
#include <vector>

enum class Result {
  Ok,
  Invalid,
  StaleBoot,
  Full,
  NotJoined,
  WrongIp,
};

struct DeviceRecord {
  std::string deviceId;
  std::string ip;
  std::uint32_t clientId = 0;
  std::uint32_t order = 0;
  std::uint32_t lastActivity = 0;
  bool online = false;
};

struct HostRecord {
  std::string deviceId;
  std::string ip;
  std::uint32_t clientId = 0;
  bool online = false;
};

class ConnectionCore {
 public:
  explicit ConnectionCore(std::string bootId);

  Result hello(const std::string& deviceId, const std::string& bootId,
               const std::string& observedIp, std::uint32_t clientId,
               std::uint32_t now);
  Result claimHost(std::uint32_t clientId, const std::string& enteredHostIp);
  void disconnect(std::uint32_t clientId);
  void touch(std::uint32_t clientId, std::uint32_t now);
  std::vector<std::uint32_t> expireStale(std::uint32_t now,
                                         std::uint32_t timeoutMs);

  bool isHost(std::uint32_t clientId) const;
  const DeviceRecord* byClient(std::uint32_t clientId) const;
  const std::vector<DeviceRecord>& devices() const { return devices_; }
  const HostRecord& host() const { return host_; }
  const std::string& bootId() const { return bootId_; }

  static bool validIpv4(const std::string& value);

 private:
  static bool validDeviceId(const std::string& value);
  static bool validClientIp(const std::string& value);
  DeviceRecord* findByClient(std::uint32_t clientId);
  DeviceRecord* findByDeviceId(const std::string& deviceId);

  static constexpr std::size_t kMaxDevices = 12;
  std::string bootId_;
  std::vector<DeviceRecord> devices_;
  HostRecord host_;
  std::uint32_t nextOrder_ = 1;
};
