import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
function app(stored = null, failSave = false, theme = null) {
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
    document: { documentElement, querySelector() { return themeMeta; }, getElementById: node, addEventListener() {} },
    window: { addEventListener(type, fn) { (windowHandlers[type] ||= []).push(fn); } },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem(key, value) { if (failSave) throw Error('Full'); storage.set(key, value); } },
    Option: function() {}, setTimeout() { return 1; }, clearTimeout() {}, console,
  });
  vm.runInContext(source, context);
  const run = code => vm.runInContext(code, context);
  function submit(amount, category = 'Food', date = '2026-10-13', note = 'Lunch') {
    node('amount').value = amount; node('purchase-category').value = category;
    node('purchase-date').value = date; node('note').value = note;
    node('purchase-form').handlers.submit({ preventDefault() {} });
  }
  return { node, run, submit, storage, documentElement, themeMeta, windowHandlers };
}
test('theme toggle saves preference, updates accessibility and restores on reload', () => {
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
test('theme still switches if preference cannot be saved', () => {
  const a = app(null, true);
  a.node('theme-button').handlers.click();
  assert.equal(a.documentElement.dataset.theme, 'dark');
  assert.ok(a.node('toast-message').textContent.includes('may reset'));
});
test('theme follows preference changes from another tab and ignores invalid preferences', () => {
  const a = app(null, false, 'invalid');
  assert.equal(a.documentElement.dataset.theme, 'light');
  for (const handler of a.windowHandlers.storage) handler({ key: 'pocket.theme.v1', newValue: 'dark' });
  assert.equal(a.documentElement.dataset.theme, 'dark');
  for (const handler of a.windowHandlers.storage) handler({ key: null, newValue: null });
  assert.equal(a.documentElement.dataset.theme, 'light');
});
test('new tracker starts empty and lists all seven categories', () => {
  const a = app(); assert.equal(a.run('records.length'), 0);
  assert.equal(a.node('total-spent').textContent, '€0.00');
  assert.equal((a.node('category-list').innerHTML.match(/class="category-row"/g) || []).length, 7);
});
test('purchase entry accepts decimal comma, saves exact cents and survives reload', () => {
  const a = app(); a.submit('12,50'); a.submit('0.10', 'Drinks');
  assert.equal(a.run('records.reduce((s,r)=>s+r.cents,0)'), 1260);
  assert.equal(a.node('total-spent').textContent, '€12.60');
  const b = app(a.storage.get('pocket.purchases.v1'));
  assert.equal(b.run('records.length'), 2);
});
test('invalid amounts and impossible dates never save', () => {
  const a = app(); for (const value of ['0','-1','1.234','abc','1e3']) a.submit(value);
  a.submit('10', 'Food', '2026-02-30');
  assert.equal(a.run('records.length'), 0);
  assert.ok(a.node('form-error').textContent);
});
test('day, Monday-based week, month, year and all-time totals filter correctly', () => {
  const a = app(); a.submit('10', 'Food', '2026-10-13'); a.submit('20', 'Car', '2026-10-12');
  a.submit('30', 'Bills', '2026-09-30'); a.submit('40', 'House', '2025-12-31');
  a.run("anchor=parseDate('2026-10-13')");
  for (const [period, expected] of [['day',1000],['week',3000],['month',3000],['year',6000],['all',10000]]) {
    a.node('period').value=period;
    assert.equal(a.run('filtered().reduce((s,r)=>s+r.cents,0)'), expected);
  }
});
test('editing replaces the original record and category filtering safely renders notes', () => {
  const a = app(); a.submit('10', 'Food', '2026-10-13', '<img src=x onerror=alert(1)>');
  assert.ok(a.node('history-list').innerHTML.includes('&lt;img'));
  a.run('editingId=records[0].id'); a.submit('15.25', 'Car', '2026-10-13', 'Fuel');
  assert.equal(a.run('records.length'),1); assert.equal(a.run('records[0].cents'),1525);
  a.node('category-filter').value='Car'; a.run('renderHistory(filtered())');
  assert.ok(a.node('history-list').innerHTML.includes('Fuel'));
  a.node('category-filter').value='Food'; a.run('renderHistory(filtered())');
  assert.ok(a.node('history-list').innerHTML.includes('No purchases found'));
});
test('storage failure leaves existing state unchanged', () => {
  const a = app(null,true); a.submit('10');
  assert.equal(a.run('records.length'),0);
  assert.ok(a.node('form-error').textContent.includes('could not be saved'));
});
test('corrupt storage is preserved instead of overwritten', () => {
  const a = app('invalid json'); a.submit('10');
  assert.equal(a.run('records.length'),0);
  assert.equal(a.storage.get('pocket.purchases.v1'),'invalid json');
});
test('undo restores a deleted purchase and updates total', () => {
  const a = app(); a.submit('7.99');
  a.run('deletedRecord=records[0]; persist([]); render()');
  a.node('undo-delete').handlers.click();
  assert.equal(a.run('records.length'),1); assert.equal(a.node('total-spent').textContent,'€7.99');
});
test('month navigation handles January 31 without skipping February', () => {
  const a = app(); a.run("anchor=parseDate('2026-01-31'); movePeriod(1)");
  assert.equal(a.run('localDate(anchor)'), '2026-02-01');
});
