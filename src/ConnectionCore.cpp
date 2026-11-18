#include "ConnectionCore.h"

#include <utility>

ConnectionCore::ConnectionCore(std::string bootId)
    : bootId_(std::move(bootId)) {
  devices_.reserve(kMaxDevices);
}

bool ConnectionCore::validDeviceId(const std::string& value) {
  if (value.size() < 23 || value.size() > 71 ||
      value.compare(0, 7, "device-") != 0) {
    return false;
  }
  for (std::size_t i = 7; i < value.size(); ++i) {
    const char c = value[i];
    if (!((c >= '0' && c <= '9') || (c >= 'A' && c <= 'Z') ||
          (c >= 'a' && c <= 'z') || c == '-' || c == '_')) {
      return false;
    }
  }
  return true;
}

bool ConnectionCore::validIpv4(const std::string& value) {
  if (value.size() < 7 || value.size() > 15) return false;
  std::size_t start = 0;
  for (int part = 0; part < 4; ++part) {
    const std::size_t end = value.find('.', start);
    if ((part < 3 && end == std::string::npos) ||
        (part == 3 && end != std::string::npos)) {
      return false;
    }
    const std::size_t stop = part == 3 ? value.size() : end;
    const std::size_t digits = stop - start;
    if (digits == 0 || digits > 3 ||
        (digits > 1 && value[start] == '0')) {
      return false;
    }
    unsigned number = 0;
    for (std::size_t i = start; i < stop; ++i) {
      if (value[i] < '0' || value[i] > '9') return false;
      number = number * 10 + static_cast<unsigned>(value[i] - '0');
    }
    if (number > 255) return false;
    start = stop + 1;
  }
  return true;
}

bool ConnectionCore::validClientIp(const std::string& value) {
  if (!validIpv4(value) || value.compare(0, 10, "192.168.4.") != 0) {
    return false;
  }
  const unsigned last = static_cast<unsigned>(
      std::stoul(value.substr(10)));
  return last >= 2 && last <= 254;
}

DeviceRecord* ConnectionCore::findByClient(std::uint32_t clientId) {
  if (clientId == 0) return nullptr;
  for (auto& device : devices_) {
    if (device.online && device.clientId == clientId) return &device;
  }
  return nullptr;
}

const DeviceRecord* ConnectionCore::byClient(std::uint32_t clientId) const {
  if (clientId == 0) return nullptr;
  for (const auto& device : devices_) {
    if (device.online && device.clientId == clientId) return &device;
  }
  return nullptr;
}

DeviceRecord* ConnectionCore::findByDeviceId(const std::string& deviceId) {
  for (auto& device : devices_) {
    if (device.deviceId == deviceId) return &device;
  }
  return nullptr;
}

Result ConnectionCore::hello(const std::string& deviceId,
                             const std::string& bootId,
                             const std::string& observedIp,
                             std::uint32_t clientId,
                             std::uint32_t now) {
  if (bootId != bootId_) return Result::StaleBoot;
  if (!validDeviceId(deviceId) || !validClientIp(observedIp) || clientId == 0) {
    return Result::Invalid;
  }
  DeviceRecord* bound = findByClient(clientId);
  if (bound && bound->deviceId != deviceId) return Result::Invalid;

  DeviceRecord* device = findByDeviceId(deviceId);
  if (!device) {
    if (devices_.size() >= kMaxDevices) return Result::Full;
    devices_.push_back({deviceId, observedIp, clientId, nextOrder_++, now,
                        true});
    device = &devices_.back();
  } else {
    device->ip = observedIp;
    device->clientId = clientId;
    device->lastActivity = now;
    device->online = true;
  }

  if (host_.deviceId.empty()) {
    host_ = {deviceId, observedIp, clientId, true};
  } else if (host_.deviceId == deviceId) {
    host_.ip = observedIp;
    host_.clientId = clientId;
    host_.online = true;
  }
  return Result::Ok;
}

Result ConnectionCore::claimHost(std::uint32_t clientId,
                                 const std::string& enteredHostIp) {
  DeviceRecord* requester = findByClient(clientId);
  if (!requester) return Result::NotJoined;
  if (!validIpv4(enteredHostIp) || isHost(clientId)) return Result::Invalid;
  if (enteredHostIp != host_.ip) return Result::WrongIp;
  host_ = {requester->deviceId, requester->ip, clientId, true};
  return Result::Ok;
}

void ConnectionCore::disconnect(std::uint32_t clientId) {
  DeviceRecord* device = findByClient(clientId);
  if (!device) return;
  device->online = false;
  device->clientId = 0;
  if (host_.online && host_.clientId == clientId &&
      host_.deviceId == device->deviceId) {
    host_.online = false;
    host_.clientId = 0;
  }
}

void ConnectionCore::touch(std::uint32_t clientId, std::uint32_t now) {
  DeviceRecord* device = findByClient(clientId);
  if (device) device->lastActivity = now;
}

std::vector<std::uint32_t> ConnectionCore::expireStale(
    std::uint32_t now, std::uint32_t timeoutMs) {
  std::vector<std::uint32_t> expired;
  for (auto& device : devices_) {
    if (device.online && now - device.lastActivity > timeoutMs) {
      expired.push_back(device.clientId);
    }
  }
  for (std::uint32_t clientId : expired) disconnect(clientId);
  return expired;
}

bool ConnectionCore::isHost(std::uint32_t clientId) const {
  return clientId != 0 && host_.online && host_.clientId == clientId &&
         byClient(clientId) != nullptr;
}
