(function () {
  "use strict";

  const NativeMutationObserver = window.MutationObserver;

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

  function rerenderSupabaseRows() {
    const search = document.querySelector("#searchInput");
    if (search) search.dispatchEvent(new Event("input", { bubbles: true }));
    clearLegacySessionNotice();
  }

  const script = document.createElement("script");
  script.src = "assets/application-supabase.js?v=20260822-session2";
  script.async = false;
  script.onload = function () {
    if (NativeMutationObserver) window.MutationObserver = NativeMutationObserver;

    document.querySelectorAll(".file-note").forEach(function (note) {
      if (/drive/i.test(note.textContent || "")) {
        note.textContent = (note.textContent || "").replace(/Drive/gi, "private Supabase Storage");
      }
    });

    [300, 900, 1800, 4000, 8000, 12000].forEach(function (delay) {
      window.setTimeout(rerenderSupabaseRows, delay);
    });

    const notice = document.getElementById("notice");
    if (notice && NativeMutationObserver) {
      const observer = new NativeMutationObserver(function () {
        clearLegacySessionNotice();
      });
      observer.observe(notice, { childList: true, characterData: true, subtree: true });
    }
  };
  script.onerror = function () {
    if (NativeMutationObserver) window.MutationObserver = NativeMutationObserver;
    console.error("Unable to load Supabase Application Form module.");
  };
  document.head.appendChild(script);
})();