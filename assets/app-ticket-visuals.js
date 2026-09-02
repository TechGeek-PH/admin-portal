(function(){'use strict';
const page=(location.pathname.split('/').pop()||'').toLowerCase();
if(page!=='app.html'&&page!=='app')return;
const ACCOUNT_BAD=new Set(['','pending','none','n/a','na','-','—','null','undefined']);
function ensureCss(){if(document.getElementById('tgAppTicketVisualCss'))return;const s=document.createElement('style');s.id='tgAppTicketVisualCss';s.textContent=`
#ticketRecords .ticket .issue{margin-top:7px!important;padding:10px 11px!important;border-radius:10px!important;border-left:5px solid #8191a3!important;background:#f5f7fa!important;color:#24364a!important;font-size:.76rem!important;font-weight:950!important;line-height:1.35!important}
#ticketRecords .ticket.tg-issue-critical .issue{background:#fff0f2!important;border-left-color:#c51f4a!important;color:#941737!important}
#ticketRecords .ticket.tg-issue-warning .issue{background:#fff5e8!important;border-left-color:#df8100!important;color:#8b5200!important}
#ticketRecords .ticket.tg-issue-install .issue{background:#eaf5ff!important;border-left-color:#1674b8!important;color:#075b8e!important}
#ticketRecords .ticket.tg-issue-relocate .issue{background:#f4edff!important;border-left-color:#7d42b5!important;color:#5b2b88!important}
#ticketRecords .ticket.tg-issue-repair .issue{background:#fff8df!important;border-left-color:#c79b00!important;color:#725700!important}
#ticketRecords .ticket.tg-issue-cctv .issue{background:#eafaf7!important;border-left-color:#168b7b!important;color:#0c665a!important}
#ticketRecords .ticket.tg-issue-billing .issue{background:#eef9ee!important;border-left-color:#3b8b43!important;color:#286530!important}
#ticketRecords .tg-app-account{display:grid;place-items:center;gap:2px;width:100%;margin:10px 0;padding:10px 12px;border:1px solid #91c8ad;border-radius:10px;background:linear-gradient(180deg,#eefaf4,#f9fffb);text-align:center}
#ticketRecords .tg-app-account span{color:#60788d;font-size:.56rem;font-weight:950;letter-spacing:.06em;text-transform:uppercase}
#ticketRecords .tg-app-account b{color:#116447;font-size:.94rem;font-weight:1000;letter-spacing:.035em;overflow-wrap:anywhere}
`;document.head.appendChild(s)}
function classify(text){const x=String(text||'').toLowerCase();if(/no internet|offline|\blos\b|fiber cut|no signal|no connection|disconnected/.test(x))return'critical';if(/slow|intermittent|latency|high ping|packet loss|unstable/.test(x))return'warning';if(/new installation|internet installation|\binstallation\b/.test(x))return'install';if(/relocation|relocate|transfer|move/.test(x))return'relocate';if(/cctv|camera|dvr|nvr/.test(x))return'cctv';if(/billing|payment|collection|balance/.test(x))return'billing';if(/repair|troubleshoot|fault|router|onu|modem/.test(x))return'repair';return''}
function accountFrom(card){const d=card.querySelector('.detail');if(!d)return'';const m=String(d.innerHTML||'').match(/<b>Account:<\/b>\s*([^<]+)/i);if(!m)return'';const a=String(m[1]||'').replace(/&nbsp;/gi,' ').trim();return ACCOUNT_BAD.has(a.toLowerCase())?'':a}
function esc(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function decorateCard(card){if(!(card instanceof Element))return;const issue=card.querySelector('.issue'),detail=card.querySelector('.detail');const combined=[issue&&issue.textContent,detail&&detail.textContent].filter(Boolean).join(' ');['critical','warning','install','relocate','repair','cctv','billing'].forEach(k=>card.classList.remove('tg-issue-'+k));const kind=classify(combined);if(kind)card.classList.add('tg-issue-'+kind);const acct=accountFrom(card);let badge=card.querySelector('.tg-app-account');if(!acct){if(badge)badge.remove();return}if(!badge){badge=document.createElement('div');badge.className='tg-app-account';const chips=card.querySelector('.chips');if(chips)card.insertBefore(badge,chips);else if(issue)issue.insertAdjacentElement('afterend',badge);else card.appendChild(badge)}badge.innerHTML='<span>Account No.</span><b>'+esc(acct)+'</b>'}
function apply(){ensureCss();document.querySelectorAll('#ticketRecords .ticket').forEach(decorateCard)}
function start(){ensureCss();apply();const root=document.getElementById('ticketRecords');if(root)new MutationObserver(apply).observe(root,{childList:true,subtree:true});window.addEventListener('message',e=>{if(e.origin===location.origin&&e.data&&e.data.type==='tg-clients-changed')setTimeout(apply,300)});window.addEventListener('storage',e=>{if(e.key==='tg_clients_changed_at')setTimeout(apply,300)})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();