from pathlib import Path

path = Path('app-tickets.html')
text = path.read_text(encoding='utf-8')
original = text

# 1) Build/version marker.
text = text.replace("const BUILD='20260909-new-install-wizard-v1'", "const BUILD='20260910-new-install-wizard-v2'")

# 2) Add Page 4 payment styles once.
css_anchor = ".final-status span.ok{background:#e5f8ef;color:#08714b}"
css_extra = """.final-status span.ok{background:#e5f8ef;color:#08714b}.payment-box{margin-top:12px;padding:14px;border:1px solid #b9d7ee;border-radius:13px;background:#fff}.payment-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.payment-head h3{margin:0;color:var(--b);font-size:.92rem}.payment-head p{margin:4px 0 0;color:var(--m);font-size:.64rem;line-height:1.45}.payment-badge{display:inline-flex;align-items:center;min-height:28px;padding:0 9px;border-radius:999px;background:#eef7ff;color:#075b8e;font-size:.6rem;font-weight:950;white-space:nowrap}.payment-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:11px}.payment-item{padding:10px;border:1px solid #dbe7f0;border-radius:10px;background:#f8fbfd}.payment-item span,.payment-item b,.payment-item small{display:block}.payment-item span{color:#718096;font-size:.57rem;font-weight:900;text-transform:uppercase;letter-spacing:.03em}.payment-item b{margin-top:4px;color:var(--ink);font-size:.8rem}.payment-item small{margin-top:3px;color:var(--m);font-size:.57rem;line-height:1.35}.payment-choice{margin-top:11px}.payment-choice select{font-weight:800}.payment-note{margin-top:7px;padding:9px 10px;border-radius:9px;background:#f7fafc;color:#536579;font-size:.63rem;line-height:1.45}.payment-note.paid{background:#eefaf5;color:#126247}.payment-total{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px;padding:11px 12px;border-radius:10px;background:#eef7ff;color:#075b8e}.payment-total span{font-size:.65rem;font-weight:850}.payment-total b{font-size:.95rem}.payment-loading{grid-column:1/-1;padding:12px;text-align:center;color:var(--m);font-size:.66rem}.payment-recorded{margin-top:8px;color:#126247;font-size:.61rem;font-weight:850}@media(max-width:620px){.payment-grid{grid-template-columns:1fr}.payment-head{display:block}.payment-badge{margin-top:8px}}"""
if '.payment-box{' not in text:
    if css_anchor not in text:
        raise SystemExit('CSS anchor not found')
    text = text.replace(css_anchor, css_extra, 1)

# 3) Replace Page 4 with payment section.
old_page4 = '''      <section class="wizard-page" data-page="4">
        <div class="final-box"><h3>Complete Installation</h3><p class="step-sub">Review the generated account and proof status, then enter the final technician remarks. No checklist or manual work-status selection is required for New Installation.</p><div id="finalStatus" class="final-status"></div><div id="finalSummary" class="install-summary"></div></div>
        <div class="field"><label>Technician Remarks / Work Done</label><textarea id="installRemarks" placeholder="Example: Installed ONU/router, SC reading -18 dBm, speedtest passed. Client service activated successfully."></textarea><div class="hint">Required before closing. The ticket closes only when MikroTik is ACTIVE and all 6 proof photos are saved.</div></div>
        <div class="wizard-actions"><button class="btn ghost" id="backToProof" type="button">← Back</button><button class="btn success" id="completeInstall" type="button">Complete Installation & Close Ticket</button></div>
      </section>'''
new_page4 = '''      <section class="wizard-page" data-page="4">
        <div class="final-box"><h3>Complete Installation</h3><p class="step-sub">Review the generated account and proof status, confirm the installation payment, then enter the final technician remarks.</p><div id="finalStatus" class="final-status"></div><div id="finalSummary" class="install-summary"></div></div>
        <div id="installPaymentBox" class="payment-box">
          <div class="payment-head"><div><h3>Cashout & Prorated Bill</h3><p>Cashout is fixed at ₱800. The first service bill is automatically prorated using Monthly Plan ÷ 30 × service days before the next 10th.</p></div><span class="payment-badge">AUTO COMPUTE</span></div>
          <div id="paymentSummary" class="payment-grid"><div class="payment-loading">Loading prorated computation…</div></div>
          <div class="field payment-choice"><label>Prorated Bill Payment</label><select id="proratedPaymentStatus"><option value="unpaid">Generate bill only — Client will pay later</option><option value="paid">Paid now — Mark prorated bill as PAID</option></select><div id="proratedPaymentNote" class="payment-note">The prorated bill will be generated as OPEN and will remain visible in Billing.</div></div>
          <div class="payment-total"><span id="collectTotalLabel">Amount to collect on installation</span><b id="collectTotal">₱800.00</b></div>
          <div id="paymentRecorded" class="payment-recorded"></div>
        </div>
        <div class="field"><label>Technician Remarks / Work Done</label><textarea id="installRemarks" placeholder="Example: Installed ONU/router, SC reading -18 dBm, speedtest passed. Client service activated successfully."></textarea><div class="hint">Required before closing. The ticket closes only when MikroTik is ACTIVE and all 6 proof photos are saved. The prorated bill is generated at the same time.</div></div>
        <div class="wizard-actions"><button class="btn ghost" id="backToProof" type="button">← Back</button><button class="btn success" id="completeInstall" type="button">Complete Installation & Close Ticket</button></div>
      </section>'''
if 'id="installPaymentBox"' not in text:
    if old_page4 not in text:
        raise SystemExit('Page 4 anchor not found')
    text = text.replace(old_page4, new_page4, 1)

# 4) Add financial preview state.
old_state = "let profile=null,session=null,tickets=[],updates=new Map(),selected=null,requestedOpened=false,clientDetails=null,routerSetup=null,routerPoll=null,wizardStep=1,proofRows=[],proofBusy=new Set();"
new_state = "let profile=null,session=null,tickets=[],updates=new Map(),selected=null,requestedOpened=false,clientDetails=null,routerSetup=null,routerPoll=null,wizardStep=1,proofRows=[],proofBusy=new Set(),installFinancial=null;"
if 'installFinancial=null' not in text:
    if old_state not in text:
        raise SystemExit('State anchor not found')
    text = text.replace(old_state, new_state, 1)

# 5) Insert financial preview helpers before final summary.
final_anchor = "function renderFinalSummary(){"
helpers = r'''function money(v){const n=Number(v||0);return '₱'+n.toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}
function dateLabel(v){if(!v)return '—';try{return new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric'}).format(new Date(String(v)+'T00:00:00+08:00'))}catch(_){return String(v)}}
function paymentChoiceKey(){return selected?'tg_install_prorated_paid_'+selected.ticket_no:''}
function savePaymentChoice(){if(!selected||!$('proratedPaymentStatus')||installFinancial&&installFinancial.recorded)return;try{localStorage.setItem(paymentChoiceKey(),$('proratedPaymentStatus').value)}catch(_){}renderFinancialPreview()}
function clearPaymentChoice(){try{if(paymentChoiceKey())localStorage.removeItem(paymentChoiceKey())}catch(_){}}
function renderFinancialPreview(){if(!$('paymentSummary'))return;const f=installFinancial,sel=$('proratedPaymentStatus');if(!f){$('paymentSummary').innerHTML='<div class="payment-loading">Prorated computation is not available yet.</div>';$('collectTotal').textContent=money(800);return}if(f.recorded){sel.value=f.prorated_paid?'paid':'unpaid';sel.disabled=true}else{sel.disabled=false;try{const saved=localStorage.getItem(paymentChoiceKey());if(saved==='paid'||saved==='unpaid')sel.value=saved}catch(_){}}const paid=sel.value==='paid',total=Number(f.cashout_amount||800)+(paid?Number(f.prorated_amount||0):0);$('paymentSummary').innerHTML=`<div class="payment-item"><span>Cashout</span><b>${money(f.cashout_amount||800)}</b><small>Fixed installation cashout</small></div><div class="payment-item"><span>Monthly Plan</span><b>${money(f.monthly_bill)}</b><small>Daily rate ${money(f.daily_rate)} ÷ based on 30 days</small></div><div class="payment-item"><span>Prorated Service</span><b>${money(f.prorated_amount)}</b><small>${Number(f.prorated_days||0)} day${Number(f.prorated_days||0)===1?'':'s'} · ${dateLabel(f.prorated_start_date)} to before ${dateLabel(f.prorated_due_date)}</small></div><div class="payment-item"><span>First Due Date</span><b>${dateLabel(f.prorated_due_date)}</b><small>Billing ID: ${esc(f.billing_id||'Generated on completion')}</small></div>`;$('proratedPaymentNote').classList.toggle('paid',paid);$('proratedPaymentNote').textContent=paid?'Client is paying the prorated bill now. On completion, this bill will be generated and marked PAID immediately.':'The prorated bill will be generated as OPEN and will remain visible in Billing for later payment.';$('collectTotalLabel').textContent=paid?'Total collected on installation':'Cashout collected now · prorated bill remains due';$('collectTotal').textContent=money(total);$('paymentRecorded').textContent=f.recorded?`Saved billing result: ${String(f.billing_status||'').toUpperCase()} · ${money(f.prorated_amount)} prorated bill.`:''}
}
async function loadFinancialPreview(){if(!selected)return null;const r=await db.rpc('get_new_install_financial_preview',{p_ticket_no:selected.ticket_no});if(r.error)throw r.error;installFinancial=r.data||null;renderFinancialPreview();return installFinancial}
'''
if 'function loadFinancialPreview()' not in text:
    if final_anchor not in text:
        raise SystemExit('Final summary anchor not found')
    text = text.replace(final_anchor, helpers + final_anchor, 1)

# 6) Load financial preview when Page 4 opens.
old_step4 = "if(wizardStep===4){loadProofs().then(renderFinalSummary).catch(()=>renderFinalSummary())}"
new_step4 = "if(wizardStep===4){loadFinancialPreview().catch(e=>{installFinancial=null;renderFinancialPreview();note(e.message||'Unable to calculate the prorated bill.','err')});loadProofs().then(renderFinalSummary).catch(()=>renderFinalSummary())}"
if old_step4 in text:
    text = text.replace(old_step4, new_step4, 1)
elif new_step4 not in text:
    raise SystemExit('Wizard Step 4 anchor not found')

# 7) Reset financial state each time a ticket is opened.
old_open = "stopRouterPoll();proofRows=[];routerSetup=null;const u=updates.get(id)||{}"
new_open = "stopRouterPoll();proofRows=[];routerSetup=null;installFinancial=null;const u=updates.get(id)||{}"
if old_open in text:
    text = text.replace(old_open, new_open, 1)
elif new_open not in text:
    raise SystemExit('Open ticket reset anchor not found')

# 8) Enhance final summary to keep payment section in sync/read-only after close.
old_final_tail = "if(closed){$('installRemarks').value=(updates.get(selected.ticket_no)||{}).remarks||selected.tech_remarks||'';$('installRemarks').readOnly=true;$('completeInstall').style.display='none';$('backToProof').style.display='none'}else{$('installRemarks').readOnly=false;$('completeInstall').style.display='';$('backToProof').style.display=''}}"
new_final_tail = "if(closed){$('installRemarks').value=(updates.get(selected.ticket_no)||{}).remarks||selected.tech_remarks||'';$('installRemarks').readOnly=true;$('completeInstall').style.display='none';$('backToProof').style.display='none'}else{$('installRemarks').readOnly=false;$('completeInstall').style.display='';$('backToProof').style.display=''}renderFinancialPreview()}"
if old_final_tail in text:
    text = text.replace(old_final_tail, new_final_tail, 1)
elif new_final_tail not in text:
    raise SystemExit('Final summary tail anchor not found')

# 9) Pass paid/unpaid choice to the authoritative backend. Backend computes the amount again.
old_complete = "async function completeInstall(){if(!selected)return;const remarks=$('installRemarks').value.trim();if(!remarks)return note('Enter the Technician Remarks / Work Done before closing.','err');const count=PROOFS.filter(([t])=>!!proofFor(t)).length;if(count<6)return note('All 6 installation proof photos are required.','err');if(String(routerSetup&&routerSetup.pppoe_status||'').toUpperCase()!=='ACTIVE')return note('MikroTik PPPoE account must be ACTIVE before closing.','err');const btn=$('completeInstall');btn.disabled=true;btn.textContent='Closing Ticket…';try{const r=await db.rpc('complete_new_install_wizard',{p_ticket_no:selected.ticket_no,p_remarks:remarks});if(r.error)throw r.error;clearDraft();stopRouterPoll();$('dlg').close();await load();note('Installation completed. Ticket closed and client account activated.','ok')}catch(e){note(e.message||'Unable to complete installation.','err')}finally{btn.disabled=false;btn.textContent='Complete Installation & Close Ticket'}}"
new_complete = "async function completeInstall(){if(!selected)return;const remarks=$('installRemarks').value.trim();if(!remarks)return note('Enter the Technician Remarks / Work Done before closing.','err');const count=PROOFS.filter(([t])=>!!proofFor(t)).length;if(count<6)return note('All 6 installation proof photos are required.','err');if(String(routerSetup&&routerSetup.pppoe_status||'').toUpperCase()!=='ACTIVE')return note('MikroTik PPPoE account must be ACTIVE before closing.','err');try{if(!installFinancial)await loadFinancialPreview()}catch(e){return note(e.message||'Unable to calculate the prorated bill.','err')}const proratedPaid=$('proratedPaymentStatus').value==='paid',btn=$('completeInstall');btn.disabled=true;btn.textContent='Closing Ticket…';try{const r=await db.rpc('complete_new_install_wizard',{p_ticket_no:selected.ticket_no,p_remarks:remarks,p_prorated_paid:proratedPaid});if(r.error)throw r.error;clearDraft();clearPaymentChoice();stopRouterPoll();$('dlg').close();await load();const b=r.data||{};note(`Installation completed. Cashout ${money(b.cashout_amount||800)} · prorated bill ${money(b.prorated_amount)} ${String(b.billing_status||'OPEN').toUpperCase()}.`,'ok')}catch(e){note(e.message||'Unable to complete installation.','err')}finally{btn.disabled=false;btn.textContent='Complete Installation & Close Ticket'}}"
if old_complete in text:
    text = text.replace(old_complete, new_complete, 1)
elif new_complete not in text:
    raise SystemExit('Complete function anchor not found')

# 10) Hook the Page 4 selector.
old_hooks = "$('retryProvision').onclick=()=>saveInstallDetails();$('completeInstall').onclick=completeInstall;"
new_hooks = "$('retryProvision').onclick=()=>saveInstallDetails();$('proratedPaymentStatus').onchange=savePaymentChoice;$('completeInstall').onclick=completeInstall;"
if old_hooks in text:
    text = text.replace(old_hooks, new_hooks, 1)
elif new_hooks not in text:
    raise SystemExit('Event hook anchor not found')

if text == original:
    raise SystemExit('No changes were applied')

path.write_text(text, encoding='utf-8')
print('Patched New Installation Page 4 with cashout + authoritative prorated billing flow.')
