// TechGeekPH Application Form -> Clients list refresh notifier.
// The main save flow already writes the client master through the secured
// staff_sync_client_master_from_form RPC. This helper only signals the app/Clients
// page after a successful New Installation save, avoiding a second database write.
(function () {
  "use strict";

  if (!/(^|\/)application_form\.html$/i.test(window.location.pathname) || window.__tgClientDbSyncLoaded) return;
  window.__tgClientDbSyncLoaded = true;

  const $ = function (id) { return document.getElementById(id); };

  function value(id) {
    const el = $(id);
    return el ? String(el.value || "").trim() : "";
  }

  function currentFormType() {
    const requested = String(new URLSearchParams(location.search).get("form") || "").toLowerCase();
    if (requested.indexOf("repair") !== -1) return "Repair";
    if (requested.indexOf("relocation") !== -1) return "Relocation";
    return value("formType") || "New Application";
  }

  function currentAccountNo() {
    return value("accountNo") || value("tgAccountPreview");
  }

  function signalClientChange(accountNo) {
    const detail = { account_no: accountNo || "", saved_at: Date.now() };
    try { localStorage.setItem("tg_clients_changed_at", String(detail.saved_at)); } catch (_) {}
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "tg-clients-changed", account_no: detail.account_no }, location.origin);
      }
    } catch (_) {}
    try { window.dispatchEvent(new CustomEvent("tg-client-db-saved", { detail: detail })); } catch (_) {}
  }

  function waitForOriginalSave(initialText, formType, accountNo) {
    const started = Date.now();
    let sawPendingState = false;
    const timer = window.setInterval(function () {
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
        if (String(formType || "").toLowerCase() === "new application") {
          signalClientChange(accountNo);
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
      const notice = $("notice");
      const initialText = String(notice && notice.textContent || "").trim();
      const formType = currentFormType();
      const accountNo = currentAccountNo();
      window.setTimeout(function () { waitForOriginalSave(initialText, formType, accountNo); }, 0);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { window.setTimeout(bind, 100); }, { once: true });
  } else {
    window.setTimeout(bind, 100);
  }
})();
