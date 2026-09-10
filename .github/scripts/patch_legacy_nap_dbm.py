from pathlib import Path

# Patch the older Physical Ports renderer that is still used by the embedded Admin V2 shell.
p = Path('assets/nap-ping-status.js')
s = p.read_text(encoding='utf-8')

if 'TG-LEGACY-NAP-DBM-20260910' not in s:
    s = s.replace(
        "      .tg-port-state{font-size:.54rem;font-weight:950;letter-spacing:.04em;text-align:center;line-height:1.15}\n",
        "      .tg-port-state{font-size:.54rem;font-weight:950;letter-spacing:.04em;text-align:center;line-height:1.15}\n"
        "      /* TG-LEGACY-NAP-DBM-20260910 */\n"
        "      .tg-port-dbm{font-size:.56rem;font-weight:950;line-height:1.15;text-align:center;color:#116247}\n"
        "      .tg-port-btn.health-down .tg-port-dbm,.tg-port-btn.down .tg-port-dbm{color:#98113b}\n"
        "      .tg-port-btn.pending .tg-port-dbm{color:#98113b}\n"
        "      .tg-port-btn.conflict .tg-port-dbm{color:#8a4d06}\n"
    )

s = s.replace(
    "  const pingCache=new Map();\n",
    "  const pingCache=new Map();\n  const bindingCache=new Map();\n  const opticalCache=new Map();\n"
)

anchor = "  function connectionHealth(account,row){\n"
helpers = r'''  const opticalKey=(olt,pon,onu)=>`${String(olt||'')}|${Number(pon)||0}|${Number(onu)||0}`;
  function opticalFor(row){
    const b=bindingCache.get(String(row?.id));
    return b?opticalCache.get(opticalKey(b.olt_id,b.pon_port,b.onu_id))||null:null;
  }
  function blockDbm(row){
    const o=opticalFor(row);
    if(o?.onu_rx_dbm!==null&&o?.onu_rx_dbm!==undefined&&Number.isFinite(Number(o.onu_rx_dbm)))return `${Number(o.onu_rx_dbm).toFixed(2)} dBm`;
    const sig=norm(o?.signal_status);
    if(sig==='OFFLINE'||sig==='DYINGGASP')return 'NO RX';
    if(!bindingCache.get(String(row?.id)))return 'UNBOUND';
    return 'N/A dBm';
  }
  async function loadOptical(rows){
    const db=window.TechGeekSupabase;
    if(!db)return;
    const ids=[...new Set(rows.map(r=>String(r?.id||'')).filter(Boolean))];
    if(!ids.length)return;
    try{
      const br=await db.from('client_onu_bindings').select('client_id,olt_id,pon_port,onu_id,onu_serial').in('client_id',ids);
      if(br.error)throw br.error;
      ids.forEach(id=>bindingCache.delete(id));
      const bindings=br.data||[];
      bindings.forEach(b=>bindingCache.set(String(b.client_id),b));
      const olts=[...new Set(bindings.map(b=>String(b.olt_id||'')).filter(Boolean))];
      if(!olts.length)return;
      const or=await db.from('onu_optical_status').select('olt_id,pon_port,onu_id,onu_serial,onu_rx_dbm,olt_rx_dbm,signal_status,onu_status,last_checked_at').in('olt_id',olts).limit(3000);
      if(or.error)throw or.error;
      (or.data||[]).forEach(o=>opticalCache.set(opticalKey(o.olt_id,o.pon_port,o.onu_id),o));
    }catch(e){console.warn('NAP optical load failed:',e?.message||e)}
  }

'''
if 'function blockDbm(row)' not in s:
    if anchor not in s:
        raise SystemExit('legacy helper anchor not found')
    s = s.replace(anchor, helpers + anchor, 1)

old = "      buttons+=`<button type=\"button\" class=\"tg-port-btn ${kind}\" data-port=\"${no}\" aria-label=\"Port ${no} ${text}\"><span class=\"tg-port-no\">${no}</span><span class=\"tg-port-state\">${text}</span></button>`;"
new = "      const dbm=a?.row?blockDbm(a.row):'';\n      buttons+=`<button type=\"button\" class=\"tg-port-btn ${kind}\" data-port=\"${no}\" aria-label=\"Port ${no} ${text}\"><span class=\"tg-port-no\">${no}</span><span class=\"tg-port-state\">${text}</span>${dbm?`<span class=\"tg-port-dbm\">${esc(dbm)}</span>`:''}</button>`;"
if old in s:
    s = s.replace(old, new, 1)

old = "        <div><span>Connection Health</span><strong>${esc(health)}</strong></div>\n"
new = "        <div><span>Connection Health</span><strong>${esc(health)}</strong></div>\n        <div><span>Fiber RX</span><strong>${esc(blockDbm(r))}</strong></div>\n"
if old in s and '<span>Fiber RX</span>' not in s:
    s = s.replace(old, new, 1)

old = "      await loadPing(rows.map(r=>r.account_no));\n"
new = "      await Promise.all([loadPing(rows.map(r=>r.account_no)),loadOptical(rows)]);\n"
if old in s:
    s = s.replace(old, new, 1)

# Add a real live refresh for the selected NAP; the old script only watched selector changes.
needle = "    window.setInterval(()=>{\n      const id=String($('boxSelect')?.value||'');\n      if(id!==lastNapId){selectedPort='';loadSelectedNap(true)}\n    },400);\n"
replacement = needle + "    window.setInterval(()=>{if(!document.hidden&&lastNapId)loadSelectedNap(true)},10000);\n    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&lastNapId)loadSelectedNap(true)});\n"
if 'if(!document.hidden&&lastNapId)loadSelectedNap(true)' not in s:
    if needle not in s:
        raise SystemExit('legacy live timer anchor not found')
    s = s.replace(needle, replacement, 1)

p.write_text(s, encoding='utf-8')

# Patch the newer health overlay too, so dBm appears even if the Admin shell uses that renderer.
p = Path('assets/nap-port-health.js')
s = p.read_text(encoding='utf-8')

if 'TG-PORT-HEALTH-DBM-20260910' not in s:
    s = s.replace(
        "      .tg-health-line{margin-top:5px;font-size:.58rem;color:#64748b}\n",
        "      .tg-health-line{margin-top:5px;font-size:.58rem;color:#64748b}\n"
        "      /* TG-PORT-HEALTH-DBM-20260910 */\n"
        "      .tg-live-dbm{display:block;margin-top:3px;font-size:.56rem;font-weight:950;line-height:1.15}\n"
        "      .port.health-good .tg-live-dbm{color:#126247}\n"
        "      .port.health-fair .tg-live-dbm{color:#8b5800}\n"
        "      .port.health-down .tg-live-dbm{color:#fff}\n"
    )

s = s.replace(
    "  const activeRow=r=>![norm(r.account_status),norm(r.service_status)].some(v=>['DISCONNECTED','CANCELLED'].includes(v));\n",
    "  const activeRow=r=>![norm(r.account_status),norm(r.service_status)].some(v=>['DISCONNECTED','CANCELLED'].includes(v));\n  const opticalKey=(olt,pon,onu)=>`${String(olt||'')}|${Number(pon)||0}|${Number(onu)||0}`;\n"
)

old = "    return {key,rows,allActive,active,byPort,ping};\n"
new = r'''    const bindingsByClient=new Map(),opticalByKey=new Map();
    const ids=[...new Set(allActive.map(r=>String(r.id)).filter(Boolean))];
    if(ids.length){
      const br=await db.from('client_onu_bindings').select('client_id,olt_id,pon_port,onu_id,onu_serial').in('client_id',ids);
      if(!br.error){
        const bindings=br.data||[];
        bindings.forEach(b=>bindingsByClient.set(String(b.client_id),b));
        const olts=[...new Set(bindings.map(b=>String(b.olt_id||'')).filter(Boolean))];
        if(olts.length){
          const or=await db.from('onu_optical_status').select('olt_id,pon_port,onu_id,onu_rx_dbm,signal_status,onu_status,last_checked_at').in('olt_id',olts).limit(3000);
          if(!or.error)(or.data||[]).forEach(o=>opticalByKey.set(opticalKey(o.olt_id,o.pon_port,o.onu_id),o));
        }
      }
    }
    return {key,rows,allActive,active,byPort,ping,bindingsByClient,opticalByKey};
'''
if old in s:
    s = s.replace(old, new, 1)

helper_anchor = "  function paintPorts(state){\n"
helper = r'''  function opticalFor(state,row){
    const b=state.bindingsByClient?.get(String(row?.id));
    return b?state.opticalByKey?.get(opticalKey(b.olt_id,b.pon_port,b.onu_id))||null:null;
  }
  function dbmText(state,row){
    const o=opticalFor(state,row);
    if(o?.onu_rx_dbm!==null&&o?.onu_rx_dbm!==undefined&&Number.isFinite(Number(o.onu_rx_dbm)))return `${Number(o.onu_rx_dbm).toFixed(2)} dBm`;
    const sig=norm(o?.signal_status);
    if(sig==='OFFLINE'||sig==='DYINGGASP')return 'NO RX';
    if(!state.bindingsByClient?.get(String(row?.id)))return 'UNBOUND';
    return 'N/A dBm';
  }

'''
if 'function dbmText(state,row)' not in s:
    if helper_anchor not in s:
        raise SystemExit('health helper anchor not found')
    s = s.replace(helper_anchor, helper + helper_anchor, 1)

old = "      const small=btn.querySelector('small');\n      if(small) small.textContent=c.label;\n      btn.title=`${row.client_name||row.account_no||'Client'} • ${c.detail}`;\n"
new = "      const small=btn.querySelector('small');\n      if(small) small.textContent=c.label;\n      let rx=btn.querySelector('.tg-live-dbm');\n      if(!rx){rx=document.createElement('span');rx.className='tg-live-dbm';btn.appendChild(rx)}\n      rx.textContent=dbmText(state,row);\n      btn.title=`${row.client_name||row.account_no||'Client'} • ${c.detail} • ${dbmText(state,row)}`;\n"
if old in s:
    s = s.replace(old, new, 1)

old = "    const info=[...box.querySelectorAll('.info div')];\n"
new = "    const info=[...box.querySelectorAll('.info div')];\n    let rxCell=info.find(d=>norm(d.querySelector('span')?.textContent)==='FIBER RX');\n    if(!rxCell){rxCell=document.createElement('div');rxCell.innerHTML='<span>Fiber RX</span><b></b>';const grid=box.querySelector('.info');if(grid)grid.appendChild(rxCell)}\n    if(rxCell){const rb=rxCell.querySelector('b');if(rb)rb.textContent=dbmText(state,row)}\n"
if old in s:
    s = s.replace(old, new, 1)

s = s.replace(
    "      lastState={byPort:state.byPort,ping:state.ping,lp:state.key.lp,np:state.key.np};\n",
    "      lastState={byPort:state.byPort,ping:state.ping,bindingsByClient:state.bindingsByClient,opticalByKey:state.opticalByKey,lp:state.key.lp,np:state.key.np};\n"
)
s = s.replace(
    "paintOpenDetail({byPort:lastState.byPort,ping:lastState.ping,active:[...lastState.byPort.values()]})",
    "paintOpenDetail({byPort:lastState.byPort,ping:lastState.ping,bindingsByClient:lastState.bindingsByClient,opticalByKey:lastState.opticalByKey,active:[...lastState.byPort.values()]})"
)
s = s.replace("    setInterval(()=>{if(!document.hidden)refresh()},15000);\n", "    setInterval(()=>{if(!document.hidden)refresh()},10000);\n")

if "table:'onu_optical_status'" not in s:
    s = s.replace(
        "        .on('postgres_changes',{event:'*',schema:'public',table:'clients'},()=>refresh())\n",
        "        .on('postgres_changes',{event:'*',schema:'public',table:'clients'},()=>refresh())\n        .on('postgres_changes',{event:'*',schema:'public',table:'client_onu_bindings'},()=>refresh())\n        .on('postgres_changes',{event:'*',schema:'public',table:'onu_optical_status'},()=>refresh())\n"
    )

p.write_text(s, encoding='utf-8')
