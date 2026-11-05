'use strict';
const $ = id => document.getElementById(id);
const paths = {
car:'<path d="m5 7 2-4h10l2 4M5 7h14a2 2 0 0 1 2 2v7H3V9a2 2 0 0 1 2-2ZM5 16v3m14-3v3M6 11h2m8 0h2"/>',
house:'<path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8"/>',
wallet:'<path d="M20 7H5a2 2 0 0 1 0-4h13v4M4 7v13h17V7m0 4h-6v5h6m-4-3h.01"/>',
salary:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12a20 20 0 0 0 18 0M12 11v4"/>',
income:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
investing:'<path d="M3 3v18h18M7 15l5-5 4 3 5-6m-5 0h5v5"/>',
food:'<path d="M5 3v7m3-7v7m-6-7v7c0 3 6 3 6 0M5 13v8M16 3c-4 3-4 10 0 10h2V3Zm2 10v8"/>',
basket:'<path d="m8 3-4 7m12-7 4 7M2 10h20l-3 11H5Zm6 4v3m4-3v3m4-3v3"/>',
drink:'<path d="M7 4h10l-1 17H8ZM6 8h12m-5 0 2-7h4"/>',
bills:'<path d="M5 2h14v20l-3-2-4 2-4-2-3 2Zm4 5h6m-6 4h6m-6 4h3"/>',
sports:'<path d="m6 6 12 12M4 9l5-5m6 16 5-5M2 7l5-5m10 20 5-5"/>',
shirt:'<path d="M8 4 3 7l2 5 3-1v9h8v-9l3 1 2-5-5-3a4 4 0 0 1-8 0Z"/>',
shipping:'<path d="m3 7 9-4 9 4v10l-9 4-9-4Zm0 0 9 4 9-4M12 11v10M8 5l9 4"/>',
gift:'<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13m0-13H8.5A2.5 2.5 0 1 1 11 5.5Zm0 0h3.5A2.5 2.5 0 1 0 13 5.5Z"/>',
bus:'<rect x="4" y="3" width="16" height="16" rx="3"/><path d="M4 12h16M6 19v2m12-2v2M8 15h.01m8 0h.01M10 6h4"/>',
uncategorized:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3h.01"/>',
edit:'<path d="m15 4 5 5M3 21l5-1L21 7a2 2 0 0 0-5-5L3 15Z"/>',
trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
backup:'<path d="M12 3v12m-4-4 4 4 4-4M4 14v6h16v-6"/>',
settings:'<path d="M9 2h6l.5 2.5 2 1.2 2.4-.8 2.5 4.3-1.9 1.8v2l1.9 1.8-2.5 4.3-2.4-.8-2 1.2L15 22H9l-.5-2.5-2-1.2-2.4.8-2.5-4.3L3.5 13v-2L1.6 9.2l2.5-4.3 2.4.8 2-1.2Z"/><circle cx="12" cy="12" r="3"/>',
moon:'<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>',
sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>'
};
const icon = key => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[key]}</svg>`;
const categories = [
{name:'House', color:'#7dcaa4', tint:'#eaf7f0', icon:'house'},
{name:'Investing', color:'#66bfa1', tint:'#e5f4ee', icon:'investing'},
{name:'Paysera', color:'#edc467', tint:'#fcf5e3', icon:'wallet'},
{name:'Subscriptions', color:'#eeab80', tint:'#fcf0e8', icon:'bills'},
{name:'Car', color:'#b897e8', tint:'#f1eafa', icon:'car'},
{name:'Transport', color:'#829ce8', tint:'#edf1fc', icon:'bus'},
{name:'Food', color:'#94c9dd', tint:'#eaf5f9', icon:'basket'},
{name:'Eating Out', color:'#ef95a7', tint:'#fcecf0', icon:'food'},
{name:'Drinks', color:'#b4d67d', tint:'#f1f7e6', icon:'drink'},
{name:'Sports', color:'#6eb9c2', tint:'#e8f5f6', icon:'sports'},
{name:'Clothes', color:'#ba91c9', tint:'#f4edf7', icon:'shirt'},
{name:'Gifts', color:'#d889be', tint:'#f8eaf4', icon:'gift'},
{name:'Shipping Labels', color:'#e68b59', tint:'#fcf0e7', icon:'shipping'},
{name:'Uncategorized', color:'#a0a7b4', tint:'#eef0f4', icon:'uncategorized'}
];
const incomeCategories = [
  { name: 'Salary', color: '#63b58d', tint: '#e8f6ee', icon: 'salary' },
  { name: 'Other', color: '#72b7c2', tint: '#e8f4f6', icon: 'income' },
];
const allCategories = [...incomeCategories, ...categories];
const incomeCategoryNames = new Set(incomeCategories.map(category => category.name));
const isIncome = record => incomeCategoryNames.has(record.category);
const categoryMap = new Map(allCategories.map(category => [category.name, category]));
const STORAGE_KEY = 'pocket.purchases.v1';
const THEME_KEY = 'pocket.theme.v1';
function applyTheme(theme){
  const dark=theme==='dark';
  document.documentElement.dataset.theme=dark?'dark':'light';
  document.querySelector('meta[name="theme-color"]').content=dark?'#101010':'#f7f7f0';
  const label=dark?'Switch to light theme':'Switch to dark theme';
  $('theme-button').innerHTML=icon(dark?'sun':'moon');
  $('theme-button').setAttribute('aria-label',label);
  $('theme-button').setAttribute('aria-pressed',String(dark));
  $('theme-button').title=label;
}
let initialTheme='light';
try{initialTheme=localStorage.getItem(THEME_KEY)||'light';}catch{}
applyTheme(initialTheme);
$('theme-button').addEventListener('click',()=>{
  const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';
  applyTheme(theme);
  try{localStorage.setItem(THEME_KEY,theme);}catch{notify('Theme changed. Browser storage is unavailable, so it may reset when you reload.');}
});
window.addEventListener('storage',e=>{if(e.key===THEME_KEY||e.key===null)applyTheme(e.key===null?'light':e.newValue);});
const money = cents => new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',minimumFractionDigits:2}).format(cents/100);
const localDate = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const parseDate = value => new Date(`${value}T12:00:00`);
const validDate = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseDate(value).getTime()) && localDate(parseDate(value))===value;
const escapeHTML = value => String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validRecord = r => r && typeof r.id==='string' && r.id.length>0 && r.id.length<=100 && Number.isSafeInteger(r.cents) && r.cents>0 && r.cents<=99999999999 && categoryMap.has(r.category) && typeof r.note==='string' && r.note.length<=200 && (r.merchant===undefined||(typeof r.merchant==='string'&&r.merchant.length<=200)) && validDate(r.date) && Number.isSafeInteger(r.createdAt) && r.createdAt>=0;
const validRecords = data => Array.isArray(data)&&data.every(validRecord)&&new Set(data.map(r=>r.id)).size===data.length;
const legacyCategoryNames = new Map([
  ['Bills', 'Subscriptions'],
  ['Etsy (shipping labels)', 'Shipping Labels'],
]);
function normalizeCategories(purchases) {
  if (!Array.isArray(purchases)) return purchases;
  return purchases.map(purchase => {
    const category = legacyCategoryNames.get(purchase?.category);
    return category ? { ...purchase, category } : purchase;
  });
}
const purchaseStorage = window.pocketNative?.purchases;
let records=[],anchor=new Date(),editingId=null,deletedRecord=null,toastTimer,storageHealthy=true,storageReady=!purchaseStorage,saveBusy=false,storageRevision=0,refreshPending=false;
if(!purchaseStorage)try{const raw=localStorage.getItem(STORAGE_KEY);if(raw!==null){const data=normalizeCategories(JSON.parse(raw));if(!validRecords(data))throw new Error('Invalid stored records');records=data;}}catch{storageHealthy=false;}
async function persist(next,rememberPurchaseId=null){
  if(!storageReady){notify('Purchases are still loading. Please try again.');return false;}
  if(!storageHealthy){notify('Storage could not be read. Recover your saved data before saving.');return false;}
  if(saveBusy){notify('A purchase is still being saved. Please try again.');return false;}
  saveBusy=true;
  storageRevision++;
  try{if(!validRecords(next))throw new Error('Invalid purchases');if(purchaseStorage){records=await purchaseStorage.save(records,next,validRecords,rememberPurchaseId);}else{localStorage.setItem(STORAGE_KEY,JSON.stringify(next));records=next;}return true;}
  catch{notify('Could not save. Check device storage space and try again.');return false;}
  finally{saveBusy=false;if(refreshPending){refreshPending=false;void refreshNativePurchases();}}
}
async function refreshNativePurchases(){
  if(!purchaseStorage||!storageHealthy)return;
  if(!storageReady||saveBusy){refreshPending=true;return;}
  const revision=++storageRevision;
  try{const data=await purchaseStorage.reload(validRecords);if(revision!==storageRevision||saveBusy){if(saveBusy)refreshPending=true;return;}records=data;render();}
  catch{notify('Could not refresh purchases. Reopen Pocket to try again.');}
}
window.addEventListener('pocket-purchases-changed',refreshNativePurchases);
function notify(message,undo=false){clearTimeout(toastTimer);$('toast-message').textContent=message;$('undo-delete').hidden=!undo;$('toast').hidden=false;toastTimer=setTimeout(()=>{$('toast').hidden=true;},undo?10000:5500);}
function bounds(){const year=anchor.getFullYear(),month=anchor.getMonth();return {start:localDate(new Date(year,month,1,12)),end:localDate(new Date(year,month+1,0,12))};}
function filtered(){const b=bounds();return records.filter(r=>r.date>=b.start&&r.date<=b.end).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);}
function periodLabel(){$('period-label').textContent=anchor.toLocaleDateString('en-GB',{month:'long',year:'numeric'});}
function categoryIcon(c){return `<span class="category-icon" style="--color:${c.color};--tint:${c.tint}">${icon(c.icon)}</span>`;}
function empty(message,detail,add=false){return `<div class="empty-state"><span class="empty-symbol">✧</span><strong>${message}</strong><p>${detail}</p>${add?'<button class="text-button" data-add>Add your first purchase ↗</button>':''}</div>`;}
function purchaseRow(r){const c=categoryMap.get(r.category);return `<div class="purchase-row">${categoryIcon(c)}<div class="purchase-copy"><strong>${escapeHTML(r.note||r.category)}</strong><p>${r.category} · ${parseDate(r.date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</p></div><span class="purchase-sum">${isIncome(r) ? "+" : ""}${money(r.cents)}</span><div class="purchase-actions"><button data-edit="${escapeHTML(r.id)}" aria-label="Edit ${escapeHTML(r.note||r.category)}" title="Edit purchase">${icon('edit')}</button><button data-delete="${escapeHTML(r.id)}" aria-label="Delete ${escapeHTML(r.note||r.category)}" title="Delete purchase">${icon('trash')}</button></div></div>`;}
function renderHistory(list){const cat=$('category-filter').value;const visible=list.filter(r=>cat==='all'||r.category===cat);let lastDate='';$('history-list').innerHTML=visible.length?visible.map(r=>{let heading='';if(r.date!==lastDate){heading=`<p class="history-group">${parseDate(r.date).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>`;lastDate=r.date;}return heading+purchaseRow(r);}).join(''):empty('No entries found',cat!=='all'?'Try another category.':'Entries in this period will appear here.',!records.length);}
let selectedChartCategory = null;

function renderChartCenter(purchases) {
  const expenses = purchases.filter(purchase => !isIncome(purchase));
  const visible = selectedChartCategory
    ? expenses.filter(purchase => purchase.category === selectedChartCategory)
    : expenses;
  const cents = visible.reduce((sum, purchase) => sum + purchase.cents, 0);
  $('chart-selection-label').textContent = selectedChartCategory || 'Total spent';
  $('total-spent').textContent = money(cents);
  $('purchase-count').textContent = `${visible.length} purchase${visible.length === 1 ? '' : 's'}`;
}

function renderChart(purchases, totals, total) {
  const chart = $('spending-chart');
  const slices = totals.filter(category => category.cents > 0);
  if (!slices.some(category => category.name === selectedChartCategory)) selectedChartCategory = null;
  renderChartCenter(purchases);

  const radius = 116;
  const pointAt = angle => `${140 + radius * Math.sin(angle)} ${140 - radius * Math.cos(angle)}`;
  let offset = 0;
  const arcs = slices.map(category => {
    const attributes = `class="chart-slice" data-chart-category="${category.name}" role="button" tabindex="0" aria-label="${category.name}: ${money(category.cents)}" aria-pressed="${category.name === selectedChartCategory}" fill="none" stroke="${category.color}" stroke-width="29"`;
    if (slices.length === 1) return `<circle cx="140" cy="140" r="${radius}" ${attributes}/>`;

    const angle = category.cents / total * 2 * Math.PI;
    const gap = Math.min(5 / radius, angle * .18);
    const start = offset + gap / 2;
    const end = offset + angle - gap / 2;
    offset += angle;
    const largeArc = end - start > Math.PI ? 1 : 0;
    return `<path d="M ${pointAt(start)} A ${radius} ${radius} 0 ${largeArc} 1 ${pointAt(end)}" ${attributes}/>`;
  });
  chart.innerHTML = `<circle cx="140" cy="140" r="${radius}" fill="none" stroke-width="29" aria-hidden="true"/>${arcs.join('')}`;
  chart.setAttribute('aria-label', total ? `Spending by category. Total ${money(total)}.` : 'No purchases in this period');
}

function updateChartSelection(name) {
  const next = selectedChartCategory === name ? null : name;
  if (next === selectedChartCategory) return;
  selectedChartCategory = next;
  for (const button of $('spending-chart').querySelectorAll('[data-chart-category]')) {
    button.setAttribute('aria-pressed', String(button.dataset.chartCategory === selectedChartCategory));
  }
  renderChartCenter(filtered());
}

$('chart-card').addEventListener('click', event => {
  const slice = event.target.closest('[data-chart-category]');
  updateChartSelection(slice?.dataset.chartCategory ?? null);
});
$('spending-chart').addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const slice = event.target.closest('[data-chart-category]');
  if (!slice) return;
  event.preventDefault();
  if (!event.repeat) updateChartSelection(slice.dataset.chartCategory);
});

const categoryAnimations = new WeakMap();

function toggleCategory(event) {
  const summary = event.target.closest('.category-row');
  if (!summary || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const details = summary.parentElement;
  const content = summary.nextElementSibling;
  if (!content.animate) return;

  event.preventDefault();
  const closing = details.open && !details.hasAttribute('data-closing');
  const startHeight = details.open ? content.getBoundingClientRect().height : 0;
  const startOpacity = details.open ? getComputedStyle(content).opacity : 0;
  categoryAnimations.get(details)?.cancel();

  // Keep the native disclosure open until its content finishes collapsing.
  details.open = true;
  details.toggleAttribute('data-closing', closing);
  const endHeight = closing ? 0 : content.getBoundingClientRect().height;
  const animation = content.animate([
    { height: `${startHeight}px`, opacity: startOpacity },
    { height: `${endHeight}px`, opacity: closing ? 0 : 1 },
  ], { duration: 220, easing: 'ease-out', fill: 'both' });
  categoryAnimations.set(details, animation);

  animation.onfinish = () => {
    if (categoryAnimations.get(details) !== animation) return;
    details.open = !closing;
    details.removeAttribute('data-closing');
    categoryAnimations.delete(details);
    animation.cancel();
  };
}
for (const id of ['category-list', 'income-list']) $(id).addEventListener('click', toggleCategory);

function renderCategories(totals, total, listId = 'category-list') {
  const list = $(listId);
  const expanded = new Set([...list.querySelectorAll('details[open]:not([data-closing])')].map(row => row.dataset.category));
  const ranked = [...totals].sort((a, b) => b.cents - a.cents);
  list.innerHTML = ranked.map(category => {
    const purchases = category.purchases.map(purchase => `
      <li>
        <span>${escapeHTML(purchase.note.trim() || purchase.merchant?.trim() || purchase.category)}</span>
        <strong>${isIncome(purchase) ? '+' : ''}${money(purchase.cents)}</strong>
      </li>`).join('');
    return `
      <details class="category-details" data-category="${category.name}"${expanded.has(category.name) ? ' open' : ''}>
        <summary class="category-row">
          ${categoryIcon(category)}
          <span class="category-name">${category.name}</span>
          <span class="category-amount">${money(category.cents)}</span>
          <span class="category-percent">${total ? Math.round(category.cents / total * 100) : 0}%</span>
        </summary>
        <div class="category-content">
          ${purchases ? `<ul class="category-purchases" role="list">${purchases}</ul>` : `<p class="category-empty">${listId === 'income-list' ? 'No income this month.' : 'No purchases this month.'}</p>`}
        </div>
      </details>`;
  }).join('');
}

function categoryTotals(definitions, list) {
  return definitions.map(category => {
    const purchases = list.filter(purchase => purchase.category === category.name);
    const cents = purchases.reduce((sum, purchase) => sum + purchase.cents, 0);
    return { ...category, cents, purchases };
  });
}

function render() {
  periodLabel();
  const list = filtered();
  const expenses = list.filter(purchase => !isIncome(purchase));
  const income = list.filter(isIncome);
  const total = expenses.reduce((sum, purchase) => sum + purchase.cents, 0);
  const incomeTotal = income.reduce((sum, purchase) => sum + purchase.cents, 0);
  const totals = categoryTotals(categories, expenses);
  $('history-count').textContent = list.length;
  renderChart(expenses, totals, total);
  renderCategories(totals, total);
  renderCategories(categoryTotals(incomeCategories, income), incomeTotal, 'income-list');
  const top = totals.reduce((highest, category) => category.cents > highest.cents ? category : highest, totals[0]);
  $('chart-insight').textContent = total
    ? `${top.name} makes up ${Math.round(top.cents / total * 100)}% of your spending.`
    : 'Your next purchase starts the picture.';
  renderHistory(list);
}
function showView(view){const overview=view==='overview';$('overview').hidden=!overview;$('history').hidden=overview;for(const [id,on] of [['overview-tab',overview],['history-tab',!overview],['mobile-overview',overview],['mobile-history',!overview]]){$(id).classList.toggle('active',on);if(id.endsWith('-tab'))$(id).setAttribute('aria-selected',on);}if(!overview)renderHistory(filtered());}
function selectCategory(name){$('purchase-category').value=name;for(const button of $('category-picker').children){const on=button.dataset.category===name;button.classList.toggle('active',on);button.setAttribute('aria-pressed',on);}}
function openPurchase(record = null, income = false) {
  const incomeEntry = record ? isIncome(record) : income;
  editingId = record?.id || null;
  $('purchase-form').reset();
  $('form-title').textContent = incomeEntry
    ? (record ? 'Edit income' : 'Add income')
    : (record ? 'Edit purchase' : 'Add a purchase');
  $('save-entry').innerHTML = incomeEntry ? 'Save income <span>↗</span>' : 'Save purchase <span>↗</span>';
  $('amount').value = record ? (record.cents / 100).toFixed(2) : '';
  $('note').value = record?.note || '';
  $('purchase-date').value = record?.date || localDate();
  $('form-error').textContent = '';
  $('remember-category').checked = false;
  $('remember-category-option').hidden = !(purchaseStorage && record?.merchant && record.merchant.normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[\p{L}\p{N}]/u));
  $('remember-vendor').textContent = record?.merchant || '';
  renderCategoryPicker(incomeEntry ? incomeCategories : categories);
  selectCategory(record?.category || '');
  $('purchase-dialog').showModal();
  setTimeout(() => $('amount').focus(), 50);
}
$('backup-button').innerHTML=icon('backup');
$('settings-button').innerHTML=icon('settings');
$('settings-button').addEventListener('click',()=>$('settings-dialog').showModal());
for(const c of allCategories){$('purchase-category').add(new Option(c.name,c.name));$('category-filter').add(new Option(c.name,c.name));}
function renderCategoryPicker(definitions) {
  $('category-picker').innerHTML = definitions.map(category => `
    <button type="button" data-category="${category.name}" style="--color:${category.color}" aria-pressed="false">
      ${icon(category.icon)}<span>${category.name}</span>
    </button>`).join('');
}
renderCategoryPicker(categories);
$('category-picker').addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(b)selectCategory(b.dataset.category);});
document.addEventListener('click',async e=>{const incomeAdd=e.target.closest('[data-add-income]');if(incomeAdd){openPurchase(null,true);return;}const add=e.target.closest('[data-add]');if(add){openPurchase();return;}const edit=e.target.closest('[data-edit]');if(edit){const r=records.find(r=>r.id===edit.dataset.edit);if(r)openPurchase(r);return;}const del=e.target.closest('[data-delete]');if(del){const r=records.find(r=>r.id===del.dataset.delete);if(r&&await persist(records.filter(x=>x.id!==r.id))){deletedRecord=r;render();notify('Purchase deleted.',true);}}if(e.target.closest('.close-dialog'))e.target.closest('dialog').close();});
$('undo-delete').addEventListener('click',async()=>{if(deletedRecord&&await persist([...records,deletedRecord])){deletedRecord=null;render();notify('Purchase restored.');}});
$('purchase-form').addEventListener('submit',async e=>{e.preventDefault();const raw=$('amount').value.trim().replace(',','.');if(!/^\d{1,9}(\.\d{1,2})?$/.test(raw)){$('form-error').textContent='Enter an amount with up to two decimal places, such as 12.50.';return;}const cents=Math.round(Number(raw)*100);if(cents<=0||cents>99999999999){$('form-error').textContent='Enter an amount greater than €0.00 and up to €999,999,999.99.';return;}
  const category = $('purchase-category').value;
  if (!categoryMap.has(category)) {
    $('form-error').textContent = 'Choose a category.';
    $('category-picker').firstElementChild?.focus();
    return;
  }
  const date=$('purchase-date').value;if(!validDate(date)){$('form-error').textContent='Choose a valid date.';return;}const old=records.find(r=>r.id===editingId);const record={...(old?.merchant?{merchant:old.merchant}:{}),id:old?.id||(globalThis.crypto?.randomUUID?.()||`p-${Date.now()}-${Math.random().toString(36).slice(2)}`),cents,category,note:$('note').value.trim(),date,createdAt:old?.createdAt||Date.now()};const next=old?records.map(r=>r.id===old.id?record:r):[...records,record];const rememberPurchaseId=purchaseStorage&&old?.merchant&&$('remember-category').checked?record.id:null;if(!await persist(next,rememberPurchaseId)){$('form-error').textContent='The purchase could not be saved. Your existing records are unchanged.';return;}$('purchase-dialog').close();anchor=parseDate(date);render();notify(rememberPurchaseId?'Purchase updated. Category remembered for this vendor.':isIncome(record)?(old?'Income updated.':'Income saved.'):old?'Purchase updated.':'Purchase saved.');});
for(const id of ['overview-tab','mobile-overview'])$(id).addEventListener('click',()=>showView('overview'));
for(const id of ['history-tab','mobile-history'])$(id).addEventListener('click',()=>showView('history'));
function movePeriod(direction){anchor=new Date(anchor.getFullYear(),anchor.getMonth()+direction,1,12);selectedChartCategory=null;render();}
$('previous-period').addEventListener('click',()=>movePeriod(-1));$('next-period').addEventListener('click',()=>movePeriod(1));
$('category-filter').addEventListener('change',()=>renderHistory(filtered()));
async function download(content,name,type){if(window.pocketNative){await window.pocketNative.exportFile(content,name);return;}const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export-csv').addEventListener('click',async()=>{const cat=$('category-filter').value;const list=filtered().filter(r=>cat==='all'||r.category===cat);if(!list.length){notify('No purchases to export in this view.');return;}const cell=s=>`"${String(s).replace(/^[=+@-]/,"'$&").replace(/"/g,'""')}"`;try{await download('\uFEFFDate,Category,Amount (EUR),Note,Type\r\n'+list.map(r=>[r.date,r.category,(r.cents/100).toFixed(2),r.note,isIncome(r)?'Income':'Expense'].map(cell).join(',')).join('\r\n'),`pocket-purchases-${localDate()}.csv`,'text/csv;charset=utf-8');notify(window.pocketNative?'CSV sharing finished.':'CSV exported.');}catch{notify('CSV export could not be completed. Try again.');}});
$('backup-button').addEventListener('click',()=>{$('backup-error').textContent='';$('backup-dialog').showModal();});
$('export-backup').addEventListener('click',async()=>{if(!storageReady||!storageHealthy){$('backup-error').textContent='Stored data could not be read. Recover the original browser storage before exporting.';return;}$('backup-error').textContent='';try{await download(JSON.stringify({app:'pocket',version:1,exportedAt:new Date().toISOString(),purchases:records},null,2),`pocket-backup-${localDate()}.json`,'application/json');notify(window.pocketNative?'Backup sharing finished.':'Backup downloaded.');}catch{$('backup-error').textContent='Backup export could not be completed. Try again.';}});
$('import-backup').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>10000000)throw new Error('This file is too large. Choose a Pocket JSON backup under 10 MB.');const data=JSON.parse(await file.text());const purchases=normalizeCategories(data.purchases);if(data.app!=='pocket'||data.version!==1||!validRecords(purchases))throw new Error('Choose a valid Pocket backup file.');const existing=new Set(records.map(r=>r.id));const added=purchases.filter(r=>!existing.has(r.id));if(!await persist([...records,...added]))throw new Error('The backup could not be saved.');render();$('backup-dialog').close();notify(`${added.length} purchase${added.length===1?'':'s'} restored.`);}catch(err){$('backup-error').textContent=err instanceof SyntaxError?'This file is not a valid JSON backup.':err.message;}e.target.value='';});
window.addEventListener('storage',e=>{if(purchaseStorage||e.key!==STORAGE_KEY)return;try{const data=normalizeCategories(e.newValue?JSON.parse(e.newValue):[]);if(!validRecords(data))throw new Error();records=data;storageHealthy=true;render();}catch{storageHealthy=false;notify('Stored records changed unexpectedly. Reload to recover your data.');}});
render();
const purchasesReady = purchaseStorage ? purchaseStorage.load(validRecords,normalizeCategories).then(data=>{records=data;storageReady=true;render();if(refreshPending){refreshPending=false;void refreshNativePurchases();}}).catch(()=>{storageHealthy=false;storageReady=true;notify('Purchases could not be loaded. Saving is disabled to protect existing data.');}) : Promise.resolve();
if(!storageHealthy)notify('Storage could not be read. Saving is disabled to protect existing data.');
