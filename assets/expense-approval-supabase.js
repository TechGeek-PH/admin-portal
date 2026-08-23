(function () {
  "use strict";

  if (!/(^|\/)expense_approval\.html$/i.test(window.location.pathname)) return;

  const BASE = "https://tcexzfztdgximrzuosqs.supabase.co";
  const KEY = "sb_publishable_8H8_S7NTWvzPCLvYUe2C4g_k3Ltjfiz";
  const SESSION_KEYS = [
    "tg_session_v3",
    "sb-tcexzfztdgximrzuosqs-auth-token",
    "techgeekph_admin_session",
    "techgeekph_session"
  ];

  let rows = [];
  let profile = null;
  let busy = false;
  let els = {};

  function parseJson(value) {
    try { return JSON.parse(value || "null"); } catch (_) { return null; }
  }

  function readSession() {
    for (const key of SESSION_KEYS) {
      const value = parseJson(localStorage.getItem(key));
      if (!value) continue;
      const token = value.access_token || (value.session && value.session.access_token) || "";
      if (token) return { raw: value, accessToken: token, user: value.user || (value.session && value.session.user) || null };
    }
    return null;
  }

  function decodeJwtSub(token) {
    try {
      const part = String(token || "").split(".")[1];
      if (!part) return "";
      const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
      return JSON.parse(json).sub || "";
    } catch (_) { return ""; }
  }

  function headers(extra) {
    const session = readSession();
    if (!session || !session.accessToken) throw new Error("Supabase login session not found. Please sign in again.");
    return Object.assign({
      apikey: KEY,
      Authorization: "Bearer " + session.accessToken,
      "Content-Type": "application/json"
    }, extra || {});
  }

  async function api(path, options) {
    const response = await fetch(BASE + path, Object.assign({}, options || {}, { headers: headers((options && options.headers) || {}) }));
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
    if (!response.ok) throw new Error((data && (data.message || data.hint || data.error_description)) || (typeof data === "string" && data) || ("Request failed " + response.status));
    return data;
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function norm(value) { return String(value || "").trim().toLowerCase(); }
  function money(value) {
    const number = Number(value || 0);
    return "₱ " + (Number.isFinite(number) ? number : 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function dateText(value) {
    if (!value) return "—";
    const raw = String(value).slice(0, 10);
    const d = new Date(raw + "T00:00:00");
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "2-digit" });
  }
  function initials(value) {
    return String(value || "TG").split(/\s+/).filter(Boolean).slice(0, 2).map(function (p) { return p.charAt(0).toUpperCase(); }).join("") || "TG";
  }
  function isCompanyExpense(row) {
    return norm(row && row.category) === "company expense" || /\bcompany expense\b/i.test(String((row && row.remarks) || ""));
  }

  function replaceNode(id) {
    const oldNode = document.getElementById(id);
    if (!oldNode) return null;
    const clone = oldNode.cloneNode(true);
    oldNode.replaceWith(clone);
    return clone;
  }

  function takeOverUi() {
    [
      "notice", "avatar", "userName", "userRole", "metricTotal", "metricPending",
      "metricReleased", "metricAmount", "rowCount", "refreshBtn", "exportBtn",
      "searchInput", "employeeFilter", "statusFilter", "dateFilter", "expenseRows"
    ].forEach(replaceNode);

    els = {
      notice: document.getElementById("notice"),
      avatar: document.getElementById("avatar"),
      userName: document.getElementById("userName"),
      userRole: document.getElementById("userRole"),
      metricTotal: document.getElementById("metricTotal"),
      metricPending: document.getElementById("metricPending"),
      metricReleased: document.getElementById("metricReleased"),
      metricAmount: document.getElementById("metricAmount"),
      rowCount: document.getElementById("rowCount"),
      refreshBtn: document.getElementById("refreshBtn"),
      exportBtn: document.getElementById("exportBtn"),
      searchInput: document.getElementById("searchInput"),
      employeeFilter: document.getElementById("employeeFilter"),
      statusFilter: document.getElementById("statusFilter"),
      dateFilter: document.getElementById("dateFilter"),
      expenseRows: document.getElementById("expenseRows")
    };

    const description = document.querySelector(".panel .panel-head p");
    if (description && /Expenses sheet/i.test(description.textContent || "")) {
      description.textContent = "Live expense requests from the Supabase employee expense database.";
    }

    const flowInfo = document.querySelector("#adminGuardPanel .info-box span");
    if (flowInfo) {
      flowInfo.innerHTML = "<b>Flow:</b> Employee deduction/request: Pending → Approved → Released. <b>Company Expense:</b> Pending → Released directly, so it is never included in payroll deductions.";
    }

    if (els.statusFilter) els.statusFilter.value = "Pending";
  }

  function showNotice(message, type) {
    if (!els.notice) return;
    els.notice.textContent = message || "";
    els.notice.classList.remove("is-hidden", "ok", "error");
    if (!message) els.notice.classList.add("is-hidden");
    if (type === "ok") els.notice.classList.add("ok");
    if (type === "error") els.notice.classList.add("error");
  }

  async function loadProfile() {
    const session = readSession();
    if (!session) throw new Error("Supabase login session not found. Please sign in again.");
    const uid = (session.user && session.user.id) || decodeJwtSub(session.accessToken);
    if (!uid) throw new Error("Unable to identify the signed-in account.");
    const result = await api("/rest/v1/staff_profiles?select=user_id,employee_id,full_name,role,active&user_id=eq." + encodeURIComponent(uid) + "&limit=1", { method: "GET" });
    profile = Array.isArray(result) ? result[0] : null;
    if (!profile || !profile.active || ["OWNER", "ADMIN"].indexOf(String(profile.role || "").toUpperCase()) === -1) {
      throw new Error("Owner or Admin access is required for Expense Approval.");
    }
    if (els.userName) els.userName.textContent = profile.full_name || "TechGeekPH Admin";
    if (els.userRole) els.userRole.textContent = String(profile.role || "ADMIN").toUpperCase() + " · Finance approval";
    if (els.avatar) els.avatar.textContent = initials(profile.full_name);
  }

  function filteredRows() {
    const q = norm(els.searchInput && els.searchInput.value);
    const employee = norm(els.employeeFilter && els.employeeFilter.value);
    const status = norm(els.statusFilter && els.statusFilter.value);
    const date = String((els.dateFilter && els.dateFilter.value) || "");
    return rows.filter(function (row) {
      const text = [row.expense_id, row.employee_name, row.employee_id, row.category, row.purpose, row.remarks, row.status].join(" ").toLowerCase();
      return (!q || text.indexOf(q) !== -1) &&
        (!employee || norm(row.employee_name) === employee) &&
        (!status || norm(row.status) === status) &&
        (!date || String(row.expense_date || "").slice(0, 10) === date);
    });
  }

  function renderEmployees() {
    if (!els.employeeFilter) return;
    const selected = els.employeeFilter.value;
    const names = Array.from(new Set(rows.map(function (r) { return String(r.employee_name || "").trim(); }).filter(Boolean))).sort(function (a, b) { return a.localeCompare(b); });
    els.employeeFilter.innerHTML = '<option value="">All employees</option>' + names.map(function (name) {
      return '<option value="' + esc(name) + '">' + esc(name) + "</option>";
    }).join("");
    if (names.indexOf(selected) !== -1) els.employeeFilter.value = selected;
  }

  function statusClass(status) {
    const s = norm(status);
    if (s === "approved") return "approved";
    if (s === "released") return "released";
    if (s === "rejected") return "rejected";
    return "";
  }

  function actionHtml(row) {
    const status = norm(row.status || "Pending");
    const id = esc(row.expense_id);
    if (status === "pending" || !status) {
      if (isCompanyExpense(row)) {
        return '<div class="actions"><button class="warn-btn small" type="button" data-expense-action="CompanyReleased" data-expense-id="' + id + '">Release Company Expense</button><button class="danger-btn small" type="button" data-expense-action="Rejected" data-expense-id="' + id + '">Reject</button></div>';
      }
      return '<div class="actions"><button class="ok-btn small" type="button" data-expense-action="Approved" data-expense-id="' + id + '">Approve</button><button class="warn-btn small" type="button" data-expense-action="CompanyReleased" data-expense-id="' + id + '">Release as Company Expense</button><button class="danger-btn small" type="button" data-expense-action="Rejected" data-expense-id="' + id + '">Reject</button></div>';
    }
    if (status === "approved") {
      return '<div class="actions"><button class="warn-btn small" type="button" data-expense-action="Released" data-expense-id="' + id + '">Mark Released</button><button class="danger-btn small" type="button" data-expense-action="Rejected" data-expense-id="' + id + '">Reject</button></div>';
    }
    return '<span style="color:#7d8b9d;font-size:.76rem">No action needed</span>';
  }

  function cutoffText(row) {
    if (!row.payroll_cutoff_start || !row.payroll_cutoff_end) return "";
    return '<div style="margin-top:6px;color:#7d8b9d;font-size:.72rem">Payroll cutoff: ' + esc(dateText(row.payroll_cutoff_start)) + ' – ' + esc(dateText(row.payroll_cutoff_end)) + (row.payroll_salary_date ? ' · Salary ' + esc(dateText(row.payroll_salary_date)) : "") + '</div>';
  }

  function receiptHtml(row) {
    if (row.receipt_path) return '<button class="small-btn" type="button" data-receipt-path="' + esc(row.receipt_path) + '">Open</button>';
    if (row.legacy_receipt_link) return '<a class="small-btn" href="' + esc(row.legacy_receipt_link) + '" target="_blank" rel="noopener">Open</a>';
    return "—";
  }

  function render() {
    const view = filteredRows();
    const pending = rows.filter(function (r) { return norm(r.status) === "pending"; });
    const released = rows.filter(function (r) { return norm(r.status) === "released"; });
    if (els.metricTotal) els.metricTotal.textContent = rows.length.toLocaleString();
    if (els.metricPending) els.metricPending.textContent = pending.length.toLocaleString();
    if (els.metricReleased) els.metricReleased.textContent = released.length.toLocaleString();
    if (els.metricAmount) els.metricAmount.textContent = money(view.reduce(function (sum, r) { return sum + Number(r.amount || 0); }, 0));
    if (els.rowCount) els.rowCount.textContent = view.length + " record" + (view.length === 1 ? "" : "s");

    if (!els.expenseRows) return;
    if (!view.length) {
      els.expenseRows.innerHTML = '<tr><td colspan="11">No expense records found for the selected filter.</td></tr>';
      return;
    }

    els.expenseRows.innerHTML = view.map(function (row) {
      const status = row.status || "Pending";
      const companyBadge = isCompanyExpense(row) ? '<div style="margin-top:5px;color:#7a4e10;font-size:.7rem;font-weight:900">COMPANY EXPENSE · NO PAYROLL DEDUCTION</div>' : '';
      return '<tr>' +
        '<td data-label="Expense ID"><b>' + esc(row.expense_id) + '</b></td>' +
        '<td data-label="Date">' + esc(dateText(row.expense_date)) + '</td>' +
        '<td data-label="Employee"><b>' + esc(row.employee_name) + '</b><div style="margin-top:3px;color:#7d8b9d;font-size:.7rem">' + esc(row.employee_id) + '</div></td>' +
        '<td data-label="Category">' + esc(row.category) + companyBadge + '</td>' +
        '<td data-label="Amount" class="amount">' + esc(money(row.amount)) + '</td>' +
        '<td data-label="Purpose">' + esc(row.purpose) + cutoffText(row) + (row.remarks ? '<div style="margin-top:6px;color:#526274;font-size:.72rem"><b>Remarks:</b> ' + esc(row.remarks) + '</div>' : '') + '</td>' +
        '<td data-label="Receipt">' + receiptHtml(row) + '</td>' +
        '<td data-label="Status"><span class="status-pill ' + statusClass(status) + '">' + esc(status) + '</span></td>' +
        '<td data-label="Approved By">' + esc(row.approved_by || "—") + (row.approved_at ? '<div style="margin-top:3px;color:#7d8b9d;font-size:.7rem">' + esc(new Date(row.approved_at).toLocaleString("en-PH")) + '</div>' : '') + '</td>' +
        '<td data-label="Released By">' + esc(row.released_by || "—") + (row.released_at ? '<div style="margin-top:3px;color:#7d8b9d;font-size:.7rem">' + esc(new Date(row.released_at).toLocaleString("en-PH")) + '</div>' : '') + '</td>' +
        '<td data-label="Action">' + actionHtml(row) + '</td>' +
      '</tr>';
    }).join("");
  }

  async function loadExpenses(options) {
    const silent = options && options.silent;
    if (!silent) showNotice("Loading live expense requests from Supabase...");
    const result = await api("/rest/v1/app_expenses?select=*&order=created_at.desc&limit=1000", { method: "GET" });
    rows = Array.isArray(result) ? result : [];
    renderEmployees();
    render();
    if (!silent) showNotice("Live expense records updated. Pending requests: " + rows.filter(function (r) { return norm(r.status) === "pending"; }).length + ".", "ok");
  }

  async function updateStatus(expenseId, requestedStatus) {
    if (busy) return;
    const row = rows.find(function (r) { return String(r.expense_id) === String(expenseId); });
    if (!row) return;

    const companyRelease = requestedStatus === "CompanyReleased";
    const nextStatus = companyRelease ? "Released" : requestedStatus;
    const verb = companyRelease ? "release as COMPANY EXPENSE (no payroll deduction)" : nextStatus === "Approved" ? "approve" : nextStatus === "Released" ? "mark as released" : "reject";
    if (!window.confirm("Confirm: " + verb + " " + expenseId + " for " + row.employee_name + " (" + money(row.amount) + ")?")) return;

    const defaultRemark = companyRelease ? "Company Expense — Released directly; not payroll deductible." : nextStatus === "Approved" ? "Approved by admin." : nextStatus === "Released" ? "Released / paid by admin." : "Rejected by admin.";
    const currentRemarks = String(row.remarks || "").trim();
    const initialRemark = companyRelease && currentRemarks && !/\bcompany expense\b/i.test(currentRemarks) ? "Company Expense — " + currentRemarks : (currentRemarks || defaultRemark);
    const remark = window.prompt("Remarks", initialRemark);
    if (remark === null) return;

    busy = true;
    showNotice("Updating " + expenseId + "...");
    try {
      let finalRemark = String(remark || "").trim() || null;
      if (companyRelease && finalRemark && !/\bcompany expense\b/i.test(finalRemark)) finalRemark = "Company Expense — " + finalRemark;
      if (companyRelease && !finalRemark) finalRemark = defaultRemark;
      const payload = { status: nextStatus, remarks: finalRemark };
      const now = new Date().toISOString();
      if (nextStatus === "Approved") {
        payload.approved_by = profile.full_name;
        payload.approved_at = now;
        payload.released_by = null;
        payload.released_at = null;
      } else if (nextStatus === "Released") {
        payload.released_by = profile.full_name;
        payload.released_at = now;
        if (companyRelease) {
          payload.approved_by = null;
          payload.approved_at = null;
        }
      } else if (nextStatus === "Rejected") {
        payload.released_by = null;
        payload.released_at = null;
      }

      const result = await api("/rest/v1/app_expenses?expense_id=eq." + encodeURIComponent(expenseId), {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload)
      });
      if (!Array.isArray(result) || !result.length) throw new Error("Expense record was not updated.");
      await loadExpenses({ silent: true });
      if (companyRelease) {
        showNotice(expenseId + " released as Company Expense. It will NOT be deducted from the employee salary.", "ok");
      } else {
        showNotice(expenseId + " updated to " + nextStatus + "." + (nextStatus === "Approved" && ["cash advance", "food"].indexOf(norm(row.category)) !== -1 ? " Draft payroll deductions are refreshed automatically for this cutoff." : ""), "ok");
      }
    } catch (error) {
      showNotice("Unable to update expense. " + (error && error.message ? error.message : error), "error");
    } finally {
      busy = false;
    }
  }

  async function openReceipt(path) {
    try {
      const encoded = String(path || "").split("/").map(encodeURIComponent).join("/");
      const result = await api("/storage/v1/object/sign/expense-receipts/" + encoded, {
        method: "POST",
        body: JSON.stringify({ expiresIn: 600 })
      });
      const signed = result && (result.signedURL || result.signedUrl || result.signed_url);
      if (!signed) throw new Error("Unable to create receipt link.");
      window.open(String(signed).startsWith("http") ? signed : BASE + signed, "_blank", "noopener");
    } catch (error) {
      showNotice("Unable to open receipt. " + (error && error.message ? error.message : error), "error");
    }
  }

  function exportCsv() {
    const view = filteredRows();
    const headers = ["Expense ID", "Date", "Employee ID", "Employee Name", "Category", "Amount", "Purpose", "Status", "Remarks", "Approved By", "Released By", "Payroll Cutoff Start", "Payroll Cutoff End", "Salary Date"];
    const data = view.map(function (r) {
      return [r.expense_id, r.expense_date, r.employee_id, r.employee_name, r.category, r.amount, r.purpose, r.status, r.remarks, r.approved_by, r.released_by, r.payroll_cutoff_start, r.payroll_cutoff_end, r.payroll_salary_date];
    });
    const csv = [headers].concat(data).map(function (line) {
      return line.map(function (value) { return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"'; }).join(",");
    }).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "expense_approval_" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function bind() {
    [els.searchInput, els.employeeFilter, els.statusFilter, els.dateFilter].forEach(function (node) {
      if (!node) return;
      node.addEventListener(node.tagName === "INPUT" ? "input" : "change", render);
    });
    if (els.refreshBtn) els.refreshBtn.addEventListener("click", function () { loadExpenses().catch(function (e) { showNotice("Unable to load expenses. " + e.message, "error"); }); });
    if (els.exportBtn) els.exportBtn.addEventListener("click", exportCsv);
    if (els.expenseRows) {
      els.expenseRows.addEventListener("click", function (event) {
        const action = event.target.closest("[data-expense-action]");
        if (action) {
          updateStatus(action.dataset.expenseId, action.dataset.expenseAction);
          return;
        }
        const receipt = event.target.closest("[data-receipt-path]");
        if (receipt) openReceipt(receipt.dataset.receiptPath);
      });
    }
  }

  async function init() {
    takeOverUi();
    bind();
    try {
      await loadProfile();
      await loadExpenses();
    } catch (error) {
      showNotice(error && error.message ? error.message : String(error), "error");
      if (els.expenseRows) els.expenseRows.innerHTML = '<tr><td colspan="11">Unable to load expense approval data.</td></tr>';
    }
  }

  window.setTimeout(init, 250);
})();
