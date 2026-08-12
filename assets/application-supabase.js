(function () {
  "use strict";

  const SUPABASE_URL = "https://tcexzfztdgximrzuosqs.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8H8_S7NTWvzPCLvYUe2C4g_k3Ltjfiz";
  const BUCKET = "client-documents";
  const form = document.querySelector("#applicationForm");

  if (!form) return;

  const state = {
    submissions: [],
    rendering: false
  };

  function $(selector) {
    return document.querySelector(selector);
  }

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function money(value) {
    const clean = String(value == null ? "" : value).replace(/[^0-9.-]/g, "");
    const number = Number(clean);
    return Number.isFinite(number) ? number : 0;
  }

  function today() {
    const d = new Date();
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
  }

  function showNotice(message, type) {
    const el = $("#notice");
    if (!el) return;
    el.textContent = message || "";
    el.classList.remove("is-hidden", "ok", "error");
    if (!message) el.classList.add("is-hidden");
    if (type === "ok") el.classList.add("ok");
    if (type === "error") el.classList.add("error");
  }

  function setSupabaseChip() {
    const chip = $("#sheetChip");
    if (chip) chip.textContent = "Database: Supabase";
  }

  function loadSupabaseLibrary() {
    return new Promise(function (resolve, reject) {
      if (window.TechGeekSupabase) return resolve(window.TechGeekSupabase);

      function createClient() {
        if (!window.supabase || typeof window.supabase.createClient !== "function") {
          reject(new Error("Supabase library unavailable."));
          return;
        }
        window.TechGeekSupabase = window.supabase.createClient(
          SUPABASE_URL,
          SUPABASE_PUBLISHABLE_KEY,
          { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
        );
        resolve(window.TechGeekSupabase);
      }

      if (window.supabase && typeof window.supabase.createClient === "function") {
        createClient();
        return;
      }

      const existing = document.querySelector('script[data-techgeek-supabase-lib]');
      if (existing) {
        existing.addEventListener("load", createClient, { once: true });
        existing.addEventListener("error", function () { reject(new Error("Unable to load Supabase library.")); }, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      script.async = true;
      script.dataset.techgeekSupabaseLib = "1";
      script.onload = createClient;
      script.onerror = function () { reject(new Error("Unable to load Supabase library.")); };
      document.head.appendChild(script);
    });
  }

  async function getContext() {
    const db = await loadSupabaseLibrary();
    const auth = await db.auth.getSession();
    if (auth.error) throw auth.error;
    const session = auth.data && auth.data.session;
    if (!session || !session.user) throw new Error("Supabase login session not found. Please log in again.");

    const profileResult = await db
      .from("staff_profiles")
      .select("full_name,role,active")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (profileResult.error) throw profileResult.error;
    const profile = profileResult.data;
    if (!profile || !profile.active || ["OWNER", "ADMIN"].indexOf(String(profile.role || "").toUpperCase()) === -1) {
      throw new Error("This account is not authorized to save admin forms.");
    }

    return { db: db, session: session, profile: profile };
  }

  function readPlainForm() {
    const data = {};
    const fd = new FormData(form);

    fd.forEach(function (value, key) {
      if (value instanceof File) return;
      data[key] = value;
    });

    const terms = $("#termsAccepted");
    const acceptedDate = $("#acceptedDateTime");
    const prorated = $("#payProratedBill");
    const ftthTotal = $("#ftthTotal");

    data["Terms Accepted"] = terms && terms.checked ? "Yes" : "No";
    if (acceptedDate) data["Accepted Date & Time"] = acceptedDate.value || "";
    if (prorated) data["Pay Prorated Bill"] = prorated.checked ? "Yes" : "No";
    if (ftthTotal) data["FTTH Total Meter"] = ftthTotal.value || "";

    ["monthlyFee", "nextDueDate", "proratedDays", "proratedBill", "totalInitialPayment", "amountPaid"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el && el.name) data[el.name] = el.value || "";
    });

    return data;
  }

  function safeFileName(name) {
    return String(name || "file")
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "file";
  }

  async function compressLargeImage(file) {
    if (!/^image\//i.test(file.type || "") || file.size <= 9 * 1024 * 1024) return file;

    const dataUrl = await new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(reader.error || new Error("Unable to read image.")); };
      reader.readAsDataURL(file);
    });

    const image = await new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("Unable to process image.")); };
      img.src = String(dataUrl || "");
    });

    const max = 1600;
    const ratio = Math.min(max / image.width, max / image.height, 1);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * ratio));
    canvas.height = Math.max(1, Math.round(image.height * ratio));
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise(function (resolve) {
      canvas.toBlob(resolve, "image/jpeg", 0.82);
    });

    if (!blob) throw new Error("Unable to compress image.");
    return new File([blob], safeFileName(file.name).replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  }

  async function uploadFiles(db, userId) {
    const uploads = {};
    const inputs = Array.prototype.slice.call(form.querySelectorAll('input[type="file"]'));
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

    for (const input of inputs) {
      let file = input.files && input.files[0];
      if (!file) continue;

      if (/^image\//i.test(file.type || "") && file.size > 9 * 1024 * 1024) {
        file = await compressLargeImage(file);
      }

      if (allowed.indexOf(file.type) === -1) {
        throw new Error((input.name || "Attachment") + ": supported files are JPG, PNG, WEBP, and PDF only.");
      }
      if (file.size > 10 * 1024 * 1024) {
        throw new Error((input.name || "Attachment") + " exceeds the 10 MB upload limit.");
      }

      const stamp = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      const month = today().slice(0, 7);
      const path = "form-submissions/" + userId + "/" + month + "/" + stamp + "-" + safeFileName(file.name);
      const result = await db.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type
      });

      if (result.error) throw result.error;
      uploads[input.name || input.id || "file"] = {
        bucket: BUCKET,
        path: result.data.path,
        original_name: file.name,
        mime_type: file.type,
        size: file.size
      };
    }

    return uploads;
  }

  function fullName(data) {
    return [data["Name"], data["Middle Name"], data["Surname"]]
      .map(function (v) { return String(v || "").trim(); })
      .filter(Boolean)
      .join(" ");
  }

  function buildAddress(data, relocation) {
    const keys = relocation
      ? ["New House Number", "New Street Name", "New Barangay", "New City/Municipality", "New Postal Code", "Country"]
      : ["House Number", "Street Name", "Barangay", "City/Municipality", "Postal Code", "Country"];

    return keys.map(function (key) { return String(data[key] || "").trim(); }).filter(Boolean).join(", ");
  }

  function parseDate(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    const d = new Date(text.length === 10 ? text + "T00:00:00" : text);
    if (Number.isNaN(d.getTime())) return null;
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
  }

  function dueDayFrom(value) {
    const date = parseDate(value);
    if (!date) return null;
    const day = Number(date.slice(8, 10));
    return day >= 1 && day <= 31 ? day : null;
  }

  async function findClient(db, accountNo) {
    if (!accountNo) return null;
    const result = await db.from("clients").select("*").eq("account_no", accountNo).maybeSingle();
    if (result.error) throw result.error;
    return result.data || null;
  }

  async function syncNewApplicationClient(db, data, existing) {
    const accountNo = String(data["Account No."] || "").trim();
    if (!accountNo) return existing || null;

    const installedDate = parseDate(data["Date Installed"]);
    const pon = normalize(data["PON Status"]);
    const isActive = Boolean(installedDate) || pon === "online" || pon === "active";
    const payload = {
      account_no: accountNo,
      client_name: fullName(data),
      account_status: isActive ? "Active" : "Pending",
      service_status: isActive ? "Active" : "For Installation",
      phone: String(data["Contact No"] || "").trim() || null,
      email: String(data["Email Address"] || "").trim() || null,
      service_address: buildAddress(data, false) || null,
      plan: String(data["Plan"] || "").trim() || null,
      speed: String(data["Speed"] || "").trim() || null,
      monthly_bill: money(data["Monthly Fee"]) || null,
      due_day: dueDayFrom(data["Next Due Date"]),
      register_date: parseDate(data["Date Today"]),
      installation_date: installedDate,
      activation_date: isActive ? installedDate : null,
      sales_agent_referral: String(data["Referral By"] || "").trim() || null,
      installer_technician: String(data["Assigned Technician"] || "").trim() || null,
      google_maps_link: String(data["Google Maps Link"] || "").trim() || null,
      modem_brand_model: String(data["Router Model"] || "").trim() || null,
      modem_serial_no: String(data["Serial No."] || "").trim() || null
    };

    Object.keys(payload).forEach(function (key) {
      if (payload[key] === null || payload[key] === "") delete payload[key];
    });

    let result;
    if (existing) {
      result = await db.from("clients").update(payload).eq("id", existing.id).select("*").single();
    } else {
      result = await db.from("clients").insert(payload).select("*").single();
    }
    if (result.error) throw result.error;
    return result.data;
  }

  function formStatus(data) {
    const type = normalize(data["Form Type"]);
    if (type.indexOf("repair") !== -1) return String(data["Repair Status"] || "Pending");
    if (type.indexOf("relocation") !== -1) return String(data["Relocation Status"] || "Pending");
    return String(data["Application Status"] || (data["Date Installed"] ? "Installed" : "Pending"));
  }

  function ticketStatus(data) {
    const status = normalize(formStatus(data));
    if (["done", "completed", "installed", "resolved"].indexOf(status) !== -1) return "Done";
    if (status === "on going" || status === "ongoing") return "On Going";
    if (status === "for checking") return "For Checking";
    if (status === "assigned" || status === "scheduled") return "Assigned";
    if (status.indexOf("cancel") !== -1 || status.indexOf("reject") !== -1) return "Cancelled";
    return "Pending";
  }

  function ticketType(data) {
    const type = normalize(data["Form Type"]);
    if (type.indexOf("repair") !== -1) return "Repair";
    if (type.indexOf("relocation") !== -1) return "Relocation";
    return "Installation";
  }

  function ticketIssue(data) {
    const type = ticketType(data);
    if (type === "Repair") {
      return [data["Repair Category"], data["Problem Description"], data["Initial Diagnosis"]]
        .filter(Boolean).join(" - ") || "Repair request";
    }
    if (type === "Relocation") {
      const oldAddress = String(data["Current Service Address"] || "").trim();
      const newAddress = buildAddress(data, true);
      return "Relocation request" + (oldAddress || newAddress ? ": " + oldAddress + " → " + newAddress : "");
    }
    return ["New client installation", data["Plan"], data["Speed"]].filter(Boolean).join(" - ");
  }

  function ticketPriority(data) {
    const p = normalize(data["Repair Priority"]);
    if (p.indexOf("urgent") !== -1 || p.indexOf("emergency") !== -1) return "Urgent";
    if (p === "high") return "High";
    return "Normal";
  }

  function ticketSchedule(data) {
    if (ticketType(data) === "Repair") return parseDate(data["Preferred Repair Date"]);
    if (ticketType(data) === "Relocation") return parseDate(data["Preferred Relocation Date"]);
    return parseDate(data["Date Installed"]);
  }

  async function nextTicketNo(db) {
    const result = await db.from("support_tickets").select("ticket_no").order("ticket_no", { ascending: false }).limit(1);
    if (result.error) throw result.error;
    const last = result.data && result.data[0] && result.data[0].ticket_no;
    const match = String(last || "").match(/([0-9]+)$/);
    const next = (match ? Number(match[1]) : 0) + 1;
    return "TKT-" + String(next).padStart(4, "0");
  }

  async function createTicket(db, data, client, createdBy) {
    const accountNo = String(data["Account No."] || "").trim() || null;
    const address = ticketType(data) === "Relocation" ? buildAddress(data, true) : buildAddress(data, false);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const ticketNo = await nextTicketNo(db);
      const payload = {
        ticket_no: ticketNo,
        created_date: parseDate(data["Date Today"]) || today(),
        client_id: client ? client.id : null,
        client_account_no: accountNo,
        client_name: fullName(data),
        contact_number: String(data["Contact No"] || "").trim() || null,
        address: address || String(data["Current Service Address"] || "").trim() || null,
        ticket_type: ticketType(data),
        issue_purpose: ticketIssue(data),
        priority: ticketPriority(data),
        assigned_tech: String(data["Assigned Technician"] || "").trim() || null,
        status: ticketStatus(data),
        schedule_date: ticketSchedule(data),
        created_by: createdBy
      };

      const result = await db.from("support_tickets").insert(payload).select("ticket_no").single();
      if (!result.error) return result.data.ticket_no;
      if (result.error.code !== "23505") throw result.error;
    }

    throw new Error("Unable to generate a unique ticket number.");
  }

  function resetFormAfterSave() {
    form.reset();
    const dateToday = $("#dateToday");
    if (dateToday) dateToday.value = today();

    ["resetUploadNotes", "refreshSpeedOptions", "updateFormMode", "updateFtthTotal", "updatePaymentComputation"].forEach(function (name) {
      try {
        if (typeof window[name] === "function") window[name]();
      } catch (error) {}
    });
  }

  async function saveToSupabase(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    const submit = form.querySelector('button[type="submit"]');
    const oldText = submit ? submit.textContent : "";
    if (submit) {
      submit.disabled = true;
      submit.textContent = "Saving to Supabase...";
    }

    try {
      showNotice("Preparing form and private uploads...");
      const ctx = await getContext();
      const data = readPlainForm();
      data["Form Type"] = String(data["Form Type"] || "New Application");
      data["Record Type"] = data["Form Type"];
      data["Encoded By"] = ctx.profile.full_name;

      const uploads = await uploadFiles(ctx.db, ctx.session.user.id);
      data.__private_uploads = uploads;

      const accountNo = String(data["Account No."] || "").trim();
      let client = await findClient(ctx.db, accountNo);
      if (normalize(data["Form Type"]).indexOf("new application") !== -1 && accountNo) {
        showNotice("Saving application and syncing client account...");
        client = await syncNewApplicationClient(ctx.db, data, client);
      }

      const submissionPayload = {
        form_type: data["Form Type"],
        client_id: client ? client.id : null,
        account_no: accountNo || null,
        full_name: fullName(data),
        contact_no: String(data["Contact No"] || "").trim() || null,
        email: String(data["Email Address"] || "").trim() || null,
        plan: String(data["Plan"] || "").trim() || null,
        speed: String(data["Speed"] || "").trim() || null,
        amount_paid: money(data["Amount Paid"] || data["Total Initial Payment"]) || 0,
        status: formStatus(data),
        google_maps_link: String(data["Google Maps Link"] || "").trim() || null,
        form_data: data,
        submitted_by: ctx.session.user.id,
        submitted_by_name: ctx.profile.full_name
      };

      const submissionResult = await ctx.db
        .from("client_form_submissions")
        .insert(submissionPayload)
        .select("id")
        .single();
      if (submissionResult.error) throw submissionResult.error;

      showNotice("Form saved. Creating service ticket...");
      const ticketNo = await createTicket(ctx.db, data, client, ctx.profile.full_name);

      const updatedData = Object.assign({}, data, {
        "Supabase Submission ID": submissionResult.data.id,
        "Ticket No.": ticketNo
      });
      const updateResult = await ctx.db
        .from("client_form_submissions")
        .update({ form_data: updatedData })
        .eq("id", submissionResult.data.id);
      if (updateResult.error) console.warn("Unable to attach ticket metadata to form record:", updateResult.error.message);

      showNotice("✅ Saved to Supabase. Ticket created: " + ticketNo, "ok");
      resetFormAfterSave();
      await loadSubmissions();
    } catch (error) {
      console.error("Supabase application save failed:", error);
      showNotice("Unable to save form: " + (error && error.message ? error.message : "Unknown error"), "error");
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = oldText || "Save Form";
      }
    }
  }

  function submissionSearchText(row) {
    const raw = row.form_data || {};
    return [row.form_type, row.full_name, row.account_no, row.contact_no, row.plan, row.speed, row.status,
      raw["Repair Category"], raw["Problem Description"], raw["Current Service Address"], raw["New Street Name"]]
      .map(function (v) { return String(v || ""); }).join(" ").toLowerCase();
  }

  function localDateFromTimestamp(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
  }

  function isCompleted(row) {
    const raw = row.form_data || {};
    const status = normalize(row.status);
    return Boolean(raw["Date Installed"]) || ["done", "completed", "installed", "resolved"].indexOf(status) !== -1;
  }

  function renderSubmissions() {
    if (state.rendering) return;
    state.rendering = true;

    try {
      setSupabaseChip();
      const search = $("#searchInput");
      const query = normalize(search && search.value);
      const rows = state.submissions.filter(function (row) {
        return !query || submissionSearchText(row).indexOf(query) !== -1;
      });

      const total = $("#metricTotal");
      const metricToday = $("#metricToday");
      const installed = $("#metricInstalled");
      const paid = $("#metricPaid");
      const rowCount = $("#rowCount");
      const body = $("#applicationRows");

      if (total) total.textContent = state.submissions.length.toLocaleString();
      if (metricToday) metricToday.textContent = state.submissions.filter(function (r) { return localDateFromTimestamp(r.created_at) === today(); }).length.toLocaleString();
      if (installed) installed.textContent = state.submissions.filter(isCompleted).length.toLocaleString();
      if (paid) paid.textContent = state.submissions.filter(function (r) { return Number(r.amount_paid || 0) > 0; }).length.toLocaleString();
      if (rowCount) rowCount.textContent = rows.length + " record" + (rows.length === 1 ? "" : "s");

      if (!body) return;
      if (!rows.length) {
        body.innerHTML = '<tr><td colspan="9">No Supabase form records yet.</td></tr>';
        return;
      }

      body.innerHTML = rows.slice(0, 80).map(function (row) {
        const raw = row.form_data || {};
        const planOrConcern = raw["Repair Category"] || row.plan || (normalize(row.form_type).indexOf("relocation") !== -1 ? "Relocation" : "");
        const speedOrStatus = raw["Repair Status"] || raw["Relocation Status"] || row.speed || row.status || "";
        const amountOrFee = raw["Repair Fee"] || raw["Relocation Fee"] || row.amount_paid || "";
        const completed = raw["Date Installed"] || raw["Preferred Relocation Date"] || raw["Preferred Repair Date"] || "";
        const maps = row.google_maps_link || raw["Google Maps Link"] || "";

        return "<tr>" +
          '<td data-label="Form Type">' + esc(row.form_type) + "</td>" +
          '<td data-label="Name">' + esc(row.full_name) + "</td>" +
          '<td data-label="Account No.">' + esc(row.account_no || "") + "</td>" +
          '<td data-label="Contact No">' + esc(row.contact_no || "") + "</td>" +
          '<td data-label="Plan / Concern">' + esc(planOrConcern) + "</td>" +
          '<td data-label="Speed / Status">' + esc(speedOrStatus) + "</td>" +
          '<td data-label="Amount / Fee">' + (money(amountOrFee) ? "₱ " + money(amountOrFee).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "") + "</td>" +
          '<td data-label="Completed">' + esc(completed) + "</td>" +
          '<td data-label="Google Maps">' + (maps ? '<a href="' + esc(maps) + '" target="_blank" rel="noopener">Open Maps</a>' : "") + "</td>" +
        "</tr>";
      }).join("");
    } finally {
      state.rendering = false;
    }
  }

  async function loadSubmissions() {
    try {
      const ctx = await getContext();
      const result = await ctx.db
        .from("client_form_submissions")
        .select("id,form_type,account_no,full_name,contact_no,email,plan,speed,amount_paid,status,google_maps_link,form_data,created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (result.error) throw result.error;
      state.submissions = result.data || [];
      renderSubmissions();
      showNotice("", "");
    } catch (error) {
      showNotice("Unable to load Supabase form records: " + (error && error.message ? error.message : "Unknown error"), "error");
    }
  }

  document.addEventListener("submit", function (event) {
    if (event.target !== form) return;
    saveToSupabase(event);
  }, true);

  document.addEventListener("input", function (event) {
    if (event.target && event.target.id === "searchInput") {
      event.stopImmediatePropagation();
      renderSubmissions();
    }
  }, true);

  document.addEventListener("click", function (event) {
    const refresh = event.target.closest("#refreshBtn");
    if (refresh) {
      event.preventDefault();
      event.stopImmediatePropagation();
      loadSubmissions();
    }
  }, true);

  const body = $("#applicationRows");
  if (body && typeof MutationObserver !== "undefined") {
    const observer = new MutationObserver(function () {
      if (state.rendering) return;
      window.setTimeout(renderSubmissions, 0);
    });
    observer.observe(body, { childList: true, subtree: true });
  }

  setSupabaseChip();
  loadSubmissions();
  window.setTimeout(renderSubmissions, 1200);
  window.setTimeout(renderSubmissions, 3500);
})();