import test from 'node:test';
import assert from 'node:assert/strict';
import { setupNotificationControls } from '../notification-controls.mjs';

async function controls(initial = { enabled: true, accessGranted: false, connected: false }) {
  const nodes = new Map(), events = {}, calls = [];
  let status = initial, result = null;
  const document = { getElementById(id) {
    if (!nodes.has(id)) nodes.set(id, { hidden: true, textContent: '', disabled: false, handlers: {}, addEventListener(event, fn) { this.handlers[event] = fn; } });
    return nodes.get(id);
  } };
  const access = {
    getStatus: async () => status,
    getLastResult: async () => ({ result }),
    setEnabled: async ({ enabled }) => { calls.push(enabled); status = { ...status, enabled }; if (!enabled) result = null; },
    openSettings: async () => { calls.push('settings'); },
    addListener: async (event, fn) => { events[event] = fn; },
  };
  await setupNotificationControls(access, { addListener: async (event, fn) => { events[event] = fn; } }, document);
  return { node: id => document.getElementById(id), events, calls, access,
    status: value => { status = value; }, result: value => { result = value; } };
}

test('enabling opens Android settings without assuming that access was granted', async () => {
  const c = await controls();
  await c.node('notification-toggle').handlers.click();
  assert.deepEqual(c.calls, [true, 'settings']);
  assert.match(c.node('notification-status').textContent, /access required/);
  c.status({ enabled: true, accessGranted: true, connected: true });
  await c.events.resume();
  assert.equal(c.node('notification-toggle').textContent, 'Turn off');
  assert.match(c.node('notification-status').textContent, /Listening/);
});

test('live parse previews are text and turning off clears them', async () => {
  const c = await controls({ enabled: true, accessGranted: true, connected: true });
  c.result({ status: 'parsed', importStatus: 'saved', merchant: '<Shop>', currency: 'EUR', cents: 350, category: 'Uncategorized' });
  await c.events.notificationParsed();
  assert.equal(c.node('notification-preview').textContent, 'Purchase saved: <Shop> · €3.50 · Uncategorized.');
  await c.node('notification-toggle').handlers.click();
  assert.deepEqual(c.calls, [false]);
  assert.equal(c.node('notification-status').textContent, 'Off');
  assert.match(c.node('notification-preview').textContent, /No notification/);
});

test('settings failures leave controls available for retry', async () => {
  const c = await controls();
  c.access.openSettings = async () => { throw Error('Unavailable'); };
  await c.node('notification-settings').handlers.click();
  assert.match(c.node('notification-status').textContent, /Could not change/);
  assert.equal(c.node('notification-toggle').disabled, false);
});
