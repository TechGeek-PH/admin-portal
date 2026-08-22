// TechGeekPH Supabase bootstrap + app enhancements.
// The previous complete enhancement bundle is pinned below so existing portal features remain intact.
(function () {
  "use strict";

  const SUPABASE_URL = "https://tcexzfztdgximrzuosqs.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8H8_S7NTWvzPCLvYUe2C4g_k3Ltjfiz";
  const LEGACY_BUILD = "aa669f71fc242f8dcf04ca76fb38f0fc41e1e1ed";

  // app.html expects the shared client immediately after this file loads.
  if (window.supabase && typeof window.supabase.createClient === "function") {
    window.TechGeekSupabase = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
    );
    window.TechGeekSupabaseConfig = { url: SUPABASE_URL, keyType: "publishable" };
  }

  // Preserve all enhancements that existed before this employee-form update.
  const legacy = document.createElement("script");
  legacy.src = "https://cdn.jsdelivr.net/gh/TechGeek-PH/admin-portal@" + LEGACY_BUILD + "/assets/supabase-config.js";
  legacy.async = false;
  legacy.dataset.techgeekLegacySupabaseConfig = "1";
  document.head.appendChild(legacy);
})();

// Employee workspace: expose the three field forms directly in the unified app.
(function () {
  "use strict";

  if (!/(^|\/)app\.html$/i.test(window.location.pathname) && !/(^|\/)app$/i.test(window.location.pathname)) return;

  const EMPLOYEE_MODULES = [
    ["app-attendance.html", "⏱", "Time In / Time Out", "Attendance and breaks"],
    ["app-tickets.html", "✓", "Technician Checklist", "Assigned tickets and checklist"],
    ["application_form.html?form=install", "＋", "New Installation", "New client application and installation form"],
    ["application_form.html?form=repair", "🛠", "Repair Form", "Existing client repair and service form"],
    ["application_form.html?form=relocation", "↔", "Relocation Form", "Existing client transfer / relocation form"],
    ["my_expense_request.html", "₱", "My Expenses", "Expense requests"],
    ["app-payslips.html", "▥", "Payslips", "Payroll records"]
  ];

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function tile(item) {
    return '<a class="tile" href="' + esc(item[0]) + '" data-module-title="' + esc(item[2]) + '" data-employee-workspace="1">' +
      '<span class="ico">' + esc(item[1]) + '</span>' +
      '<b>' + esc(item[2]) + '</b>' +
      '<small>' + esc(item[3]) + '</small>' +
      '</a>';
  }

  function isEmployee() {
    const role = document.getElementById("welcomeRole") || document.getElementById("topRole");
    return !!role && String(role.textContent || "").trim().toUpperCase() === "EMPLOYEE";
  }

  function renderGrid(grid) {
    if (!grid) return;
    const signature = "employee-field-forms-v1";
    if (grid.dataset.employeeWorkspaceVersion === signature) return;
    grid.dataset.employeeWorkspaceVersion = signature;
    grid.innerHTML = EMPLOYEE_MODULES.map(tile).join("");
  }

  function syncEmployeeWorkspace() {
    if (!isEmployee()) return false;
    renderGrid(document.getElementById("menuGrid"));
    renderGrid(document.getElementById("allModulesGrid"));

    const title = document.getElementById("menuTitle");
    if (title) title.textContent = "Employee Workspace";
    const activity = document.getElementById("activityLabel");
    if (activity) activity.textContent = "Attendance, forms and assigned work";
    return true;
  }

  function setup() {
    const shell = document.getElementById("appShell");
    if (!shell) {
      window.setTimeout(setup, 150);
      return;
    }

    const observer = new MutationObserver(function () {
      if (isEmployee()) syncEmployeeWorkspace();
    });
    observer.observe(shell, { childList: true, subtree: true, characterData: true });

    [100, 250, 500, 900, 1500, 2500, 4000].forEach(function (delay) {
      window.setTimeout(syncEmployeeWorkspace, delay);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup, { once: true });
  } else {
    setup();
  }
})();
