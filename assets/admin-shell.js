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

  const CORE_BUILD = "9d49133f04208f86428d59461aaf235b9caff027";
  const CORE_URL = "https://cdn.jsdelivr.net/gh/TechGeek-PH/admin-portal@" + CORE_BUILD + "/assets/admin-shell.js";

  function loadScript(src, marker) {
    return new Promise(function (resolve, reject) {
      if (marker && document.querySelector('script[data-techgeek-module="' + marker + '"]')) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      if (marker) script.dataset.techgeekModule = marker;
      script.onload = function () { resolve(); };
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

  if (currentFile === "billing.html") {
    loadBillingEditors().catch(function (error) {
      console.error("Billing editors failed to load:", error && error.message ? error.message : error);
    });
  }

  loadScript("assets/auth-session-bridge-v2.js?v=20260822-2", "auth-session-bridge-v2")
    .then(function () { return window.TechGeekAuthReady || null; })
    .then(function () { return loadScript(CORE_URL, "admin-core"); })
    .then(function () { return loadScript("assets/admin-nav.js?v=20260813-6", "admin-nav"); })
    .then(function () {
      if (currentFile === "application_form.html") {
        return loadScript("assets/application-independent-service.js?v=20260822-2", "application-independent-service")
          .then(function () { return loadScript("assets/application-existing-client-lookup.js?v=20260823-4", "application-existing-client-lookup"); })
          .then(function () { return loadScript("assets/application-supabase-loader.js?v=20260823-field-save1", "application-supabase-loader"); })
          .then(function () { return loadScript("assets/application-client-db-sync.js?v=20260824-1", "application-client-db-sync"); });
      }
      if (currentFile === "statement_of_account.html" || currentFile === "statement_of_account_v3.html") return loadScript("assets/soa-supabase.js?v=20260812-2", "soa-supabase");
      if (currentFile === "billing.html") return loadBillingEditors();
      if (currentFile === "billing_control.html") return loadScript("assets/billing-expired-tag.js?v=20260813-1", "billing-expired-tag");
      if (currentFile === "expense_approval.html") return loadScript("assets/expense-approval-supabase.js?v=20260823-2", "expense-approval-supabase");
      return null;
    })
    .catch(function (error) {
      console.error("TechGeekPH admin shell loader failed:", error && error.message ? error.message : error);
    });
})();
