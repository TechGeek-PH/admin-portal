from pathlib import Path

index = Path('client/index.html')
html = index.read_text()

css = r'''
/* Multi-account switcher */
.account-strip{margin:0 0 14px;background:#fff;border:1px solid var(--line);border-radius:15px;padding:10px 12px;box-shadow:var(--shadow)}
.account-strip-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}.account-strip-head b{font-size:.68rem;color:var(--ink)}.account-strip-head span{font-size:.56rem;color:var(--m)}
.account-chips{display:flex;gap:7px;overflow-x:auto;padding-bottom:2px;scrollbar-width:thin}.account-chip{flex:0 0 auto;border:1px solid #d6e2eb;border-radius:999px;background:#f7fafc;color:var(--b2);min-height:34px;padding:0 11px;font-size:.62rem;font-weight:850;cursor:pointer;white-space:nowrap}.account-chip.active{background:linear-gradient(135deg,var(--b2),var(--b));border-color:transparent;color:#fff}.account-chip small{font-size:.52rem;font-weight:750;opacity:.82;margin-left:4px}
.linked-account-list{display:grid;gap:8px;margin-top:12px}.linked-account{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--line2);border-radius:12px;padding:11px 12px;background:#f9fbfc}.linked-account-main{min-width:0}.linked-account-main b{display:block;font-size:.75rem;color:var(--ink)}.linked-account-main span{display:block;margin-top:3px;font-size:.59rem;color:var(--m);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.linked-account-side{text-align:right;flex:0 0 auto}.linked-account-side strong{display:block;font-size:.66rem;color:var(--b)}.linked-account-side small{display:block;margin-top:3px;font-size:.53rem;color:var(--m)}.mini-btn{border:1px solid #d8e2e9;background:#fff;color:var(--bad);border-radius:9px;min-height:30px;padding:0 9px;font-size:.56rem;font-weight:850;cursor:pointer;margin-top:6px}.link-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}.link-help{margin-top:9px;color:var(--m);font-size:.6rem;line-height:1.5}
@media(max-width:640px){.link-grid{grid-template-columns:1fr}.account-strip{margin-left:0;margin-right:0}}
'''
if '/* Multi-account switcher */' not in html:
    html = html.replace('</style>', css + '\n</style>', 1)

strip = '''  <main class="wrap">\n    <div id="accountStrip" class="account-strip hidden">\n      <div class="account-strip-head"><b>My Accounts</b><span>Tap an account to switch dashboard &amp; payment</span></div>\n      <div id="accountChips" class="account-chips"></div>\n    </div>'''
if 'id="accountStrip"' not in html:
    html = html.replace('  <main class="wrap">', strip, 1)

linked_section = '''
      <section class="section">
        <h2>My Linked Accounts</h2>
        <p class="section-sub">Use one Client Portal login for multiple verified TechGeekPH accounts. Select an account above to view its dashboard and pay its bill.</p>
        <div id="linkedAccountNotice" class="notice"></div>
        <div id="linkedAccountsList" class="linked-account-list"></div>
        <div class="link-grid">
          <div class="field"><label>Account Number</label><input id="linkAccountNo" autocomplete="off" placeholder="SATR0001"></div>
          <div class="field"><label>Registered Mobile Number</label><input id="linkPhone" inputmode="tel" autocomplete="tel" placeholder="09XXXXXXXXX"></div>
        </div>
        <button id="linkAccountBtn" class="btn secondary" style="width:100%;margin-top:10px">+ Link Another Account</button>
        <div class="link-help">For security, the account number and registered mobile number must match the account being linked. Billing records stay separate; switching only changes which verified account is currently open.</div>
      </section>
'''
marker = '      <div class="pane-heading"><div><h1>My Profile</h1><p>Update your personal and contact details securely.</p></div></div>\n\n      <section class="section">\n        <h2>Personal Details</h2>'
if 'id="linkedAccountsList"' not in html:
    if marker not in html:
        raise SystemExit('Account profile insertion marker not found')
    replacement = '      <div class="pane-heading"><div><h1>My Profile</h1><p>Update your personal and contact details securely.</p></div></div>\n' + linked_section + '\n      <section class="section">\n        <h2>Personal Details</h2>'
    html = html.replace(marker, replacement, 1)

html = html.replace('app.js?v=20260912-profile1', 'app.js?v=20260912-multi1')
index.write_text(html)

app = Path('client/app.js')
js = app.read_text()
js = js.replace(
    "const $=id=>document.getElementById(id),db=window.TechGeekSupabase,TOKEN_KEY='tg_client_portal_token';let data=null,loadRetryTimer=null,profileOriginal=null,profileDirty=false,profileLoading=false;",
    "const $=id=>document.getElementById(id),db=window.TechGeekSupabase,TOKEN_KEY='tg_client_portal_token';let data=null,loadRetryTimer=null,profileOriginal=null,profileDirty=false,profileLoading=false,accountsState=null,accountsLoading=false,switchingAccount=false;"
)
js = js.replace(
    "data=r;render();showApp();paymentReminder();if(!profileOriginal&&!profileLoading)loadProfile(false);if(!profileOriginal&&!profileLoading)loadProfile(false)",
    "data=r;render();showApp();paymentReminder();loadAccounts(false);if(!profileOriginal&&!profileLoading)loadProfile(false)"
)

multi_code = r'''
async function loadAccounts(force=false){if(accountsLoading)return;const token=localStorage.getItem(TOKEN_KEY);if(!token)return;accountsLoading=true;try{const r=await rpc('client_portal_get_accounts',{p_token:token});if(!r?.ok){if(r?.code==='SESSION_INVALID'){localStorage.removeItem(TOKEN_KEY);showLogin()}return}accountsState=r;renderAccounts()}catch(e){console.error('Linked accounts load error:',e)}finally{accountsLoading=false}}
function accountBalanceText(a){const n=Number(a?.balance||0);return n>0?peso(n):'Paid / ₱0.00'}
function renderAccounts(){const rows=accountsState?.accounts||[],active=String(accountsState?.active_account_no||data?.client?.account_no||'').toUpperCase(),primary=String(accountsState?.primary_account_no||'').toUpperCase();const strip=$('accountStrip'),chips=$('accountChips'),list=$('linkedAccountsList');if(strip&&chips){strip.classList.toggle('hidden',rows.length<=1);chips.innerHTML=rows.map(a=>{const no=String(a.account_no||''),isActive=no.toUpperCase()===active;return `<button class="account-chip ${isActive?'active':''}" data-account="${encodeURIComponent(no)}" type="button">${esc(no)}<small>${esc(accountBalanceText(a))}</small></button>`}).join('')}if(list){list.innerHTML=rows.length?rows.map(a=>{const no=String(a.account_no||''),isPrimary=no.toUpperCase()===primary,isActive=no.toUpperCase()===active;const tags=[isPrimary?'Primary':'',isActive?'Selected':''].filter(Boolean).join(' · ');return `<div class="linked-account"><div class="linked-account-main"><b>${esc(no)}${tags?` · ${esc(tags)}`:''}</b><span>${esc(a.client_name||'Client')} · ${esc(a.plan||'No plan')} · ${esc(a.service_address||'')}</span></div><div class="linked-account-side"><strong>${esc(accountBalanceText(a))}</strong><small>${esc(a.billing_status||a.account_status||'')}</small>${!isPrimary?`<button class="mini-btn" type="button" data-unlink="${encodeURIComponent(no)}">Remove</button>`:''}</div></div>`}).join(''):empty('No linked accounts yet.')} }
async function switchAccount(accountNo){if(switchingAccount||!accountNo)return;if(String(data?.client?.account_no||'').toUpperCase()===String(accountNo).toUpperCase())return;if(profileDirty&&!confirm('You have unsaved profile changes. Switch account and discard those changes?'))return;const token=localStorage.getItem(TOKEN_KEY);if(!token)return showLogin();switchingAccount=true;try{const r=await rpc('client_portal_switch_account',{p_token:token,p_account_no:accountNo});if(!r?.ok)throw new Error(r?.message||'Unable to switch account.');profileOriginal=null;profileDirty=false;location.reload()}catch(e){alert(e.message||'Unable to switch account.');switchingAccount=false}}
async function linkAccount(){clearNotice('linkedAccountNotice');const account=$('linkAccountNo')?.value.trim(),phone=$('linkPhone')?.value.trim();if(!account||!phone)return notice('linkedAccountNotice','Enter the account number and registered mobile number.');const token=localStorage.getItem(TOKEN_KEY);if(!token)return showLogin();const btn=$('linkAccountBtn');btn.disabled=true;btn.textContent='Verifying account…';try{const r=await rpc('client_portal_link_account',{p_token:token,p_account_no:account,p_phone:phone});if(!r?.ok)return notice('linkedAccountNotice',r?.message||'Unable to link this account.');if($('linkAccountNo'))$('linkAccountNo').value='';if($('linkPhone'))$('linkPhone').value='';notice('linkedAccountNotice',r?.message||'Account linked successfully.','ok');await loadAccounts(true)}catch(e){notice('linkedAccountNotice',e.message||'Unable to link this account.')}finally{btn.disabled=false;btn.textContent='+ Link Another Account'}}
async function unlinkAccount(accountNo){if(!accountNo||!confirm(`Remove ${accountNo} from your linked accounts? This does not delete the TechGeekPH account.`))return;const token=localStorage.getItem(TOKEN_KEY);if(!token)return showLogin();try{const r=await rpc('client_portal_unlink_account',{p_token:token,p_account_no:accountNo});if(!r?.ok)return notice('linkedAccountNotice',r?.message||'Unable to remove this linked account.');notice('linkedAccountNotice',r?.message||'Linked account removed.','ok');if(String(data?.client?.account_no||'').toUpperCase()===String(accountNo).toUpperCase())location.reload();else await loadAccounts(true)}catch(e){notice('linkedAccountNotice',e.message||'Unable to remove this linked account.')}}
'''
if 'async function loadAccounts(' not in js:
    js = js.replace('\nfunction updatePaymentLink(){', '\n' + multi_code + '\nfunction updatePaymentLink(){', 1)

js = js.replace(
    "localStorage.removeItem(TOKEN_KEY);data=null;profileOriginal=null;profileDirty=false;if(loadRetryTimer)",
    "localStorage.removeItem(TOKEN_KEY);data=null;profileOriginal=null;profileDirty=false;accountsState=null;if(loadRetryTimer)"
)

old_listeners = "$('notifyBtn').addEventListener('click',enableNotifications);$('profileSaveBtn')?.addEventListener('click',saveProfile);Object.values(PROFILE_MAP).forEach(id=>$(id)?.addEventListener('input',()=>{profileDirty=true;clearNotice('profileNotice')}));document.querySelectorAll('.nav button').forEach"
new_listeners = "$('notifyBtn').addEventListener('click',enableNotifications);$('profileSaveBtn')?.addEventListener('click',saveProfile);$('linkAccountBtn')?.addEventListener('click',linkAccount);$('linkPhone')?.addEventListener('keydown',e=>{if(e.key==='Enter')linkAccount()});$('linkAccountNo')?.addEventListener('keydown',e=>{if(e.key==='Enter')linkAccount()});$('accountChips')?.addEventListener('click',e=>{const b=e.target.closest?.('[data-account]');if(b)switchAccount(decodeURIComponent(b.dataset.account||''))});$('linkedAccountsList')?.addEventListener('click',e=>{const b=e.target.closest?.('[data-unlink]');if(b)unlinkAccount(decodeURIComponent(b.dataset.unlink||''))});Object.values(PROFILE_MAP).forEach(id=>$(id)?.addEventListener('input',()=>{profileDirty=true;clearNotice('profileNotice')}));document.querySelectorAll('.nav button').forEach"
if old_listeners in js:
    js = js.replace(old_listeners, new_listeners, 1)
elif "$('linkAccountBtn')?.addEventListener('click',linkAccount)" not in js:
    raise SystemExit('Event listener marker not found')

app.write_text(js)
print('Client multi-account UI patched.')
