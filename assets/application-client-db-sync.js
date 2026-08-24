// TechGeekPH Application Form -> Clients database safety sync.
// Runs after the form's normal save succeeds, so a successful New Installation
// is guaranteed to exist in the Supabase client master used by Clients/Repair/Relocation.
(function () {
  "use strict";

  if (!/(^|\/)application_form\.html$/i.test(window.location.pathname) || window.__tgClientDbSyncLoaded) return;
  window.__tgClientDbSyncLoaded = true;

  const BASE = "https://tcexzfztdgximrzuosqs.supabase.co";
  const KEY = "sb_publishable_8H8_S7NTWvzPCLvYUe2C4g_k3Ltjfiz";
  const $ = function (id) { return document.getElementById(id); };

  function token() {
    try {
      const session = JSON.parse(
        localStorage.getItem("tg_session_v3") ||
        localStorage.getItem("sb-tcexzfztdgximrzuosqs-auth-token") ||
        "null"
      );
      return session && session.access_token ? session.access_token : "";
    } catch (_) {
      return "";
    }
  }

  async function rpc(name, body) {
    const accessToken = token();
    if (!accessToken) throw new Error("Session expired. Please sign in again.");
    const response = await fetch(BASE + "/rest/v1/rpc/" + name, {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body || {})
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
    if (!response.ok) throw new Error((data && (data.message || data.hint)) || "Client database request failed.");
    return data;
  }

  function snapshotForm(form) {
    const data = {};
    const fd = new FormData(form);
    fd.forEach(function (value, key) {
      if (value instanceof File) return;
      const text = String(value == null ? "" : value).trim();
      if (data[key] == null) data[key] = text;
      else if (text) data[key] = String(data[key]) + " | " + text;
    });

    function value(id) {
      const el = $(id);
      return el ? String(el.value || "").trim() : "";
    }

    const requested = String(new URLSearchParams(location.search).get("form") || "").toLowerCase();
    data["Form Type"] = requested.indexOf("repair") !== -1 ? "Repair" :
      (requested.indexOf("relocation") !== -1 ? "Relocation" : (value("formType") || "New Application"));
    data["Record Type"] = data["Form Type"];

    if (value("accountNo")) data["Account No."] = value("accountNo");
    if (value("tgSiteTag")) data["Site Tag"] = value("tgSiteTag");
    if (value("tgClientNumber")) data["Client Number"] = value("tgClientNumber");
    if (!data["Account No."] && value("tgAccountPreview")) data["Account No."] = value("tgAccountPreview");
    return data;
  }

  function appendNotice(text, error) {
    const notice = $("notice");
    if (!notice) return;
    const current = String(notice.textContent || "").trim();
    notice.textContent = current ? current + " " + text : text;
    notice.classList.remove("is-hidden");
    if (error) {
      notice.classList.remove("ok");
      notice.classList.add("error");
    }
  }

  function signalClientChange(result) {
    try { localStorage.setItem("tg_clients_changed_at", String(Date.now())); } catch (_) {}
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "tg-clients-changed", account_no: result && result.account_no || "" }, location.origin);
      }
    } catch (_) {}
    try { window.dispatchEvent(new CustomEvent("tg-client-db-saved", { detail: result || {} })); } catch (_) {}
  }

  function waitForOriginalSave(initialText, payload) {
    const started = Date.now();
    let sawPendingState = false;
    const timer = window.setInterval(async function () {
      const notice = $("notice");
      const text = String(notice && notice.textContent || "").trim();
      const isOk = !!notice && notice.classList.contains("ok");
      const isError = !!notice && (notice.classList.contains("error") || notice.classList.contains("err"));
      const changed = text !== initialText;

      if (!isOk && !isError) sawPendingState = true;
      if (isError && (changed || sawPendingState)) {
        window.clearInterval(timer);
        return;
      }

      if (isOk && (changed || sawPendingState)) {
        window.clearInterval(timer);
        // New Installation is the missing path reported in the app. Keep this
        // idempotent and avoid duplicating Repair/Relocation history updates.
        if (String(payload["Form Type"] || "").toLowerCase() !== "new application") return;
        try {
          const result = await rpc("staff_sync_client_master_from_form", { p_data: payload });
          signalClientChange(result);
          appendNotice("Client list updated" + (result && result.account_no ? " · " + result.account_no : "") + ".", false);
        } catch (error) {
          appendNotice("Form saved, but client list sync failed: " + error.message, true);
        }
        return;
      }

      if (Date.now() - started > 180000) window.clearInterval(timer);
    }, 250);
  }

  function bind() {
    const form = $("applicationForm");
    if (!form || form.dataset.tgClientDbSyncBound === "1") return;
    form.dataset.tgClientDbSyncBound = "1";
    form.addEventListener("submit", function () {
      const payload = snapshotForm(form);
      const notice = $("notice");
      const initialText = String(notice && notice.textContent || "").trim();
      window.setTimeout(function () { waitForOriginalSave(initialText, payload); }, 0);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { window.setTimeout(bind, 100); }, { once: true });
  } else {
    window.setTimeout(bind, 100);
  }
})();
