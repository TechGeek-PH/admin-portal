// TechGeekPH Supabase bootstrap for the unified browser + Android/iOS app.
// Keep this file synchronous and lightweight because app.html depends on
// window.TechGeekSupabase immediately during startup.
(function () {
  "use strict";

  const SUPABASE_URL = "https://tcexzfztdgximrzuosqs.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8H8_S7NTWvzPCLvYUe2C4g_k3Ltjfiz";

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("TechGeekPH: Supabase JS library is not loaded.");
    return;
  }

  // Do not replace an already-running client. Replacing the client while app.html
  // is booting can leave the splash screen waiting on a different auth instance.
  if (!window.TechGeekSupabase) {
    window.TechGeekSupabase = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );
  }

  window.TechGeekSupabaseConfig = {
    url: SUPABASE_URL,
    keyType: "publishable"
  };
})();

// Employee workspace field-service forms.
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

  let rendering = false;

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
    const role = document.getElementById("topRole") || document.getElementById("welcomeRole");
    return !!role && String(role.textContent || "").trim().toUpperCase() === "EMPLOYEE";
  }

  function gridIsCurrent(grid) {
    if (!grid) return false;
    return !!grid.querySelector('a[href*="form=install"]') &&
      !!grid.querySelector('a[href*="form=repair"]') &&
      !!grid.querySelector('a[href*="form=relocation"]');
  }

  function renderGrid(grid) {
    if (!grid || gridIsCurrent(grid)) return;
    grid.innerHTML = EMPLOYEE_MODULES.map(tile).join("");
  }

  function syncEmployeeWorkspace() {
    if (rendering || !isEmployee()) return false;
    rendering = true;
    try {
      renderGrid(document.getElementById("menuGrid"));
      renderGrid(document.getElementById("allModulesGrid"));
      const title = document.getElementById("menuTitle");
      if (title) title.textContent = "Employee Workspace";
      const activity = document.getElementById("activityLabel");
      if (activity) activity.textContent = "Attendance, installation, repair, relocation and assigned work";
    } finally {
      rendering = false;
    }
    return true;
  }

  function setup() {
    const shell = document.getElementById("appShell");
    if (!shell) {
      window.setTimeout(setup, 120);
      return;
    }

    const observer = new MutationObserver(function () {
      if (!rendering && isEmployee()) syncEmployeeWorkspace();
    });
    observer.observe(shell, { childList: true, subtree: true, characterData: true });

    [0, 100, 250, 500, 900, 1500, 2500, 4000, 7000].forEach(function (delay) {
      window.setTimeout(syncEmployeeWorkspace, delay);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup, { once: true });
  } else {
    setup();
  }
})();

// Payroll Admin: Loan Management is the source of truth for loan deductions.
// Cash Advance / Food are controlled by Expense Approval and must not be typed
// manually into a payslip adjustment.
(function () {
  "use strict";
  if (!/(^|\/)app-payroll-admin\.html$/i.test(window.location.pathname)) return;

  function setupPayrollControls() {
    const toolbar = document.querySelector(".toolbar");
    if (toolbar && !document.getElementById("tgLoanManagementBtn")) {
      const link = document.createElement("a");
      link.id = "tgLoanManagementBtn";
      link.href = "loan_management.html" + (new URLSearchParams(location.search).get("embed") === "1" ? "?embed=1&source=app-embed" : "");
      link.className = "primary";
      link.textContent = "Loan Management";
      link.style.cssText = "display:inline-flex;align-items:center;justify-content:center;min-height:42px;border-radius:10px;padding:0 12px;text-decoration:none;font-size:.75rem";
      toolbar.appendChild(link);
    }

    const automatic = [
      ["cash", "Cash Advance Deduction (Auto from Released Expenses)", "Managed in Expense Approval. Only released payroll-deductible Cash Advance/Food is deducted."],
      ["loan", "Loan Deduction (Auto from Loan Management)", "Managed in Loan Management. Active approved loans are deducted based on their terms and schedule."]
    ];

    automatic.forEach(function (item) {
      const input = document.getElementById(item[0]);
      if (!input) return;
      input.disabled = true;
      input.readOnly = true;
      input.style.background = "#eef3f7";
      input.title = item[2];
      const field = input.closest(".field");
      if (!field) return;
      const label = field.querySelector("label");
      if (label) label.textContent = item[1];
      if (!field.querySelector(".tg-auto-deduction-note")) {
        const note = document.createElement("div");
        note.className = "tg-auto-deduction-note";
        note.textContent = item[2];
        note.style.cssText = "margin-top:5px;color:#6b7a8e;font-size:.58rem;line-height:1.35";
        field.appendChild(note);
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setupPayrollControls, { once: true });
  else setupPayrollControls();
})();

// Clients master: keep the list current when a New Installation is saved from
// another app module/device, and refresh again when returning to this screen.
(function () {
  "use strict";
  if (!/(^|\/)clients\.html$/i.test(window.location.pathname)) return;

  function setupClientLiveRefresh() {
    const db = window.TechGeekSupabase;
    const refreshBtn = document.getElementById("refreshBtn");
    if (!db || !refreshBtn) {
      window.setTimeout(setupClientLiveRefresh, 180);
      return;
    }
    if (window.__tgClientsLiveRefreshBound) return;
    window.__tgClientsLiveRefreshBound = true;

    let lastRefresh = 0;
    function refresh() {
      const now = Date.now();
      if (now - lastRefresh < 700 || refreshBtn.disabled) return;
      lastRefresh = now;
      refreshBtn.click();
    }

    try {
      db.channel("techgeekph-clients-live-" + Math.random().toString(36).slice(2))
        .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, refresh)
        .subscribe();
    } catch (_) {}

    window.addEventListener("storage", function (event) {
      if (event.key === "tg_clients_changed_at") refresh();
    });
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) refresh();
    });
    window.addEventListener("focus", refresh);
    window.setInterval(function () {
      if (!document.hidden) refresh();
    }, 30000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupClientLiveRefresh, { once: true });
  } else {
    setupClientLiveRefresh();
  }
})();
