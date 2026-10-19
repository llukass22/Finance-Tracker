import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
function app(stored = null, failSave = false, theme = null, purchases = null) {
  const nodes = new Map(), storage = new Map(), windowHandlers = {};
  const documentElement = { dataset: {} }, themeMeta = {};
  if (stored !== null) storage.set('pocket.purchases.v1', stored);
  if (theme !== null) storage.set('pocket.theme.v1', theme);
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {
      value: id === 'period' ? 'month' : id === 'category-filter' ? 'all' : '',
      innerHTML: '', textContent: '', hidden: false, children: [], handlers: {},
      attributes: {}, classList: { toggle() {} }, setAttribute(key, value) { this.attributes[key] = value; }, add() {}, focus() {},
      addEventListener(type, fn) { this.handlers[type] = fn; },
      showModal() { this.open = true; }, close() { this.open = false; }, reset() {},
    });
    return nodes.get(id);
  }
  const context = vm.createContext({
    document: { handlers: {}, documentElement, querySelector() { return themeMeta; }, getElementById: node, addEventListener(type, fn) { this.handlers[type] = fn; } },
    window: { pocketNative: purchases ? { purchases } : undefined, addEventListener(type, fn) { (windowHandlers[type] ||= []).push(fn); } },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem(key, value) { if (failSave) throw Error('Full'); storage.set(key, value); } },
    Option: function() {}, setTimeout() { return 1; }, clearTimeout() {}, console,
  });
  vm.runInContext(source, context);
  const run = code => vm.runInContext(code, context);
  function submit(amount, category = 'Food', date = '2026-10-13', note = 'Lunch') {
    node('amount').value = amount; node('purchase-category').value = category;
    node('purchase-date').value = date; node('note').value = note;
    return node('purchase-form').handlers.submit({ preventDefault() {} });
  }
  return { node, run, submit, storage, documentElement, themeMeta, windowHandlers };
}
test('theme toggle saves preference, updates accessibility and restores on reload', async () => {
  const a = app();
  assert.equal(a.documentElement.dataset.theme, 'light');
  a.node('theme-button').handlers.click();
  assert.equal(a.documentElement.dataset.theme, 'dark');
  assert.equal(a.storage.get('pocket.theme.v1'), 'dark');
  assert.equal(a.node('theme-button').attributes['aria-pressed'], 'true');
  assert.equal(a.node('theme-button').attributes['aria-label'], 'Switch to light theme');
  assert.equal(a.themeMeta.content, '#101010');
  const b = app(null, false, a.storage.get('pocket.theme.v1'));
  assert.equal(b.documentElement.dataset.theme, 'dark');
  b.node('theme-button').handlers.click();
  assert.equal(b.storage.get('pocket.theme.v1'), 'light');
  assert.equal(b.node('theme-button').attributes['aria-pressed'], 'false');
});
test('theme still switches if preference cannot be saved', async () => {
  const a = app(null, true);
  a.node('theme-button').handlers.click();
  assert.equal(a.documentElement.dataset.theme, 'dark');
  assert.ok(a.node('toast-message').textContent.includes('may reset'));
});
test('theme follows preference changes from another tab and ignores invalid preferences', async () => {
  const a = app(null, false, 'invalid');
  assert.equal(a.documentElement.dataset.theme, 'light');
  for (const handler of a.windowHandlers.storage) handler({ key: 'pocket.theme.v1', newValue: 'dark' });
  assert.equal(a.documentElement.dataset.theme, 'dark');
  for (const handler of a.windowHandlers.storage) handler({ key: null, newValue: null });
  assert.equal(a.documentElement.dataset.theme, 'light');
});
test('new tracker starts empty and lists all eight categories', async () => {
  const a = app(); assert.equal(a.run('records.length'), 0);
  assert.equal(a.node('total-spent').textContent, '€0.00');
  assert.equal((a.node('category-list').innerHTML.match(/class="category-row"/g) || []).length, 8);
});
test('purchase entry accepts decimal comma, saves exact cents and survives reload', async () => {
  const a = app(); await a.submit('12,50'); await a.submit('0.10', 'Drinks');
  assert.equal(a.run('records.reduce((s,r)=>s+r.cents,0)'), 1260);
  assert.equal(a.node('total-spent').textContent, '€12.60');
  const b = app(a.storage.get('pocket.purchases.v1'));
  assert.equal(b.run('records.length'), 2);
});
test('invalid amounts and impossible dates never save', async () => {
  const a = app(); for (const value of ['0','-1','1.234','abc','1e3']) await a.submit(value);
  await a.submit('10', 'Food', '2026-02-30');
  assert.equal(a.run('records.length'), 0);
  assert.ok(a.node('form-error').textContent);
});
test('day, Monday-based week, month, year and all-time totals filter correctly', async () => {
  const a = app(); await a.submit('10', 'Food', '2026-10-13'); await a.submit('20', 'Car', '2026-10-12');
  await a.submit('30', 'Bills', '2026-09-30'); await a.submit('40', 'House', '2025-12-31');
  a.run("anchor=parseDate('2026-10-13')");
  for (const [period, expected] of [['day',1000],['week',3000],['month',3000],['year',6000],['all',10000]]) {
    a.node('period').value=period;
    assert.equal(a.run('filtered().reduce((s,r)=>s+r.cents,0)'), expected);
  }
});
test('editing replaces the original record and category filtering safely renders notes', async () => {
  const a = app(); await a.submit('10', 'Food', '2026-10-13', '<img src=x onerror=alert(1)>');
  assert.ok(a.node('history-list').innerHTML.includes('&lt;img'));
  a.run('editingId=records[0].id'); await a.submit('15.25', 'Car', '2026-10-13', 'Fuel');
  assert.equal(a.run('records.length'),1); assert.equal(a.run('records[0].cents'),1525);
  a.node('category-filter').value='Car'; a.run('renderHistory(filtered())');
  assert.ok(a.node('history-list').innerHTML.includes('Fuel'));
  a.node('category-filter').value='Food'; a.run('renderHistory(filtered())');
  assert.ok(a.node('history-list').innerHTML.includes('No purchases found'));
});
test('storage failure leaves existing state unchanged', async () => {
  const a = app(null,true); await a.submit('10');
  assert.equal(a.run('records.length'),0);
  assert.ok(a.node('form-error').textContent.includes('could not be saved'));
});
test('corrupt storage is preserved instead of overwritten', async () => {
  const a = app('invalid json'); await a.submit('10');
  assert.equal(a.run('records.length'),0);
  assert.equal(a.storage.get('pocket.purchases.v1'),'invalid json');
});
test('undo restores a deleted purchase and updates total', async () => {
  const a = app(); await a.submit('7.99');
  await a.run('(async()=>{deletedRecord=records[0]; await persist([]); render();})()');
  await a.node('undo-delete').handlers.click();
  assert.equal(a.run('records.length'),1); assert.equal(a.node('total-spent').textContent,'€7.99');
});
test('month navigation handles January 31 without skipping February', async () => {
  const a = app(); a.run("anchor=parseDate('2026-01-31'); movePeriod(1)");
  assert.equal(a.run('localDate(anchor)'), '2026-02-01');
});

test('Android backup exports valid saved records through the native bridge', async () => {
  const a = app();
  await a.submit('12.50');
  let exported;
  a.run('window.pocketNative = {}');
  a.run('window').pocketNative.exportFile = async (content, name) => { exported = { content, name }; };
  await a.node('export-backup').handlers.click();
  const backup = JSON.parse(exported.content);
  assert.equal(backup.app, 'pocket');
  assert.equal(backup.purchases[0].cents, 1250);
  assert.match(exported.name, /^pocket-backup-.*\.json$/);
});

test('native export failures are shown without losing purchases', async () => {
  const a = app();
  await a.submit('7.99');
  a.run('window.pocketNative = {}');
  a.run('window').pocketNative.exportFile = async () => { throw new Error('Cannot share'); };
  await a.node('export-backup').handlers.click();
  assert.match(a.node('backup-error').textContent, /could not be completed/);
  await a.node('export-csv').handlers.click();
  assert.match(a.node('toast-message').textContent, /could not be completed/);
  assert.equal(a.run('records[0].cents'), 799);
});

test('Android CSV export retains spreadsheet formula escaping', async () => {
  const a = app();
  await a.submit('1.25', 'Food', '2026-10-13', '=1+1');
  a.node('period').value = 'all';
  let content;
  a.run('window.pocketNative = {}');
  a.run('window').pocketNative.exportFile = async text => { content = text; };
  await a.node('export-csv').handlers.click();
  assert.ok(content.includes('"1.25"'));
  assert.ok(content.includes('"\'=1+1"'));
});

test('native initialization blocks saves and exports until purchases have loaded', async () => {
  let finish;
  const a = app(null, false, null, { load: () => new Promise(resolve => { finish = resolve; }) });
  await a.submit('10');
  assert.equal(a.run('records.length'), 0);
  await a.node('export-backup').handlers.click();
  assert.match(a.node('backup-error').textContent, /could not be read/);
  finish([]);
  await a.run('purchasesReady');
  assert.equal(a.run('storageReady'), true);
});

test('native CRUD and backup restore use database records without writing localStorage', async () => {
  let saved = [], calls = 0;
  const a = app(null, false, null, {
    load: async () => saved,
    save: async (previous, next) => { calls++; saved = JSON.parse(JSON.stringify(next)); return saved; },
  });
  await a.run('purchasesReady');
  await a.submit('12.50');
  const id = saved[0].id;
  a.run('editingId=records[0].id');
  await a.submit('15', 'Car');
  assert.equal(saved[0].id, id);
  assert.equal(saved[0].cents, 1500);
  const target = { dataset: { delete: id } };
  await a.run('document').handlers.click({ target: { closest: selector => selector === '[data-delete]' ? target : null } });
  assert.equal(saved.length, 0);
  await a.node('undo-delete').handlers.click();
  assert.equal(saved[0].id, id);
  const extra = { ...saved[0], id: 'restored', cents: 700 };
  await a.node('import-backup').handlers.change({ target: { files: [{ size: 100, text: async () => JSON.stringify({ app: 'pocket', version: 1, purchases: [extra] }) }], value: 'backup.json' } });
  assert.equal(saved.length, 2);
  assert.equal(calls, 5);
  assert.equal(a.storage.has('pocket.purchases.v1'), false);
  let backup;
  a.run('window').pocketNative.exportFile = async content => { backup = JSON.parse(content); };
  await a.node('export-backup').handlers.click();
  assert.equal(backup.purchases.length, 2);
});

test('native load errors block writes without falling back to stale browser records', async () => {
  const a = app('[]', false, null, { load: async () => { throw Error('Database unavailable'); }, save: () => { throw Error('Must not save'); } });
  await a.run('purchasesReady');
  await a.submit('10');
  assert.equal(a.run('storageHealthy'), false);
  assert.equal(a.storage.get('pocket.purchases.v1'), '[]');
  assert.equal(a.run('records.length'), 0);
});

test('native write errors preserve records and concurrent writes do not overwrite each other', async () => {
  let finish;
  const a = app(null, false, null, {
    load: async () => [],
    save: (previous, next) => new Promise(resolve => { finish = () => resolve(next); }),
  });
  await a.run('purchasesReady');
  const first = a.submit('10');
  await a.submit('20');
  assert.equal(a.run('records.length'), 0);
  finish(); await first;
  assert.equal(a.run('records.length'), 1);
  assert.equal(a.run('records[0].cents'), 1000);
  a.run('purchaseStorage').save = async () => { throw Error('Disk full'); };
  await a.submit('30');
  assert.equal(a.run('records[0].cents'), 1000);
  assert.match(a.node('form-error').textContent, /could not be saved/);
});
