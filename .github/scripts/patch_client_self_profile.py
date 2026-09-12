from pathlib import Path

index = Path('client/index.html')
html = index.read_text()

old_account = '''    <section id="accountPane" class="pane">
      <div class="pane-heading"><div><h1>Account Profile</h1><p>View your registered service and subscription information.</p></div></div>
      <section class="section"><h2>Client Information</h2><div id="accountRows" class="rows"></div><button id="refreshBtn" class="btn secondary" style="width:100%;margin-top:12px">Refresh Account Data</button><button id="logoutBtn" class="btn danger" style="width:100%;margin-top:9px">Sign Out</button></section>
    </section>'''

new_account = '''    <section id="accountPane" class="pane">
      <div class="pane-heading"><div><h1>My Profile</h1><p>Update your personal and contact details securely.</p></div></div>

      <section class="section">
        <h2>Personal Details</h2>
        <p class="section-sub">You can update your name, contact information and personal address. Changes are saved to your TechGeekPH client record.</p>
        <div id="profileNotice" class="notice"></div>
        <div class="profile-grid">
          <div class="field"><label>First Name</label><input id="profileFirstName" autocomplete="given-name" placeholder="First name"></div>
          <div class="field"><label>Middle Name</label><input id="profileMiddleName" autocomplete="additional-name" placeholder="Middle name (optional)"></div>
          <div class="field"><label>Surname</label><input id="profileSurname" autocomplete="family-name" placeholder="Surname"></div>
          <div class="field"><label>Registered Mobile Number</label><input id="profilePhone" inputmode="tel" autocomplete="tel" placeholder="09XXXXXXXXX" maxlength="20"><small>This number will be used for your next Client Portal login.</small></div>
          <div class="field profile-full"><label>Email Address</label><input id="profileEmail" type="email" autocomplete="email" placeholder="name@example.com"></div>
          <div class="field"><label>House / Blk / Lot</label><input id="profileHouse" autocomplete="address-line1" placeholder="House / Blk / Lot"></div>
          <div class="field"><label>Street / Purok</label><input id="profileStreet" autocomplete="address-line2" placeholder="Street / Purok"></div>
          <div class="field"><label>Barangay</label><input id="profileBarangay" placeholder="Barangay"></div>
          <div class="field"><label>City / Municipality</label><input id="profileCity" autocomplete="address-level2" placeholder="City / Municipality"></div>
          <div class="field"><label>Postal Code</label><input id="profilePostal" inputmode="numeric" autocomplete="postal-code" placeholder="Postal Code"></div>
          <div class="field"><label>Country</label><input id="profileCountry" autocomplete="country-name" placeholder="Philippines"></div>
          <div class="field profile-full"><label>Landmark</label><input id="profileLandmark" placeholder="Nearest landmark"></div>
          <div class="field profile-full"><label>Permanent Address</label><textarea id="profilePermanentAddress" autocomplete="street-address" placeholder="Complete permanent address"></textarea></div>
        </div>
        <button id="profileSaveBtn" class="btn primary" style="width:100%;margin-top:14px">Save Personal Details</button>
        <div class="profile-lock"><b>Protected account details</b><br>Account No., service address, plan, speed, monthly bill, network/ONU/PPPoE details and account status cannot be changed here. For service-location or plan changes, contact TechGeekPH Support.</div>
      </section>

      <section class="section"><h2>Account &amp; Service Information</h2><p class="section-sub">Read-only information managed by TechGeekPH.</p><div id="accountRows" class="rows"></div><button id="refreshBtn" class="btn secondary" style="width:100%;margin-top:12px">Refresh Account Data</button><button id="logoutBtn" class="btn danger" style="width:100%;margin-top:9px">Sign Out</button></section>
    </section>'''

if old_account in html:
    html = html.replace(old_account, new_account, 1)
elif 'id="profileSaveBtn"' not in html:
    raise SystemExit('Account pane marker not found')

css = '.profile-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 12px;margin-top:13px}.profile-grid .field{margin-top:0}.profile-grid .field small{display:block;margin-top:5px;color:var(--m);font-size:.58rem;line-height:1.4}.profile-full{grid-column:1/-1}.profile-lock{margin-top:12px;padding:11px 12px;border:1px solid #d9e5ee;border-radius:11px;background:#f6f9fc;color:var(--m);font-size:.64rem;line-height:1.5}.profile-lock b{color:var(--ink)}\n@media(max-width:640px){.profile-grid{grid-template-columns:1fr}.profile-full{grid-column:auto}}\n'
if '.profile-grid{' not in html:
    html = html.replace('</style>', css + '</style>', 1)

html = html.replace('app.js?v=20260904-drawer1', 'app.js?v=20260912-profile1')
index.write_text(html)

app = Path('client/app.js')
js = app.read_text()
js = js.replace("const $=id=>document.getElementById(id),db=window.TechGeekSupabase,TOKEN_KEY='tg_client_portal_token';let data=null,loadRetryTimer=null;", "const $=id=>document.getElementById(id),db=window.TechGeekSupabase,TOKEN_KEY='tg_client_portal_token';let data=null,loadRetryTimer=null,profileOriginal=null,profileDirty=false,profileLoading=false;")

marker = "function renderAccount(){const c=data.client||{},net=data.network||{},ppp=data.pppoe||{},ps=profileLabel(ppp,net,c);$('accountRows').innerHTML=[['Account Number',c.account_no],['Client Name',c.client_name],['Account Status',ps.label],['Registered Mobile',c.phone_masked],['Service Address',c.service_address],['Area / RD-BLK',c.rd_blk],['Plan',c.plan],['Speed',c.speed],['Monthly Bill',peso(c.monthly_bill)]].map(([a,v])=>`<div class=\"row\"><div><b>${esc(a)}</b></div><div class=\"status\">${esc(v||'—')}</div></div>`).join('')}"
if marker not in js:
    raise SystemExit('renderAccount marker not found')

extra = """
const PROFILE_MAP={first_name:'profileFirstName',middle_name:'profileMiddleName',surname:'profileSurname',phone:'profilePhone',email:'profileEmail',house_number:'profileHouse',street_name:'profileStreet',barangay:'profileBarangay',city_municipality:'profileCity',postal_code:'profilePostal',country:'profileCountry',landmark:'profileLandmark',permanent_address:'profilePermanentAddress'};
function normProfileValue(v){return String(v??'').trim()}
function setProfileForm(p){profileOriginal={};Object.entries(PROFILE_MAP).forEach(([k,id])=>{const el=$(id);const v=p?.[k]??'';profileOriginal[k]=normProfileValue(v);if(el)el.value=v??''});profileDirty=false}
async function loadProfile(force=false){if(profileLoading||(!force&&profileDirty))return;const token=localStorage.getItem(TOKEN_KEY);if(!token)return;profileLoading=true;try{const r=await rpc('client_portal_get_profile',{p_token:token});if(!r?.ok){if(r?.code==='SESSION_INVALID'){localStorage.removeItem(TOKEN_KEY);profileOriginal=null;profileDirty=false;showLogin()}return}setProfileForm(r.profile||{})}catch(e){console.error('Profile load error:',e)}finally{profileLoading=false}}
async function saveProfile(){clearNotice('profileNotice');const token=localStorage.getItem(TOKEN_KEY);if(!token){showLogin();return}if(!profileOriginal)await loadProfile(true);const patch={};Object.entries(PROFILE_MAP).forEach(([k,id])=>{const el=$(id);if(!el)return;const now=normProfileValue(el.value),before=normProfileValue(profileOriginal?.[k]);if(now!==before)patch[k]=now});if(!Object.keys(patch).length){notice('profileNotice','No changes to save.','ok');return}const btn=$('profileSaveBtn');btn.disabled=true;btn.textContent='Saving…';try{const r=await rpc('client_portal_update_profile',{p_token:token,p_profile:patch});if(!r?.ok){if(r?.code==='SESSION_INVALID'){localStorage.removeItem(TOKEN_KEY);showLogin();return}return notice('profileNotice',r?.message||'Unable to update your profile.')}setProfileForm(r.profile||{...profileOriginal,...patch});notice('profileNotice',r?.message||'Personal details updated successfully.','ok');await load(false)}catch(e){notice('profileNotice',e.message||'Unable to update your profile.')}finally{btn.disabled=false;btn.textContent='Save Personal Details'}}
"""
if 'const PROFILE_MAP=' not in js:
    js = js.replace(marker, marker + extra, 1)

js = js.replace("data=r;render();showApp();paymentReminder()", "data=r;render();showApp();paymentReminder();if(!profileOriginal&&!profileLoading)loadProfile(false)")
js = js.replace("localStorage.removeItem(TOKEN_KEY);data=null;if(loadRetryTimer)", "localStorage.removeItem(TOKEN_KEY);data=null;profileOriginal=null;profileDirty=false;if(loadRetryTimer)")

old_nav = "document.querySelectorAll('.nav button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.nav button').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.pane').forEach(x=>x.classList.toggle('active',x.id===b.dataset.pane))}));"
new_nav = "document.querySelectorAll('.nav button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.nav button').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.pane').forEach(x=>x.classList.toggle('active',x.id===b.dataset.pane));if(b.dataset.pane==='accountPane')loadProfile(false)}));"
if old_nav in js:
    js = js.replace(old_nav, new_nav, 1)

listener_marker = "$('notifyBtn').addEventListener('click',enableNotifications);"
listener_add = "$('notifyBtn').addEventListener('click',enableNotifications);$('profileSaveBtn')?.addEventListener('click',saveProfile);Object.values(PROFILE_MAP).forEach(id=>$(id)?.addEventListener('input',()=>{profileDirty=true;clearNotice('profileNotice')}));"
if listener_marker in js and "profileSaveBtn')?.addEventListener" not in js:
    js = js.replace(listener_marker, listener_add, 1)

app.write_text(js)
