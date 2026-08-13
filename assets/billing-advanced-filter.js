(function () {
  "use strict";

  function parseMoney(text) {
    return Number(String(text == null ? "" : text).replace(/[^0-9.-]/g, "")) || 0;
  }

  function money(value) {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP"
    }).format(Number(value || 0));
  }

  function norm(value) {
    return String(value == null ? "" : value).trim().toUpperCase();
  }

  function getRows() {
    return Array.from(document.querySelectorAll("#rows tr")).filter(function (row) {
      return row.cells && row.cells.length >= 10;
    });
  }

  function paymentStatus(row) {
    const select = row.cells[7] && row.cells[7].querySelector(".billing-status-select");
    if (select) return norm(select.value);
    const text = norm(row.cells[7] && row.cells[7].textContent);
    return text.indexOf("PAID") !== -1 ? "PAID" : "UNPAID";
  }

  function accountTag(row) {
    const select = row.cells[8] && row.cells[8].querySelector(".tag-select");
    return norm(select ? select.value : (row.cells[8] && row.cells[8].textContent));
  }

  function reminderStatus(row) {
    return norm(row.cells[9] && row.cells[9].textContent);
  }

  function value(id) {
    const el = document.getElementById(id);
    return el ? String(el.value || "").trim() : "";
  }

  function hasAdvancedFilter() {
    return [
      "bfAccount", "bfClient", "bfBilling", "bfDue", "bfAmountDueMin",
      "bfPaidMin", "bfBalance", "bfBillingStatus", "bfAccountTag", "bfReminder"
    ].some(function (id) { return !!value(id); });
  }

  function matches(row) {
    const account = norm(row.cells[0] && row.cells[0].textContent);
    const client = norm(row.cells[1] && row.cells[1].textContent);
    const billing = norm(row.cells[2] && row.cells[2].textContent);
    const dueDate = String(row.cells[3] && row.cells[3].textContent || "").trim().slice(0, 10);
    const amountDue = parseMoney(row.cells[4] && row.cells[4].textContent);
    const paid = parseMoney(row.cells[5] && row.cells[5].textContent);
    const balance = parseMoney(row.cells[6] && row.cells[6].textContent);
    const status = paymentStatus(row);
    const tag = accountTag(row);
    const reminder = reminderStatus(row);

    const accountFilter = norm(value("bfAccount"));
    const clientFilter = norm(value("bfClient"));
    const billingFilter = norm(value("bfBilling"));
    const dueFilter = value("bfDue");
    const dueMin = Number(value("bfAmountDueMin"));
    const paidMin = Number(value("bfPaidMin"));
    const balanceFilter = norm(value("bfBalance"));
    const statusFilter = norm(value("bfBillingStatus"));
    const tagFilter = norm(value("bfAccountTag"));
    const reminderFilter = norm(value("bfReminder"));

    if (accountFilter && account.indexOf(accountFilter) === -1) return false;
    if (clientFilter && client.indexOf(clientFilter) === -1) return false;
    if (billingFilter && billing.indexOf(billingFilter) === -1) return false;
    if (dueFilter && dueDate !== dueFilter) return false;
    if (!Number.isNaN(dueMin) && value("bfAmountDueMin") !== "" && amountDue < dueMin) return false;
    if (!Number.isNaN(paidMin) && value("bfPaidMin") !== "" && paid < paidMin) return false;

    if (balanceFilter === "WITH_BALANCE" && balance <= 0) return false;
    if (balanceFilter === "ZERO_BALANCE" && balance > 0) return false;
    if (statusFilter && status !== statusFilter) return false;
    if (tagFilter && tag !== tagFilter) return false;

    if (reminderFilter === "PENDING" && reminder.indexOf("PENDING") === -1) return false;
    if (reminderFilter === "SENT" && reminder.indexOf("SENT") === -1) return false;
    if (reminderFilter === "FAILED" && reminder.indexOf("FAILED") === -1) return false;
    if (reminderFilter === "SKIPPED" && reminder.indexOf("SKIPPED") === -1) return false;
    if (reminderFilter === "BLOCKED" && reminder.indexOf("BLOCKED") === -1) return false;

    return true;
  }

  function updateKpis(rows) {
    const visible = rows.filter(function (row) { return row.style.display !== "none"; });
    const paid = visible.filter(function (row) { return paymentStatus(row) === "PAID"; }).length;
    const unpaid = visible.length - paid;
    const expired = visible.filter(function (row) { return accountTag(row) === "EXPIRED"; }).length;
    const disconnected = visible.filter(function (row) { return accountTag(row) === "DISCONNECTED"; }).length;
    const outstanding = visible.reduce(function (sum, row) {
      return sum + parseMoney(row.cells[6] && row.cells[6].textContent);
    }, 0);

    const map = {
      totalBills: visible.length.toLocaleString(),
      unpaidBills: unpaid.toLocaleString(),
      paidBills: paid.toLocaleString(),
      expiredBills: expired.toLocaleString(),
      disconnectedBills: disconnected.toLocaleString(),
      outstanding: money(outstanding)
    };

    Object.keys(map).forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.textContent = map[id];
    });

    const summary = document.getElementById("summary");
    if (summary) {
      summary.textContent = visible.length + " filtered bill(s) shown • Visible outstanding: " + money(outstanding);
    }
  }

  function applyFilters() {
    const rows = getRows();
    rows.forEach(function (row) {
      row.style.display = matches(row) ? "" : "none";
    });
    updateKpis(rows);
  }

  function resetAdvancedFilters() {
    [
      "bfAccount", "bfClient", "bfBilling", "bfDue", "bfAmountDueMin",
      "bfPaidMin", "bfBalance", "bfBillingStatus", "bfAccountTag", "bfReminder"
    ].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    applyFilters();
  }

  function createFilterPanel() {
    if (document.getElementById("billingAdvancedFilters")) return;
    const tableWrap = document.querySelector(".table-wrap");
    if (!tableWrap || !tableWrap.parentNode) return;

    const style = document.createElement("style");
    style.textContent =
      "#billingAdvancedFilters{padding:12px 16px;border-bottom:1px solid #dce4ed;background:#f8fafc}" +
      "#billingAdvancedFilters .bf-title{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:9px}" +
      "#billingAdvancedFilters .bf-title b{font-size:.78rem}" +
      "#billingAdvancedFilters .bf-title span{color:#64748b;font-size:.67rem}" +
      "#billingAdvancedFilters .bf-grid{display:grid;grid-template-columns:repeat(5,minmax(150px,1fr));gap:8px}" +
      "#billingAdvancedFilters label{display:grid;gap:4px;color:#536174;font-size:.62rem;font-weight:800;text-transform:uppercase;letter-spacing:.03em}" +
      "#billingAdvancedFilters input,#billingAdvancedFilters select{min-height:36px;width:100%;padding:6px 8px;border:1px solid #dce4ed;border-radius:7px;background:#fff;color:#172033;font-size:.7rem}" +
      "#billingAdvancedFilters .bf-actions{display:flex;justify-content:flex-end;margin-top:8px}" +
      "#billingAdvancedFilters button{min-height:34px;padding:6px 11px;border:1px solid #dce4ed;border-radius:7px;background:#fff;font-weight:800;cursor:pointer}" +
      "@media(max-width:1250px){#billingAdvancedFilters .bf-grid{grid-template-columns:repeat(3,minmax(150px,1fr))}}" +
      "@media(max-width:760px){#billingAdvancedFilters .bf-grid{grid-template-columns:1fr 1fr}}" +
      "@media(max-width:520px){#billingAdvancedFilters .bf-grid{grid-template-columns:1fr}}";
    document.head.appendChild(style);

    const panel = document.createElement("div");
    panel.id = "billingAdvancedFilters";
    panel.innerHTML =
      '<div class="bf-title"><div><b>Advanced Billing Filters</b><span> — KPIs above follow the filtered rows</span></div></div>' +
      '<div class="bf-grid">' +
        '<label>Account<input id="bfAccount" type="search" placeholder="SATR0001"></label>' +
        '<label>Client<input id="bfClient" type="search" placeholder="Client name"></label>' +
        '<label>Billing ID / Period<input id="bfBilling" type="search" placeholder="2026-08 or BILL-..."></label>' +
        '<label>Due Date<input id="bfDue" type="date"></label>' +
        '<label>Amount Due ≥<input id="bfAmountDueMin" type="number" min="0" step="1" placeholder="0"></label>' +
        '<label>Paid ≥<input id="bfPaidMin" type="number" min="0" step="1" placeholder="0"></label>' +
        '<label>Balance<select id="bfBalance"><option value="">All balances</option><option value="WITH_BALANCE">With balance / unpaid</option><option value="ZERO_BALANCE">Zero balance</option></select></label>' +
        '<label>Billing Status<select id="bfBillingStatus"><option value="">All status</option><option value="UNPAID">Unpaid</option><option value="PAID">Paid</option></select></label>' +
        '<label>Account Tag<select id="bfAccountTag"><option value="">All tags</option><option value="ACTIVE">Active</option><option value="PENDING">Pending</option><option value="EXPIRED">Expired</option><option value="DISCONNECTED">Disconnected</option></select></label>' +
        '<label>Reminder Queue<select id="bfReminder"><option value="">All reminders</option><option value="PENDING">Pending</option><option value="SENT">Sent</option><option value="FAILED">Failed</option><option value="SKIPPED">Skipped</option><option value="BLOCKED">Blocked</option></select></label>' +
      '</div>' +
      '<div class="bf-actions"><button id="bfReset" type="button">Reset Advanced Filters</button></div>';

    tableWrap.parentNode.insertBefore(panel, tableWrap);

    panel.querySelectorAll("input,select").forEach(function (el) {
      el.addEventListener(el.tagName === "INPUT" ? "input" : "change", applyFilters);
    });
    document.getElementById("bfReset").addEventListener("click", resetAdvancedFilters);

    applyFilters();
  }

  function init() {
    createFilterPanel();
    const rows = document.getElementById("rows");
    if (rows) {
      const observer = new MutationObserver(function () {
        window.setTimeout(applyFilters, 0);
      });
      observer.observe(rows, { childList: true, subtree: true });
    }

    ["search", "period"].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener(id === "search" ? "input" : "change", function () {
        window.setTimeout(applyFilters, 0);
      });
    });

    document.addEventListener("techgeek:billing-updated", function () {
      window.setTimeout(applyFilters, 0);
    });

    window.setInterval(function () {
      if (hasAdvancedFilter()) applyFilters();
    }, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
