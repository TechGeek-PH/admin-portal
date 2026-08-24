// TechGeekPH unified Application Form persistence.
// One first-party flow for OWNER / ADMIN / EMPLOYEE: client master + form history,
// with admin-only ticket creation and employee requests routed for admin review.
(function () {
  "use strict";
  if (!/(^|\/)application_form\.html$/i.test(location.pathname) || window.__tgApplicationSupabaseV2) return;
  window.__tgApplicationSupabaseV2 = true;

  const form = document.getElementById("applicationForm");
  if (!form) return;
  const BUCKET = "client-documents";
  const $ = id => document.getElementById(id);
  const state = { rows: [], rendering: false };

  function normalize(v) { return String(v || "").trim().toLowerCase(); }
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>\"]/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m])); }
  function money(v) { const n = Number(String(v == null ? "" : v).replace(/[^0-9.-]/g, "")); return Number.isFinite(n) ? n : 0; }
  function today() { const d = new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-"); }

  function showNotice(message, type) {
    const el = $("notice");
    if (!el) return;
    el.textContent = message || "";
    el.classList.remove("is-hidden", "ok", "error", "err");
    if (!message) el.classList.add("is-hidden");
    else if (type === "error") el.classList.add("error");
    else if (type === "ok") el.classList.add("ok");
  }

  async function getContext() {
    if (window.TechGeekAuthReady) await window.TechGeekAuthReady;
    const db = window.TechGeekSupabase;
    if (!db) throw new Error("Supabase connection is not ready. Refresh the app and try again.");
    let auth = await db.auth.getSession();
    if (auth.error) throw auth.error;
    let session = auth.data && auth.data.session;
    if (!session && typeof window.TechGeekEnsureSupabaseSession === "function") {
      session = await window.TechGeekEnsureSupabaseSession();
    }
    if (!session || !session.user) throw new Error("Session expired. Please sign in again.");
    const p = await db.from("staff_profiles").select("full_name,role,active").eq("user_id", session.user.id).maybeSingle();
    if (p.error) throw p.error;
    const profile = p.data;
    const role = String(profile && profile.role || "").toUpperCase();
    if (!profile || !profile.active || !["OWNER","ADMIN","EMPLOYEE"].includes(role)) throw new Error("Active TechGeekPH staff account required.");
    return { db, session, profile, role };
  }

  function modeFromUrlOrForm() {
    const q = new URLSearchParams(location.search);
    const requested = normalize(q.get("form") || q.get("mode"));
    if (requested.includes("repair") || requested === "service") return "Repair";
    if (requested.includes("relocation") || requested.includes("transfer")) return "Relocation";
    if (requested) return "New Application";
    const select = $("formType");
    const value = normalize(select && select.value);
    if (value.includes("repair")) return "Repair";
    if (value.includes("relocation")) return "Relocation";
    return "New Application";
  }

  function readForm() {
    const data = {};
    const fd = new FormData(form);
    fd.forEach((value, key) => {
      if (value instanceof File) return;
      const text = String(value == null ? "" : value).trim();
      if (data[key] == null) data[key] = text;
      else if (text) data[key] = String(data[key]) + " | " + text;
    });
    data["Form Type"] = modeFromUrlOrForm();
    data["Record Type"] = data["Form Type"];
    const terms = $("termsAccepted"); if (terms) data["Terms Accepted"] = terms.checked ? "Yes" : "No";
    const accepted = $("acceptedDateTime"); if (accepted) data["Accepted Date & Time"] = accepted.value || "";
    const prorated = $("payProratedBill"); if (prorated) data["Pay Prorated Bill"] = prorated.checked ? "Yes" : "No";
    const ftth = $("ftthTotal"); if (ftth) data["FTTH Total Meter"] = ftth.value || "";
    ["monthlyFee","nextDueDate","proratedDays","proratedBill","totalInitialPayment","amountPaid"].forEach(id => { const el=$(id); if (el && el.name) data[el.name]=el.value||""; });
    const account = $("accountNo"); if (account && account.value) data["Account No."] = account.value.trim();
    const site = $("tgSiteTag"); if (site && site.value) data["Site Tag"] = site.value.trim();
    const num = $("tgClientNumber"); if (num && num.value) data["Client Number"] = num.value.trim();
    const preview = $("tgAccountPreview"); if (!data["Account No."] && preview && preview.value) data["Account No."] = preview.value.trim();
    return data;
  }

  function safeName(name) { return String(name || "file").replace(/[^A-Za-z0-9._-]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"") || "file"; }
  async function compressImage(file) {
    if (!/^image\//i.test(file.type || "") || file.size <= 9*1024*1024) return file;
    const url = await new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=()=>reject(r.error); r.readAsDataURL(file); });
    const img = await new Promise((resolve,reject)=>{ const i=new Image(); i.onload=()=>resolve(i); i.onerror=()=>reject(new Error("Unable to process image.")); i.src=String(url); });
    const max=1600, ratio=Math.min(max/img.width,max/img.height,1), canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(img.width*ratio)); canvas.height=Math.max(1,Math.round(img.height*ratio));
    canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",.82));
    if (!blob) throw new Error("Unable to compress image.");
    return new File([blob],safeName(file.name).replace(/\.[^.]+$/,"")+".jpg",{type:"image/jpeg"});
  }

  async function uploadFiles(db, uid) {
    const uploads = {}, allowed=["image/jpeg","image/png","image/webp","application/pdf"];
    for (const input of Array.from(form.querySelectorAll('input[type="file"]'))) {
      let file=input.files && input.files[0]; if (!file) continue;
      file=await compressImage(file);
      if (!allowed.includes(file.type)) throw new Error((input.name||"Attachment")+": JPG, PNG, WEBP, or PDF only.");
      if (file.size>10*1024*1024) throw new Error((input.name||"Attachment")+" exceeds 10 MB.");
      const path="form-submissions/"+uid+"/"+today().slice(0,7)+"/"+Date.now()+"-"+Math.random().toString(36).slice(2,8)+"-"+safeName(file.name);
      const up=await db.storage.from(BUCKET).upload(path,file,{cacheControl:"3600",upsert:false,contentType:file.type});
      if (up.error) throw up.error;
      uploads[input.name||input.id||"file"]={bucket:BUCKET,path:up.data.path,original_name:file.name,mime_type:file.type,size:file.size};
    }
    return uploads;
  }

  function resetAfterSave() {
    form.reset();
    const date=$("dateToday"); if (date) date.value=today();
    ["resetUploadNotes","refreshSpeedOptions","updateFormMode","updateFtthTotal","updatePaymentComputation"].forEach(name=>{ try { if(typeof window[name]==="function") window[name](); } catch(_){} });
  }

  async function save(event) {
    event.preventDefault(); event.stopImmediatePropagation();
    const submit=form.querySelector('button[type="submit"]'), old=submit?submit.textContent:"";
    if (submit) { submit.disabled=true; submit.textContent="Saving..."; }
    try {
      const ctx=await getContext();
      showNotice("Saving client record and form history...");
      const data=readForm();
      data["Encoded By"]=ctx.profile.full_name;
      data.__private_uploads=await uploadFiles(ctx.db,ctx.session.user.id);
      const result=await ctx.db.rpc("staff_save_client_form",{p_data:data});
      if (result.error) throw result.error;
      const saved=result.data || {};
      if (saved.account_no) {
        const account=$("accountNo"), preview=$("tgAccountPreview"), num=$("tgClientNumber");
        if (account) account.value=saved.account_no;
        if (preview) preview.value=saved.account_no;
        if (num && saved.client_number) num.value=String(saved.client_number).padStart(4,"0");
      }
      try { localStorage.setItem("tg_clients_changed_at",String(Date.now())); } catch(_){}
      try { window.dispatchEvent(new CustomEvent("tg-client-db-saved",{detail:saved})); } catch(_){}
      try { if(window.parent!==window) window.parent.postMessage({type:"tg-clients-changed",account_no:saved.account_no||""},location.origin); } catch(_){}
      if (saved.workflow === "ADMIN_REVIEW") showNotice("✅ Saved. Request "+(saved.request_no||"")+" sent to Tickets Admin for review.","ok");
      else showNotice("✅ Saved to Clients and Form History. Ticket created: "+(saved.ticket_no||"Created")+".","ok");
      resetAfterSave();
      setTimeout(loadHistory,250);
    } catch (error) {
      console.error("Application save failed",error);
      showNotice("Unable to save form: "+(error && error.message ? error.message : "Unknown error"),"error");
    } finally {
      if (submit) { submit.disabled=false; submit.textContent=old||"Save Form"; }
    }
  }

  function searchText(row) { const raw=row.form_data||{}; return [row.form_type,row.full_name,row.account_no,row.contact_no,row.plan,row.speed,row.status,raw["Repair Category"],raw["Problem Description"]].join(" ").toLowerCase(); }
  function renderHistory() {
    if (state.rendering) return; state.rendering=true;
    try {
      const body=$("applicationRows"); if (!body) return;
      const q=normalize($("searchInput") && $("searchInput").value);
      const rows=state.rows.filter(r=>!q||searchText(r).includes(q));
      const total=$("metricTotal"), count=$("rowCount"), installed=$("metricInstalled"), paid=$("metricPaid"), metricToday=$("metricToday");
      if(total) total.textContent=state.rows.length.toLocaleString();
      if(count) count.textContent=rows.length+" record"+(rows.length===1?"":"s");
      if(installed) installed.textContent=state.rows.filter(r=>["done","completed","installed","resolved"].includes(normalize(r.status)) || !!(r.form_data||{})["Date Installed"]).length.toLocaleString();
      if(paid) paid.textContent=state.rows.filter(r=>Number(r.amount_paid||0)>0).length.toLocaleString();
      if(metricToday) metricToday.textContent=state.rows.filter(r=>String(r.created_at||"").slice(0,10)===today()).length.toLocaleString();
      if(!rows.length){ body.innerHTML='<tr><td colspan="9">No form records yet.</td></tr>'; return; }
      body.innerHTML=rows.slice(0,100).map(r=>{ const raw=r.form_data||{}, maps=r.google_maps_link||raw["Google Maps Link"]||"", detail=raw["Repair Category"]||r.plan||r.form_type||"", status=raw["Repair Status"]||raw["Relocation Status"]||r.speed||r.status||"", ref=raw["Ticket No."]||raw["Service Request No."]||""; return '<tr><td data-label="Form Type">'+esc(r.form_type)+'</td><td data-label="Name">'+esc(r.full_name)+'</td><td data-label="Account No.">'+esc(r.account_no||"")+'</td><td data-label="Contact No">'+esc(r.contact_no||"")+'</td><td data-label="Plan / Concern">'+esc(detail)+'</td><td data-label="Speed / Status">'+esc(status)+'</td><td data-label="Amount / Fee">'+(Number(r.amount_paid||0)?"₱ "+Number(r.amount_paid).toLocaleString("en-PH",{minimumFractionDigits:2}):"")+'</td><td data-label="Reference">'+esc(ref)+'</td><td data-label="Google Maps">'+(maps?'<a href="'+esc(maps)+'" target="_blank" rel="noopener">Open Maps</a>':"")+'</td></tr>'; }).join("");
    } finally { state.rendering=false; }
  }

  async function loadHistory() {
    try {
      const ctx=await getContext();
      const r=await ctx.db.from("client_form_submissions").select("id,form_type,account_no,full_name,contact_no,email,plan,speed,amount_paid,status,google_maps_link,form_data,created_at").order("created_at",{ascending:false}).limit(500);
      if(r.error) throw r.error; state.rows=r.data||[]; renderHistory();
    } catch(error) { console.warn("Unable to load form history",error); }
  }

  document.addEventListener("submit",e=>{ if(e.target===form) save(e); },true);
  document.addEventListener("input",e=>{ if(e.target && e.target.id==="searchInput") renderHistory(); },true);
  document.addEventListener("click",e=>{ const b=e.target.closest && e.target.closest("#refreshBtn"); if(b){e.preventDefault();loadHistory();}},true);
  loadHistory();
})();
