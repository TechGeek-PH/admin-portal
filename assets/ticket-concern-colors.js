(function(){'use strict';
const page=(location.pathname.split('/').pop()||'').toLowerCase();if(page!=='app-tickets.html')return;
function css(){if(document.getElementById('tgConcernColorCss'))return;const s=document.createElement('style');s.id='tgConcernColorCss';s.textContent=`
.card .desc{font-weight:800!important;padding:9px 10px!important;border-radius:10px!important;border-left:5px solid #7b8da0!important;background:#f5f7fa!important;color:#26384a!important}
.card .desc b{font-size:.78rem!important;font-weight:950!important;text-transform:uppercase!important;letter-spacing:.02em!important}
.card.tg-concern-critical .desc{background:#fff0f2!important;border-left-color:#c51f4a!important;color:#8e1735!important}
.card.tg-concern-warning .desc{background:#fff5e8!important;border-left-color:#df8100!important;color:#8b5200!important}
.card.tg-concern-install .desc{background:#eaf5ff!important;border-left-color:#1674b8!important;color:#075b8e!important}
.card.tg-concern-relocate .desc{background:#f4edff!important;border-left-color:#7d42b5!important;color:#5b2b88!important}
.card.tg-concern-repair .desc{background:#fff8df!important;border-left-color:#c79b00!important;color:#725700!important}
.card.tg-concern-cctv .desc{background:#eafaf7!important;border-left-color:#168b7b!important;color:#0c665a!important}
.card.tg-concern-billing .desc{background:#eef9ee!important;border-left-color:#3b8b43!important;color:#286530!important}
#ticketInfo .tg-issue-highlight{display:block;margin-top:8px;padding:9px 10px;border-radius:9px;background:#fff2e7;color:#8b4a00;font-size:.76rem;font-weight:950;border-left:5px solid #e58a20}
`;document.head.appendChild(s)}
function classify(text){const x=String(text||'').toLowerCase();if(/no internet|offline|los|fiber cut|no signal|disconnected/.test(x))return'critical';if(/slow|intermittent|latency|high ping|packet loss|unstable/.test(x))return'warning';if(/new installation|installation/.test(x))return'install';if(/relocation|relocate|transfer|move/.test(x))return'relocate';if(/cctv|camera|dvr|nvr/.test(x))return'cctv';if(/billing|payment|collection|balance/.test(x))return'billing';if(/repair|troubleshoot|fault|router|onu|modem/.test(x))return'repair';return''}
function apply(){css();document.querySelectorAll('.card').forEach(card=>{const d=card.querySelector('.desc');if(!d)return;['critical','warning','install','relocate','repair','cctv','billing'].forEach(k=>card.classList.remove('tg-concern-'+k));const k=classify(d.textContent);if(k)card.classList.add('tg-concern-'+k)});const ti=document.getElementById('ticketInfo');if(ti&&!ti.querySelector('.tg-issue-highlight')){const html=ti.innerHTML,match=html.match(/<b>Issue:<\/b>\s*([^<]+)/i);if(match&&match[1].trim()){const x=document.createElement('span');x.className='tg-issue-highlight';x.textContent='CONCERN / SERVICE: '+match[1].trim();ti.appendChild(x)}}}
function start(){apply();new MutationObserver(()=>apply()).observe(document.body,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();