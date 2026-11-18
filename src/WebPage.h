#pragma once

#include <Arduino.h>

const char WEB_PAGE[] PROGMEM = R"HTML(
<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BOARD GAME · Kết nối</title>
  <style>
    :root { color-scheme: light; font-family: system-ui, -apple-system, sans-serif; background: #f4f7fa; color: #122333; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 20px; }
    main { width: min(100%, 460px); }
    h1 { font-size: 1.7rem; margin: 0 0 8px; line-height: 1.2; }
    h2 { font-size: 1.15rem; margin: 0 0 12px; }
    p { line-height: 1.5; }
    .muted { color: #53697c; }
    .card { background: white; border: 1px solid #dce5ec; border-radius: 18px; box-shadow: 0 12px 32px #24465b12; padding: 22px; margin: 16px 0; }
    .hidden { display: none !important; }
    .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .spread { justify-content: space-between; }
    button { border: 0; border-radius: 10px; padding: 12px 16px; min-height: 44px; font: inherit; font-weight: 650; background: #0767ad; color: white; cursor: pointer; }
    button.secondary { background: #e8f0f7; color: #164b72; }
    button:disabled { opacity: .55; cursor: default; }
    label { display: block; font-weight: 600; margin: 14px 0 6px; }
    input { width: 100%; padding: 12px; min-height: 44px; font: inherit; border: 1px solid #9fb5c6; border-radius: 10px; }
    .value { font-size: 1.3rem; font-weight: 750; color: #075b99; overflow-wrap: anywhere; }
    .status { min-height: 1.5em; color: #395a6e; }
    .game-link { display: inline-block; margin-top: 8px; padding: 12px 16px; border-radius: 10px; background: #0767ad; color: white; font-weight: 650; text-decoration: none; }
  </style>
</head>
<body>
<main>
  <header>
    <h1>BOARD GAME</h1>
    <p class="muted">Phòng kết nối trong mạng Wi-Fi của ESP32</p>
  </header>
  <section class="card" id="entry">
    <h2>Vào trò chơi</h2>
    <p>Thiết bị đầu tiên bấm vào trong phiên này sẽ nhận quyền Host.</p>
    <button id="joinBtn" type="button">Vào trò chơi</button>
  </section>
  <section class="card hidden" id="room">
    <div class="row spread"><h2>Đã vào phòng</h2><button id="settingsBtn" class="secondary" type="button">Cài đặt</button></div>
    <p>Vai trò: <strong id="role">Đang xác nhận vai trò</strong></p>
    <p id="roomInfo" class="muted"></p>
    <p id="hostStatus" class="muted"></p>
    <a id="gameLink" class="game-link hidden" href="/game/">Mở trò chơi (Bàn cờ Đỉnh Bàn Cờ)</a>
    <p class="muted">Game đã được kết nối và đồng bộ trực tiếp qua ESP32. Host quan sát bàn cờ và điều hành, các thiết bị sau là Người chơi.</p>
  </section>
  <section class="card hidden" id="settings">
    <div class="row spread"><h2>Cài đặt</h2><button id="closeSettingsBtn" class="secondary" type="button">Đóng</button></div>
    <p id="settingsHint" class="muted">Vào trò chơi để xem quyền của thiết bị.</p>
    <div id="hostSettings" class="hidden">
      <p>IP thiết bị Host:</p>
      <p id="hostIp" class="value"></p>
      <p class="muted">Bạn có thể đọc hoặc chia sẻ IP này cho thiết bị muốn nhận quyền Host.</p>
    </div>
    <div id="guestSettings" class="hidden">
      <label for="hostIpInput">Nhập IP Host để đổi Host</label>
      <input id="hostIpInput" type="text" inputmode="decimal" maxlength="15" autocomplete="off" placeholder="192.168.4.x">
      <p><button id="claimBtn" type="button">Xác nhận đổi Host</button></p>
    </div>
  </section>
  <p id="connectionStatus" class="status" aria-live="polite">Đang kết nối ESP32…</p>
  <p class="muted">Nếu trang không tự mở, truy cập http://192.168.4.1/.</p>
</main>
<script>
(() => {
  const byId = id => document.getElementById(id);
  const entry = byId('entry');
  const room = byId('room');
  const gameLink = byId('gameLink');
  const settings = byId('settings');
  const hostSettings = byId('hostSettings');
  const guestSettings = byId('guestSettings');
  const roleText = byId('role');
  const hostIpText = byId('hostIp');
  const roomInfo = byId('roomInfo');
  const hostStatus = byId('hostStatus');
  const connectionStatus = byId('connectionStatus');
  const settingsHint = byId('settingsHint');
  const storageKey = 'frameworkDeviceId';
  const joinedKey = 'frameworkJoinedBoot';

  let socket = null;
  let bootId = null;
  let joined = false;
  let joinRequested = false;
  let role = 'UNKNOWN';
  let hostIp = '';
  let lastPong = 0;
  let reconnectTimer = null;
  let onlineCount = 0;
  let deviceCount = 0;
  let hostOnline = false;
  let cachedDeviceId = null;

  function readJoinedBoot() {
    try { return sessionStorage.getItem(joinedKey); } catch (_) { return null; }
  }
  function saveJoinedBoot(value) {
    try { sessionStorage.setItem(joinedKey, value); } catch (_) {}
  }
  function clearJoinedBoot() {
    try { sessionStorage.removeItem(joinedKey); } catch (_) {}
  }
  function deviceId() {
    if (cachedDeviceId) return cachedDeviceId;
    let value = null;
    try { value = localStorage.getItem(storageKey); } catch (_) {}
    if (/^device-[A-Za-z0-9_-]{16,64}$/.test(value || '')) {
      cachedDeviceId = value;
      return value;
    }
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    value = 'device-' + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem(storageKey, value); } catch (_) {}
    cachedDeviceId = value;
    return value;
  }
  function render() {
    entry.classList.toggle('hidden', joined);
    room.classList.toggle('hidden', !joined);
    gameLink.classList.toggle('hidden', !joined);
    hostSettings.classList.toggle('hidden', !joined || role !== 'HOST');
    guestSettings.classList.toggle('hidden', !joined || role !== 'GUEST');
    settingsHint.classList.toggle('hidden', joined);
    roleText.textContent = !joined ? 'Đang xác nhận vai trò' : role === 'HOST' ? 'Host' : 'Khách';
    hostIpText.textContent = joined && role === 'HOST' ? hostIp : '';
    roomInfo.textContent = `${onlineCount} thiết bị đang online · ${deviceCount} thiết bị đã vào phòng`;
    hostStatus.textContent = joined ? `Host ${hostOnline ? 'đang online' : 'đang offline'}` : '';
  }
  function resetForNewBoot() {
    joined = false;
    role = 'UNKNOWN';
    hostIp = '';
    onlineCount = 0;
    deviceCount = 0;
    hostOnline = false;
    clearJoinedBoot();
    render();
  }
  function sendHello() {
    if (!socket || socket.readyState !== WebSocket.OPEN || !bootId) return;
    socket.send(JSON.stringify({t: 'hello', deviceId: deviceId(), bootId}));
    connectionStatus.textContent = 'Đang xác nhận vai trò…';
  }
  function receiveSession(nextBoot) {
    if (typeof nextBoot !== 'string' || !nextBoot) return;
    const previous = bootId || readJoinedBoot();
    const resume = previous === nextBoot && (joined || readJoinedBoot() === nextBoot);
    if (previous && previous !== nextBoot) joinRequested = false;
    if (previous !== nextBoot) resetForNewBoot();
    bootId = nextBoot;
    if (resume || joinRequested) sendHello();
    else connectionStatus.textContent = 'Đã kết nối ESP32. Bấm Vào trò chơi để tham gia.';
  }
  function receiveIdentity(message) {
    if (message.bootId !== bootId || (message.role !== 'HOST' && message.role !== 'GUEST')) return;
    joined = true;
    joinRequested = false;
    role = message.role === 'HOST' && message.host === true ? 'HOST' : 'GUEST';
    hostIp = role === 'HOST' && typeof message.hostIp === 'string' ? message.hostIp : '';
    saveJoinedBoot(bootId);
    connectionStatus.textContent = 'Đã kết nối ESP32.';
    render();
  }
  function receiveError(message) {
    if (message.code === 'STALE_BOOT') {
      resetForNewBoot();
      joinRequested = false;
      if (typeof message.bootId === 'string') bootId = message.bootId;
    }
    const descriptions = {
      INVALID_JSON: 'Gói dữ liệu không hợp lệ.',
      INVALID_MESSAGE: 'Nội dung gửi lên không hợp lệ.',
      STALE_BOOT: 'ESP32 đã khởi động lại. Hãy bấm Vào trò chơi.',
      ROOM_FULL: 'Phòng đã đủ thiết bị trong phiên này.',
      NOT_JOINED: 'Hãy vào trò chơi trước.',
      WRONG_IP: 'IP Host không đúng hoặc đã đổi.',
      UNKNOWN_TYPE: 'Lệnh không được hỗ trợ.',
    };
    connectionStatus.textContent = descriptions[message.code] || 'Có lỗi kết nối.';
  }
  function connect() {
    const ws = new WebSocket(`ws://${location.host}/ws`);
    socket = ws;
    ws.onopen = () => {
      if (socket !== ws) return;
      lastPong = Date.now();
      connectionStatus.textContent = 'Đã nối WebSocket, đang chờ phiên…';
    };
    ws.onmessage = event => {
      if (socket !== ws) return;
      let message;
      try { message = JSON.parse(event.data); } catch (_) { return; }
      if (!message || typeof message !== 'object') return;
      if (message.t === 'session') receiveSession(message.bootId);
      else if (message.t === 'identity') receiveIdentity(message);
      else if (message.t === 'state' && message.bootId === bootId) {
        onlineCount = Number(message.onlineCount) || 0;
        deviceCount = Number(message.deviceCount) || 0;
        hostOnline = message.hostOnline === true;
        render();
      } else if (message.t === 'pong') lastPong = Date.now();
      else if (message.t === 'error') receiveError(message);
    };
    ws.onclose = () => {
      if (socket !== ws) return;
      socket = null;
      connectionStatus.textContent = 'Mất kết nối ESP32. Đang nối lại…';
      if (reconnectTimer === null) {
        reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, 1000);
      }
    };
    ws.onerror = () => { if (socket === ws) ws.close(); };
  }

  byId('joinBtn').onclick = () => {
    joinRequested = true;
    sendHello();
  };
  byId('settingsBtn').onclick = () => settings.classList.remove('hidden');
  byId('closeSettingsBtn').onclick = () => settings.classList.add('hidden');
  byId('claimBtn').onclick = () => {
    if (!joined || role !== 'GUEST' || !socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({t: 'claim_host', hostIp: byId('hostIpInput').value.trim()}));
  };
  if (location.pathname === '/host') settings.classList.remove('hidden');
  render();
  setInterval(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (Date.now() - lastPong > 7000) { socket.close(); return; }
    socket.send(JSON.stringify({t: 'ping'}));
  }, 2000);
  connect();
})();
</script>
</body>
</html>
)HTML";
