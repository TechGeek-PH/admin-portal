(function () {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const embedded = params.get("embed") === "1" || params.get("source") === "app-embed" || window.parent !== window;
  const currentFile = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();

  function routeEmployeePayslips() {
    if (!embedded || currentFile !== "payslip_generator.html" || window.parent === window) return false;
    try {
      const parentRole = String(window.parent.document.getElementById("topRole")?.textContent || "").trim().toUpperCase();
      if (parentRole === "EMPLOYEE") {
        window.location.replace("app-payslips.html?embed=1&source=app-embed");
        return true;
      }
    } catch (_) {}
    return false;
  }
  if (routeEmployeePayslips()) return;

  function applyEmbeddedShell() {
    if (!embedded) return;
    document.documentElement.classList.add("tg-embedded");
    if (document.body) document.body.classList.add("tg-embedded");
    if (!document.getElementById("tg-embedded-inline-style")) {
      const style = document.createElement("style");
      style.id = "tg-embedded-inline-style";
      let css = [
        "html.tg-embedded,body.tg-embedded{margin:0!important;background:#f3f6fa!important;}",
        "html.tg-embedded .sidebar,body.tg-embedded .sidebar,html.tg-embedded [data-admin-sidebar],body.tg-embedded [data-admin-sidebar],html.tg-embedded .topbar,body.tg-embedded .topbar{display:none!important;}",
        "html.tg-embedded .app,body.tg-embedded .app{display:block!important;grid-template-columns:1fr!important;min-height:0!important;width:100%!important;}",
        "html.tg-embedded .main,body.tg-embedded .main{display:block!important;width:100%!important;min-width:0!important;}",
        "html.tg-embedded .content,body.tg-embedded .content{width:100%!important;max-width:none!important;padding:12px!important;margin:0!important;}",
        "html.tg-embedded .workspace,body.tg-embedded .workspace{width:100%!important;}"
      ];
      if (currentFile === "statement_of_account.html" || currentFile === "statement_of_account_v3.html") {
        css = css.concat([
          "body.tg-embedded .content{grid-template-columns:minmax(300px,420px) minmax(0,1fr)!important;gap:14px!important;padding:10px!important;align-items:start!important;}",
          "body.tg-embedded .panel{box-shadow:none!important;border-radius:12px!important;}",
          "body.tg-embedded .preview-area{min-width:0!important;overflow:auto!important;}",
          "body.tg-embedded .soa-paper-wrap{overflow:auto!important;max-width:100%!important;}",
          "@media(max-width:900px){body.tg-embedded .content{grid-template-columns:1fr!important;}body.tg-embedded .form-grid{grid-template-columns:1fr!important;}body.tg-embedded .preview-actions{display:grid!important;grid-template-columns:1fr 1fr!important;}body.tg-embedded .preview-actions button{width:100%!important;}}",
          "@media(max-width:560px){body.tg-embedded .content{padding:8px!important;}body.tg-embedded .preview-actions{grid-template-columns:1fr!important;}}"
        ]);
      }
      style.textContent = css.join("");
      document.head.appendChild(style);
    }
  }
  if (embedded) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", applyEmbeddedShell, { once: true });
    else applyEmbeddedShell();
  }

  function setupNapMobileEnhancements() {
    if (currentFile !== "nap-checker.html" || !document.body) return;
    if (document.body.dataset.tgNapMobileReady === "1") return;
    document.body.dataset.tgNapMobileReady = "1";
    document.body.classList.add("tg-nap-mobile");

    const mq = window.matchMedia("(max-width: 860px)");
    const sidebar = document.querySelector("[data-admin-sidebar]");
    const topbar = document.querySelector(".topbar");
    const detailPanel = document.querySelector(".detail-panel");
    const detailContent = document.getElementById("detailContent");
    const searchInput = document.getElementById("globalSearch");
    const controlsPanel = searchInput ? searchInput.closest(".panel") : null;
    const mapEl = document.getElementById("napMap");
    const mapPanel = mapEl ? mapEl.closest(".panel") : null;
    const clientRows = document.getElementById("clientRows");
    const clientsPanel = clientRows ? clientRows.closest(".panel") : null;
    const boxSelect = document.getElementById("boxSelect");
    const lcpFilter = document.getElementById("lcpFilter");
    const statusFilter = document.getElementById("statusFilter");
    const showAllBtn = document.getElementById("showAllBtn");
    const pickPinBtn = document.getElementById("pickPinBtn");
    const dragPinBtn = document.getElementById("dragPinBtn");

    if (controlsPanel) controlsPanel.classList.add("tg-nap-controls");
    if (mapPanel) mapPanel.id = mapPanel.id || "tg-nap-map-section";
    if (clientsPanel) clientsPanel.id = clientsPanel.id || "tg-nap-clients-section";

    function makeButton(className, label, ariaLabel) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = className;
      button.textContent = label;
      if (ariaLabel) button.setAttribute("aria-label", ariaLabel);
      return button;
    }

    let menuBtn = document.getElementById("tgNapMenuBtn");
    if (!menuBtn && topbar) {
      menuBtn = makeButton("tg-nap-menu-btn", "☰", "Open navigation menu");
      menuBtn.id = "tgNapMenuBtn";
      topbar.insertBefore(menuBtn, topbar.firstChild);
    }

    let closeBtn = document.getElementById("tgNapCloseBtn");
    if (!closeBtn && sidebar) {
      closeBtn = makeButton("tg-nap-close-btn", "×", "Close navigation menu");
      closeBtn.id = "tgNapCloseBtn";
      sidebar.insertBefore(closeBtn, sidebar.firstChild);
    }

    let backdrop = document.getElementById("tgNapBackdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = "tgNapBackdrop";
      backdrop.className = "tg-nap-backdrop";
      backdrop.setAttribute("aria-hidden", "true");
      document.body.appendChild(backdrop);
    }

    let filterBtn = document.getElementById("tgNapFilterBtn");
    if (!filterBtn && controlsPanel) {
      const head = controlsPanel.querySelector(".panel-head");
      filterBtn = makeButton("tg-nap-filter-btn", "Filters", "Show map filters");
      filterBtn.id = "tgNapFilterBtn";
      if (head) {
        const statusChip = head.querySelector("#loadStatus");
        if (statusChip) head.insertBefore(filterBtn, statusChip);
        else head.appendChild(filterBtn);
      }
    }

    let detailClose = document.getElementById("tgNapDetailClose");
    if (!detailClose && detailPanel) {
      const head = detailPanel.querySelector(".panel-head");
      detailClose = makeButton("tg-nap-detail-close", "×", "Close NAP details");
      detailClose.id = "tgNapDetailClose";
      if (head) head.appendChild(detailClose);
    }

    let bottomNav = document.getElementById("tgNapBottomNav");
    if (!bottomNav) {
      bottomNav = document.createElement("nav");
      bottomNav.id = "tgNapBottomNav";
      bottomNav.className = "tg-nap-bottom-nav";
      bottomNav.setAttribute("aria-label", "NAP mobile navigation");
      const lastLabel = embedded ? "Filters" : "Menu";
      const lastIcon = embedded ? "⌕" : "☰";
      bottomNav.innerHTML = [
        '<button type="button" data-tg-nap-action="map"><strong>⌖</strong>Map</button>',
        '<button type="button" data-tg-nap-action="details"><strong>◉</strong>NAP</button>',
        '<button type="button" data-tg-nap-action="clients"><strong>☷</strong>Clients</button>',
        '<button type="button" data-tg-nap-action="last"><strong>' + lastIcon + '</strong>' + lastLabel + '</button>'
      ].join("");
      document.body.appendChild(bottomNav);
    }

    function openMenu() {
      if (!mq.matches || embedded || !sidebar) return;
      sidebar.classList.add("tg-mobile-open");
      backdrop.classList.add("tg-mobile-open");
      document.body.classList.add("tg-nap-menu-open");
    }

    function closeMenu() {
      if (sidebar) sidebar.classList.remove("tg-mobile-open");
      backdrop.classList.remove("tg-mobile-open");
      document.body.classList.remove("tg-nap-menu-open");
    }

    function openDetails() {
      if (!mq.matches || !detailPanel) return;
      closeMenu();
      detailPanel.classList.add("tg-mobile-open");
    }

    function closeDetails() {
      if (detailPanel) detailPanel.classList.remove("tg-mobile-open");
    }

    function setFilters(open) {
      if (!controlsPanel) return;
      controlsPanel.classList.toggle("tg-filters-open", !!open);
      if (filterBtn) filterBtn.textContent = open ? "Close" : "Filters";
    }

    function toggleFilters() {
      if (!controlsPanel) return;
      setFilters(!controlsPanel.classList.contains("tg-filters-open"));
    }

    function scrollToPanel(panel) {
      if (!panel) return;
      closeMenu();
      closeDetails();
      setFilters(false);
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
      if (panel === mapPanel) setTimeout(function () { window.dispatchEvent(new Event("resize")); }, 240);
    }

    if (menuBtn) menuBtn.addEventListener("click", openMenu);
    if (closeBtn) closeBtn.addEventListener("click", closeMenu);
    backdrop.addEventListener("click", closeMenu);
    if (detailClose) detailClose.addEventListener("click", closeDetails);
    if (filterBtn) filterBtn.addEventListener("click", toggleFilters);

    bottomNav.addEventListener("click", function (event) {
      const button = event.target.closest("button[data-tg-nap-action]");
      if (!button) return;
      const action = button.dataset.tgNapAction;
      if (action === "map") scrollToPanel(mapPanel);
      if (action === "details") openDetails();
      if (action === "clients") scrollToPanel(clientsPanel);
      if (action === "last") {
        if (embedded) {
          closeDetails();
          if (controlsPanel) controlsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
          setFilters(true);
        } else openMenu();
      }
    });

    if (sidebar) sidebar.querySelectorAll("a").forEach(function (link) { link.addEventListener("click", closeMenu); });

    if (detailContent && window.MutationObserver) {
      const observer = new MutationObserver(function () {
        if (mq.matches && !detailContent.classList.contains("is-hidden")) openDetails();
      });
      observer.observe(detailContent, { attributes: true, attributeFilter: ["class"] });
    }

    if (boxSelect) boxSelect.addEventListener("change", function () { if (boxSelect.value) setTimeout(openDetails, 30); });
    if (searchInput) searchInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        setFilters(false);
        setTimeout(function () {
          if (detailContent && !detailContent.classList.contains("is-hidden")) openDetails();
        }, 350);
      }
    });

    [lcpFilter, statusFilter].forEach(function (field) {
      if (field) field.addEventListener("change", function () {
        if (!mq.matches) return;
        setFilters(false);
        setTimeout(function () { scrollToPanel(mapPanel); }, 40);
      });
    });

    if (showAllBtn) showAllBtn.addEventListener("click", function () {
      if (!mq.matches) return;
      setFilters(false);
      setTimeout(function () { scrollToPanel(mapPanel); }, 40);
    });

    if (pickPinBtn) pickPinBtn.addEventListener("click", function () {
      setTimeout(function () {
        if (!mq.matches) return;
        if (String(pickPinBtn.textContent || "").toLowerCase().includes("cancel")) scrollToPanel(mapPanel);
      }, 30);
    });

    if (dragPinBtn) dragPinBtn.addEventListener("click", function () {
      setTimeout(function () {
        if (!mq.matches) return;
        if (String(dragPinBtn.textContent || "").toLowerCase().includes("finish")) scrollToPanel(mapPanel);
      }, 30);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeMenu();
        closeDetails();
        setFilters(false);
      }
    });

    function resetWideScreen() {
      if (!mq.matches) {
        closeMenu();
        closeDetails();
        setFilters(false);
      }
    }
    if (mq.addEventListener) mq.addEventListener("change", resetWideScreen);
    else if (mq.addListener) mq.addListener(resetWideScreen);
  }

  if (currentFile === "nap-checker.html") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setupNapMobileEnhancements, { once: true });
    else setupNapMobileEnhancements();
  }

  const CORE_BUILD = "9d49133f04208f86428d59461aaf235b9caff027";
  const CORE_URL = "https://cdn.jsdelivr.net/gh/TechGeek-PH/admin-portal@" + CORE_BUILD + "/assets/admin-shell.js";
  function loadScript(src, marker) {
    return new Promise(function (resolve, reject) {
      if (marker && document.querySelector('script[data-techgeek-module="' + marker + '"]')) { resolve(); return; }
      const script = document.createElement("script");
      script.src = src; script.async = false;
      if (marker) script.dataset.techgeekModule = marker;
      script.onload = resolve;
      script.onerror = function () { reject(new Error("Unable to load " + src)); };
      document.head.appendChild(script);
    });
  }

  function ensureLatestBillingPaymentEditor() {
    const existing = document.querySelector('script[data-techgeek-module="billing-payment-editor"]');
    if (existing && String(existing.src || "").indexOf("v=20260813-8") === -1) existing.remove();
  }
  function loadBillingEditors() {
    ensureLatestBillingPaymentEditor();
    return loadScript("assets/billing-account-editor.js?v=20260813-3", "billing-account-editor")
      .then(function () { return loadScript("assets/billing-payment-editor.js?v=20260813-8", "billing-payment-editor"); })
      .then(function () { return loadScript("assets/billing-unpaid-reset.js?v=20260813-1", "billing-unpaid-reset"); })
      .then(function () { return loadScript("assets/billing-advanced-filter.js?v=20260813-1", "billing-advanced-filter"); });
  }
  if (currentFile === "billing.html") loadBillingEditors().catch(function (error) { console.error("Billing editors failed to load:", error && error.message ? error.message : error); });

  loadScript("assets/auth-session-bridge-v2.js?v=20260824-sequence1", "auth-session-bridge-v2")
    .then(function () { return window.TechGeekAuthReady || null; })
    .then(function () { return loadScript(CORE_URL, "admin-core"); })
    .then(function () { return loadScript("assets/admin-nav.js?v=20260813-6", "admin-nav"); })
    .then(function () {
      if (currentFile === "application_form.html") {
        return loadScript("assets/application-independent-service.js?v=20260822-2", "application-independent-service")
          .then(function () { return loadScript("assets/application-existing-client-lookup.js?v=20260823-4", "application-existing-client-lookup"); })
          .then(function () { return loadScript("assets/app-client-sync.js?v=20260824-sequence2", "app-client-sync"); })
          .then(function () { return loadScript("assets/app-client-sync-mode-guard.js?v=20260824-1", "app-client-sync-mode-guard"); })
          .then(function () { return loadScript("assets/application-supabase-loader.js?v=20260824-unified1", "application-supabase-loader"); });
      }
      if (currentFile === "tickets.html") return loadScript("assets/tickets-workflow-v2.js?v=20260824-1", "tickets-workflow-v2");
      if (currentFile === "statement_of_account.html" || currentFile === "statement_of_account_v3.html") return loadScript("assets/soa-supabase.js?v=20260812-2", "soa-supabase");
      if (currentFile === "billing.html") return loadBillingEditors();
      if (currentFile === "billing_control.html") return loadScript("assets/billing-expired-tag.js?v=20260813-1", "billing-expired-tag");
      if (currentFile === "expense_approval.html") return loadScript("assets/expense-approval-supabase.js?v=20260823-2", "expense-approval-supabase");
      return null;
    })
    .catch(function (error) { console.error("TechGeekPH admin shell loader failed:", error && error.message ? error.message : error); });
})();
