(function () {
  "use strict";

  function normalize(value) {
    return String(value == null ? "" : value).trim().toUpperCase();
  }

  function manilaFivePm(value, addDays) {
    const raw = String(value || "").trim();
    if (!raw) return null;

    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]) - 1;
      const day = Number(match[3]) + Number(addDays || 0);
      // 5:00 PM Asia/Manila = 09:00 UTC.
      return new Date(Date.UTC(year, month, day, 9, 0, 0));
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function expiredDeadline(bill) {
    const explicit =
      bill.grace_end_date ||
      bill.grace_end_date_iso ||
      bill.final_cutoff_date ||
      bill.final_cutoff_date_iso ||
      bill.grace_end ||
      "";

    if (explicit) return manilaFivePm(explicit, 0);
    return manilaFivePm(bill.due_date, 7);
  }

  function isExpiredBill(bill) {
    if (!bill) return false;

    const serviceStatus = normalize(bill.service_status);
    const accountStatus = normalize(bill.account_status);

    if (
      serviceStatus.indexOf("DISCONNECTED") !== -1 ||
      accountStatus.indexOf("DISCONNECTED") !== -1 ||
      accountStatus === "EXPIRED"
    ) {
      return true;
    }

    // A settled active bill should not be tagged expired just because its old
    // grace date has passed.
    if (
      normalize(bill.billing_status) === "PAID" ||
      Number(bill.balance || 0) <= 0
    ) {
      return false;
    }

    const deadline = expiredDeadline(bill);
    return Boolean(deadline && Date.now() > deadline.getTime());
  }

  function decorateExpiredRows() {
    if (typeof state === "undefined" || !state || !Array.isArray(state.bills)) return;

    const byAccount = new Map();
    state.bills.forEach(function (bill) {
      byAccount.set(String(bill.account_no || "").trim(), bill);
    });

    document.querySelectorAll("#billRows tr").forEach(function (row) {
      const accountTag = row.querySelector(".account-tag");
      const clientCell = row.querySelector(".client-cell");
      if (!accountTag || !clientCell) return;

      const accountNo = String(accountTag.textContent || "").trim();
      const bill = byAccount.get(accountNo);
      if (!bill) return;

      const expired = isExpiredBill(bill);
      const chips = Array.from(clientCell.querySelectorAll(".chip"));
      const inactiveChip = chips.find(function (chip) {
        return normalize(chip.textContent) === "INACTIVE";
      });
      let expiredChip = clientCell.querySelector('[data-billing-expired-tag="true"]');

      if (expired) {
        if (inactiveChip) {
          inactiveChip.textContent = "Expired";
          inactiveChip.dataset.billingExpiredTag = "true";
          expiredChip = inactiveChip;
        }

        if (!expiredChip) {
          expiredChip = document.createElement("span");
          expiredChip.className = "chip danger";
          expiredChip.dataset.billingExpiredTag = "true";
          expiredChip.style.marginTop = "6px";
          expiredChip.textContent = "Expired";
          clientCell.appendChild(expiredChip);
        }
      } else if (expiredChip) {
        expiredChip.remove();
      }
    });
  }

  function installExpiredFilter() {
    const filter = document.querySelector("#attentionFilter");
    if (filter) {
      const option = filter.querySelector('option[value="INACTIVE"]');
      if (option) option.textContent = "Expired / disconnected";
    }

    if (typeof reminderMatchesFilter === "function" && !window.__tgExpiredFilterWrapped) {
      const originalReminderMatchesFilter = reminderMatchesFilter;
      reminderMatchesFilter = function (bill, filterName) {
        if (filterName === "INACTIVE") return isExpiredBill(bill);
        return originalReminderMatchesFilter(bill, filterName);
      };
      window.__tgExpiredFilterWrapped = true;
    }
  }

  function installRenderHook() {
    if (typeof renderBillTable !== "function" || window.__tgExpiredRenderWrapped) return;

    const originalRenderBillTable = renderBillTable;
    renderBillTable = function () {
      const result = originalRenderBillTable.apply(this, arguments);
      decorateExpiredRows();
      return result;
    };
    window.__tgExpiredRenderWrapped = true;
  }

  installExpiredFilter();
  installRenderHook();
  decorateExpiredRows();

  // Keep the visual tag current if the browser stays open across the 5 PM cutoff.
  window.setInterval(decorateExpiredRows, 60000);
})();
