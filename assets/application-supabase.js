// TechGeekPH Application Form Supabase core loader.
// Reuses the proven form/database implementation and extends form submission access
// to active EMPLOYEE accounts for New Installation, Repair and Relocation field work.
(function () {
  "use strict";

  if (!/(^|\/)application_form\.html$/i.test(window.location.pathname)) return;

  const LEGACY_BUILD = "aa669f71fc242f8dcf04ca76fb38f0fc41e1e1ed";
  const CORE_URL = "https://cdn.jsdelivr.net/gh/TechGeek-PH/admin-portal@" + LEGACY_BUILD + "/assets/application-supabase.js";

  function installCore(source) {
    let code = String(source || "");

    // Field employees use these forms as part of assigned installation/repair work.
    code = code.replace(
      '["OWNER", "ADMIN"].indexOf(String(profile.role || "").toUpperCase()) === -1',
      '["OWNER", "ADMIN", "EMPLOYEE"].indexOf(String(profile.role || "").toUpperCase()) === -1'
    );
    code = code.replace(
      'This account is not authorized to save admin forms.',
      'This account is not authorized to save field service forms.'
    );

    const script = document.createElement("script");
    script.textContent = code + "\n//# sourceURL=application-supabase-core.js";
    script.dataset.techgeekApplicationSupabaseCore = "1";
    document.head.appendChild(script);
  }

  fetch(CORE_URL, { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) throw new Error("Application database core HTTP " + response.status);
      return response.text();
    })
    .then(installCore)
    .catch(function (error) {
      console.error("Unable to load TechGeekPH Application Form database core:", error && error.message ? error.message : error);
      const notice = document.getElementById("notice");
      if (notice) {
        notice.textContent = "Unable to load the Application Form database module. Please refresh the app and try again.";
        notice.classList.remove("is-hidden", "ok");
        notice.classList.add("error");
      }
    });
})();
