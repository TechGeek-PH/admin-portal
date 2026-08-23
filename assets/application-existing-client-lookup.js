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

  function removeLegacyLookupCard() {
    if (!isRepairOrRelocation()) return;

    const search = document.getElementById("tgExistingClientSearch") ||
      document.querySelector('input[placeholder*="client name" i][placeholder*="account" i]');

    if (search) {
      const card = search.closest("section, .section, .card, .panel, fieldset, .form-section") || search.parentElement;
      if (card) {
        card.style.display = "none";
        card.setAttribute("aria-hidden", "true");
        return;
      }
    }

    // Fallback: find the old card by heading text.
    const candidates = Array.from(document.querySelectorAll("section, .section, .card, .panel, fieldset, .form-section"));
    const legacyCard = candidates.find(function (el) {
      const text = String(el.textContent || "").toLowerCase();
      return text.includes("existing client lookup") &&
             (text.includes("existing client repair request") || text.includes("existing client transfer request"));
    });
    if (legacyCard) {
      legacyCard.style.display = "none";
      legacyCard.setAttribute("aria-hidden", "true");
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
    removeLegacyLookupCard();
    return true;
  }

  const legacy = document.createElement("script");
  legacy.src = "https://cdn.jsdelivr.net/gh/TechGeek-PH/admin-portal@" + LEGACY_BUILD + "/assets/application-existing-client-lookup.js";
  legacy.async = false;
  legacy.dataset.techgeekExistingClientLookupCore = "1";
  legacy.onload = function () {
    applyRequestedMode();
    [100, 300, 700, 1400, 2500, 4000].forEach(function (delay) {
      window.setTimeout(function () {
        applyRequestedMode();
        removeLegacyLookupCard();
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
      removeLegacyLookupCard();
    }, { once: true });
  } else {
    applyRequestedMode();
    removeLegacyLookupCard();
  }
})();
