(function () {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const embedded = params.get("embed") === "1" || params.get("source") === "app-embed";
  if (embedded) {
    document.documentElement.classList.add("tg-embedded");
    const markBody = function () {
      if (document.body) document.body.classList.add("tg-embedded");
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", markBody, { once: true });
    else markBody();
  }

  // =========================================================
  // TECHGEEKPH ADMIN NAVIGATION
  // Add/edit sidebar HTML links ONLY in this file.
  // =========================================================
  const NAV_ITEMS = [
    {
      type: "link",
      label: "Dashboard",
      href: "dashboard.html"
    },
    {
      type: "group",
      label: "Operations",
      items: [
        { label: "Application Form", href: "application_form.html" },
        { label: "Clients", href: "clients.html" },
        { label: "Billing Control", href: "billing.html", aliases: ["billing_control.html"] },
        { label: "Tickets", href: "tickets.html" },
        { label: "NAP Checker", href: "nap-checker.html" },
        { label: "Statement of Account", href: "statement_of_account_v3.html", aliases: ["statement_of_account.html"] }
      ]
    },
    {
      type: "group",
      label: "Attendance & Expenses",
      items: [
        { label: "My Time Record", href: "daily_time_record.html" },
        { label: "Admin Time Records", href: "daily_time_record_admin.html" },
        { label: "My Expense Request", href: "my_expense_request.html" },
        { label: "Expense Approval", href: "expense_approval.html" },
        { label: "Payroll & Loans", href: "payroll-loans.html", aliases: ["app-payroll-admin.html", "admin-employee-payslips.html", "loan_management.html", "payslip_generator.html"] }
      ]
    },
    {
      type: "group",
      label: "Stock & Assets",
      items: [
        { label: "Consumable Stock", href: "consumable_stock.html" },
        { label: "Company Assets", href: "company_assets.html" }
      ]
    },
    {
      type: "group",
      label: "Administration",
      items: [
        { label: "User Accounts", href: "admin_accounts.html" },
        { label: "Telegram Settings", href: "telegram-settings.html" }
      ]
    },
    {
      type: "group",
      label: "Investor",
      items: [
        { label: "Morwin Gapud", href: "investor_morwin_gapud.html" },
        { label: "Marivie Viana Gapud", href: "investor_marivie_viana_gapud.html" }
      ]
    }
  ];

  function currentFile() {
    return (window.location.pathname.split("/").pop() || "dashboard.html")
      .split("?")[0]
      .split("#")[0]
      .toLowerCase();
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isActive(item, file) {
    const href = String(item.href || "").toLowerCase();
    if (href === file) return true;
    return Array.isArray(item.aliases) && item.aliases.some(function (alias) {
      return String(alias || "").toLowerCase() === file;
    });
  }

  function renderNav() {
    const nav = document.querySelector("[data-admin-sidebar] .nav");
    if (!nav) return;

    const file = currentFile();

    nav.innerHTML = NAV_ITEMS.map(function (item) {
      if (item.type === "link") {
        const active = isActive(item, file);
        return '<a href="' + esc(item.href) + '"' + (active ? ' class="is-active"' : '') + '>' + esc(item.label) + '</a>';
      }

      const children = Array.isArray(item.items) ? item.items : [];
      const hasActive = children.some(function (child) { return isActive(child, file); });

      return '<div class="nav-group' + (hasActive ? ' is-open' : '') + '">' +
        '<button class="nav-toggle' + (hasActive ? ' is-active' : '') + '" type="button">' + esc(item.label) + '</button>' +
        '<div class="nav-panel">' +
          children.map(function (child) {
            const active = isActive(child, file);
            return '<a href="' + esc(child.href) + '"' + (active ? ' class="is-active"' : '') + '>' + esc(child.label) + '</a>';
          }).join("") +
        '</div>' +
      '</div>';
    }).join("");

    nav.querySelectorAll(".nav-toggle").forEach(function (button) {
      button.addEventListener("click", function () {
        const group = button.closest(".nav-group");
        if (!group) return;
        group.classList.toggle("is-open");
        button.classList.toggle("is-active", group.classList.contains("is-open"));
      });
    });
  }

  function ensureBillingPaymentEditor() {
    if (currentFile() !== "billing.html") return;
    if (document.querySelector('script[data-techgeek-module="billing-payment-editor"]')) return;

    const script = document.createElement("script");
    script.src = "assets/billing-payment-editor.js?v=20260813-3";
    script.async = false;
    script.dataset.techgeekModule = "billing-payment-editor";
    script.onload = function () {
      console.log("TechGeekPH billing Paid/Unpaid editor loaded.");
    };
    script.onerror = function () {
      console.error("Unable to load TechGeekPH billing Paid/Unpaid editor.");
    };
    document.head.appendChild(script);
  }

  window.TechGeekAdminNav = {
    items: NAV_ITEMS,
    render: renderNav
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      renderNav();
      ensureBillingPaymentEditor();
    }, { once: true });
  } else {
    renderNav();
    ensureBillingPaymentEditor();
  }
})();