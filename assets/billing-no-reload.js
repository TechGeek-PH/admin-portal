(function () {
  "use strict";

  // Prevent only the legacy delayed billing reload callbacks.
  const nativeSetTimeout = window.setTimeout.bind(window);
  window.setTimeout = function (handler, delay) {
    const args = Array.prototype.slice.call(arguments, 2);
    if (typeof handler === "function") {
      const source = Function.prototype.toString.call(handler);
      if (source.indexOf("location.reload") !== -1) {
        return nativeSetTimeout(function () {}, delay || 0);
      }
    }
    return nativeSetTimeout.apply(window, [handler, delay].concat(args));
  };

  function parseMoney(text) {
    return Number(String(text == null ? "" : text).replace(/[^0-9.-]/g, "")) || 0;
  }

  function money(value) {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP"
    }).format(Number(value || 0));
  }

  function accountOf(row) {
    const el = row && row.querySelector(".account");
    return String((el && el.textContent) || "").trim();
  }

  function syncAccountTag(account, tag) {
    document.querySelectorAll("#rows tr").forEach(function (row) {
      if (accountOf(row) !== account) return;
      const select = row.cells && row.cells[8]
        ? row.cells[8].querySelector(".tag-select")
        : null;
      if (!select) return;
      select.value = tag;
      select.dataset.current = tag;
      select.dataset.tone = String(tag).toLowerCase();
      const note = row.cells[8].querySelector(".tag-note");
      if (note) note.textContent = "Editable account tag";
    });
  }

  function syncPaymentRow(select) {
    const row = select && select.closest("tr");
    if (!row || !row.cells || row.cells.length < 8) return;

    const selected = String(select.value || "").toUpperCase();
    const saved = String(select.dataset.previous || "").toUpperCase();
    if (!selected || selected !== saved) return;

    const due = parseMoney(row.cells[4] && row.cells[4].textContent);
    if (selected === "PAID") {
      row.cells[5].textContent = money(due);
      row.cells[6].textContent = money(0);
      syncAccountTag(String(select.dataset.account || accountOf(row)).trim(), "Active");
    } else if (selected === "UNPAID") {
      row.cells[5].textContent = money(0);
      row.cells[6].textContent = money(due);
    }
  }

  document.addEventListener("change", function (event) {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) return;
    if (!select.classList.contains("billing-status-select")) return;

    [250, 600, 1200].forEach(function (delay) {
      nativeSetTimeout(function () { syncPaymentRow(select); }, delay);
    });
  });
})();
