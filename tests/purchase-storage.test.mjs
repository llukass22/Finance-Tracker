import test from 'node:test';
import assert from 'node:assert/strict';
import { createPurchaseStorage } from '../purchase-storage.mjs';

const record = { id: 'legacy', cents: 1250, category: 'Food', note: 'Lunch', date: '2026-10-19', createdAt: 1 };
const valid = data => Array.isArray(data) && data.every(row => row.id && Number.isInteger(row.cents));

test('migration imports legacy purchases only once, preserving the recovery copy', async () => {
  let state = { migrated: false, purchases: [] }, imports = 0;
  const plugin = {
    read: async () => state,
    migrate: async ({ purchases }) => { imports++; return state = { migrated: true, purchases }; },
  };
  let legacyReads = 0;
  const storage = createPurchaseStorage(plugin, { getItem: () => { legacyReads++; return JSON.stringify([record]); } });
  assert.deepEqual(await storage.load(valid), [record]);
  state = { migrated: true, purchases: [] }; // A later deletion must stay deleted.
  assert.deepEqual(await storage.load(valid), []);
  assert.equal(imports, 1);
  assert.equal(legacyReads, 1);
});

test('malformed legacy data never marks migration complete and can be retried', async () => {
  let imports = 0, raw = 'broken';
  const storage = createPurchaseStorage({
    read: async () => ({ migrated: false, purchases: [] }),
    migrate: async ({ purchases }) => { imports++; return { purchases }; },
  }, { getItem: () => raw });
  await assert.rejects(storage.load(valid));
  raw = JSON.stringify({ wrong: true });
  await assert.rejects(storage.load(valid));
  assert.equal(imports, 0);
  raw = JSON.stringify([record]);
  assert.deepEqual(await storage.load(valid), [record]);
});

test('failed migration retains the source for a later retry', async () => {
  let fail = true;
  const storage = createPurchaseStorage({
    read: async () => ({ migrated: false, purchases: [] }),
    migrate: async ({ purchases }) => { if (fail) throw Error('Disk full'); return { purchases }; },
  }, { getItem: () => JSON.stringify([record]) });
  await assert.rejects(storage.load(valid), /Disk full/);
  fail = false;
  assert.deepEqual(await storage.load(valid), [record]);
});

test('saves send only changed and deleted IDs and retain unrelated database purchases', async () => {
  const changed = { ...record, cents: 2000 }, removed = { ...record, id: 'removed' }, untouched = { ...record, id: 'untouched' }, concurrent = { ...record, id: 'native' };
  let changes;
  const storage = createPurchaseStorage({
    applyChanges: async request => { changes = request; return { purchases: [changed, untouched, concurrent] }; },
  }, {});
  const saved = await storage.save([record, removed, untouched], [changed, untouched], valid);
  assert.deepEqual(changes, { upserts: [changed], deletedIds: ['removed'] });
  assert.deepEqual(saved, [changed, untouched, concurrent]);
});

test('migration identifies the WebView origin so development does not skip standalone data', async () => {
  const calls = [];
  const storage = createPurchaseStorage({
    read: async options => { calls.push(options); return { migrated: false }; },
    migrate: async options => { calls.push(options); return { purchases: options.purchases }; },
  }, { getItem: () => null }, 'localStorage.v1:https://localhost');
  assert.deepEqual(await storage.load(valid), []);
  assert.deepEqual(calls, [{ source: 'localStorage.v1:https://localhost' }, { source: 'localStorage.v1:https://localhost', purchases: [] }]);
});
