(function () {
  "use strict";

  const SUPABASE_URL = "https://tcexzfztdgximrzuosqs.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8H8_S7NTWvzPCLvYUe2C4g_k3Ltjfiz";
  const state = { clients: [], ready: false };

  const els = {
    search: document.querySelector("#clientSearch"),
    status: document.querySelector("#clientSearchStatus"),
    results: document.querySelector("#clientSearchResults"),
    clear: document.querySelector("#clearClientSearchBtn"),
    notice: document.querySelector("#notice")
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
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value == null ? "" : String(value);
  }

  function hideResults() {
    els.results.classList.add("is-hidden");
    els.results.innerHTML = "";
  }

  function setReadyStatus() {
    if (!state.ready) return;
    els.search.disabled = false;
    els.search.placeholder = "Search account #, client name, phone, or RD/BLK";
    if (els.status) {
      els.status.textContent = state.clients.length.toLocaleString() + " clients ready from Supabase. Type to search.";
    }
    if (els.notice && /unable to load clients|apps script/i.test(els.notice.textContent || "")) {
      els.notice.textContent = "";
      els.notice.classList.add("is-hidden");
      els.notice.classList.remove("error");
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

  async function fetchClients() {
    const db = await loadSupabaseLibrary();
    const auth = await db.auth.getSession();
    if (!auth.data || !auth.data.session) throw new Error("Supabase login session not found. Please log in again.");

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

  function fillClient(row) {
    if (!row) return;

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
    setValue("currentBill", row.monthly_bill == null ? "0" : row.monthly_bill);
    setValue("dueDay", row.due_day || 10);

    if (typeof window.generateStatementNo === "function") window.generateStatementNo();
    if (typeof window.updateDates === "function") window.updateDates();
    if (typeof window.calculateTotals === "function") window.calculateTotals();
    if (typeof window.updatePreview === "function") window.updatePreview();
  }

  function renderResults() {
    const query = normalize(els.search.value);

    if (!query) {
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

  const statusObserver = new MutationObserver(function () {
    if (!state.ready || !els.status) return;
    const text = els.status.textContent || "";
    if (/unable to load clients|apps script deployment/i.test(text)) setReadyStatus();
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
    if (els.notice) {
      els.notice.textContent = "Unable to load clients from Supabase. " + (error && error.message ? error.message : "");
      els.notice.classList.remove("is-hidden");
      els.notice.classList.add("error");
    }
  });
})();