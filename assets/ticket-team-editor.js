/* Restore the per-ticket technician partner editor without changing ticket workflows. */
(function () {
  'use strict';
  var db=window.TechGeekSupabase, dlg=document.getElementById('dlg'),
      info=document.getElementById('ticketInfo'), grid=document.getElementById('grid');
  if(!db||!dlg||!info)return;
  var pane=document.createElement('section');
  pane.id='ticketTeamEditor';
  pane.className='tt-team-editor';
  info.insertAdjacentElement('afterend',pane);
  var style=document.createElement('style');
  style.textContent='.tt-team-editor{border:1px solid #d7e2ed;background:#f7fbff;border-radius:12px;margin:12px 0;padding:12px;color:#243b53;font-size:.78rem}.tt-team-editor h3{font-size:.86rem;margin:0 0 7px}.tt-team-editor p{margin:4px 0;color:#597087;line-height:1.5}.tt-team-editor .tt-pill{display:inline-flex;background:#e4f1ff;border-radius:99px;padding:5px 9px;margin:4px 5px 3px 0;font-size:.73rem}.tt-team-editor .tt-controls{display:flex;gap:8px;flex-wrap:wrap;margin-top:9px}.tt-team-editor button{border:0;border-radius:9px;background:#075987;color:#fff;padding:10px 13px;font-size:.76rem;font-weight:700;cursor:pointer}.tt-team-editor button.secondary{background:#e4e9ef;color:#334a5e}.tt-team-editor button:disabled{opacity:.5;cursor:wait}.tt-team-editor .tt-picker{display:grid;gap:7px;margin:10px 0}.tt-team-editor label{display:flex;align-items:center;gap:10px;background:#fff;padding:10px;border:1px solid #dbe6ef;border-radius:9px;cursor:pointer}.tt-team-editor label small{margin-left:auto;color:#72849a}.tt-team-editor .tt-msg{font-size:.73rem;margin-top:8px;white-space:pre-wrap}.tt-team-editor .tt-error{color:#ab2338}.tt-team-editor .tt-success{color:#157b55}';
  document.head.appendChild(style);
  var cachedTeams=new Map(), currentNo='', currentRows=[], currentUser=null,
      currentProfile=null, currentStatus='', sequence=0;
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function ticketNo(){var title=document.getElementById('dlgTitle');return title?String(title.textContent||'').split(' · ')[0].trim():'';}
  function isClosed(v){return /^(closed|done|resolved|completed|cancelled|canceled)$/i.test(String(v||'').trim());}
  function teamLabel(rows, fallback){
    var lead=rows.find(function(x){return x.is_lead;});
    var partners=rows.filter(function(x){return !x.is_lead;});
    if(!lead)return fallback||'Not assigned';
    return 'Lead: '+lead.employee_name+' | Partner'+(partners.length>1?'s':'')+': '+(partners.map(function(x){return x.employee_name;}).join(', ')||'None');
  }
  function updateCards(){
    if(!grid)return;
    grid.querySelectorAll('.card').forEach(function(card){
      var no=card.querySelector('.head b'), meta=card.querySelector('.meta');
      if(!no||!meta)return;
      var rows=cachedTeams.get(no.textContent.trim());
      if(!rows||!rows.length)return;
      var cell=Array.from(meta.children).find(function(n){return n.textContent.trim().indexOf('Assigned')===0;});
      if(cell)cell.innerHTML='<b>Team</b><br>'+esc(teamLabel(rows));
    });
  }
  function updateAssignedInfo(rows){
    var bold=Array.from(info.querySelectorAll('b')).find(function(x){return x.textContent.trim()==='Assigned:';});
    if(bold&&bold.nextSibling&&bold.nextSibling.nodeType===3)bold.nextSibling.textContent=' '+teamLabel(rows)+' ';
  }
  function message(text,error){
    var m=pane.querySelector('.tt-msg');
    if(m){m.textContent=text||'';m.className='tt-msg '+(error?'tt-error':'tt-success');}
  }
  function canEdit(rows){
    var lead=rows.find(function(x){return x.is_lead;});
    if(!lead||!currentProfile||isClosed(currentStatus))return false;
    return /^(OWNER|ADMIN)$/i.test(currentProfile.role) ||
      (currentProfile.role==='EMPLOYEE' && String(lead.employee_id)===String(currentProfile.employee_id));
  }
  function showSummary(){
    var rows=currentRows, lead=rows.find(function(x){return x.is_lead;});
    var partners=rows.filter(function(x){return !x.is_lead;});
    pane.innerHTML='<h3>Assigned Technician Team</h3>'+
      (lead?'<div><b>Lead:</b> '+esc(lead.employee_name)+'</div><div><b>Partners:</b> '+
         (partners.length?partners.map(function(x){return '<span class="tt-pill">'+esc(x.employee_name)+'</span>';}).join(''):'None assigned')+'</div>':
         '<p>Walang assigned lead team record. Kailangang i-claim muna ang ticket para makapili ng partner.</p>')+
      (canEdit(rows)?'<div class="tt-controls"><button type="button" id="ttEditPartners">Edit Partners</button></div>':
        '<p>'+(isClosed(currentStatus)?'Closed ticket — view only.':'Lead technician o Admin lang ang puwedeng magpalit ng partners.')+'</p>')+
      '<div class="tt-msg" role="status" aria-live="polite"></div>';
    var btn=document.getElementById('ttEditPartners');if(btn)btn.onclick=editPartners;
    updateCards();updateAssignedInfo(rows);
  }
  async function getProfile(){
    if(currentProfile)return currentProfile;
    var sr=await db.auth.getSession(), session=sr.data&&sr.data.session;
    if(!session)return null;
    var pr=await db.from('staff_profiles').select('role,employee_id,active').eq('user_id',session.user.id).maybeSingle();
    if(pr.error||!pr.data||!pr.data.active)return null;
    currentProfile=pr.data;return currentProfile;
  }
  async function refreshTeams(){
    var r=await db.rpc('get_ticket_team_overview');
    if(r.error)throw r.error;
    var map=new Map();
    (r.data||[]).forEach(function(x){if(!map.has(x.ticket_no))map.set(x.ticket_no,[]);map.get(x.ticket_no).push(x);});
    cachedTeams=map;updateCards();
  }
  async function showTicket(){
    var n=ticketNo();if(!n)return;
    var seq=++sequence;currentNo=n;
    pane.innerHTML='<h3>Assigned Technician Team</h3><p>Loading team and partners…</p>';
    try{
      await getProfile();
      var rr=await Promise.all([refreshTeams(),db.from('tech_ticket_public_queue').select('status,assigned_tech').eq('ticket_no',n).maybeSingle()]);
      if(seq!==sequence||!dlg.open||ticketNo()!==n)return;
      if(rr[1].error)throw rr[1].error;
      currentStatus=rr[1].data&&rr[1].data.status||'';
      currentRows=cachedTeams.get(n)||[];
      showSummary();
    }catch(e){
      if(seq===sequence)pane.innerHTML='<h3>Assigned Technician Team</h3><p>Unable to load team: '+esc(e.message||e)+'</p>';
    }
  }
  async function editPartners(){
    if(!canEdit(currentRows))return;
    pane.innerHTML='<h3>Edit Ticket Partners · '+esc(currentNo)+'</h3><p>Lead technician stays assigned. Newly added partners must be Time In / On Duty. Existing off-duty partners can be retained or removed.</p><p>Loading on-duty employees…</p>';
    try{
      var rr=await db.rpc('get_on_duty_team_options');
      if(rr.error)throw rr.error;
      var lead=currentRows.find(function(x){return x.is_lead;});
      var existing=currentRows.filter(function(x){return !x.is_lead;});
      var choices=new Map();
      existing.forEach(function(x){choices.set(x.employee_id,{employee_id:x.employee_id,employee_name:x.employee_name,on_duty:false,selected:true});});
      (rr.data||[]).forEach(function(x){
        if(String(x.employee_id)===String(lead.employee_id))return;
        var old=choices.get(x.employee_id);
        choices.set(x.employee_id,{employee_id:x.employee_id,employee_name:x.employee_name,on_duty:true,selected:!!old});
      });
      var list=Array.from(choices.values()).sort(function(a,b){return String(a.employee_name).localeCompare(String(b.employee_name));});
      pane.innerHTML='<h3>Edit Ticket Partners · '+esc(currentNo)+'</h3><p><b>Lead:</b> '+esc(lead.employee_name)+'</p>'+
        '<div class="tt-picker">'+(list.length?list.map(function(x){
          return '<label><input type="checkbox" data-tt-partner="'+esc(x.employee_id)+'" '+(x.selected?'checked':'')+'><span>'+esc(x.employee_name)+'</span><small>'+(x.on_duty?'On Duty':'Existing partner')+'</small></label>';
        }).join(''):'<p>No on-duty partners available.</p>')+'</div>'+
        '<div class="tt-controls"><button type="button" id="ttSavePartners">Save Partners</button><button type="button" class="secondary" id="ttCancelPartners">Cancel</button></div>'+
        '<div class="tt-msg" role="status" aria-live="polite"></div>';
      document.getElementById('ttSavePartners').onclick=savePartners;
      document.getElementById('ttCancelPartners').onclick=showSummary;
    }catch(e){showSummary();message('Unable to load employees: '+(e.message||e),true);}
  }
  async function savePartners(){
    var btn=document.getElementById('ttSavePartners');
    if(!btn||!canEdit(currentRows))return;
    var n=currentNo, ids=Array.from(pane.querySelectorAll('[data-tt-partner]:checked')).map(function(x){return x.getAttribute('data-tt-partner');});
    btn.disabled=true;btn.textContent='Saving…';
    try{
      var r=await db.rpc('update_ticket_partners',{p_ticket_no:n,p_partner_ids:ids});
      if(r.error)throw r.error;
      if(n!==currentNo)return;
      currentRows=Array.isArray(r.data)?r.data:[];
      cachedTeams.set(n,currentRows);
      showSummary();message('Ticket partners updated and saved.','false'===true);
      await refreshTeams();
    }catch(e){message('Unable to save partners: '+(e.message||e),true);}
    finally{if(btn.isConnected){btn.disabled=false;btn.textContent='Save Partners';}}
  }
  var o=new MutationObserver(function(){if(dlg.open)showTicket();else{sequence++;currentNo='';}});
  o.observe(dlg,{attributes:true,attributeFilter:['open']});
  if(grid){var go=new MutationObserver(updateCards);go.observe(grid,{childList:true});}
  refreshTeams().catch(function(){});
  if(dlg.open)showTicket();
})();