(function () {
  "use strict";

  const NativeMutationObserver = window.MutationObserver;
  const embedded = new URLSearchParams(window.location.search).get("embed") === "1" || new URLSearchParams(window.location.search).get("source") === "app-embed" || window.parent !== window;

  function clearLegacySessionNotice() {
    const notice = document.getElementById("notice");
    if (!notice) return;
    const text = String(notice.textContent || "").trim();
    if (/session expired|please login again|login again/i.test(text)) {
      notice.textContent = "";
      notice.classList.add("is-hidden");
      notice.classList.remove("error", "ok");
    }
  }

  function installNoticeGuard() {
    clearLegacySessionNotice();
    const notice = document.getElementById("notice");
    if (!notice || !NativeMutationObserver) return;
    if (notice.dataset.tgSessionGuard === "1") return;
    notice.dataset.tgSessionGuard = "1";
    const observer = new NativeMutationObserver(clearLegacySessionNotice);
    observer.observe(notice, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  }

  if (NativeMutationObserver) {
    window.MutationObserver = function (callback) {
      const observer = new NativeMutationObserver(callback);
      const nativeObserve = observer.observe.bind(observer);
      observer.observe = function (target, options) {
        if (target && target.id === "applicationRows") return;
        return nativeObserve(target, options);
      };
      return observer;
    };
    window.MutationObserver.prototype = NativeMutationObserver.prototype;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installNoticeGuard, { once: true });
  else installNoticeGuard();

  if (embedded) {
    const style = document.createElement("style");
    style.id = "tg-application-embed-fix";
    style.textContent = ".sidebar,[data-admin-sidebar],.topbar{display:none!important}.app{display:block!important;grid-template-columns:1fr!important;width:100%!important}.main{display:block!important;width:100%!important}.content{width:100%!important;max-width:none!important;margin:0!important;padding:12px!important}";
    document.head.appendChild(style);
  }

  function rerenderSupabaseRows() {
    const search = document.querySelector("#searchInput");
    if (search) search.dispatchEvent(new Event("input", { bubbles: true }));
    clearLegacySessionNotice();
  }

  const script = document.createElement("script");
  script.src = "assets/application-supabase.js?v=20260824-unified2";
  script.async = false;
  script.onload = function () {
    if (NativeMutationObserver) window.MutationObserver = NativeMutationObserver;
    document.querySelectorAll(".file-note").forEach(function (note) {
      if (/drive/i.test(note.textContent || "")) note.textContent = (note.textContent || "").replace(/Drive/gi, "private Supabase Storage");
    });
    installNoticeGuard();
    [0,150,300,900,1800,4000].forEach(function (delay) { window.setTimeout(rerenderSupabaseRows, delay); });
  };
  script.onerror = function () {
    if (NativeMutationObserver) window.MutationObserver = NativeMutationObserver;
    installNoticeGuard();
    console.error("Unable to load Supabase Application Form module.");
  };
  document.head.appendChild(script);
})();
