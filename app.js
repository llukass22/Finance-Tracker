'use strict';
const $ = id => document.getElementById(id);
const paths = {
car:'<path d="m5 7 2-4h10l2 4M5 7h14a2 2 0 0 1 2 2v7H3V9a2 2 0 0 1 2-2ZM5 16v3m14-3v3M6 11h2m8 0h2"/>',
house:'<path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8"/>',
wallet:'<path d="M20 7H5a2 2 0 0 1 0-4h13v4M4 7v13h17V7m0 4h-6v5h6m-4-3h.01"/>',
food:'<path d="M5 3v7m3-7v7m-6-7v7c0 3 6 3 6 0M5 13v8M16 3c-4 3-4 10 0 10h2V3Zm2 10v8"/>',
basket:'<path d="m8 3-4 7m12-7 4 7M2 10h20l-3 11H5Zm6 4v3m4-3v3m4-3v3"/>',
drink:'<path d="M7 4h10l-1 17H8ZM6 8h12m-5 0 2-7h4"/>',
bills:'<path d="M5 2h14v20l-3-2-4 2-4-2-3 2Zm4 5h6m-6 4h6m-6 4h3"/>',
uncategorized:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3h.01"/>',
edit:'<path d="m15 4 5 5M3 21l5-1L21 7a2 2 0 0 0-5-5L3 15Z"/>',
trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
backup:'<path d="M12 3v12m-4-4 4 4 4-4M4 14v6h16v-6"/>',
moon:'<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>',
sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>'
};
const icon = key => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[key]}</svg>`;
const categories = [
{name:'Car', color:'#b897e8', tint:'#f1eafa', icon:'car'},
{name:'House', color:'#7dcaa4', tint:'#eaf7f0', icon:'house'},
{name:'Paysera', color:'#edc467', tint:'#fcf5e3', icon:'wallet'},
{name:'Eating Out', color:'#ef95a7', tint:'#fcecf0', icon:'food'},
{name:'Food', color:'#94c9dd', tint:'#eaf5f9', icon:'basket'},
{name:'Drinks', color:'#b4d67d', tint:'#f1f7e6', icon:'drink'},
{name:'Bills', color:'#eeab80', tint:'#fcf0e8', icon:'bills'},
{name:'Uncategorized', color:'#a0a7b4', tint:'#eef0f4', icon:'uncategorized'}
];
const categoryMap = new Map(categories.map(c => [c.name,c]));
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
const validRecord = r => r && typeof r.id==='string' && r.id.length>0 && r.id.length<=100 && Number.isSafeInteger(r.cents) && r.cents>0 && r.cents<=99999999999 && categoryMap.has(r.category) && typeof r.note==='string' && r.note.length<=200 && validDate(r.date) && Number.isSafeInteger(r.createdAt) && r.createdAt>=0;
const validRecords = data => Array.isArray(data)&&data.every(validRecord)&&new Set(data.map(r=>r.id)).size===data.length;
const purchaseStorage = window.pocketNative?.purchases;
let records=[],anchor=new Date(),editingId=null,deletedRecord=null,toastTimer,storageHealthy=true,storageReady=!purchaseStorage,saveBusy=false;
if(!purchaseStorage)try{const raw=localStorage.getItem(STORAGE_KEY);if(raw!==null){const data=JSON.parse(raw);if(!validRecords(data))throw new Error('Invalid stored records');records=data;}}catch{storageHealthy=false;}
async function persist(next){
  if(!storageReady){notify('Purchases are still loading. Please try again.');return false;}
  if(!storageHealthy){notify('Storage could not be read. Recover your saved data before saving.');return false;}
  if(saveBusy){notify('A purchase is still being saved. Please try again.');return false;}
  saveBusy=true;
  try{if(!validRecords(next))throw new Error('Invalid purchases');if(purchaseStorage){records=await purchaseStorage.save(records,next,validRecords);}else{localStorage.setItem(STORAGE_KEY,JSON.stringify(next));records=next;}return true;}
  catch{notify('Could not save. Check device storage space and try again.');return false;}
  finally{saveBusy=false;}
}
function notify(message,undo=false){clearTimeout(toastTimer);$('toast-message').textContent=message;$('undo-delete').hidden=!undo;$('toast').hidden=false;toastTimer=setTimeout(()=>{$('toast').hidden=true;},undo?10000:5500);}
function bounds(){const mode=$('period').value;let start=new Date(anchor.getFullYear(),anchor.getMonth(),anchor.getDate(),12),end=new Date(start);if(mode==='all')return {start:null,end:null};if(mode==='week'){start.setDate(start.getDate()-((start.getDay()+6)%7));end=new Date(start);end.setDate(end.getDate()+6);}if(mode==='month'){start=new Date(anchor.getFullYear(),anchor.getMonth(),1,12);end=new Date(anchor.getFullYear(),anchor.getMonth()+1,0,12);}if(mode==='year'){start=new Date(anchor.getFullYear(),0,1,12);end=new Date(anchor.getFullYear(),11,31,12);}return {start:localDate(start),end:localDate(end)};}
function filtered(){const b=bounds();return records.filter(r=>!b.start||(r.date>=b.start&&r.date<=b.end)).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);}
function periodLabel(){const mode=$('period').value;const b=bounds();$('previous-period').disabled=mode==='all';$('next-period').disabled=mode==='all';let label='All time';if(mode==='day')label=anchor.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});if(mode==='month')label=anchor.toLocaleDateString('en-GB',{month:'long',year:'numeric'});if(mode==='year')label=String(anchor.getFullYear());if(mode==='week'){const s=parseDate(b.start),e=parseDate(b.end);label=`${s.toLocaleDateString('en-GB',{day:'numeric',month:'short'})} – ${e.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}`;}$('period-label').textContent=label;}
function categoryIcon(c){return `<span class="category-icon" style="--color:${c.color};--tint:${c.tint}">${icon(c.icon)}</span>`;}
function empty(message,detail,add=false){return `<div class="empty-state"><span class="empty-symbol">✧</span><strong>${message}</strong><p>${detail}</p>${add?'<button class="text-button" data-add>Add your first purchase ↗</button>':''}</div>`;}
function purchaseRow(r){const c=categoryMap.get(r.category);return `<div class="purchase-row">${categoryIcon(c)}<div class="purchase-copy"><strong>${escapeHTML(r.note||r.category)}</strong><p>${r.category} · ${parseDate(r.date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</p></div><span class="purchase-sum">${money(r.cents)}</span><div class="purchase-actions"><button data-edit="${escapeHTML(r.id)}" aria-label="Edit ${escapeHTML(r.note||r.category)}" title="Edit purchase">${icon('edit')}</button><button data-delete="${escapeHTML(r.id)}" aria-label="Delete ${escapeHTML(r.note||r.category)}" title="Delete purchase">${icon('trash')}</button></div></div>`;}
function renderHistory(list){const cat=$('category-filter').value;const visible=list.filter(r=>cat==='all'||r.category===cat);let lastDate='';$('history-list').innerHTML=visible.length?visible.map(r=>{let heading='';if(r.date!==lastDate){heading=`<p class="history-group">${parseDate(r.date).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>`;lastDate=r.date;}return heading+purchaseRow(r);}).join(''):empty('No purchases found',cat!=='all'?'Try another category.':'Purchases in this period will appear here.',!records.length);}
function render(){periodLabel();const list=filtered(),total=list.reduce((sum,r)=>sum+r.cents,0);const totals=categories.map(c=>({...c,cents:list.filter(r=>r.category===c.name).reduce((sum,r)=>sum+r.cents,0)}));$('total-spent').textContent=money(total);$('purchase-count').textContent=`${list.length} purchase${list.length===1?'':'s'}`;$('history-count').textContent=list.length;const circumference=2*Math.PI*116;let offset=0;let arcs='<circle cx="140" cy="140" r="116" fill="none" stroke="#edf1e6" stroke-width="29"/>';totals.filter(c=>c.cents).forEach(c=>{const length=c.cents/total*circumference;const gap=totals.filter(c=>c.cents).length>1?Math.min(5,length*.18):0;arcs+=`<circle cx="140" cy="140" r="116" fill="none" stroke="${c.color}" stroke-width="29" stroke-dasharray="${length-gap} ${circumference-(length-gap)}" stroke-dashoffset="${-offset-gap/2}" transform="rotate(-90 140 140)"><title>${c.name}: ${money(c.cents)}</title></circle>`;offset+=length;});$('spending-chart').innerHTML=arcs;$('spending-chart').setAttribute('aria-label',total?`Spending by category. Total ${money(total)}. ${totals.filter(c=>c.cents).map(c=>`${c.name} ${money(c.cents)}`).join(', ')}`:'No purchases in this period');$('category-list').innerHTML=totals.map(c=>`<button class="category-row" data-add="${c.name}" aria-label="Add a purchase to ${c.name}">${categoryIcon(c)}<span class="category-name">${c.name}</span><span class="category-amount">${money(c.cents)}</span><span class="category-percent">${total?Math.round(c.cents/total*100):0}%</span></button>`).join('');const top=totals.reduce((a,c)=>c.cents>a.cents?c:a,totals[0]);$('chart-insight').textContent=total?`${top.name} makes up ${Math.round(top.cents/total*100)}% of your spending.`:'Your next purchase starts the picture.';renderHistory(list);}
function showView(view){const overview=view==='overview';$('overview').hidden=!overview;$('history').hidden=overview;for(const [id,on] of [['overview-tab',overview],['history-tab',!overview],['mobile-overview',overview],['mobile-history',!overview]]){$(id).classList.toggle('active',on);if(id.endsWith('-tab'))$(id).setAttribute('aria-selected',on);}if(!overview)renderHistory(filtered());}
function selectCategory(name){$('purchase-category').value=name;for(const button of $('category-picker').children){const on=button.dataset.category===name;button.classList.toggle('active',on);button.setAttribute('aria-pressed',on);}}
function openPurchase(category='Food',record=null){editingId=record?.id||null;$('purchase-form').reset();$('form-title').textContent=record?'Edit purchase':'Add a purchase';$('amount').value=record?(record.cents/100).toFixed(2):'';$('note').value=record?.note||'';$('purchase-date').value=record?.date||localDate();$('form-error').textContent='';selectCategory(record?.category||category);$('purchase-dialog').showModal();setTimeout(()=>$('amount').focus(),50);}
$('backup-button').innerHTML=icon('backup');
for(const c of categories){$('purchase-category').add(new Option(c.name,c.name));$('category-filter').add(new Option(c.name,c.name));}
$('category-picker').innerHTML=categories.map(c=>`<button type="button" data-category="${c.name}" style="--color:${c.color}" aria-pressed="false">${icon(c.icon)}${c.name}</button>`).join('');
$('category-picker').addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(b)selectCategory(b.dataset.category);});
document.addEventListener('click',async e=>{const add=e.target.closest('[data-add]');if(add){openPurchase(add.dataset.add||'Food');return;}const edit=e.target.closest('[data-edit]');if(edit){const r=records.find(r=>r.id===edit.dataset.edit);if(r)openPurchase(r.category,r);return;}const del=e.target.closest('[data-delete]');if(del){const r=records.find(r=>r.id===del.dataset.delete);if(r&&await persist(records.filter(x=>x.id!==r.id))){deletedRecord=r;render();notify('Purchase deleted.',true);}}if(e.target.closest('.close-dialog'))e.target.closest('dialog').close();});
$('undo-delete').addEventListener('click',async()=>{if(deletedRecord&&await persist([...records,deletedRecord])){deletedRecord=null;render();notify('Purchase restored.');}});
$('purchase-form').addEventListener('submit',async e=>{e.preventDefault();const raw=$('amount').value.trim().replace(',','.');if(!/^\d{1,9}(\.\d{1,2})?$/.test(raw)){$('form-error').textContent='Enter an amount with up to two decimal places, such as 12.50.';return;}const cents=Math.round(Number(raw)*100);if(cents<=0||cents>99999999999){$('form-error').textContent='Enter an amount greater than €0.00 and up to €999,999,999.99.';return;}const date=$('purchase-date').value;if(!validDate(date)){$('form-error').textContent='Choose a valid date.';return;}const old=records.find(r=>r.id===editingId);const record={id:old?.id||(globalThis.crypto?.randomUUID?.()||`p-${Date.now()}-${Math.random().toString(36).slice(2)}`),cents,category:$('purchase-category').value,note:$('note').value.trim(),date,createdAt:old?.createdAt||Date.now()};const next=old?records.map(r=>r.id===old.id?record:r):[...records,record];if(!await persist(next)){$('form-error').textContent='The purchase could not be saved. Your existing records are unchanged.';return;}$('purchase-dialog').close();anchor=parseDate(date);render();notify(old?'Purchase updated.':'Purchase saved.');});
for(const id of ['overview-tab','mobile-overview'])$(id).addEventListener('click',()=>showView('overview'));
for(const id of ['history-tab','mobile-history'])$(id).addEventListener('click',()=>showView('history'));
$('period').addEventListener('change',render);
function movePeriod(direction){const mode=$('period').value;if(mode==='day')anchor.setDate(anchor.getDate()+direction);if(mode==='week')anchor.setDate(anchor.getDate()+direction*7);if(mode==='month')anchor=new Date(anchor.getFullYear(),anchor.getMonth()+direction,1,12);if(mode==='year')anchor=new Date(anchor.getFullYear()+direction,0,1,12);render();}
$('previous-period').addEventListener('click',()=>movePeriod(-1));$('next-period').addEventListener('click',()=>movePeriod(1));
$('category-filter').addEventListener('change',()=>renderHistory(filtered()));
async function download(content,name,type){if(window.pocketNative){await window.pocketNative.exportFile(content,name);return;}const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export-csv').addEventListener('click',async()=>{const cat=$('category-filter').value;const list=filtered().filter(r=>cat==='all'||r.category===cat);if(!list.length){notify('No purchases to export in this view.');return;}const cell=s=>`"${String(s).replace(/^[=+@-]/,"'$&").replace(/"/g,'""')}"`;try{await download('\uFEFFDate,Category,Amount (EUR),Note\r\n'+list.map(r=>[r.date,r.category,(r.cents/100).toFixed(2),r.note].map(cell).join(',')).join('\r\n'),`pocket-purchases-${localDate()}.csv`,'text/csv;charset=utf-8');notify(window.pocketNative?'CSV sharing finished.':'CSV exported.');}catch{notify('CSV export could not be completed. Try again.');}});
$('backup-button').addEventListener('click',()=>{$('backup-error').textContent='';$('backup-dialog').showModal();});
$('export-backup').addEventListener('click',async()=>{if(!storageReady||!storageHealthy){$('backup-error').textContent='Stored data could not be read. Recover the original browser storage before exporting.';return;}$('backup-error').textContent='';try{await download(JSON.stringify({app:'pocket',version:1,exportedAt:new Date().toISOString(),purchases:records},null,2),`pocket-backup-${localDate()}.json`,'application/json');notify(window.pocketNative?'Backup sharing finished.':'Backup downloaded.');}catch{$('backup-error').textContent='Backup export could not be completed. Try again.';}});
$('import-backup').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>10000000)throw new Error('This file is too large. Choose a Pocket JSON backup under 10 MB.');const data=JSON.parse(await file.text());if(data.app!=='pocket'||data.version!==1||!Array.isArray(data.purchases)||!data.purchases.every(validRecord)||new Set(data.purchases.map(r=>r.id)).size!==data.purchases.length)throw new Error('Choose a valid Pocket backup file.');const existing=new Set(records.map(r=>r.id));const added=data.purchases.filter(r=>!existing.has(r.id));if(!await persist([...records,...added]))throw new Error('The backup could not be saved.');render();$('backup-dialog').close();notify(`${added.length} purchase${added.length===1?'':'s'} restored.`);}catch(err){$('backup-error').textContent=err instanceof SyntaxError?'This file is not a valid JSON backup.':err.message;}e.target.value='';});
window.addEventListener('storage',e=>{if(purchaseStorage||e.key!==STORAGE_KEY)return;try{const data=e.newValue?JSON.parse(e.newValue):[];if(!validRecords(data))throw new Error();records=data;storageHealthy=true;render();}catch{storageHealthy=false;notify('Stored records changed unexpectedly. Reload to recover your data.');}});
render();
const purchasesReady = purchaseStorage ? purchaseStorage.load(validRecords).then(data=>{records=data;storageReady=true;render();}).catch(()=>{storageHealthy=false;storageReady=true;notify('Purchases could not be loaded. Saving is disabled to protect existing data.');}) : Promise.resolve();
if(!storageHealthy)notify('Storage could not be read. Saving is disabled to protect existing data.');
