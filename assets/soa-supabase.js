(function () {
  "use strict";

  const SUPABASE_URL = "https://tcexzfztdgximrzuosqs.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8H8_S7NTWvzPCLvYUe2C4g_k3Ltjfiz";

  const state = {
    clients: [],
    ready: false,
    selectedClient: null,
    db: null,
    billingRequest: 0
  };

  const els = {
    search: document.querySelector("#clientSearch"),
    status: document.querySelector("#clientSearchStatus"),
    results: document.querySelector("#clientSearchResults"),
    clear: document.querySelector("#clearClientSearchBtn"),
    notice: document.querySelector("#notice"),
    billingMonth: document.querySelector("#billingMonth")
  };

  if (!els.search || !els.results) return;

  function normalize(value) {
    return String(value == null ? "" : value).trim().toLowerCase();
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function numberValue(value) {
    const n = Number(value == null || value === "" ? 0 : value);
    return Number.isFinite(n) ? n : 0;
  }

  function moneyInput(value) {
    return numberValue(value).toFixed(2);
  }

  function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value == null ? "" : String(value);
  }

  function getValue(id) {
    const el = document.getElementById(id);
    return el ? String(el.value || "") : "";
  }

  function setNotice(message, type) {
    if (!els.notice) return;
    if (!message) {
      els.notice.textContent = "";
      els.notice.classList.add("is-hidden");
      els.notice.classList.remove("error", "ok");
      return;
    }
    els.notice.textContent = message;
    els.notice.classList.remove("is-hidden", "error", "ok");
    if (type) els.notice.classList.add(type);
  }

  function hideResults() {
    els.results.classList.add("is-hidden");
    els.results.innerHTML = "";
  }

  function setReadyStatus() {
    if (!state.ready) return;
    els.search.disabled = false;
    els.search.placeholder = "Search account #, client name, phone, or RD/BLK";
    if (els.status && !state.selectedClient) {
      els.status.textContent = state.clients.length.toLocaleString() + " clients ready from Supabase. Type to search.";
    }
    if (els.notice && /unable to load clients|apps script/i.test(els.notice.textContent || "")) {
      setNotice("");
    }
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

      const existing = document.querySelector('script[data-techgeek-supabase-lib="1"]');
      if (existing) {
        existing.addEventListener("load", createClient, { once: true });
        existing.addEventListener("error", function () { reject(new Error("Unable to load Supabase library.")); }, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      script.async = false;
      script.dataset.techgeekSupabaseLib = "1";
      script.onload = createClient;
      script.onerror = function () { reject(new Error("Unable to load Supabase library.")); };
      document.head.appendChild(script);
    });
  }

  async function ensureSession(db) {
    let result = await db.auth.getSession();
    let session = result && result.data ? result.data.session : null;
    if (!session) {
      const refreshed = await db.auth.refreshSession();
      session = refreshed && refreshed.data ? refreshed.data.session : null;
    }
    if (!session) throw new Error("Supabase login session not found. Please log in again.");
    return session;
  }

  async function fetchClients() {
    const db = await loadSupabaseLibrary();
    state.db = db;
    await ensureSession(db);

    const result = await db
      .from("clients")
      .select("id,account_no,client_name,phone,email,service_address,rd_blk,plan,speed,monthly_bill,due_day,account_status,service_status")
      .order("account_no", { ascending: true });

    if (result.error) throw result.error;
    return result.data || [];
  }

  function searchText(row) {
    return normalize([
      row.account_no,
      row.client_name,
      row.phone,
      row.rd_blk,
      row.service_address
    ].join(" "));
  }

  function billingStatusForSOA(bill) {
    if (!bill) return "Unpaid";
    const balance = numberValue(bill.balance);
    const paid = numberValue(bill.amount_paid);
    const raw = String(bill.billing_status || "").toUpperCase();

    if (balance <= 0 || raw === "PAID" || raw === "SETTLED") return "Paid";
    if (paid > 0) return "Partial";
    if (["FOR_DISCONNECTION", "DISCONNECTED", "OVERDUE", "PAST_DUE"].indexOf(raw) !== -1) return "Overdue";
    return "Unpaid";
  }

  function applyBillingRow(bill) {
    if (!bill) return;

    const adjustments = numberValue(bill.adjustments);
    const feeTotal = numberValue(bill.reconnection_fee) +
      numberValue(bill.extension_fee) +
      numberValue(bill.processing_fee);
    const otherCharges = numberValue(bill.penalty) + Math.max(adjustments, 0);
    const discount = adjustments < 0 ? Math.abs(adjustments) : 0;

    setValue("billingMonth", bill.billing_period || getValue("billingMonth"));
    setValue("previousBalance", moneyInput(bill.previous_balance));
    setValue("currentBill", moneyInput(bill.base_charge));
    setValue("reconnectionFee", moneyInput(feeTotal));
    setValue("otherCharges", moneyInput(otherCharges));
    setValue("discount", moneyInput(discount));
    setValue("amountPaid", moneyInput(bill.amount_paid));
    setValue("dueDate", bill.due_date || "");
    setValue("status", billingStatusForSOA(bill));

    if (typeof window.generateStatementNo === "function") window.generateStatementNo();
    if (typeof window.updateDates === "function") window.updateDates();
    if (bill.due_date) setValue("dueDate", bill.due_date);
    if (typeof window.calculateTotals === "function") window.calculateTotals();
    if (typeof window.updatePreview === "function") window.updatePreview();
  }

  async function fetchBillingForClient(row, preferredPeriod) {
    if (!row || !state.db) return null;
    const requestId = ++state.billingRequest;
    const db = state.db;
    await ensureSession(db);

    let bill = null;
    const period = String(preferredPeriod || "").trim();

    if (period) {
      const exact = await db
        .from("billing_ledger")
        .select("billing_id,billing_period,account_no,base_charge,previous_balance,adjustments,penalty,amount_due,due_date,billing_status,amount_paid,balance,date_paid,payment_reference,grace_end_date,disconnect_at,reconnection_fee,extension_fee,processing_fee,fee_applied,fee_type")
        .eq("account_no", row.account_no)
        .eq("billing_period", period)
        .order("due_date", { ascending: false })
        .limit(1);

      if (exact.error) throw exact.error;
      bill = exact.data && exact.data.length ? exact.data[0] : null;
    }

    if (!bill) {
      const latest = await db
        .from("billing_ledger")
        .select("billing_id,billing_period,account_no,base_charge,previous_balance,adjustments,penalty,amount_due,due_date,billing_status,amount_paid,balance,date_paid,payment_reference,grace_end_date,disconnect_at,reconnection_fee,extension_fee,processing_fee,fee_applied,fee_type")
        .eq("account_no", row.account_no)
        .order("billing_period", { ascending: false })
        .order("due_date", { ascending: false })
        .limit(1);

      if (latest.error) throw latest.error;
      bill = latest.data && latest.data.length ? latest.data[0] : null;
    }

    if (requestId !== state.billingRequest) return null;
    return bill;
  }

  async function loadBillingIntoSOA(row, preferredPeriod) {
    if (!row) return;
    if (els.status) els.status.textContent = "Loading billing ledger for " + row.account_no + "…";

    try {
      const bill = await fetchBillingForClient(row, preferredPeriod);
      if (state.selectedClient !== row) return;

      if (!bill) {
        setValue("previousBalance", "0.00");
        setValue("currentBill", moneyInput(row.monthly_bill));
        setValue("reconnectionFee", "0.00");
        setValue("otherCharges", "0.00");
        setValue("discount", "0.00");
        setValue("amountPaid", "0.00");
        setValue("status", "Unpaid");
        if (typeof window.calculateTotals === "function") window.calculateTotals();
        if (els.status) els.status.textContent = "Selected: " + row.account_no + " - " + (row.client_name || "No Name") + ". No billing ledger found; client monthly bill loaded.";
        return;
      }

      applyBillingRow(bill);
      if (els.status) {
        els.status.textContent = "Selected: " + row.account_no + " - " + (row.client_name || "No Name") +
          " | Billing " + bill.billing_period +
          " | Balance ₱" + numberValue(bill.balance).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      setNotice("");
    } catch (error) {
      if (state.selectedClient !== row) return;
      if (els.status) els.status.textContent = "Client loaded, but billing ledger could not be loaded.";
      setNotice("Unable to load billing ledger from Supabase. " + (error && error.message ? error.message : ""), "error");
    }
  }

  async function fillClient(row) {
    if (!row) return;
    state.selectedClient = row;

    els.search.value = [row.account_no, row.client_name].filter(Boolean).join(" - ");
    if (els.status) els.status.textContent = "Selected: " + els.search.value;
    hideResults();

    setValue("accountNo", row.account_no || "");
    setValue("clientName", row.client_name || "");
    setValue("phoneNumber", row.phone || "");
    setValue("clientEmail", row.email || "");
    setValue("serviceAddress", row.service_address || "");
    setValue("plan", row.plan || "");
    setValue("speed", row.speed || "");
    setValue("monthlyBill", row.monthly_bill == null ? "" : row.monthly_bill);
    setValue("currentBill", row.monthly_bill == null ? "0.00" : moneyInput(row.monthly_bill));
    setValue("dueDay", row.due_day || 10);

    if (typeof window.generateStatementNo === "function") window.generateStatementNo();
    if (typeof window.updateDates === "function") window.updateDates();
    if (typeof window.calculateTotals === "function") window.calculateTotals();
    if (typeof window.updatePreview === "function") window.updatePreview();

    await loadBillingIntoSOA(row, getValue("billingMonth"));
  }

  function renderResults() {
    const query = normalize(els.search.value);

    if (!query) {
      state.selectedClient = null;
      hideResults();
      setReadyStatus();
      return;
    }

    const digits = String(query).replace(/\D/g, "");
    const matches = state.clients.filter(function (row) {
      return searchText(row).indexOf(query) !== -1;
    }).slice(0, 15);

    const exact = matches.find(function (row) {
      const account = normalize(row.account_no);
      const phoneDigits = String(row.phone || "").replace(/\D/g, "");
      return account === query || (digits.length >= 7 && phoneDigits === digits);
    });

    if (exact && query.length >= 3) {
      fillClient(exact);
      return;
    }

    if (!matches.length) {
      els.results.innerHTML = '<div class="client-search-empty">No matching client found. You may still enter the SOA details manually.</div>';
      els.results.classList.remove("is-hidden");
      if (els.status) els.status.textContent = "No match found in Supabase.";
      return;
    }

    els.results.innerHTML = matches.map(function (row) {
      const index = state.clients.indexOf(row);
      const secondary = [row.phone, row.rd_blk, row.service_address].filter(Boolean).join(" | ");
      return '<button type="button" class="client-search-option" role="option" data-soa-supabase-index="' + index + '">' +
        '<strong>' + esc(row.account_no || "No Account") + '</strong>' +
        '<span>' + esc(row.client_name || "No Name") + '</span>' +
        '<small>' + esc(secondary || "No additional details") + '</small>' +
      '</button>';
    }).join("");

    els.results.classList.remove("is-hidden");
    if (els.status) els.status.textContent = matches.length + " matching client" + (matches.length === 1 ? "" : "s") + " from Supabase.";
  }

  function clearSearch() {
    state.selectedClient = null;
    ++state.billingRequest;
    els.search.value = "";
    hideResults();
    setReadyStatus();
  }

  document.addEventListener("input", function (event) {
    if (event.target !== els.search || !state.ready) return;
    event.stopImmediatePropagation();
    renderResults();
  }, true);

  document.addEventListener("keydown", function (event) {
    if (event.target !== els.search || !state.ready) return;
    if (event.key !== "Enter") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const first = els.results.querySelector("[data-soa-supabase-index]");
    if (first) fillClient(state.clients[Number(first.dataset.soaSupabaseIndex)]);
  }, true);

  document.addEventListener("click", function (event) {
    const option = event.target.closest("[data-soa-supabase-index]");
    if (option) {
      event.preventDefault();
      event.stopImmediatePropagation();
      fillClient(state.clients[Number(option.dataset.soaSupabaseIndex)]);
      return;
    }

    if (event.target === els.clear && state.ready) {
      event.preventDefault();
      event.stopImmediatePropagation();
      clearSearch();
    }
  }, true);

  if (els.billingMonth) {
    els.billingMonth.addEventListener("change", function () {
      if (!state.selectedClient) return;
      loadBillingIntoSOA(state.selectedClient, els.billingMonth.value);
    });
  }

  const statusObserver = new MutationObserver(function () {
    if (!state.ready || !els.status) return;
    const text = els.status.textContent || "";
    if (/unable to load clients|apps script deployment/i.test(text)) {
      if (state.selectedClient) {
        els.status.textContent = "Selected: " + state.selectedClient.account_no + " - " + (state.selectedClient.client_name || "No Name") + " | Supabase active.";
      } else {
        setReadyStatus();
      }
    }
  });
  if (els.status) statusObserver.observe(els.status, { childList: true, subtree: true, characterData: true });

  fetchClients().then(function (rows) {
    state.clients = rows;
    state.ready = true;
    setReadyStatus();
    window.setTimeout(setReadyStatus, 1200);
    window.setTimeout(setReadyStatus, 5000);
  }).catch(function (error) {
    els.search.disabled = false;
    els.search.placeholder = "Unable to load Supabase clients - manual entry still available";
    if (els.status) els.status.textContent = "Supabase client lookup unavailable.";
    setNotice("Unable to load clients from Supabase. " + (error && error.message ? error.message : ""), "error");
  });
})();