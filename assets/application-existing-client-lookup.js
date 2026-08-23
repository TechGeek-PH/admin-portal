// Existing-client lookup loader + direct form-mode routing for the unified TechGeekPH app.
(function () {
  "use strict";

  if (!/(^|\/)application_form\.html$/i.test(window.location.pathname)) return;

  const LEGACY_BUILD = "aa669f71fc242f8dcf04ca76fb38f0fc41e1e1ed";

  function requestedMode() {
    const params = new URLSearchParams(window.location.search);
    return String(params.get("form") || params.get("mode") || "").trim().toLowerCase();
  }

  function isRepairOrRelocation() {
    return ["repair", "service", "service-repair", "relocation", "relocate", "transfer"].indexOf(requestedMode()) !== -1;
  }

  function installLegacyBlockGuard() {
    if (!isRepairOrRelocation()) return;
    if (!document.getElementById("tgLegacyLookupBlockStyle")) {
      const style = document.createElement("style");
      style.id = "tgLegacyLookupBlockStyle";
      style.textContent = "#tgExistingClientLookup{display:none!important}";
      document.head.appendChild(style);
    }
    const remove = function () {
      const legacy = document.getElementById("tgExistingClientLookup");
      if (!legacy) return;
      const account = document.getElementById("accountNo");
      const form = document.getElementById("applicationForm");
      if (account && legacy.contains(account) && form) {
        const field = account.closest ? account.closest(".field") : account.parentElement;
        if (field) {
          field.style.display = "none";
          form.appendChild(field);
        }
      }
      legacy.remove();
    };
    remove();
    if (!window.__tgLegacyLookupBlockObserver && document.body) {
      window.__tgLegacyLookupBlockObserver = new MutationObserver(remove);
      window.__tgLegacyLookupBlockObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  function applyRequestedMode() {
    const formType = document.getElementById("formType");
    if (!formType) return false;

    const requested = requestedMode();
    let value = "";

    if (["install", "installation", "new", "new-install", "new-installation", "application"].indexOf(requested) !== -1) {
      value = "New Application";
    } else if (["repair", "service", "service-repair"].indexOf(requested) !== -1) {
      value = "Repair";
    } else if (["relocation", "relocate", "transfer"].indexOf(requested) !== -1) {
      value = "Relocation";
    }

    if (!value) return false;
    if (formType.value !== value) formType.value = value;
    try { formType.dispatchEvent(new Event("change", { bubbles: true })); } catch (_) {}
    installLegacyBlockGuard();
    return true;
  }

  function startDedicatedMode() {
    installLegacyBlockGuard();
    applyRequestedMode();
    [0, 80, 200, 500, 1000, 2000].forEach(function (delay) {
      window.setTimeout(function () {
        installLegacyBlockGuard();
        applyRequestedMode();
      }, delay);
    });
  }

  // Dedicated Repair/Relocation modules already use the new Select Existing Client
  // control from app-client-sync.js. Do not load the retired lookup implementation.
  if (isRepairOrRelocation()) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startDedicatedMode, { once: true });
    else startDedicatedMode();
    return;
  }

  // Keep the legacy lookup only for the general admin form where the form type can
  // still be switched manually and the newer dedicated module picker is not present.
  const legacy = document.createElement("script");
  legacy.src = "https://cdn.jsdelivr.net/gh/TechGeek-PH/admin-portal@" + LEGACY_BUILD + "/assets/application-existing-client-lookup.js";
  legacy.async = false;
  legacy.dataset.techgeekExistingClientLookupCore = "1";
  legacy.onload = applyRequestedMode;
  legacy.onerror = function () {
    console.error("Unable to load existing-client lookup core.");
    applyRequestedMode();
  };
  document.head.appendChild(legacy);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyRequestedMode, { once: true });
  } else {
    applyRequestedMode();
  }
})();
