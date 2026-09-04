from pathlib import Path

# ---------- Billing ----------
p=Path('billing.html')
s=p.read_text()
if '.soa-pdf-btn{' not in s:
    s=s.replace('</style>','.soa-pdf-btn{min-width:132px;border-color:#b8e3d2!important;background:#eefaf5!important;color:#116447!important;white-space:nowrap}.soa-na{color:var(--muted);font-size:.68rem}</style>',1)
s=s.replace('<th>Account Tag — Editable</th><th>Reminder Queue</th></tr></thead><tbody id="rows"><tr><td colspan="10" class="empty">Loading billing records…</td></tr></tbody>','<th>Account Tag — Editable</th><th>Reminder Queue</th><th>SOA / PDF</th></tr></thead><tbody id="rows"><tr><td colspan="11" class="empty">Loading billing records…</td></tr></tbody>',1)
anchor='  function renderRows(){const rows=filtered();'
if 'function soaPdfButton(' not in s:
    s=s.replace(anchor,"  function soaPdfButton(b){if(!isPaid(b))return '<span class=\"soa-na\">Available after PAID</span>';return '<button class=\"btn soa-pdf-btn\" type=\"button\" data-soa-pdf=\"1\" data-account=\"'+esc(accountNo(b))+'\" data-billing=\"'+esc(billId(b))+'\">Download SOA PDF</button>'}\n\n"+anchor,1)
s=s.replace('colspan="10" class="empty">No billing records match this view.','colspan="11" class="empty">No billing records match this view.',1)
old='<td><span class="'+"'+qclass+'"+'">'+"'+esc(qtext)+'"+'</span></td></tr>'
new='<td><span class="'+"'+qclass+'"+'">'+"'+esc(qtext)+'"+'</span></td><td>'+"'+soaPdfButton(b)+'"+'</td></tr>'
if old in s:s=s.replace(old,new,1)
event='  document.addEventListener("change",e=>{const s=e.target.closest(".tag-select");if(s)setTag(s.dataset.account,s.value,s)});'
if 'statement_of_account.html?account_no=' not in s:
    click='  document.addEventListener("click",e=>{const b=e.target.closest("[data-soa-pdf]");if(!b)return;const account=String(b.dataset.account||"").trim(),billing=String(b.dataset.billing||"").trim();if(!account||!billing)return;const url="statement_of_account.html?account_no="+encodeURIComponent(account)+"&billing_id="+encodeURIComponent(billing)+"&auto_pdf=1&from=billing";window.open(url,"_blank","noopener")});\n'
    s=s.replace(event,click+event,1)
p.write_text(s)

# ---------- SOA ----------
p=Path('statement_of_account.html')
s=p.read_text()
canvas='<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>'
if 'jspdf.umd.min.js' not in s:
    s=s.replace(canvas,canvas+'\n  <script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>\n  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>',1)
png='<button class="ghost-btn" type="button" id="downloadPngBtn">Download SOA as PNG</button>'
if 'id="downloadPdfBtn"' not in s:
    s=s.replace(png,png+'\n            <button class="primary-btn" type="button" id="downloadPdfBtn">Download SOA PDF</button>',1)
fa='      downloadPngBtn: document.querySelector("#downloadPngBtn"),'
if 'downloadPdfBtn: document.querySelector' not in s:
    s=s.replace(fa,fa+'\n      downloadPdfBtn: document.querySelector("#downloadPdfBtn"),',1)
s=s.replace('setText("pvReminder", "Please settle the balance on or before the due date to avoid service interruption.");','setText("pvReminder", String(fields.status.value||"").toLowerCase()==="paid" ? "Payment received. Thank you for settling your TechGeekPH account." : "Please settle the balance on or before the due date to avoid service interruption.");',1)

ia='    fields.clientSearch.addEventListener("input", renderClientSearchResults);'
if 'async function downloadSoaAsPdfDirect()' not in s:
    block=r'''    function billingPeriodToMonth(value,dueDate){
      const raw=String(value||"").trim();
      let m=raw.match(/^(\d{4})[-\/]?(\d{2})$/);if(m)return m[1]+"-"+m[2];
      m=String(dueDate||"").match(/^(\d{4})-(\d{2})/);return m?m[1]+"-"+m[2]:currentMonthValue();
    }
    function isoDateOnly(value){const m=String(value||"").match(/^(\d{4}-\d{2}-\d{2})/);return m?m[1]:todayISO()}
    async function downloadSoaAsPdfDirect(){
      calculateTotals();
      if(!window.jspdf||!window.jspdf.jsPDF)throw new Error("PDF library is not available.");
      await initializeVisibleLogoAssets();
      const old=fields.downloadPdfBtn?fields.downloadPdfBtn.textContent:"";
      try{
        if(fields.downloadPdfBtn){fields.downloadPdfBtn.disabled=true;fields.downloadPdfBtn.textContent="Preparing PDF..."}
        const canvas=await html2canvas(fields.soaSheet,{scale:2,useCORS:true,backgroundColor:"#ffffff",logging:false,imageTimeout:15000});
        const pdf=new window.jspdf.jsPDF({orientation:"portrait",unit:"mm",format:"a4",compress:true});
        pdf.addImage(canvas.toDataURL("image/jpeg",.95),"JPEG",0,0,210,297,undefined,"FAST");
        pdf.save(safeFileName(fields.statementNo.value||fields.accountNo.value||"TechGeekPH-SOA")+".pdf");
        showNotice("SOA PDF downloaded successfully.","ok");
      }finally{if(fields.downloadPdfBtn){fields.downloadPdfBtn.disabled=false;fields.downloadPdfBtn.textContent=old||"Download SOA PDF"}}
    }
    async function initializePaidSoaFromQuery(){
      const q=new URLSearchParams(location.search),account=String(q.get("account_no")||"").trim(),billingId=String(q.get("billing_id")||"").trim();
      if(!billingId)return;
      try{
        showNotice("Loading paid billing record for PDF...","ok");
        if(!window.supabase)throw new Error("Supabase client library is unavailable.");
        const sb=window.supabase.createClient("https://tcexzfztdgximrzuosqs.supabase.co","sb_publishable_8H8_S7NTWvzPCLvYUe2C4g_k3Ltjfiz",{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
        const auth=await sb.auth.getSession();if(auth.error)throw auth.error;if(!auth.data.session)throw new Error("Admin session expired. Please sign in again.");
        let bq=sb.from("billing_ledger").select("*").eq("billing_id",billingId);if(account)bq=bq.eq("account_no",account);
        const br=await bq.maybeSingle();if(br.error)throw br.error;const bill=br.data;if(!bill)throw new Error("Billing record not found.");
        const paid=Number(bill.balance||0)<=0||String(bill.billing_status||"").toUpperCase()==="PAID";if(!paid)throw new Error("SOA PDF download is available only after this bill is PAID.");
        const cr=await sb.from("clients").select("account_no,client_name,phone,email,service_address,plan,speed,monthly_bill,due_day").eq("account_no",bill.account_no).maybeSingle();if(cr.error)throw cr.error;const c=cr.data||{};
        fields.accountNo.value=bill.account_no||c.account_no||account;fields.clientName.value=c.client_name||"";fields.phoneNumber.value=c.phone||"";if(fields.clientEmail)fields.clientEmail.value=c.email||"";fields.serviceAddress.value=c.service_address||"";fields.plan.value=c.plan||"";fields.speed.value=c.speed||"";
        fields.monthlyBill.value=Number(c.monthly_bill||bill.base_charge||bill.amount_due||0);fields.dueDay.value=String(c.due_day||String(bill.due_date||"").slice(8,10).replace(/^0/,"")||10);fields.billingMonth.value=billingPeriodToMonth(bill.billing_period,bill.due_date);fields.statementDate.value=isoDateOnly(bill.date_paid||new Date().toISOString());fields.dueDate.value=isoDateOnly(bill.due_date);fields.periodFrom.value=isoDateOnly(bill.due_date);fields.periodTo.value=addDays(fields.periodFrom.value,29);generateStatementNo();
        const amountDue=Number(bill.amount_due||0),base=Number(bill.base_charge||c.monthly_bill||0),previous=Number(bill.previous_balance||0),reconnect=Number(bill.reconnection_fee||0)+Number(bill.extension_fee||0),adj=Number(bill.adjustments||0);let other=Number(bill.penalty||0)+Number(bill.processing_fee||0)+Math.max(adj,0),discount=Math.max(-adj,0);const residual=amountDue-(base+previous+reconnect+other-discount);if(residual>.005)other+=residual;if(residual<-.005)discount+=-residual;
        fields.previousBalance.value=previous.toFixed(2);fields.currentBill.value=base.toFixed(2);fields.reconnectionFee.value=reconnect.toFixed(2);fields.otherCharges.value=other.toFixed(2);fields.discount.value=discount.toFixed(2);fields.amountPaid.value=Number(bill.amount_paid||amountDue).toFixed(2);fields.status.value="Paid";fields.remarks.value="PAID"+(bill.payment_reference?" | Payment Ref: "+bill.payment_reference:"")+(bill.date_paid?" | Paid: "+formatDate(isoDateOnly(bill.date_paid)):"");
        calculateTotals();showNotice("Paid SOA ready for "+fields.accountNo.value+" · "+billingId+".","ok");
        if(q.get("auto_pdf")==="1")setTimeout(()=>downloadSoaAsPdfDirect().catch(e=>showNotice("SOA is ready, but automatic PDF download failed: "+(e.message||e)+". Click Download SOA PDF.","error")),700);
      }catch(error){console.error("Paid SOA load failed",error);showNotice("Unable to prepare paid SOA: "+(error.message||error),"error")}
    }

'''
    s=s.replace(ia,block+ia,1)
la='    fields.downloadPngBtn.addEventListener("click", downloadSoaAsPng);'
if 'fields.downloadPdfBtn.addEventListener' not in s:
    s=s.replace(la,la+'\n    fields.downloadPdfBtn.addEventListener("click",()=>downloadSoaAsPdfDirect().catch(e=>showNotice("Unable to generate SOA PDF: "+(e.message||e),"error")));',1)
init='    initializeVisibleLogoAssets();\n    loadClients();'
if 'initializePaidSoaFromQuery();' not in s:
    s=s.replace(init,init+'\n    initializePaidSoaFromQuery();',1)
p.write_text(s)
