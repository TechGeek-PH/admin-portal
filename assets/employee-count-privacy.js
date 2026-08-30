(function(){'use strict';
const BASE='https://tcexzfztdgximrzuosqs.supabase.co';
const KEY='sb_publishable_8H8_S7NTWvzPCLvYUe2C4g_k3Ltjfiz';
const STORE='sb-tcexzfztdgximrzuosqs-auth-token',ALT='tg_session_v3';
let active=false,checking=false;
function isEmployee(v){return /(^|\b)EMPLOYEE(\b|$)/i.test(String(v||''))}
function getSession(){for(const k of [STORE,ALT]){try{const v=JSON.parse(localStorage.getItem(k)||'null');if(v&&v.access_token)return v;if(v&&v.currentSession&&v.currentSession.access_token)return v.currentSession;if(v&&v.session&&v.session.access_token)return v.session}catch(_){}}return null}
function jwtSub(token){try{const p=String(token||'').split('.')[1];if(!p)return'';const s=p.replace(/-/g,'+').replace(/_/g,'/');return JSON.parse(decodeURIComponent(Array.prototype.map.call(atob(s),'%'+('00'+arguments[0].charCodeAt(0).toString(16)).slice(-2)).join(''))).sub||''}catch(_){try{const p=String(token||'').split('.')[1];if(!p)return'';return JSON.parse(atob(p.replace(/-/g,'+').replace(/_/g,'/'))).sub||''}catch(__){return''}}}
function localRole(){const el=document.getElementById('topRole')||document.getElementById('welcomeRole');return el?el.textContent:''}
function parentRole(){try{if(window.parent!==window){const el=window.parent.document.getElementById('topRole')||window.parent.document.getElementById('welcomeRole');return el?el.textContent:''}}catch(_){}return''}
async function remoteRole(){const s=getSession();if(!s)return'';const uid=(s.user&&s.user.id)||jwtSub(s.access_token);if(!uid)return'';try{const r=await fetch(BASE+'/rest/v1/staff_profiles?select=role&user_id=eq.'+encodeURIComponent(uid)+'&limit=1',{headers:{apikey:KEY,authorization:'Bearer '+s.access_token,accept:'application/json'},cache:'no-store'});if(!r.ok)return'';const a=await r.json();return a&&a[0]?a[0].role||'':''}catch(_){return''}}
function hideAppCounts(doc){const stats=doc.getElementById('stats');if(!stats)return;stats.querySelectorAll('.stat').forEach(card=>{const label=String(card.querySelector('span')&&card.querySelector('span').textContent||'').trim().toUpperCase();if(label==='TOTAL CLIENTS'||label==='ACTIVE CLIENTS')card.style.setProperty('display','none','important')})}
function stripNapCounts(doc){const nap=doc.getElementById('nap');if(!nap)return;Array.from(nap.options||[]).forEach(o=>{const clean=String(o.textContent||'').replace(/\s*\(\s*\d+\s*\)\s*$/,'');if(clean!==o.textContent)o.textContent=clean})}
function hideModuleCounts(doc,pathname){const p=String(pathname||'').toLowerCase();if(p.includes('client-proof-photos')){const summary=doc.querySelector('.summary');if(summary)summary.style.setProperty('display','none','important')}
if(p.includes('network-monitor')){const summary=doc.querySelector('.summary');if(summary)summary.style.setProperty('display','none','important');doc.querySelectorAll('.pager span').forEach(x=>x.style.setProperty('display','none','important'));stripNapCounts(doc)}}
function applyDoc(doc,pathname){if(!doc)return;hideAppCounts(doc);hideModuleCounts(doc,pathname||doc.location&&doc.location.pathname||'')}
function applyFrame(){const f=document.getElementById('frame');if(!f)return;try{applyDoc(f.contentDocument,f.contentWindow.location.pathname)}catch(_){}}
function enforce(){if(!active)return;applyDoc(document,location.pathname);applyFrame()}
function activate(){if(active)return;active=true;document.documentElement.classList.add('employee-count-private');enforce();const frame=document.getElementById('frame');if(frame)frame.addEventListener('load',()=>setTimeout(applyFrame,0));new MutationObserver(()=>enforce()).observe(document.documentElement,{childList:true,subtree:true,characterData:true});setInterval(enforce,1500)}
async function detect(){if(active||checking)return;const role=parentRole()||localRole();if(isEmployee(role)){activate();return}if(role)return;checking=true;const rr=await remoteRole();checking=false;if(isEmployee(rr))activate()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',detect,{once:true});else detect();
new MutationObserver(()=>detect()).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();