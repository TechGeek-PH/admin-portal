(function () {
  "use strict";

  const CORE_BUILD = "9d49133f04208f86428d59461aaf235b9caff027";
  const CORE_URL = "https://cdn.jsdelivr.net/gh/TechGeek-PH/admin-portal@" + CORE_BUILD + "/assets/admin-shell.js";
  const currentFile = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();

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

  function loadBillingEditors() {
    return loadScript("assets/billing-account-editor.js?v=20260813-3", "billing-account-editor")
      .then(function () {
        return loadScript("assets/billing-payment-editor.js?v=20260813-6", "billing-payment-editor");
      })
      .then(function () {
        return loadScript("assets/billing-advanced-filter.js?v=20260813-1", "billing-advanced-filter");
      });
  }

  if (currentFile === "billing.html") {
    loadBillingEditors().catch(function (error) {
      console.error("Billing editors failed to load:", error && error.message ? error.message : error);
    });
  }

  loadScript("assets/auth-session-bridge.js?v=20260812-1", "auth-session-bridge")
    .then(function () {
      return window.TechGeekAuthReady || null;
    })
    .then(function () {
      return loadScript(CORE_URL, "admin-core");
    })
    .then(function () {
      return loadScript("assets/admin-nav.js?v=20260813-5", "admin-nav");
    })
    .then(function () {
      if (currentFile === "application_form.html") {
        return loadScript("assets/application-supabase-loader.js?v=20260812-2", "application-supabase-loader");
      }
      if (currentFile === "statement_of_account.html" || currentFile === "statement_of_account_v3.html") {
        return loadScript("assets/soa-supabase.js?v=20260812-2", "soa-supabase");
      }
      if (currentFile === "billing.html") {
        return loadBillingEditors();
      }
      if (currentFile === "billing_control.html") {
        return loadScript("assets/billing-expired-tag.js?v=20260813-1", "billing-expired-tag");
      }
      return null;
    })
    .catch(function (error) {
      console.error("TechGeekPH admin shell loader failed:", error && error.message ? error.message : error);
    });
})();
