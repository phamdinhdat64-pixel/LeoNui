const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const header = fs.readFileSync(path.join(__dirname, '..', 'src', 'WebPage.h'), 'utf8');
const script = header.match(/<script>([\s\S]*?)<\/script>/)[1];
const htmlIds = new Set([...header.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
new vm.Script(script);

function createPage(pathname = '/', storageBlocked = false) {
  const elements = new Map();
  const sockets = [];
  const timeouts = [];
  const intervals = [];
  const local = new Map();
  const session = new Map();
  let randomByte = 6;
  let now = 1000;
  function element(id = '') {
    const initiallyHidden = ['settings', 'room', 'gameLink', 'hostSettings', 'guestSettings'].includes(id);
    const classes = new Set(initiallyHidden ? ['hidden'] : []);
    return {
      id,
      classList: {
        add: c => classes.add(c),
        remove: c => classes.delete(c),
        toggle: (c, force) => force ? classes.add(c) : classes.delete(c),
        contains: c => classes.has(c),
      },
      textContent: '',
      disabled: false,
      checked: false,
      value: '',
      replaceChildren() {},
      appendChild() {},
      onclick: null,
    };
  }
  class WebSocketMock {
    static OPEN = 1;
    constructor(url) { this.url = url; this.readyState = 0; this.sent = []; sockets.push(this); }
    send(data) { this.sent.push(JSON.parse(data)); }
    close() { this.readyState = 3; this.onclose?.(); }
  }
  class CustomEventMock {
    constructor(type, options) { this.type = type; this.detail = options?.detail; }
  }
  const context = {
    document: {
      getElementById(id) {
        if (!htmlIds.has(id)) return null;
        if (!elements.has(id)) elements.set(id, element(id));
        return elements.get(id);
      },
      createElement: () => element(),
    },
    window: {
      crypto: {getRandomValues(bytes) { bytes.fill(++randomByte); }},
      dispatchEvent() {},
    },
    crypto: {getRandomValues(bytes) { bytes.fill(++randomByte); }},
    location: {host: '192.168.4.1', pathname},
    WebSocket: WebSocketMock,
    CustomEvent: CustomEventMock,
    localStorage: {
      getItem(k) { if (storageBlocked) throw Error('blocked'); return local.get(k) ?? null; },
      setItem(k, v) { if (storageBlocked) throw Error('blocked'); local.set(k, v); },
    },
    sessionStorage: {
      getItem: k => session.get(k) ?? null,
      setItem: (k, v) => session.set(k, v),
      removeItem: k => session.delete(k),
    },
    setInterval(cb) { intervals.push(cb); },
    setTimeout(cb) { timeouts.push(cb); return timeouts.length; },
    clearTimeout() {},
    Uint8Array,
    Date: {now: () => now},
    Math,
    JSON,
  };
  vm.runInNewContext(script, context);
  const get = id => context.document.getElementById(id);
  const open = ws => { ws.readyState = 1; ws.onopen(); };
  const deliver = (ws, message) => ws.onmessage({data: JSON.stringify(message)});
  const reconnect = ws => { ws.close(); timeouts.shift()(); return sockets.at(-1); };
  const tick = milliseconds => { now += milliseconds; intervals.forEach(callback => callback()); };
  return {get, sockets, local, session, open, deliver, reconnect, tick, context};
}

{
  const page = createPage('/', true);
  const first = page.sockets[0];
  page.open(first);
  page.deliver(first, {t: 'session', bootId: 'boot-1'});
  page.get('joinBtn').onclick();
  const originalDeviceId = first.sent[0].deviceId;
  page.deliver(first, {t: 'identity', role: 'HOST', host: true, hostIp: '192.168.4.2', bootId: 'boot-1'});
  const second = page.reconnect(first);
  page.open(second);
  page.deliver(second, {t: 'session', bootId: 'boot-1'});
  assert.equal(second.sent[0].deviceId, originalDeviceId, 'a live tab keeps its ID when storage is unavailable');
}

{
  const page = createPage();
  const ws = page.sockets[0];
  page.open(ws);
  page.deliver(ws, {t: 'session', bootId: 'boot-1'});
  page.tick(2000);
  assert.equal(ws.sent.at(-1).t, 'ping');
  page.deliver(ws, {t: 'pong', bootId: 'boot-1'});
  page.tick(6000);
  assert.equal(ws.readyState, 1, 'recent pong keeps the socket open');
  page.tick(2000);
  assert.equal(ws.readyState, 3, 'missing pong closes the stale socket');
}

{
  const page = createPage();
  const first = page.sockets[0];
  page.open(first);
  page.deliver(first, {t: 'session', bootId: 'boot-1'});
  assert.equal(first.sent.length, 0, 'opening the page does not enter the room');
  page.get('joinBtn').onclick();
  assert.equal(first.sent[0].t, 'hello');
  assert.equal(first.sent[0].bootId, 'boot-1');
  assert.equal(first.sent[0].deviceId, page.local.get('frameworkDeviceId'));
  page.deliver(first, {t: 'identity', role: 'HOST', host: true, hostIp: '192.168.4.2', bootId: 'boot-1'});
  assert.equal(page.get('hostIp').textContent, '192.168.4.2');
  assert.equal(page.get('hostSettings').classList.contains('hidden'), false);
  assert.equal(page.get('gameLink').classList.contains('hidden'), false);
  page.deliver(first, {t: 'identity', role: 'GUEST', host: false, bootId: 'boot-1'});
  assert.equal(page.get('hostIp').textContent, '', 'Guest cannot see the previous Host IP');
  assert.equal(page.get('hostSettings').classList.contains('hidden'), true);
  page.deliver(first, {t: 'identity', role: 'HOST', host: true, hostIp: '192.168.4.2', bootId: 'boot-1'});
  const second = page.reconnect(first);
  page.open(second);
  page.deliver(second, {t: 'session', bootId: 'boot-1'});
  assert.equal(second.sent[0].t, 'hello', 'same boot reconnects with the same deviceId');
  const third = page.reconnect(second);
  page.open(third);
  page.deliver(third, {t: 'session', bootId: 'boot-2'});
  assert.equal(third.sent.length, 0, 'new boot waits for an explicit click');
  assert.equal(page.session.has('frameworkJoinedBoot'), false);
  assert.equal(page.get('role').textContent, 'Đang xác nhận vai trò');
  assert.equal(page.get('hostIp').textContent, '');
  assert.equal(page.get('entry').classList.contains('hidden'), false);
  page.get('joinBtn').onclick();
  assert.equal(third.sent[0].bootId, 'boot-2');
}

{
  const page = createPage();
  const first = page.sockets[0];
  page.open(first);
  page.deliver(first, {t: 'session', bootId: 'boot-1'});
  page.get('joinBtn').onclick();
  assert.equal(first.sent.length, 1);
  const second = page.reconnect(first);
  page.open(second);
  page.deliver(second, {t: 'session', bootId: 'boot-2'});
  assert.equal(second.sent.length, 0, 'a click from the previous boot cannot enter a new boot');
  assert.equal(page.get('entry').classList.contains('hidden'), false);
}

{
  const page = createPage('/host');
  const ws = page.sockets[0];
  page.open(ws);
  page.deliver(ws, {t: 'session', bootId: 'boot-1'});
  assert.equal(page.get('settings').classList.contains('hidden'), false);
  assert.equal(ws.sent.length, 0, '/host does not enter the room automatically');
}

{
  const page = createPage();
  const ws = page.sockets[0];
  page.open(ws);
  page.deliver(ws, {t: 'session', bootId: 'boot-1'});
  page.get('joinBtn').onclick();
  page.deliver(ws, {t: 'identity', role: 'GUEST', host: false, bootId: 'boot-1'});
  page.get('hostIpInput').value = '192.168.4.2';
  page.get('claimBtn').onclick();
  assert.deepEqual(ws.sent.at(-1), {t: 'claim_host', hostIp: '192.168.4.2'});
  page.deliver(ws, {t: 'error', code: 'WRONG_IP', bootId: 'boot-1'});
  assert.equal(page.get('role').textContent, 'Khách');
  page.deliver(ws, {t: 'identity', role: 'HOST', host: true, hostIp: '192.168.4.3', bootId: 'boot-1'});
  assert.equal(page.get('hostIp').textContent, '192.168.4.3');
  assert.equal(page.get('guestSettings').classList.contains('hidden'), true);
}

console.log('web connection tests passed');
