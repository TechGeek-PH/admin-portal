// TechGeekPH Supabase bootstrap for browser + Android/iOS app modules.
(function(){
  'use strict';
  const SUPABASE_URL='https://tcexzfztdgximrzuosqs.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY='sb_publishable_8H8_S7NTWvzPCLvYUe2C4g_k3Ltjfiz';
  if(!window.supabase||typeof window.supabase.createClient!=='function'){
    console.error('TechGeekPH: Supabase JS library is not loaded.');
    return;
  }
  if(!window.TechGeekSupabase){
    window.TechGeekSupabase=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  }
  window.TechGeekSupabaseConfig={url:SUPABASE_URL,keyType:'publishable'};
})();

// NAP Checker: live ping status replaces the Remote IP display.
(function(){
  'use strict';
  if(!/(^|\/)nap-checker\.html$/i.test(window.location.pathname))return;
  if(document.querySelector('script[data-nap-ping-status]'))return;
  const script=document.createElement('script');
  script.src='assets/nap-ping-status.js?v=20260830-1';
  script.async=false;
  script.dataset.napPingStatus='1';
  document.head.appendChild(script);
})();

// New Installation proof-photo workflow inside Technician Tickets.
(function(){
  'use strict';
  if(!/(^|\/)app-tickets\.html$/i.test(window.location.pathname))return;
  if(document.querySelector('script[data-client-proof-ticket]'))return;
  const script=document.createElement('script');
  script.src='assets/client-proof-ticket.js?v=20260830-2';
  script.async=false;
  script.dataset.clientProofTicket='1';
  document.head.appendChild(script);
})();

// Payroll Admin: Loan Management is the source of truth for loan deductions.
(function(){
  'use strict';
  if(!/(^|\/)app-payroll-admin\.html$/i.test(window.location.pathname))return;
  function setupPayrollControls(){
    const toolbar=document.querySelector('.toolbar');
    if(toolbar&&!document.getElementById('tgLoanManagementBtn')){
      const link=document.createElement('a');
      link.id='tgLoanManagementBtn';
      link.href='loan_management.html'+(new URLSearchParams(location.search).get('embed')==='1'?'?embed=1&source=app-embed':'');
      link.className='primary';
      link.textContent='Loan Management';
      link.style.cssText='display:inline-flex;align-items:center;justify-content:center;min-height:42px;border-radius:10px;padding:0 12px;text-decoration:none;font-size:.75rem';
      toolbar.appendChild(link);
    }
    [['cash','Cash Advance Deduction (Auto from Released Expenses)','Managed in Expense Approval. Only released payroll-deductible Cash Advance/Food is deducted.'],['loan','Loan Deduction (Auto from Loan Management)','Managed in Loan Management. Active approved loans are deducted based on their terms and schedule.']].forEach(item=>{
      const input=document.getElementById(item[0]);if(!input)return;
      input.disabled=true;input.readOnly=true;input.style.background='#eef3f7';input.title=item[2];
      const field=input.closest('.field');if(!field)return;
      const label=field.querySelector('label');if(label)label.textContent=item[1];
      if(!field.querySelector('.tg-auto-deduction-note')){const note=document.createElement('div');note.className='tg-auto-deduction-note';note.textContent=item[2];note.style.cssText='margin-top:5px;color:#6b7a8e;font-size:.58rem;line-height:1.35';field.appendChild(note)}
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setupPayrollControls,{once:true});else setupPayrollControls();
})();

// Clients master live refresh after ticket/client updates from another device/module.
(function(){
  'use strict';
  if(!/(^|\/)clients\.html$/i.test(window.location.pathname))return;
  function setupClientLiveRefresh(){
    const db=window.TechGeekSupabase,refreshBtn=document.getElementById('refreshBtn');
    if(!db||!refreshBtn){window.setTimeout(setupClientLiveRefresh,180);return}
    if(window.__tgClientsLiveRefreshBound)return;window.__tgClientsLiveRefreshBound=true;
    let lastRefresh=0;
    function refresh(){const now=Date.now();if(now-lastRefresh<700||refreshBtn.disabled)return;lastRefresh=now;refreshBtn.click()}
    try{db.channel('techgeekph-clients-live-'+Math.random().toString(36).slice(2)).on('postgres_changes',{event:'*',schema:'public',table:'clients'},refresh).subscribe()}catch(_){}
    window.addEventListener('storage',e=>{if(e.key==='tg_clients_changed_at')refresh()});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
    window.addEventListener('focus',refresh);
    window.setInterval(()=>{if(!document.hidden)refresh()},30000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setupClientLiveRefresh,{once:true});else setupClientLiveRefresh();
})();
