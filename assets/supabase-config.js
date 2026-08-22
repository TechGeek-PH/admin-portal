// TechGeekPH Admin Portal - Supabase browser client
// Publishable key only. Never place service_role or secret keys in this file.
(function () {
  "use strict";

  const SUPABASE_URL = "https://tcexzfztdgximrzuosqs.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8H8_S7NTWvzPCLvYUe2C4g_k3Ltjfiz";

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("Supabase JS library is not loaded.");
    return;
  }

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

  window.TechGeekSupabaseConfig = {
    url: SUPABASE_URL,
    keyType: "publishable"
  };
})();

// Clients page enhancement: manual Messenger binding test.
// This is intentionally separate from the billing reminder queue so a test click
// cannot create or retry billing reminders.
(function () {
  "use strict";

  function isClientsPage() {
    return /(^|\/)clients\.html$/i.test(window.location.pathname) || /(^|\/)clients$/i.test(window.location.pathname);
  }

  if (!isClientsPage()) return;

  const TEST_ENDPOINT = "https://tcexzfztdgximrzuosqs.supabase.co/functions/v1/messenger-binding-test";

  function showClientNotice(message, type) {
    const notice = document.getElementById("notice");
    if (!notice) return;
    notice.textContent = message;
    notice.className = "notice" + (type ? " " + type : "");
    notice.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function decorateBindingCards() {
    const list = document.getElementById("messengerBindings");
    if (!list) return;

    list.querySelectorAll(".binding-card").forEach(function (card) {
      const head = card.querySelector(".binding-card-head");
      if (!head || head.querySelector("[data-binding-test-btn]")) return;

      const removeButton = head.querySelector('button[data-bind-action="remove"]');
      const button = document.createElement("button");
      button.type = "button";
      button.className = "small-btn";
      button.setAttribute("data-binding-test-btn", "1");

      const linkId = String(card.dataset.linkId || "").trim();
      if (!linkId) {
        button.textContent = "Save First";
        button.disabled = true;
        button.title = "Save this Messenger binding before sending a test message.";
      } else {
        button.textContent = "Send Test Message";
        button.title = "Send one manual binding test. This does not use the billing reminder queue.";
      }

      if (removeButton) head.insertBefore(button, removeButton);
      else head.appendChild(button);
    });
  }

  async function sendBindingTest(button) {
    const db = window.TechGeekSupabase;
    const card = button.closest(".binding-card");
    const linkId = String(card && card.dataset ? card.dataset.linkId || "" : "").trim();
    const accountNo = String((document.getElementById("accountNo") || {}).value || "").trim();

    if (!db) {
      showClientNotice("Unable to send binding test: Supabase client is not available.", "error");
      return;
    }
    if (!linkId) {
      showClientNotice("Save the Facebook/Messenger binding first, then click Send Test Message.", "error");
      return;
    }
    if (!accountNo) {
      showClientNotice("Open the client record first so the Account # can be verified before testing.", "error");
      return;
    }

    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = "Sending...";

    try {
      const sessionResult = await db.auth.getSession();
      if (sessionResult.error) throw sessionResult.error;
      const session = sessionResult.data && sessionResult.data.session;
      if (!session || !session.access_token) throw new Error("Your admin session expired. Please sign in again.");

      const response = await fetch(TEST_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + session.access_token
        },
        body: JSON.stringify({
          action: "SEND_TEST",
          link_id: Number(linkId),
          account_no: accountNo
        })
      });

      let data = {};
      try { data = await response.json(); } catch (_) { data = {}; }

      if (!response.ok || !data.ok) {
        throw new Error(data.message || "Messenger binding test could not be sent.");
      }

      if (data.sent) {
        showClientNotice("Messenger binding test sent successfully for account " + accountNo + ". No billing reminder was created.", "ok");
      } else if (data.triggered) {
        showClientNotice("Messenger binding test flow triggered for account " + accountNo + ". Check the client's Messenger conversation to confirm delivery. No billing reminder was created.", "ok");
      } else {
        showClientNotice("Messenger binding test request completed for account " + accountNo + ". Check Messenger to confirm delivery.", "ok");
      }
    } catch (error) {
      showClientNotice("Unable to send Messenger binding test: " + (error && error.message ? error.message : "Unknown error"), "error");
    } finally {
      button.disabled = false;
      button.textContent = oldText || "Send Test Message";
    }
  }

  function setupBindingTestEnhancement() {
    const list = document.getElementById("messengerBindings");
    if (!list) {
      window.setTimeout(setupBindingTestEnhancement, 250);
      return;
    }

    decorateBindingCards();

    const observer = new MutationObserver(function () {
      decorateBindingCards();
    });
    observer.observe(list, { childList: true, subtree: true });

    list.addEventListener("click", function (event) {
      const button = event.target.closest("button[data-binding-test-btn]");
      if (!button || button.disabled) return;
      event.preventDefault();
      event.stopPropagation();
      sendBindingTest(button);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupBindingTestEnhancement, { once: true });
  } else {
    setupBindingTestEnhancement();
  }
})();

// TechGeekPH app.html: professional OWNER/ADMIN workspace launcher.
// Keeps the polished mobile GUI and exposes all admin HTML modules directly,
// so admins no longer need to pass through the legacy dashboard sidebar.
(function () {
  "use strict";

  if (!/(^|\/)app\.html$/i.test(window.location.pathname) && !/(^|\/)app$/i.test(window.location.pathname)) return;

  const MODULE_GROUPS = [
    {
      label: "Operations",
      items: [
        ["application_form.html", "＋", "Application Form", "New client application"],
        ["clients.html", "👥", "Clients", "Client master records"],
        ["billing.html", "₱", "Billing Control", "Billing, balances and payments"],
        ["tickets.html", "🎫", "Tickets", "Service requests and repairs"],
        ["technician-checklist.html?source=app", "🛠", "Tickets & Checklist", "Technician operations"],
        ["nap-checker.html", "◉", "NAP Checker", "NAP ports and client assignments"],
        ["statement_of_account_v3.html", "▤", "Statement of Account", "Generate client SOA"]
      ]
    },
    {
      label: "Attendance & Expenses",
      items: [
        ["daily_time_record.html", "⏱", "My Time Record", "Time in, time out and breaks"],
        ["daily_time_record_admin.html", "◷", "Admin Time Records", "All staff attendance"],
        ["my_expense_request.html", "₱", "My Expense Request", "Submit and review own requests"],
        ["expense_approval.html", "✓", "Expense Approval", "Review staff expenses"],
        ["payslip_generator.html", "▥", "Payslip Generator", "Prepare employee payslips"]
      ]
    },
    {
      label: "Stock & Assets",
      items: [
        ["consumable_stock.html", "▦", "Consumable Stock", "Inventory and stock monitoring"],
        ["company_assets.html", "◆", "Company Assets", "Company equipment and assets"]
      ]
    },
    {
      label: "Investors",
      items: [
        ["investor_morwin_gapud.html", "M", "Morwin Gapud", "Investor account and reports"],
        ["investor_marivie_viana_gapud.html", "V", "Marivie Viana Gapud", "Investor account and reports"]
      ]
    }
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
    return '<a class="tile" href="' + esc(item[0]) + '">' +
      '<span class="ico">' + esc(item[1]) + '</span>' +
      '<b>' + esc(item[2]) + '</b>' +
      '<small>' + esc(item[3]) + '</small>' +
      '</a>';
  }

  function groupHeading(label) {
    return '<div data-app-module-heading style="grid-column:1/-1;margin:8px 2px 0;padding:3px 0;color:#51657a;font-size:.68rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em">' + esc(label) + '</div>';
  }

  function renderCompleteAdminWorkspace() {
    const grid = document.getElementById("menuGrid");
    const title = document.getElementById("menuTitle");
    const role = document.getElementById("welcomeRole");
    if (!grid || !title || !role) return false;

    const roleText = String(role.textContent || "").trim().toUpperCase();
    const titleText = String(title.textContent || "").trim().toUpperCase();
    const isAdmin = titleText === "ADMIN WORKSPACE" || roleText === "OWNER" || roleText === "ADMIN" || roleText.indexOf("OWNER") !== -1 || roleText.indexOf("ADMIN") !== -1;
    if (!isAdmin) return false;
    if (grid.dataset.completeAdminWorkspace === "1") return true;

    grid.dataset.completeAdminWorkspace = "1";
    grid.classList.add("admin-grid");
    grid.innerHTML = MODULE_GROUPS.map(function (group) {
      return groupHeading(group.label) + group.items.map(tile).join("");
    }).join("");

    const activityLabel = document.getElementById("activityLabel");
    if (activityLabel) activityLabel.textContent = "Full operations access · direct modules";
    return true;
  }

  function setup() {
    const grid = document.getElementById("menuGrid");
    if (!grid) {
      window.setTimeout(setup, 200);
      return;
    }

    renderCompleteAdminWorkspace();

    const observer = new MutationObserver(function () {
      if (grid.dataset.completeAdminWorkspace === "1") return;
      renderCompleteAdminWorkspace();
    });
    observer.observe(grid, { childList: true, subtree: true });

    window.setTimeout(renderCompleteAdminWorkspace, 250);
    window.setTimeout(renderCompleteAdminWorkspace, 800);
    window.setTimeout(renderCompleteAdminWorkspace, 1800);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup, { once: true });
  } else {
    setup();
  }
})();
