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

  loadScript(CORE_URL, "admin-core")
    .then(function () {
      if (currentFile === "application_form.html") {
        return loadScript("assets/application-supabase.js?v=20260812-1", "application-supabase");
      }
      return null;
    })
    .catch(function (error) {
      console.error("TechGeekPH admin shell loader failed:", error && error.message ? error.message : error);
    });
})();