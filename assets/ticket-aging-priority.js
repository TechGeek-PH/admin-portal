(function(){'use strict';
if(window.__TG_TICKET_AGING_PRIORITY__)return;
window.__TG_TICKET_AGING_PRIORITY__=true;

const DAY=24*60*60*1000;
const CLOSED_RE=/\b(done|resolved|completed|complete|closed|cancelled|canceled)\b/i;
const LEVELS=[
  {rank:0,key:'normal',label:'NORMAL'},
  {rank:1,key:'priority',label:'PRIORITY'},
  {rank:2,key:'high',label:'HIGH PRIORITY'},
  {rank:3,key:'critical',label:'CRITICAL'}
];

function ensureCss(){
  if(document.getElementById('tgTicketAgingCss'))return;
  const s=document.createElement('style');
  s.id='tgTicketAgingCss';
  s.textContent=`
.tg-aging-legend{margin:10px 0;padding:10px 12px;border:1px solid #d7e1eb;border-left:5px solid #064f83;border-radius:10px;background:#f8fbff;color:#42566c;font-size:.68rem;font-weight:750;line-height:1.45}
.tg-aging-legend b{color:#064f83}.tg-aging-legend .tg-aging-rules{display:block;margin-top:2px;color:#64748b;font-weight:650}
.tg-aging-priority{display:inline-flex!important;align-items:center!important;gap:4px!important;padding:5px 8px!important;border-radius:999px!important;font-size:.58rem!important;font-weight:1000!important;letter-spacing:.015em!important;white-space:nowrap!important}
.tg-aging-priority.tg-age-normal{background:#eef2f6!important;color:#5e6f82!important}
.tg-aging-priority.tg-age-priority{background:#fff4d8!important;color:#8a5b00!important}
.tg-aging-priority.tg-age-high{background:#fff0df!important;color:#ad5300!important}
.tg-aging-priority.tg-age-critical{background:#ffe8ee!important;color:#a4143a!important;box-shadow:0 0 0 1px #f2b5c5 inset!important}
#ticketRecords .ticket.tg-age-card-priority{box-shadow:0 0 0 1px #ead090 inset}
#ticketRecords .ticket.tg-age-card-high{box-shadow:0 0 0 2px #efb36e inset}
#ticketRecords .ticket.tg-age-card-critical{box-shadow:0 0 0 2px #e38199 inset}
.tg-aging-table-wrap{display:flex;flex-direction:column;gap:4px;align-items:flex-start}
.tg-aging-original{font-size:.64rem;color:#64748b;font-weight:700}
tbody tr.tg-age-row-priority td:first-child{border-left:4px solid #d6a326!important}
tbody tr.tg-age-row-high td:first-child{border-left:4px solid #dc7511!important}
tbody tr.tg-age-row-critical td:first-child{border-left:4px solid #c91448!important}
`;
  document.head.appendChild(s);
}

function clean(v){return String(v==null?'':v).trim()}
function level(rank){return LEVELS[Math.max(0,Math.min(3,Number(rank)||0))]}
function manualRank(text){
  const x=clean(text).toLowerCase();
  if(/critical|urgent|emergency|p1|sev\s*1/.test(x))return 3;
  if(/high priority|\bhigh\b|p2|sev\s*2/.test(x))return 2;
  if(/\bpriority\b|medium|p3|sev\s*3/.test(x))return 1;
  return 0;
}
function parseDate(text){
  const x=clean(text);
  let m=x.match(/\b(20\d{2})[-\/]([01]\d)[-\/]([0-3]\d)\b/);
  if(m){const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));if(!isNaN(d))return d.getTime()}
  m=x.match(/\bTKT-(20\d{2})([01]\d)([0-3]\d)-/i);
  if(m){const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));if(!isNaN(d))return d.getTime()}
  m=x.match(/\b([01]?\d)[\/]([0-3]?\d)[\/](20\d{2})\b/);
  if(m){const d=new Date(Number(m[3]),Number(m[1])-1,Number(m[2]));if(!isNaN(d))return d.getTime()}
  const d=new Date(x);return isNaN(d)?0:d.getTime();
}
function ageInfo(createdMs,manual){
  const now=Date.now();
  const hours=createdMs?Math.max(0,(now-createdMs)/3600000):0;
  const aging=hours>=72?3:hours>=48?2:hours>=24?1:0;
  const rank=Math.max(aging,manualRank(manual));
  return {rank,level:level(rank),hours,createdMs:createdMs||now};
}
function ageText(hours){
  if(hours<24)return Math.max(0,Math.floor(hours))+'h old';
  const days=Math.floor(hours/24),hrs=Math.floor(hours%24);
  return days+'d'+(hrs?' '+hrs+'h':'')+' old';
}
function isClosedText(text){return CLOSED_RE.test(clean(text))}
function chipHtml(info){return '<span class="tg-aging-priority tg-age-'+info.level.key+'" title="Ticket Aging Priority">AGING · '+info.level.label+' · '+ageText(info.hours)+'</span>'}
function ensureLegend(anchor,mode){
  if(!anchor||anchor.querySelector(':scope > .tg-aging-legend'))return;
  const box=document.createElement('div');
  box.className='tg-aging-legend';
  box.innerHTML='<b>Ticket Aging Priority</b> — older unresolved tickets automatically move up the queue.'+
    '<span class="tg-aging-rules">&lt;24h Normal · 24–47h Priority · 48–71h High Priority · 72h+ Critical. Manual priority can raise a ticket further; aging never lowers it.</span>';
  if(mode==='cards'){
    const tabs=anchor.querySelector('.ticket-tabs');
    if(tabs&&tabs.nextSibling)anchor.insertBefore(box,tabs.nextSibling);else anchor.prepend(box);
  }else{
    const tableWrap=anchor.querySelector('.table-wrap');
    if(tableWrap)anchor.insertBefore(box,tableWrap);else anchor.prepend(box);
  }
}
function cardCreated(card){
  const chips=card.querySelectorAll('.chips .chip');
  if(chips[1]){const d=parseDate(chips[1].textContent);if(d)return d}
  const h=card.querySelector('h3');return parseDate(h&&h.textContent||card.textContent);
}
function cardManual(card){const c=card.querySelector('.chips .chip');return c?c.textContent:''}
function cardClosed(card){const badge=card.querySelector('.badge');return !!(badge&&(badge.classList.contains('closed')||isClosedText(badge.textContent)))}
function decorateCard(card){
  const closed=cardClosed(card),created=cardCreated(card),info=ageInfo(created,cardManual(card));
  card.dataset.tgAgeRank=closed?'-1':String(info.rank);
  card.dataset.tgCreatedMs=String(info.createdMs||0);
  card.dataset.tgClosed=closed?'1':'0';
  card.classList.remove('tg-age-card-priority','tg-age-card-high','tg-age-card-critical');
  if(!closed&&info.rank===1)card.classList.add('tg-age-card-priority');
  if(!closed&&info.rank===2)card.classList.add('tg-age-card-high');
  if(!closed&&info.rank===3)card.classList.add('tg-age-card-critical');
  let chip=card.querySelector('.tg-aging-priority');
  if(closed){if(chip)chip.remove();return}
  if(!chip){
    const chips=card.querySelector('.chips');
    if(!chips)return;
    chip=document.createElement('span');chips.appendChild(chip);
  }
  chip.className='tg-aging-priority tg-age-'+info.level.key;
  chip.title='Ticket Aging Priority';
  chip.textContent='AGING · '+info.level.label+' · '+ageText(info.hours);
}
function sortCards(root){
  const cards=Array.from(root.querySelectorAll(':scope > article.ticket'));
  if(cards.length<2)return;
  const desired=cards.slice().sort((a,b)=>{
    const ac=a.dataset.tgClosed==='1',bc=b.dataset.tgClosed==='1';
    if(ac!==bc)return ac?1:-1;
    if(ac&&bc)return 0;
    const r=Number(b.dataset.tgAgeRank||0)-Number(a.dataset.tgAgeRank||0);if(r)return r;
    return Number(a.dataset.tgCreatedMs||0)-Number(b.dataset.tgCreatedMs||0);
  });
  if(desired.some((n,i)=>n!==cards[i]))desired.forEach(n=>root.appendChild(n));
}
function tableHeaderIndex(tbody,re){
  const table=tbody.closest('table');if(!table)return-1;
  return Array.from(table.querySelectorAll('thead th')).findIndex(th=>re.test(clean(th.textContent)));
}
function rowCell(row,index,labelRe){
  if(index>=0&&row.cells[index])return row.cells[index];
  return Array.from(row.cells).find(td=>labelRe.test(clean(td.getAttribute('data-label'))))||null;
}
function rowTicketText(row,ticketIndex){const c=rowCell(row,ticketIndex,/ticket/i);return clean(c&&c.textContent||row.textContent)}
function rowStatusText(row,statusIndex){const c=rowCell(row,statusIndex,/status/i);return clean(c&&c.textContent)}
function decorateRow(row,meta){
  if(!row.cells.length||row.cells.length<2)return;
  const ticketText=rowTicketText(row,meta.ticketIndex),status=rowStatusText(row,meta.statusIndex),closed=isClosedText(status);
  const dateCell=rowCell(row,meta.dateIndex,/date created/i);
  const created=parseDate((dateCell&&dateCell.textContent)||ticketText);
  const pcell=rowCell(row,meta.priorityIndex,/priority/i);
  const manual=pcell?clean((pcell.querySelector('.tg-aging-original')||pcell).textContent):'';
  const info=ageInfo(created,manual);
  row.dataset.tgAgeRank=closed?'-1':String(info.rank);row.dataset.tgCreatedMs=String(info.createdMs||0);row.dataset.tgClosed=closed?'1':'0';
  row.classList.remove('tg-age-row-priority','tg-age-row-high','tg-age-row-critical');
  if(!closed&&info.rank===1)row.classList.add('tg-age-row-priority');
  if(!closed&&info.rank===2)row.classList.add('tg-age-row-high');
  if(!closed&&info.rank===3)row.classList.add('tg-age-row-critical');
  if(!pcell||closed)return;
  let wrap=pcell.querySelector('.tg-aging-table-wrap');
  if(!wrap){
    const original=clean(pcell.textContent)||'Normal';
    pcell.textContent='';wrap=document.createElement('div');wrap.className='tg-aging-table-wrap';
    const o=document.createElement('span');o.className='tg-aging-original';o.textContent='Manual: '+original;wrap.appendChild(o);pcell.appendChild(wrap);
  }
  let chip=wrap.querySelector('.tg-aging-priority');
  if(!chip){chip=document.createElement('span');wrap.prepend(chip)}
  chip.className='tg-aging-priority tg-age-'+info.level.key;chip.title='Ticket Aging Priority';chip.textContent=info.level.label+' · '+ageText(info.hours);
}
function sortRows(tbody){
  const rows=Array.from(tbody.querySelectorAll(':scope > tr')).filter(r=>r.cells&&r.cells.length>1&&!r.querySelector('td[colspan]'));
  if(rows.length<2)return;
  const desired=rows.slice().sort((a,b)=>{
    const ac=a.dataset.tgClosed==='1',bc=b.dataset.tgClosed==='1';if(ac!==bc)return ac?1:-1;if(ac&&bc)return 0;
    const r=Number(b.dataset.tgAgeRank||0)-Number(a.dataset.tgAgeRank||0);if(r)return r;
    return Number(a.dataset.tgCreatedMs||0)-Number(b.dataset.tgCreatedMs||0);
  });
  if(desired.some((n,i)=>n!==rows[i]))desired.forEach(n=>tbody.appendChild(n));
}
function applyCards(root,observer){
  if(observer)observer.disconnect();
  try{ensureLegend(root,'cards');root.querySelectorAll(':scope > article.ticket').forEach(decorateCard);sortCards(root)}finally{if(observer)observer.observe(root,{childList:true})}
}
function applyTable(tbody,observer){
  if(observer)observer.disconnect();
  try{
    const host=tbody.closest('.pane,.ticket-panel,.panel')||tbody.parentElement;
    ensureLegend(host,'table');
    const meta={
      ticketIndex:tableHeaderIndex(tbody,/^ticket( id)?$/i),
      dateIndex:tableHeaderIndex(tbody,/date created/i),
      priorityIndex:tableHeaderIndex(tbody,/priority/i),
      statusIndex:tableHeaderIndex(tbody,/status/i)
    };
    tbody.querySelectorAll(':scope > tr').forEach(r=>decorateRow(r,meta));sortRows(tbody);
  }finally{if(observer)observer.observe(tbody,{childList:true})}
}
function watch(root,kind){
  let queued=false;let obs;
  const run=()=>{queued=false;kind==='cards'?applyCards(root,obs):applyTable(root,obs)};
  obs=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(run)});
  run();obs.observe(root,{childList:true});
}
function start(){
  ensureCss();
  const cards=document.getElementById('ticketRecords');if(cards)watch(cards,'cards');
  ['activeRows','activeTicketRows'].forEach(id=>{const t=document.getElementById(id);if(t)watch(t,'table')});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
