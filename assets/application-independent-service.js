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

  function useEmbeddedSelectPicker() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      return params.get("embed") === "1" || params.get("source") === "app-embed" || /TechGeekPHApp\//i.test(navigator.userAgent || "");
    } catch (_) {
      return /TechGeekPHApp\//i.test(navigator.userAgent || "");
    }
  }

  function installEmbeddedSelectPicker() {
    if (!useEmbeddedSelectPicker()) return;
    if (document.getElementById("tgSelectPickerOverlay")) return;

    const style = document.createElement("style");
    style.id = "tg-select-picker-style";
    style.textContent = [
      ".tg-select-picker{position:fixed;inset:0;z-index:2147483647;display:none;align-items:flex-end;background:rgba(3,24,43,.48);padding:12px;box-sizing:border-box}",
      ".tg-select-picker.open{display:flex}",
      ".tg-select-sheet{width:100%;max-height:78vh;overflow:hidden;border-radius:18px;background:#fff;box-shadow:0 22px 70px rgba(0,0,0,.28)}",
      ".tg-select-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 16px;border-bottom:1px solid #dbe4ee;color:#172438;font-weight:900}",
      ".tg-select-close{min-width:42px;height:38px;border:0;border-radius:10px;background:#eef4f8;color:#064f83;font-size:18px;font-weight:900}",
      ".tg-select-options{max-height:calc(78vh - 69px);overflow:auto;padding:8px}",
      ".tg-select-option{display:block;width:100%;min-height:48px;margin:0 0 6px;border:1px solid #dbe4ee;border-radius:11px;background:#fff;color:#172438;padding:10px 12px;text-align:left;font-size:16px}",
      ".tg-select-option.selected{border-color:#79add1;background:#edf6fd;color:#064f83;font-weight:900}",
      ".tg-select-option:disabled{opacity:.45}",
      "body.tg-select-lock{overflow:hidden!important}"
    ].join("");
    document.head.appendChild(style);

    const overlay = document.createElement("div");
    overlay.id = "tgSelectPickerOverlay";
    overlay.className = "tg-select-picker";
    overlay.innerHTML = '<div class="tg-select-sheet"><div class="tg-select-head"><span id="tgSelectPickerTitle">Select option</span><button type="button" class="tg-select-close" id="tgSelectPickerClose">×</button></div><div class="tg-select-options" id="tgSelectPickerOptions"></div></div>';
    document.body.appendChild(overlay);

    const title = document.getElementById("tgSelectPickerTitle");
    const optionsBox = document.getElementById("tgSelectPickerOptions");
    const closeBtn = document.getElementById("tgSelectPickerClose");
    let activeSelect = null;

    function labelFor(select) {
      if (select.id) {
        const label = document.querySelector('label[for="' + select.id.replace(/"/g, '\\"') + '"]');
        if (label) return String(label.textContent || "").trim();
      }
      return String(select.getAttribute("aria-label") || select.name || "Select option").trim() || "Select option";
    }

    function closePicker() {
      activeSelect = null;
      overlay.classList.remove("open");
      document.body.classList.remove("tg-select-lock");
      optionsBox.innerHTML = "";
    }

    function openPicker(select) {
      if (!select || select.disabled || select.multiple) return;
      activeSelect = select;
      title.textContent = labelFor(select);
      optionsBox.innerHTML = "";

      Array.prototype.forEach.call(select.options || [], function (option, index) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "tg-select-option" + (index === select.selectedIndex ? " selected" : "");
        button.textContent = String(option.textContent || option.label || option.value || "");
        button.disabled = !!option.disabled;
        button.dataset.optionIndex = String(index);
        button.addEventListener("click", function () {
          if (!activeSelect || button.disabled) return;
          const idx = Number(button.dataset.optionIndex);
          activeSelect.selectedIndex = idx;
          try { activeSelect.dispatchEvent(new Event("input", { bubbles: true })); } catch (_) {}
          try { activeSelect.dispatchEvent(new Event("change", { bubbles: true })); } catch (_) {}
          try { activeSelect.focus(); } catch (_) {}
          closePicker();
        });
        optionsBox.appendChild(button);
      });

      document.body.classList.add("tg-select-lock");
      overlay.classList.add("open");
      const selected = optionsBox.querySelector(".selected");
      if (selected) window.setTimeout(function () { try { selected.scrollIntoView({ block: "nearest" }); } catch (_) {} }, 0);
    }

    closeBtn.addEventListener("click", closePicker);
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) closePicker();
    });

    document.addEventListener("click", function (event) {
      const target = event.target;
      if (!target || String(target.tagName || "").toUpperCase() !== "SELECT") return;
      if (target.disabled || target.multiple) return;
      event.preventDefault();
      event.stopPropagation();
      openPicker(target);
    }, true);
  }

  function setup() {
    const form = document.getElementById("applicationForm");
    const plan = document.getElementById("plan");
    const speed = document.getElementById("speed");
    const type = document.getElementById("type");
    const note = document.getElementById("planFeeNote");
    const monthlyFee = document.getElementById("monthlyFee");
    if (!form || !plan || !speed || !type) return;

    installEmbeddedSelectPicker();
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

    plan.addEventListener("change", function (event) {
      event.stopImmediatePropagation();
      if (note) note.textContent = "Plan, speed, and type are independent. Select each field manually.";
    }, true);

    speed.addEventListener("change", function (event) {
      event.stopImmediatePropagation();
      const selected = speed.selectedOptions && speed.selectedOptions.length ? speed.selectedOptions[0] : null;
      const isCustom = speed.value === "__CUSTOM__" || (!!selected && !!selected.dataset.customSpeed && SPEEDS.indexOf(speed.value) === -1);
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
        const option = speed.selectedOptions && speed.selectedOptions.length ? speed.selectedOptions[0] : null;
        if (option) {
          option.value = value;
          option.textContent = value;
        }
        speed.value = value;
      }
    }, true);

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
