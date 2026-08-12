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

  const script = document.createElement("script");
  script.src = "assets/application-supabase.js?v=20260812-2";
  script.async = false;
  script.onload = function () {
    if (NativeMutationObserver) window.MutationObserver = NativeMutationObserver;

    document.querySelectorAll(".file-note").forEach(function (note) {
      if (/drive/i.test(note.textContent || "")) {
        note.textContent = (note.textContent || "").replace(/Drive/gi, "private Supabase Storage");
      }
    });

    [1500, 4000, 8000].forEach(function (delay) {
      window.setTimeout(function () {
        const search = document.querySelector("#searchInput");
        if (search) search.dispatchEvent(new Event("input", { bubbles: true }));
      }, delay);
    });
  };
  script.onerror = function () {
    if (NativeMutationObserver) window.MutationObserver = NativeMutationObserver;
    console.error("Unable to load Supabase Application Form module.");
  };
  document.head.appendChild(script);
})();