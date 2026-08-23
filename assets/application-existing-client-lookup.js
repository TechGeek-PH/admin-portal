// Existing-client lookup loader + direct form-mode routing for the unified TechGeekPH app.
(function () {
  "use strict";

  if (!/(^|\/)application_form\.html$/i.test(window.location.pathname)) return;

  const LEGACY_BUILD = "aa669f71fc242f8dcf04ca76fb38f0fc41e1e1ed";

  function requestedMode() {
    const params = new URLSearchParams(window.location.search);
    return String(params.get("form") || params.get("mode") || "").trim().toLowerCase();
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
    hideDuplicateLookupAccount();
    return true;
  }

  // Repair/Relocation already have a searchable Client / Account No. field.
  // Hide the duplicate Account No. field in the Existing Client Lookup card,
  // while leaving the underlying input available for auto-fill/submission.
  function hideDuplicateLookupAccount() {
    const mode = requestedMode();
    if (["repair", "service", "service-repair", "relocation", "relocate", "transfer"].indexOf(mode) === -1) return;

    const search = document.getElementById("tgExistingClientSearch") ||
      document.querySelector('input[placeholder*="client name" i][placeholder*="account" i]');
    if (!search) return;

    let card = search.closest("section, .card, .panel, fieldset, .form-section") || search.parentElement;
    if (!card) return;

    const inputs = Array.from(card.querySelectorAll("input"));
    inputs.forEach(function (input) {
      if (input === search) return;
      const id = String(input.id || "").toLowerCase();
      const name = String(input.name || "").toLowerCase();
      const value = String(input.value || "");
      const label = input.id ? document.querySelector('label[for="' + CSS.escape(input.id) + '"]') : null;
      const labelText = String(label && label.textContent || "").trim().toLowerCase();
      const looksLikeAccount = /account/.test(id) || /account/.test(name) || labelText === "account no." || labelText === "account no" || /^([A-Z]{1,8})?\d{3,}$/i.test(value);
      if (!looksLikeAccount) return;

      let wrapper = input.closest(".field, .form-group, .input-group, .form-field, .row");
      if (!wrapper || wrapper === card) wrapper = input.parentElement;
      if (wrapper) wrapper.style.display = "none";
      else input.style.display = "none";
    });
  }

  const legacy = document.createElement("script");
  legacy.src = "https://cdn.jsdelivr.net/gh/TechGeek-PH/admin-portal@" + LEGACY_BUILD + "/assets/application-existing-client-lookup.js";
  legacy.async = false;
  legacy.dataset.techgeekExistingClientLookupCore = "1";
  legacy.onload = function () {
    applyRequestedMode();
    [100, 300, 700, 1400, 2500].forEach(function (delay) {
      window.setTimeout(function () {
        applyRequestedMode();
        hideDuplicateLookupAccount();
      }, delay);
    });
  };
  legacy.onerror = function () {
    console.error("Unable to load existing-client lookup core.");
    applyRequestedMode();
  };
  document.head.appendChild(legacy);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      applyRequestedMode();
      hideDuplicateLookupAccount();
    }, { once: true });
  } else {
    applyRequestedMode();
    hideDuplicateLookupAccount();
  }
})();
