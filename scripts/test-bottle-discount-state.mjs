import assert from 'node:assert/strict';
import {test, afterEach} from 'node:test';

const key = 'double-bottle:discount:3:v2';
const legacy = 'double-bottle:discount:3:v1';
let moduleId = 0;
const fresh = () => import(`../lib/public/bottle-discount-state.ts?test=${++moduleId}`);
class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}
function browser(localStorage = new MemoryStorage(), sessionStorage = new MemoryStorage()) {
  const window = new EventTarget();
  Object.assign(window, {localStorage, sessionStorage});
  globalThis.window = window;
  return window;
}
function storageEvent(window, key) {
  const event = new Event('storage');
  Object.defineProperty(event, 'key', {value: key});
  window.dispatchEvent(event);
}
const blocked = {
  getItem() { throw new Error('Storage blocked'); },
  setItem() { throw new Error('Quota or storage blocked'); },
  removeItem() { throw new Error('Storage blocked'); },
};
afterEach(() => { delete globalThis.window; });

test('server snapshot is stable and never touches browser storage', async () => {
  const state = await fresh();
  assert.equal(state.bottleDiscountSnapshot(), false);
  assert.doesNotThrow(() => state.activateBottleDiscount());
  assert.doesNotThrow(() => state.subscribeBottleDiscount(() => {})());
  assert.equal(state.bottleDiscountSnapshot(), false);
});

test('one discovery persists the same fixed award across reload/new tab session', async () => {
  const window = browser();
  const state = await fresh();
  assert.equal(state.bottleDiscountSnapshot(), false);
  let notifications = 0;
  const unsubscribe = state.subscribeBottleDiscount(() => notifications++);
  state.activateBottleDiscount();
  assert.equal(state.bottleDiscountSnapshot(), true);
  const award = window.localStorage.getItem(key);
  assert.deepEqual(JSON.parse(award), {version: 2, active: true});
  assert.equal(window.sessionStorage.getItem(legacy), null);
  state.activateBottleDiscount();
  assert.equal(window.localStorage.getItem(key), award);
  assert.equal(notifications, 2);
  unsubscribe();
  state.activateBottleDiscount();
  assert.equal(notifications, 2);
  browser(window.localStorage); // A fresh page module and tab session.
  assert.equal((await fresh()).bottleDiscountSnapshot(), true);
});

test('old tab discovery is migrated without another click and obsolete marker removed', async () => {
  const window = browser();
  window.sessionStorage.setItem(legacy, 'active');
  const state = await fresh();
  assert.equal(state.bottleDiscountSnapshot(), true);
  state.subscribeBottleDiscount(() => {})();
  assert.deepEqual(JSON.parse(window.localStorage.getItem(key)), {version: 2, active: true});
  assert.equal(window.sessionStorage.getItem(legacy), null);
  browser(window.localStorage);
  assert.equal((await fresh()).bottleDiscountSnapshot(), true);
});

test('malformed, obsolete and inactive records do not activate the estimate', async () => {
  const window = browser();
  const state = await fresh();
  for (const value of ['invalid JSON', 'active', 'null', 'true', '[]', '{}', '{"version":1,"active":true}', '{"version":2,"active":false}', '{"version":2,"active":"true"}']) {
    window.localStorage.setItem(key, value);
    assert.equal(state.bottleDiscountSnapshot(), false, value);
  }
  assert.doesNotThrow(() => state.activateBottleDiscount());
  assert.equal(state.bottleDiscountSnapshot(), true);
});

test('blocked persistent storage retains previous session fallback across reload', async () => {
  const window = browser(blocked);
  const state = await fresh();
  state.activateBottleDiscount();
  assert.equal(state.bottleDiscountSnapshot(), true);
  assert.equal(window.sessionStorage.getItem(legacy), 'active');
  browser(blocked, window.sessionStorage);
  assert.equal((await fresh()).bottleDiscountSnapshot(), true);
});

test('unavailable storage getters and writes cannot break discovery on this page', async () => {
  const window = browser(blocked, blocked);
  for (const name of ['localStorage', 'sessionStorage']) {
    Object.defineProperty(window, name, {get() { throw new Error('SecurityError'); }});
  }
  const state = await fresh();
  assert.equal(state.bottleDiscountSnapshot(), false);
  assert.doesNotThrow(() => state.subscribeBottleDiscount(() => {})());
  assert.doesNotThrow(() => state.activateBottleDiscount());
  assert.equal(state.bottleDiscountSnapshot(), true);
});

test('other-tab award, removal and clear are reflected, unrelated keys are ignored', async () => {
  const window = browser();
  const state = await fresh();
  let notifications = 0;
  const unsubscribe = state.subscribeBottleDiscount(() => notifications++);
  window.localStorage.setItem(key, '{"version":2,"active":true}');
  storageEvent(window, key);
  assert.equal(state.bottleDiscountSnapshot(), true);
  storageEvent(window, 'unrelated');
  assert.equal(notifications, 1);
  state.activateBottleDiscount();
  window.localStorage.removeItem(key);
  storageEvent(window, key);
  assert.equal(state.bottleDiscountSnapshot(), false);
  state.activateBottleDiscount();
  window.localStorage.values.clear();
  storageEvent(window, null);
  assert.equal(state.bottleDiscountSnapshot(), false);
  unsubscribe();
  const before = notifications;
  storageEvent(window, key);
  assert.equal(notifications, before);
});
