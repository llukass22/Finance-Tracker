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
      value: id === 'category-filter' ? 'all' : '',
      innerHTML: '', textContent: '', hidden: false, children: [], handlers: {},
      querySelectorAll() { return []; },
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
test('new tracker starts empty and lists all fourteen categories', async () => {
  const a = app(); assert.equal(a.run('records.length'), 0);
  assert.equal(a.node('total-spent').textContent, '€0.00');
  assert.equal((a.node('category-list').innerHTML.match(/class="category-row"/g) || []).length, 14);
});
test('renamed categories migrate when purchases load or restore from backup', async () => {
  const bill = { id: 'old-bill', cents: 1250, category: 'Bills', note: 'Internet', date: '2026-10-13', createdAt: 1 };
  const label = { id: 'old-label', cents: 500, category: 'Etsy (shipping labels)', note: 'Parcel', date: '2026-10-14', createdAt: 2 };
  const a = app(JSON.stringify([bill, label]));
  assert.equal(a.run('records[0].category'), 'Subscriptions');
  assert.equal(a.run('records[1].category'), 'Shipping Labels');
  const backup = { app: 'pocket', version: 1, purchases: [{ ...bill, id: 'backup-bill' }, { ...label, id: 'backup-label' }] };
  const file = { size: 100, text: async () => JSON.stringify(backup) };
  await a.node('import-backup').handlers.change({ target: { files: [file], value: 'backup.json' } });
  const saved = JSON.parse(a.storage.get('pocket.purchases.v1'));
  assert.deepEqual(saved.map(({ id, category, cents }) => ({ id, category, cents })), [
    { id: 'old-bill', category: 'Subscriptions', cents: 1250 },
    { id: 'old-label', category: 'Shipping Labels', cents: 500 },
    { id: 'backup-bill', category: 'Subscriptions', cents: 1250 },
    { id: 'backup-label', category: 'Shipping Labels', cents: 500 },
  ]);
});
test('purchase entry accepts decimal comma, saves exact cents and survives reload', async () => {
  const a = app(); await a.submit('12,50'); await a.submit('0.10', 'Drinks');
  assert.equal(a.run('records.reduce((s,r)=>s+r.cents,0)'), 1260);
  assert.equal(a.node('total-spent').textContent, '€12.60');
  const b = app(a.storage.get('pocket.purchases.v1'));
  assert.equal(b.run('records.length'), 2);
});
test('opening a new purchase clears the previous category and requires an explicit choice', async () => {
  const a = app();
  const food = { ...a.node('food-option'), dataset: { category: 'Food' } };
  a.node('category-picker').children = [food];
  a.run("selectCategory('Food')");
  assert.equal(food.attributes['aria-pressed'], true);

  await a.run('document').handlers.click({
    target: { closest: selector => selector === '[data-add]' ? {} : null },
  });
  assert.equal(a.node('purchase-dialog').open, true);
  assert.equal(a.node('purchase-category').value, '');
  assert.equal(food.attributes['aria-pressed'], false);
  await a.submit('12.50', '');
  assert.equal(a.node('form-error').textContent, 'Choose a category.');
  assert.equal(a.run('records.length'), 0);

  await a.submit('12.50', 'Food');
  a.run('openPurchase(records[0])');
  assert.equal(a.node('purchase-category').value, 'Food');
  assert.equal(food.attributes['aria-pressed'], true);
});
test('category disclosures prefer monthly purchase notes and fall back to titles', () => {
  const a = app(JSON.stringify([
    { id: '1', category: 'Food', date: '2026-10-13', note: '<Lunch>', merchant: 'Cafe', cents: 1250, createdAt: 1 },
    { id: '2', category: 'Food', date: '2026-10-14', note: ' ', merchant: 'Bakery', cents: 425, createdAt: 2 },
    { id: '3', category: 'Food', date: '2026-10-15', note: '', cents: 200, createdAt: 3 },
    { id: '4', category: 'Food', date: '2026-09-13', note: 'Last month', cents: 300, createdAt: 4 },
    { id: '5', category: 'Transport', date: '2026-10-15', note: 'Train', cents: 750, createdAt: 5 },
  ]));
  a.run("anchor=parseDate('2026-10-13'); render()");
  const html = a.node('category-list').innerHTML;
  const food = html.match(/<details[^>]+data-category="Food"[^>]*>([\s\S]*?)<\/details>/)[1];
  const rows = [...food.matchAll(/<li>\s*<span>(.*?)<\/span>\s*<strong>(.*?)<\/strong>\s*<\/li>/g)];
  assert.deepEqual(rows.map(match => match.slice(1)), [['Food', '€2.00'], ['Bakery', '€4.25'], ['&lt;Lunch&gt;', '€12.50']]);
  assert.match(html, /<summary class="category-row">/);
});
test('overview categories reorder as monthly spending changes', async () => {
  const a = app();
  const order = () => [...a.node('category-list').innerHTML.matchAll(/data-category="([^"]+)"/g)]
    .map(match => match[1]);

  await a.submit('8.00', 'Food');
  await a.submit('12.00', 'Transport');
  assert.deepEqual(order().slice(0, 3), ['Transport', 'Food', 'House']);

  await a.submit('4.00', 'Food');
  assert.deepEqual(order().slice(0, 3), ['Transport', 'Food', 'House']);

  await a.submit('0.01', 'Food');
  assert.deepEqual(order().slice(0, 3), ['Food', 'Transport', 'House']);

  a.node('previous-period').handlers.click();
  assert.deepEqual(order().slice(0, 3), ['House', 'Investing', 'Paysera']);
});
test('chart slices show monthly category spending and can return to the total', async () => {
  const a = app();
  await a.submit('12.50', 'Food');
  await a.submit('7.50', 'Transport');
  await a.submit('3.00', 'Food', '2026-09-13');
  await a.submit('2.50', 'Food');

  const chart = a.node('spending-chart');
  const click = target => a.node('chart-card').handlers.click({ target });
  assert.match(chart.innerHTML, /data-chart-category="Food"[^>]+aria-label="Food: €15\.00"/);
  const slice = name => ({
    ...a.node(name),
    dataset: { chartCategory: name },
    closest() { return this; },
  });
  const food = slice('Food'), transport = slice('Transport');
  chart.querySelectorAll = () => [food, transport];
  click(food);
  assert.equal(a.node('chart-selection-label').textContent, 'Food');
  assert.equal(a.node('total-spent').textContent, '€15.00');
  assert.equal(a.node('purchase-count').textContent, '2 purchases');
  assert.equal(food.attributes['aria-pressed'], 'true');

  chart.handlers.keydown({ target: transport, key: 'Enter', preventDefault() {} });
  assert.equal(a.node('chart-selection-label').textContent, 'Transport');
  assert.equal(a.node('total-spent').textContent, '€7.50');
  assert.equal(food.attributes['aria-pressed'], 'false');
  click({ closest: () => null });
  assert.equal(a.node('chart-selection-label').textContent, 'Total spent');
  assert.equal(a.node('total-spent').textContent, '€22.50');
  assert.equal(transport.attributes['aria-pressed'], 'false');

  click(food);
  click(food);
  assert.equal(a.node('total-spent').textContent, '€22.50');
  click(food);
  a.node('previous-period').handlers.click();
  assert.equal(a.node('chart-selection-label').textContent, 'Total spent');
  assert.equal(a.node('total-spent').textContent, '€3.00');
});
test('invalid amounts and impossible dates never save', async () => {
  const a = app(); for (const value of ['0','-1','1.234','abc','1e3']) await a.submit(value);
  await a.submit('10', 'Food', '2026-02-30');
  assert.equal(a.run('records.length'), 0);
  assert.ok(a.node('form-error').textContent);
});
test('month navigation updates spending totals across month boundaries', async () => {
  const a = app(); await a.submit('10', 'Food', '2026-10-13'); await a.submit('20', 'Car', '2026-10-12');
  await a.submit('30', 'Subscriptions', '2026-09-30'); await a.submit('40', 'House', '2025-12-31');
  a.run("anchor=parseDate('2026-10-13'); render()");
  assert.equal(a.node('total-spent').textContent, '€30.00');
  a.node('previous-period').handlers.click();
  assert.equal(a.node('period-label').textContent, 'September 2026');
  assert.equal(a.node('total-spent').textContent, '€30.00');
  a.node('next-period').handlers.click();
  a.node('next-period').handlers.click();
  assert.equal(a.node('total-spent').textContent, '€0.00');
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

test('background purchases refresh on native changes without writing back a stale list', async () => {
  const imported = { id: 'wallet-import', cents: 350, category: 'Eating Out', note: 'GASTROBARAS +++', date: '2026-10-19', createdAt: 1 };
  const a = app(null, false, null, { load: async () => [], reload: async () => [imported] });
  await a.run('purchasesReady');
  for (const refresh of a.windowHandlers['pocket-purchases-changed']) await refresh();
  assert.equal(a.run('records.length'), 1);
  assert.equal(a.run('records[0].note'), 'GASTROBARAS +++');
  assert.equal(a.storage.has('pocket.purchases.v1'), false);
});

test('an older refresh cannot overwrite a newer manual save', async () => {
  let finishRefresh;
  const a = app(null, false, null, {
    load: async () => [],
    reload: () => new Promise(resolve => { finishRefresh = resolve; }),
    save: async (previous, next) => next,
  });
  await a.run('purchasesReady');
  const refresh = a.run('refreshNativePurchases()');
  await a.submit('12.50');
  finishRefresh([]); await refresh;
  assert.equal(a.run('records.length'), 1);
  assert.equal(a.run('records[0].cents'), 1250);
});

test('vendor edits preserve identity and remember only with explicit consent', async () => {
  const record = { id: 'wallet-test', cents: 350, category: 'Uncategorized', note: 'ABC Shop', merchant: 'ABC Shop', date: '2026-10-27', createdAt: 1 };
  let remembered, saved;
  const purchases = {
    load: async () => [record],
    save: async (previous, next, validate, rememberId) => { saved = next; remembered = rememberId; return next; },
  };
  const a = app(null, false, null, purchases);
  await a.run('purchasesReady');
  a.run('openPurchase(records[0])');
  assert.equal(a.node('remember-category-option').hidden, false);
  assert.equal(a.node('remember-category').checked, false);
  a.node('remember-category').checked = true;
  await a.submit('3.50', 'Food', '2026-10-27', 'A different note');
  assert.equal(saved[0].merchant, 'ABC Shop');
  assert.equal(remembered, 'wallet-test');
  a.run('openPurchase(records[0])');
  assert.equal(a.node('remember-category').checked, false);
  await a.submit('3.50', 'House', '2026-10-27', 'Another note');
  assert.equal(remembered, null);
  a.run('openPurchase()');
  assert.equal(a.node('remember-category-option').hidden, true);
});
