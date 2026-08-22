// Existing-client lookup loader + direct form-mode routing for the unified TechGeekPH app.
(function () {
  "use strict";

  if (!/(^|\/)application_form\.html$/i.test(window.location.pathname)) return;

  const LEGACY_BUILD = "aa669f71fc242f8dcf04ca76fb38f0fc41e1e1ed";

  function applyRequestedMode() {
    const formType = document.getElementById("formType");
    if (!formType) return false;

    const params = new URLSearchParams(window.location.search);
    const requested = String(params.get("form") || params.get("mode") || "").trim().toLowerCase();
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
    return true;
  }

  // Load the complete client lookup implementation that was already working,
  // then apply the requested employee form mode.
  const legacy = document.createElement("script");
  legacy.src = "https://cdn.jsdelivr.net/gh/TechGeek-PH/admin-portal@" + LEGACY_BUILD + "/assets/application-existing-client-lookup.js";
  legacy.async = false;
  legacy.dataset.techgeekExistingClientLookupCore = "1";
  legacy.onload = function () {
    applyRequestedMode();
    [100, 300, 700, 1400].forEach(function (delay) {
      window.setTimeout(applyRequestedMode, delay);
    });
  };
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
