(function () {
  "use strict";

  if (!/(^|\/)application_form\.html$/i.test(window.location.pathname)) return;

  const SPEEDS = [
    "15Mbps", "25Mbps", "30Mbps", "35Mbps", "50Mbps", "65Mbps", "75Mbps", "80Mbps",
    "100Mbps", "120Mbps", "150Mbps", "175Mbps", "200Mbps", "300Mbps"
  ];

  let rebuilding = false;

  function triggerPaymentRefresh() {
    const dateToday = document.getElementById("dateToday");
    if (dateToday) dateToday.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function ensureCustomSpeedInput(speed) {
    let custom = document.getElementById("tgCustomSpeed");
    if (!custom) {
      custom = document.createElement("input");
      custom.id = "tgCustomSpeed";
      custom.type = "text";
      custom.inputMode = "text";
      custom.placeholder = "Enter custom speed, e.g. 500Mbps or 1Gbps";
      custom.autocomplete = "off";
      custom.style.marginTop = "7px";
      custom.style.display = "none";
      speed.insertAdjacentElement("afterend", custom);

      custom.addEventListener("input", function () {
        const value = String(custom.value || "").trim();
        let option = speed.querySelector('option[data-custom-speed="1"]');
        if (!option) {
          option = document.createElement("option");
          option.dataset.customSpeed = "1";
          speed.appendChild(option);
        }
        option.value = value || "__CUSTOM__";
        option.textContent = value || "Other / Custom Speed";
        option.selected = true;
      });
    }
    return custom;
  }

  function populateIndependentSpeeds(preserveValue) {
    const speed = document.getElementById("speed");
    if (!speed || rebuilding) return;
    rebuilding = true;
    try {
      const oldValue = String(preserveValue != null ? preserveValue : speed.value || "").trim();
      speed.innerHTML = '<option value="">Select speed</option>';
      SPEEDS.forEach(function (value) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value.replace(/Mbps$/i, " Mbps");
        speed.appendChild(option);
      });
      const customChoice = document.createElement("option");
      customChoice.value = "__CUSTOM__";
      customChoice.textContent = "Other / Custom Speed";
      customChoice.dataset.customSpeed = "1";
      speed.appendChild(customChoice);

      if (oldValue && SPEEDS.indexOf(oldValue) !== -1) {
        speed.value = oldValue;
      } else if (oldValue && oldValue !== "__CUSTOM__") {
        customChoice.value = oldValue;
        customChoice.textContent = oldValue;
        speed.value = oldValue;
      } else {
        speed.value = "";
      }
    } finally {
      rebuilding = false;
    }
  }

  function setup() {
    const form = document.getElementById("applicationForm");
    const plan = document.getElementById("plan");
    const speed = document.getElementById("speed");
    const type = document.getElementById("type");
    const note = document.getElementById("planFeeNote");
    const monthlyFee = document.getElementById("monthlyFee");
    if (!form || !plan || !speed || !type) return;

    populateIndependentSpeeds(speed.value);
    const custom = ensureCustomSpeedInput(speed);

    if (note) note.textContent = "Plan, speed, and type are selected independently.";

    if (monthlyFee) {
      monthlyFee.readOnly = false;
      monthlyFee.removeAttribute("readonly");
      monthlyFee.inputMode = "decimal";
      monthlyFee.placeholder = "Enter monthly fee manually";
      monthlyFee.addEventListener("input", triggerPaymentRefresh);
      monthlyFee.addEventListener("change", triggerPaymentRefresh);
    }

    // Capture first so the legacy Plan -> Speed/Type preset listeners never run.
    plan.addEventListener("change", function (event) {
      event.stopImmediatePropagation();
      if (note) note.textContent = "Plan, speed, and type are independent. Select each field manually.";
    }, true);

    speed.addEventListener("change", function (event) {
      event.stopImmediatePropagation();
      const isCustom = speed.value === "__CUSTOM__" || !!speed.selectedOptions[0]?.dataset.customSpeed && !SPEEDS.includes(speed.value);
      custom.style.display = isCustom ? "block" : "none";
      if (isCustom) {
        custom.value = "";
        custom.focus();
      }
      if (note) note.textContent = "Speed is independent from Plan and Type. Monthly Fee is entered manually.";
    }, true);

    type.addEventListener("change", function () {
      if (note) note.textContent = "Type is independent from Plan and Speed.";
    });

    form.addEventListener("submit", function (event) {
      if (speed.value === "__CUSTOM__") {
        const value = String(custom.value || "").trim();
        if (!value) {
          event.preventDefault();
          event.stopImmediatePropagation();
          alert("Enter the custom internet speed first.");
          custom.focus();
          return;
        }
        const option = speed.selectedOptions[0];
        option.value = value;
        option.textContent = value;
        speed.value = value;
      }
    }, true);

    // Legacy reset/edit code can rebuild the select. Restore the independent list automatically.
    const observer = new MutationObserver(function () {
      if (rebuilding) return;
      const hasLegacyLabels = Array.from(speed.options).some(function (option) {
        return /Plan\s*-\s*\d+/i.test(option.textContent || "");
      });
      if (hasLegacyLabels || speed.options.length < SPEEDS.length + 2) {
        const current = speed.value;
        window.setTimeout(function () {
          populateIndependentSpeeds(current);
          if (note) note.textContent = "Plan, speed, and type are selected independently.";
        }, 0);
      }
    });
    observer.observe(speed, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup, { once: true });
  else setup();
})();
