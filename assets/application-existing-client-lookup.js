(function () {
  "use strict";

  if (!/(^|\/)application_form\.html$/i.test(window.location.pathname)) return;

  var SUPABASE_URL = "https://tcexzfztdgximrzuosqs.supabase.co";
  var SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8H8_S7NTWvzPCLvYUe2C4g_k3Ltjfiz";
  var clientCache = null;
  var clientCacheAt = 0;
  var accountField = null;
  var originalAccountParent = null;
  var originalAccountNext = null;

  function el(id) { return document.getElementById(id); }

  function text(value) { return String(value == null ? "" : value).trim(); }

  function normalize(value) { return text(value).toLowerCase(); }

  function escapeHtml(value) {
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setValue(id, value) {
    var input = el(id);
    if (!input || value == null || text(value) === "") return;
    input.value = value;
    try { input.dispatchEvent(new Event("input", { bubbles: true })); } catch (_) {}
    try { input.dispatchEvent(new Event("change", { bubbles: true })); } catch (_) {}
  }

  function currentMode() {
    var formType = el("formType");
    var value = normalize(formType ? formType.value : "");
    if (value.indexOf("relocation") !== -1) return "relocation";
    if (value.indexOf("repair") !== -1) return "repair";
    return "application";
  }

  function ensureStyles() {
    if (el("tgExistingClientLookupStyle")) return;
    var style = document.createElement("style");
    style.id = "tgExistingClientLookupStyle";
    style.textContent = [
      ".tg-existing-client-lookup{border-color:#b9d5e9!important;background:#f8fcff!important}",
      ".tg-existing-client-grid{display:grid;grid-template-columns:minmax(180px,.7fr) minmax(260px,1.3fr);gap:12px;padding:14px}",
      ".tg-existing-client-search{min-width:0}",
      ".tg-existing-client-search label{display:block;margin-bottom:6px;color:#334155;font-size:.76rem;font-weight:850}",
      ".tg-existing-client-search input{width:100%;min-height:40px;border:1px solid #d9e1ec;border-radius:8px;background:#fff;padding:0 11px;color:#16202f;outline:none;font-size:16px}",
      ".tg-existing-client-search input:focus{border-color:#064f83;box-shadow:0 0 0 3px rgba(6,79,131,.10)}",
      ".tg-existing-client-results{grid-column:1/-1;display:grid;gap:7px;margin-top:1px}",
      ".tg-existing-client-result{display:grid;grid-template-columns:minmax(95px,.5fr) minmax(170px,1fr) minmax(220px,1.5fr);gap:10px;align-items:center;width:100%;border:1px solid #dbe4ee;border-radius:9px;background:#fff;padding:10px 12px;text-align:left;color:#172438;cursor:pointer}",
      ".tg-existing-client-result:hover,.tg-existing-client-result:focus{border-color:#7fb5d8;background:#eef7fd;outline:none}",
      ".tg-existing-client-result b{color:#064f83;font-size:.8rem}",
      ".tg-existing-client-result strong{font-size:.8rem}",
      ".tg-existing-client-result span{color:#64748b;font-size:.72rem;overflow-wrap:anywhere}",
      ".tg-existing-client-state{grid-column:1/-1;padding:10px 12px;border:1px dashed #cbd8e5;border-radius:9px;background:#fff;color:#64748b;font-size:.76rem}",
      ".tg-existing-client-selected{grid-column:1/-1;display:none;padding:10px 12px;border-radius:9px;background:#eaf8f1;color:#126247;font-size:.78rem;font-weight:800}",
      ".tg-existing-client-selected.show{display:block}",
      "@media(max-width:760px){.tg-existing-client-grid{grid-template-columns:1fr}.tg-existing-client-result{grid-template-columns:1fr}.tg-existing-client-result span{margin-top:-4px}}"
    ].join("");
    document.head.appendChild(style);
  }

  function createLookupSection() {
    if (el("tgExistingClientLookup")) return el("tgExistingClientLookup");
    var formType = el("formType");
    if (!formType) return null;
    var formTypeSection = formType.closest ? formType.closest(".section") : null;
    if (!formTypeSection || !formTypeSection.parentNode) return null;

    ensureStyles();

    var section = document.createElement("div");
    section.id = "tgExistingClientLookup";
    section.className = "section tg-existing-client-lookup";
    section.innerHTML =
      '<div class="section-title"><h3>Existing Client Lookup</h3><span id="tgExistingClientModeLabel">For relocation / repair</span></div>' +
      '<div class="tg-existing-client-grid" id="tgExistingClientGrid">' +
        '<div class="tg-existing-client-search">' +
          '<label for="tgExistingClientSearch">Search Client / Account No.</label>' +
          '<input id="tgExistingClientSearch" type="search" autocomplete="off" placeholder="Type client name or SATR account number">' +
          '<small style="display:block;margin-top:5px;color:#64748b;font-size:.72rem">Select the existing client to auto-fill account, contact, address, router, and network details.</small>' +
        '</div>' +
        '<div class="tg-existing-client-selected" id="tgExistingClientSelected"></div>' +
        '<div class="tg-existing-client-results" id="tgExistingClientResults"><div class="tg-existing-client-state">Start typing a client name or account number.</div></div>' +
      '</div>';

    formTypeSection.parentNode.insertBefore(section, formTypeSection.nextSibling);

    var search = el("tgExistingClientSearch");
    if (search) {
      var timer = null;
      search.addEventListener("input", function () {
        clearTimeout(timer);
        timer = setTimeout(function () { searchClients(search.value); }, 180);
      });
      search.addEventListener("focus", function () {
        if (text(search.value).length >= 2) searchClients(search.value);
      });
    }

    return section;
  }

  function moveAccountFieldToTop() {
    var account = el("accountNo");
    var grid = el("tgExistingClientGrid");
    if (!account || !grid) return;
    if (!accountField) {
      accountField = account.closest ? account.closest(".field") : account.parentNode;
      if (!accountField) return;
      originalAccountParent = accountField.parentNode;
      originalAccountNext = accountField.nextSibling;
    }
    if (accountField.parentNode !== grid) grid.insertBefore(accountField, grid.firstChild);
  }

  function restoreAccountField() {
    if (!accountField || !originalAccountParent) return;
    if (accountField.parentNode === originalAccountParent) return;
    if (originalAccountNext && originalAccountNext.parentNode === originalAccountParent) {
      originalAccountParent.insertBefore(accountField, originalAccountNext);
    } else {
      originalAccountParent.appendChild(accountField);
    }
  }

  function showLookupForMode() {
    var section = createLookupSection();
    if (!section) return;
    var mode = currentMode();
    var enabled = mode === "relocation" || mode === "repair";
    section.style.display = enabled ? "block" : "none";
    if (enabled) {
      moveAccountFieldToTop();
      var label = el("tgExistingClientModeLabel");
      if (label) label.textContent = mode === "relocation" ? "Existing client transfer request" : "Existing client repair request";
    } else {
      restoreAccountField();
      var selected = el("tgExistingClientSelected");
      if (selected) { selected.className = "tg-existing-client-selected"; selected.textContent = ""; }
    }
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = function () { reject(new Error("Unable to load Supabase library.")); };
      document.head.appendChild(script);
    });
  }

  async function getDb() {
    if (window.TechGeekSupabase) return window.TechGeekSupabase;
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
    }
    if (!window.TechGeekSupabase) {
      window.TechGeekSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    }
    return window.TechGeekSupabase;
  }

  async function loadClients() {
    var now = Date.now();
    if (clientCache && now - clientCacheAt < 120000) return clientCache;
    var db = await getDb();
    var result = await db.from("clients").select("*").order("client_name", { ascending: true }).limit(2000);
    if (result.error) throw result.error;
    clientCache = result.data || [];
    clientCacheAt = now;
    return clientCache;
  }

  function clientSearchText(client) {
    return normalize([
      client.account_no,
      client.client_name,
      client.phone,
      client.email,
      client.service_address
    ].join(" "));
  }

  async function searchClients(query) {
    var results = el("tgExistingClientResults");
    if (!results) return;
    var q = normalize(query);
    if (q.length < 2) {
      results.innerHTML = '<div class="tg-existing-client-state">Type at least 2 characters to search.</div>';
      return;
    }

    results.innerHTML = '<div class="tg-existing-client-state">Searching existing clients…</div>';
    try {
      var clients = await loadClients();
      var matches = clients.filter(function (client) {
        return clientSearchText(client).indexOf(q) !== -1;
      }).slice(0, 12);

      if (!matches.length) {
        results.innerHTML = '<div class="tg-existing-client-state">No client found for <b>' + escapeHtml(query) + '</b>.</div>';
        return;
      }

      results.innerHTML = matches.map(function (client, index) {
        var address = text(client.service_address) || "No service address";
        return '<button type="button" class="tg-existing-client-result" data-tg-client-index="' + index + '">' +
          '<b>' + escapeHtml(client.account_no || "No Account #") + '</b>' +
          '<strong>' + escapeHtml(client.client_name || "Unnamed client") + '</strong>' +
          '<span>' + escapeHtml(address) + '</span>' +
        '</button>';
      }).join("");

      Array.prototype.forEach.call(results.querySelectorAll("[data-tg-client-index]"), function (button) {
        button.addEventListener("click", function () {
          var index = Number(button.getAttribute("data-tg-client-index"));
          var client = matches[index];
          if (client) selectClient(client);
        });
      });
    } catch (error) {
      results.innerHTML = '<div class="tg-existing-client-state" style="color:#98113b;border-color:#f0b5c3">Unable to load clients. ' + escapeHtml(error && error.message ? error.message : "Please try again.") + '</div>';
    }
  }

  function splitNameFallback(fullName) {
    var full = text(fullName);
    if (!full) return { first: "", middle: "", surname: "" };
    return { first: full, middle: "", surname: "" };
  }

  function selectClient(client) {
    var fallback = splitNameFallback(client.client_name);

    setValue("accountNo", client.account_no);
    setValue("name", client.first_name || client.given_name || fallback.first);
    setValue("middleName", client.middle_name || fallback.middle);
    setValue("surname", client.surname || client.last_name || fallback.surname);
    setValue("contactNo", client.phone || client.contact_no || client.mobile_no);
    setValue("emailAddress", client.email || client.email_address);
    setValue("currentServiceAddress", client.service_address || client.address);

    setValue("routerModel", client.modem_brand_model || client.router_model || client.modem_model);
    setValue("serialNo", client.modem_serial_no || client.serial_no || client.router_serial_no);
    setValue("napNo", client.nap_box || client.nap_no);
    setValue("lcpNo", client.lcp_no || client.lcp);
    setValue("ponStatus", client.pon_status);
    setValue("fiberCore", client.fiber_core);
    setValue("readingDbm", client.reading_dbm || client.reading);
    setValue("napSlotNo", client.nap_slot_no || client.nap_slot);
    setValue("googleMapsLink", client.google_maps_link || client.maps_link);

    var selected = el("tgExistingClientSelected");
    if (selected) {
      selected.className = "tg-existing-client-selected show";
      selected.innerHTML = "Selected: <b>" + escapeHtml(client.account_no || "") + "</b> · " + escapeHtml(client.client_name || "") +
        (client.service_address ? " · " + escapeHtml(client.service_address) : "");
    }

    var search = el("tgExistingClientSearch");
    if (search) search.value = [client.account_no, client.client_name].filter(Boolean).join(" · ");

    var results = el("tgExistingClientResults");
    if (results) results.innerHTML = '<div class="tg-existing-client-state" style="color:#126247;border-color:#bce8d7;background:#eefaf5">Client details loaded. You may now complete the ' + (currentMode() === "repair" ? "repair" : "relocation") + ' details below.</div>';
  }

  function setup() {
    var formType = el("formType");
    if (!formType) {
      setTimeout(setup, 200);
      return;
    }

    createLookupSection();
    showLookupForMode();

    formType.addEventListener("change", function () {
      setTimeout(showLookupForMode, 0);
    });

    var observer = new MutationObserver(function () {
      showLookupForMode();
    });
    observer.observe(formType, { attributes: true, childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup, { once: true });
  else setup();
})();
