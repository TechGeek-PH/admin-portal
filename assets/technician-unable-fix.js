// Technician Tickets: allow a technician to close a non-installation ticket as Unable to Fix.
(() => {
  'use strict';

  function $(id){ return document.getElementById(id); }

  function showNotice(message, type='info'){
    const el=$('notice');
    if(!el){
      if(type==='err') window.alert(message);
      return;
    }
    el.textContent=message || '';
    el.className='notice show ' + (type==='err'?'err':type==='ok'?'ok':'info');
    try{ el.scrollIntoView({block:'nearest',behavior:'smooth'}); }catch(_){ }
  }

  function selectedTicketNo(){
    const title=String($('dlgTitle')?.textContent || '').trim();
    if(!title) return '';
    return title.split(' · ')[0].trim();
  }

  function collectClientDetails(){
    const val=(id)=>String($(id)?.value || '').trim();
    return {
      account_no:val('cuAccount'),
      client_name:val('cuClientName'),
      plan:val('cuPlan'),
      speed:val('cuSpeed'),
      monthly_bill:val('cuMonthlyBill'),
      phone:val('cuPhone'),
      email:val('cuEmail'),
      service_address:val('cuAddress'),
      permanent_address:val('cuPermanent'),
      rd_blk:val('cuRdBlk'),
      landmark:val('cuLandmark'),
      google_maps_link:val('cuMaps'),
      geo_tagging:val('cuGeo'),
      line_port:val('cuLinePort'),
      network_port:val('cuNetworkPort'),
      client_port:val('cuClientPort'),
      remote_address:val('cuRemoteAddress'),
      vlan_id:val('cuVlan'),
      band_steering:val('cuBandSteering'),
      modem_brand_model:val('cuModem'),
      modem_serial_no:val('cuSerial'),
      onu_mac:val('cuOnuMac')
    };
  }

  function checklistPayload(){
    const items=[...document.querySelectorAll('#tasks .task span')].map((node)=>
      String(node.textContent || '').replace(/^\d+\.\s*/, '').trim()
    );
    const checks=[...document.querySelectorAll('#tasks [data-check]')].map((node)=>!!node.checked);
    return {items,checks};
  }

  function setModeUi(){
    const work=$('work'),save=$('save');
    if(!work || !save) return;
    const unable=work.value==='Unable to Fix';
    save.textContent=unable?'Close · Unable to Fix':'Save Update';
    save.classList.toggle('warn',unable);
    const hint=$('remarks')?.parentElement?.querySelector('.hint');
    if(hint){
      hint.textContent=unable
        ? 'Unable to Fix: checklist may remain incomplete, but a clear reason / findings is required. Saving will close the ticket.'
        : 'To close as Done, complete every checklist item and enter the final work done/result.';
    }
  }

  async function saveUnableToFix(){
    const db=window.TechGeekSupabase;
    const work=$('work'),save=$('save'),remarks=$('remarks');
    if(!db || !work || !save || !remarks) return;

    const ticketNo=selectedTicketNo();
    const reason=String(remarks.value || '').trim();
    if(!ticketNo){ showNotice('Ticket number could not be detected. Reopen the ticket and try again.','err'); return; }
    if(!reason){
      showNotice('Please enter the reason / technician findings before closing as Unable to Fix.','err');
      remarks.focus();
      return;
    }

    if(!window.confirm('Close '+ticketNo+' as Unable to Fix? The completed checklist items and your reason will still be saved.')) return;

    const {items,checks}=checklistPayload();
    save.disabled=true;
    save.textContent='Closing…';
    showNotice('Saving progress and closing ticket as Unable to Fix…','info');

    try{
      const result=await db.rpc('save_technician_ticket_unable_to_fix',{
        p_ticket_no:ticketNo,
        p_checklist_items:items,
        p_checks:checks,
        p_remarks:reason,
        p_client_details:collectClientDetails()
      });
      if(result.error) throw result.error;

      showNotice(ticketNo+' closed as Unable to Fix. Checklist progress and technician remarks were saved.','ok');
      try{ localStorage.setItem('tg_ticket_changed_at',String(Date.now())); }catch(_){ }
      const dlg=$('dlg');
      if(dlg?.open) dlg.close();
      window.setTimeout(()=>window.location.reload(),650);
    }catch(error){
      showNotice(error?.message || 'Unable to close the ticket. Please try again.','err');
      save.disabled=false;
      setModeUi();
    }
  }

  function setup(){
    const work=$('work'),save=$('save');
    if(!work || !save){ window.setTimeout(setup,120); return; }
    if(work.dataset.unableFixReady==='1') return;
    work.dataset.unableFixReady='1';

    if(![...work.options].some((option)=>option.value==='Unable to Fix')){
      const option=document.createElement('option');
      option.value='Unable to Fix';
      option.textContent='Unable to Fix';
      work.appendChild(option);
    }

    work.addEventListener('change',setModeUi);
    document.addEventListener('click',(event)=>{
      const button=event.target.closest('#save');
      if(!button || work.value!=='Unable to Fix') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      saveUnableToFix();
    },true);

    setModeUi();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',setup,{once:true});
  else setup();
})();
