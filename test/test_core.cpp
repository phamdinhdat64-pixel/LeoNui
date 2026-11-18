#include "ConnectionCore.h"
#include <cassert>
#include <iostream>
#include <string>

static void firstJoinBecomesHostAndReconnects() {
  ConnectionCore room("boot1");
  const std::string hostId = "device-AAAAAAAAAAAAAAAA";
  const std::string guestId = "device-BBBBBBBBBBBBBBBB";

  assert(room.hello(hostId, "boot1", "192.168.4.2", 1, 100) == Result::Ok);
  assert(room.isHost(1));
  assert(room.host().ip == "192.168.4.2");
  assert(room.hello(guestId, "boot1", "192.168.4.3", 2, 200) == Result::Ok);
  assert(room.devices()[0].order == 1 && room.devices()[1].order == 2);

  room.disconnect(1);
  assert(!room.host().online);
  assert(room.host().deviceId == hostId);
  assert(room.host().ip == "192.168.4.2");
  assert(!room.isHost(2));

  assert(room.hello(hostId, "boot1", "192.168.4.7", 3, 300) == Result::Ok);
  assert(room.isHost(3) && room.host().ip == "192.168.4.7");
  room.disconnect(1);
  assert(room.host().online && room.host().clientId == 3);
  assert(room.devices().size() == 2 && room.devices()[0].order == 1);
}

static void manualTransferUsesCurrentHostIp() {
  ConnectionCore room("boot1");
  const std::string a = "device-AAAAAAAAAAAAAAAA";
  const std::string b = "device-BBBBBBBBBBBBBBBB";
  assert(room.hello(a, "boot1", "192.168.4.2", 1, 0) == Result::Ok);
  assert(room.hello(b, "boot1", "192.168.4.3", 2, 0) == Result::Ok);

  assert(room.claimHost(2, "192.168.4.1") == Result::WrongIp);
  assert(room.claimHost(2, "192.168.4.9") == Result::WrongIp);
  assert(room.claimHost(2, "192.168.4.2") == Result::Ok);
  assert(!room.isHost(1) && room.isHost(2));
  assert(room.host().deviceId == b && room.host().ip == "192.168.4.3");

  room.disconnect(2);
  assert(!room.host().online && room.host().deviceId == b);
  assert(room.claimHost(1, "192.168.4.3") == Result::Ok);
  assert(room.isHost(1) && room.host().ip == "192.168.4.2");
}

static void rebootStartsAnEmptySession() {
  ConnectionCore oldRoom("boot1");
  assert(oldRoom.hello("device-AAAAAAAAAAAAAAAA", "boot1",
                       "192.168.4.2", 1, 0) == Result::Ok);

  ConnectionCore newRoom("boot2");
  assert(newRoom.hello("device-AAAAAAAAAAAAAAAA", "boot1",
                       "192.168.4.2", 1, 0) == Result::StaleBoot);
  assert(newRoom.hello("device-AAAAAAAAAAAAAAAA", "boot2",
                       "192.168.4.1", 1, 0) == Result::Invalid);
  assert(newRoom.host().deviceId.empty());
  assert(newRoom.hello("device-BBBBBBBBBBBBBBBB", "boot2",
                       "192.168.4.3", 2, 0) == Result::Ok);
  assert(newRoom.isHost(2));
  assert(newRoom.devices().size() == 1);
}

static void replacedSocketCannotDisconnectCurrentHost() {
  ConnectionCore room("boot1");
  const std::string hostId = "device-AAAAAAAAAAAAAAAA";
  assert(room.hello(hostId, "boot1", "192.168.4.2", 1, 0) == Result::Ok);
  assert(room.hello(hostId, "boot1", "192.168.4.8", 3, 10) == Result::Ok);
  assert(!room.isHost(1) && room.isHost(3));
  room.disconnect(1);
  assert(room.host().online && room.host().clientId == 3);
}

static void oneSocketCannotUseTwoIdentities() {
  ConnectionCore room("boot1");
  assert(room.hello("device-AAAAAAAAAAAAAAAA", "boot1",
                    "192.168.4.2", 1, 0) == Result::Ok);
  assert(room.hello("device-BBBBBBBBBBBBBBBB", "boot1",
                    "192.168.4.2", 1, 1) == Result::Invalid);
  assert(room.devices().size() == 1 && room.isHost(1));
}

static void roomHasAnOnlineDeviceLimit() {
  ConnectionCore room("boot1");
  assert(room.hello("device-AAAAAAAAAAAAAAAA", "boot1",
                    "192.168.4.2", 1, 0) == Result::Ok);
  for (int i = 2; i <= 13; ++i) {
    const std::string id = "device-" + std::string(16, static_cast<char>('A' + i));
    const Result expected = i <= 12 ? Result::Ok : Result::Full;
    assert(room.hello(id, "boot1", "192.168.4.3", i, 0) == expected);
  }
}

static void strictIpAndOfflineHostTransfer() {
  assert(!ConnectionCore::validIpv4("192.168.4.2."));
  assert(!ConnectionCore::validIpv4("192.168.4.01"));
  assert(!ConnectionCore::validIpv4("999.168.4.2"));
  assert(ConnectionCore::validIpv4("192.168.4.254"));

  ConnectionCore room("boot1");
  assert(room.hello("device-AAAAAAAAAAAAAAAA", "boot1",
                    "192.168.4.2", 1, 0) == Result::Ok);
  assert(room.hello("device-BBBBBBBBBBBBBBBB", "boot1",
                    "192.168.4.3", 2, 0) == Result::Ok);
  room.disconnect(1);
  assert(!room.host().online);
  assert(room.claimHost(2, "192.168.4.2.") == Result::Invalid);
  assert(room.claimHost(2, "192.168.4.2") == Result::Ok);
  assert(room.isHost(2));
}

static void heartbeatExpiryKeepsHostAssigned() {
  ConnectionCore room("boot1");
  assert(room.hello("device-AAAAAAAAAAAAAAAA", "boot1",
                    "192.168.4.2", 1, 0) == Result::Ok);
  assert(room.hello("device-BBBBBBBBBBBBBBBB", "boot1",
                    "192.168.4.3", 2, 0) == Result::Ok);
  room.touch(2, 5000);
  assert(room.expireStale(9999, 10000).empty());
  const auto expired = room.expireStale(10001, 10000);
  assert(expired.size() == 1 && expired[0] == 1);
  assert(!room.host().online);
  assert(room.host().deviceId == "device-AAAAAAAAAAAAAAAA");
  assert(room.byClient(2) != nullptr && !room.isHost(2));
  assert(room.hello("device-AAAAAAAAAAAAAAAA", "boot1",
                    "192.168.4.9", 3, 10002) == Result::Ok);
  room.disconnect(1);
  assert(room.isHost(3));
}

static void oldSocketCannotActAfterReplacementOrTransfer() {
  ConnectionCore room("boot1");
  assert(room.hello("device-AAAAAAAAAAAAAAAA", "boot1",
                    "192.168.4.2", 1, 0) == Result::Ok);
  assert(room.hello("device-BBBBBBBBBBBBBBBB", "boot1",
                    "192.168.4.3", 2, 0) == Result::Ok);
  assert(room.hello("device-AAAAAAAAAAAAAAAA", "boot1",
                    "192.168.4.7", 3, 1) == Result::Ok);
  assert(room.claimHost(2, "192.168.4.2") == Result::WrongIp);
  assert(room.claimHost(2, "192.168.4.7") == Result::Ok);
  assert(!room.isHost(1) && !room.isHost(3) && room.isHost(2));
  assert(room.claimHost(1, "192.168.4.3") == Result::NotJoined);
  assert(room.claimHost(3, "192.168.4.7") == Result::WrongIp);
}

static void invalidIdentityAndIpDoNotOccupyHost() {
  ConnectionCore room("boot1");
  assert(room.hello("", "boot1", "192.168.4.2", 1, 0) == Result::Invalid);
  assert(room.hello("device-AAAAAAAAAAAAAAAA", "boot1",
                    "192.168.4.1", 1, 0) == Result::Invalid);
  assert(room.hello("device-AAAAAAAAAAAAAAAA", "boot1",
                    "192.168.4.255", 1, 0) == Result::Invalid);
  assert(room.host().deviceId.empty() && room.devices().empty());
}

int main() {
  firstJoinBecomesHostAndReconnects();
  manualTransferUsesCurrentHostIp();
  rebootStartsAnEmptySession();
  replacedSocketCannotDisconnectCurrentHost();
  oneSocketCannotUseTwoIdentities();
  roomHasAnOnlineDeviceLimit();
  strictIpAndOfflineHostTransfer();
  heartbeatExpiryKeepsHostAssigned();
  oldSocketCannotActAfterReplacementOrTransfer();
  invalidIdentityAndIpDoNotOccupyHost();
  std::cout << "connection core tests passed\n";
}
