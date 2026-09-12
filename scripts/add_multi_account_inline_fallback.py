from pathlib import Path

index=Path('client/index.html')
html=index.read_text()

fallback=r'''<script id="tgMultiAccountFallback">
(()=>{'use strict';
if(window.TechGeekMultiAccountNative)return;
const TOKEN_KEY='tg_client_portal_token',db=window.TechGeekSupabase,$=id=>document.getElementById(id);
const peso=v=>'₱'+Number(v||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state=null,busy=false;
async function rpc(name,args){if(!db)throw new Error('Portal connection is not ready.');const {data,error}=await db.rpc(name,args);if(error)throw error;return data}
function note(text,kind='err'){const n=$('linkedAccountNotice');if(!n)return;n.textContent=text;n.className='notice show '+kind}
function clearNote(){const n=$('linkedAccountNotice');if(n){n.textContent='';n.className='notice'}}
function balance(a){const n=Number(a?.balance||0);return n>0?peso(n):'Paid / ₱0.00'}
function render(){const rows=state?.accounts||[],active=String(state?.active_account_no||'').toUpperCase(),primary=String(state?.primary_account_no||'').toUpperCase(),strip=$('accountStrip'),chips=$('accountChips'),list=$('linkedAccountsList');
 if(strip&&chips){strip.classList.toggle('hidden',rows.length<=1);chips.innerHTML=rows.map(a=>{const no=String(a.account_no||''),sel=no.toUpperCase()===active;return `<button class="account-chip ${sel?'active':''}" type="button" data-fallback-account="${encodeURIComponent(no)}">${esc(no)}<small>${esc(balance(a))}</small></button>`}).join('')}
 if(list){list.innerHTML=rows.length?rows.map(a=>{const no=String(a.account_no||''),isPrimary=no.toUpperCase()===primary,isActive=no.toUpperCase()===active,tags=[isPrimary?'Primary':'',isActive?'Selected':''].filter(Boolean).join(' · ');return `<div class="linked-account"><div class="linked-account-main"><b>${esc(no)}${tags?` · ${esc(tags)}`:''}</b><span>${esc(a.client_name||'Client')} · ${esc(a.plan||'No plan')} · ${esc(a.service_address||'')}</span></div><div class="linked-account-side"><strong>${esc(balance(a))}</strong><small>${esc(a.billing_status||a.account_status||'')}</small>${!isPrimary?`<button class="mini-btn" type="button" data-fallback-unlink="${encodeURIComponent(no)}">Remove</button>`:''}</div></div>`}).join(''):'<div class="muted" style="padding:10px 0">No linked accounts yet.</div>'}
}
async function load(){const token=localStorage.getItem(TOKEN_KEY);if(!token||busy)return;busy=true;try{const r=await rpc('client_portal_get_accounts',{p_token:token});if(r?.ok){state=r;render()}}catch(e){console.error('Account list:',e)}finally{busy=false}}
async function link(){clearNote();const token=localStorage.getItem(TOKEN_KEY),account=$('linkAccountNo')?.value.trim(),phone=$('linkPhone')?.value.trim();if(!token)return;if(!account||!phone)return note('Enter the account number and registered mobile number.');const btn=$('linkAccountBtn');if(btn){btn.disabled=true;btn.textContent='Verifying account…'}try{const r=await rpc('client_portal_link_account',{p_token:token,p_account_no:account,p_phone:phone});if(!r?.ok)return note(r?.message||'Unable to link this account.');if($('linkAccountNo'))$('linkAccountNo').value='';if($('linkPhone'))$('linkPhone').value='';note(r?.message||'Account linked successfully.','ok');await load()}catch(e){note(e.message||'Unable to link this account.')}finally{if(btn){btn.disabled=false;btn.textContent='+ Link Another Account'}}}
async function switchTo(no){const token=localStorage.getItem(TOKEN_KEY);if(!token||!no)return;try{const r=await rpc('client_portal_switch_account',{p_token:token,p_account_no:no});if(!r?.ok)throw new Error(r?.message||'Unable to switch account.');location.reload()}catch(e){note(e.message||'Unable to switch account.')}}
async function unlink(no){const token=localStorage.getItem(TOKEN_KEY);if(!token||!no)return;if(!confirm(`Remove ${no} from your linked accounts? This does not delete the TechGeekPH account.`))return;try{const r=await rpc('client_portal_unlink_account',{p_token:token,p_account_no:no});if(!r?.ok)return note(r?.message||'Unable to remove this linked account.');note(r?.message||'Linked account removed.','ok');await load()}catch(e){note(e.message||'Unable to remove this linked account.')}}
$('linkAccountBtn')?.addEventListener('click',e=>{e.stopImmediatePropagation();link()},{capture:true});
$('linkPhone')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();link()}});
$('linkAccountNo')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();link()}});
$('accountChips')?.addEventListener('click',e=>{const b=e.target.closest?.('[data-fallback-account]');if(b)switchTo(decodeURIComponent(b.dataset.fallbackAccount||''))});
$('linkedAccountsList')?.addEventListener('click',e=>{const b=e.target.closest?.('[data-fallback-unlink]');if(b)unlink(decodeURIComponent(b.dataset.fallbackUnlink||''))});
$('loginBtn')?.addEventListener('click',()=>setTimeout(load,1200));
load();
let tries=0;const t=setInterval(()=>{tries++;if(localStorage.getItem(TOKEN_KEY))load();if(tries>12)clearInterval(t)},1000);
})();
</script>'''

if 'id="tgMultiAccountFallback"' not in html:
    marker='<script src="chat-center.js?v=20260904-drawer1"></script>'
    if marker not in html:
        raise SystemExit('chat-center script marker not found')
    html=html.replace(marker, marker+'\n'+fallback,1)
index.write_text(html)

app=Path('client/app.js')
js=app.read_text()
if 'window.TechGeekMultiAccountNative=true;' not in js:
    js=js.replace("(()=>{'use strict';", "(()=>{'use strict';\nwindow.TechGeekMultiAccountNative=true;",1)
app.write_text(js)
print('Inline multi-account fallback added.')
