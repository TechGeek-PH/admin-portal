(function () {
  "use strict";

  const SUPABASE_URL = "https://tcexzfztdgximrzuosqs.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8H8_S7NTWvzPCLvYUe2C4g_k3Ltjfiz";
  const ADMIN_SESSION_KEY = "techgeekph_admin_session";
  const APP_SESSION_KEY = "tg_session_v3";
  const SB_SESSION_KEY = "sb-tcexzfztdgximrzuosqs-auth-token";
  const params = new URLSearchParams(window.location.search);
  const embedded = params.get("embed") === "1" || params.get("source") === "app-embed" || window.parent !== window;

  function readPortalSession() {
    try { return JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY) || "{}"); }
    catch (_) { return {}; }
  }

  function parentIdentity() {
    if (!embedded || window.parent === window) return {};
    try {
      return {
        fullName: String(window.parent.document.getElementById("topName")?.textContent || "").trim(),
        role: String(window.parent.document.getElementById("topRole")?.textContent || "").trim()
      };
    } catch (_) { return {}; }
  }

  function savePortalSession(authSession) {
    if (!authSession || !authSession.access_token) return;
    const portal = readPortalSession();
    const authUser = authSession.user || {};
    const parent = parentIdentity();
    portal.provider = "supabase";
    portal.token = authSession.access_token;
    portal.sessionToken = authSession.access_token;
    portal.accessToken = authSession.access_token;
    portal.refreshToken = authSession.refresh_token || portal.refreshToken || "";
    portal.user = Object.assign({}, portal.user || {}, {
      id: authUser.id || (portal.user && portal.user.id) || "",
      email: authUser.email || (portal.user && portal.user.email) || "",
      fullName: parent.fullName || (portal.user && portal.user.fullName) || "",
      name: parent.fullName || (portal.user && portal.user.name) || "",
      role: parent.role || (portal.user && portal.user.role) || ""
    });
    portal.email = authUser.email || portal.email || "";
    portal.role = parent.role || portal.role || "";
    portal.sessionRefreshedAt = new Date().toISOString();
    try { localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(portal)); } catch (_) {}
    try { localStorage.setItem(APP_SESSION_KEY, JSON.stringify(authSession)); } catch (_) {}
    try { localStorage.setItem(SB_SESSION_KEY, JSON.stringify(authSession)); } catch (_) {}
    try {
      if (embedded && window.parent && window.parent !== window) {
        window.parent.localStorage.setItem(APP_SESSION_KEY, JSON.stringify(authSession));
        window.parent.localStorage.setItem(SB_SESSION_KEY, JSON.stringify(authSession));
      }
    } catch (_) {}
  }

  function clearPortalSession() {
    try { localStorage.removeItem(ADMIN_SESSION_KEY); } catch (_) {}
    try { sessionStorage.removeItem(ADMIN_SESSION_KEY); } catch (_) {}
  }

  function loadSupabase() {
    return new Promise(function (resolve, reject) {
      if (window.TechGeekSupabase) return resolve(window.TechGeekSupabase);

      function createClient() {
        if (!window.supabase || typeof window.supabase.createClient !== "function") {
          reject(new Error("Supabase library unavailable."));
          return;
        }
        window.TechGeekSupabase = window.supabase.createClient(
          SUPABASE_URL,
          SUPABASE_PUBLISHABLE_KEY,
          { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
        );
        resolve(window.TechGeekSupabase);
      }

      if (window.supabase && typeof window.supabase.createClient === "function") {
        createClient();
        return;
      }

      const existing = document.querySelector('script[data-techgeek-auth-lib="1"]');
      if (existing) {
        existing.addEventListener("load", createClient, { once: true });
        existing.addEventListener("error", function () { reject(new Error("Unable to load Supabase library.")); }, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      script.async = false;
      script.dataset.techgeekAuthLib = "1";
      script.onload = createClient;
      script.onerror = function () { reject(new Error("Unable to load Supabase library.")); };
      document.head.appendChild(script);
    });
  }

  async function getParentSupabaseSession() {
    if (!embedded || window.parent === window) return null;
    try {
      const parentDb = window.parent.TechGeekSupabase;
      if (!parentDb || !parentDb.auth || typeof parentDb.auth.getSession !== "function") return null;
      const result = await parentDb.auth.getSession();
      return result && result.data ? result.data.session : null;
    } catch (_) {
      return null;
    }
  }

  async function ensureSession() {
    const db = await loadSupabase();
    let session = null;

    try {
      const result = await db.auth.getSession();
      session = result && result.data ? result.data.session : null;
    } catch (_) {}

    if (!session) {
      const parentSession = await getParentSupabaseSession();
      if (parentSession && parentSession.access_token && parentSession.refresh_token) {
        try {
          const set = await db.auth.setSession({
            access_token: parentSession.access_token,
            refresh_token: parentSession.refresh_token
          });
          session = set && set.data ? set.data.session : null;
        } catch (_) {}
        if (!session) session = parentSession;
      }
    }

    if (!session) {
      try {
        const refreshed = await db.auth.refreshSession();
        session = refreshed && refreshed.data ? refreshed.data.session : null;
      } catch (_) {}
    }

    if (!session) {
      if (!embedded) {
        const portal = readPortalSession();
        if (portal && portal.provider === "supabase") {
          clearPortalSession();
          if (!/index\.html$/i.test(window.location.pathname)) {
            window.location.replace("index.html?reason=session_expired");
          }
        }
      }
      return null;
    }

    savePortalSession(session);

    db.auth.onAuthStateChange(function (event, nextSession) {
      if (nextSession) savePortalSession(nextSession);
      if (event === "SIGNED_OUT" && !embedded) clearPortalSession();
    });

    return session;
  }

  window.TechGeekEnsureSupabaseSession = ensureSession;
  window.TechGeekAuthReady = ensureSession().catch(function (error) {
    console.warn("TechGeekPH auth session bridge failed:", error && error.message ? error.message : error);
    return null;
  });
})();

(function () {
  "use strict";

  const isTickets = /(^|\/)tickets\.html$/i.test(window.location.pathname) || /(^|\/)tickets$/i.test(window.location.pathname);
  const isEmbed = new URLSearchParams(window.location.search).get("embed") === "1" || window.parent !== window;
  if (!isTickets || !isEmbed) return;

  const style = document.createElement("style");
  style.id = "techgeek-tickets-embed-style";
  style.textContent = [
    "html,body{margin:0!important;min-height:0!important;background:#f3f6fa!important;}",
    ".app{display:block!important;min-height:0!important;width:100%!important;}",
    ".sidebar,.topbar{display:none!important;}",
    ".main{display:block!important;width:100%!important;min-width:0!important;}",
    ".content{width:100%!important;max-width:none!important;margin:0!important;padding:12px 10px 28px!important;gap:12px!important;}",
    ".metrics{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;}",
    ".metric{padding:12px!important;box-shadow:none!important;min-width:0!important;}",
    ".metric strong{font-size:1.3rem!important;}",
    ".metric span{font-size:.6rem!important;}",
    ".panel{border-radius:12px!important;box-shadow:none!important;overflow:hidden!important;}",
    ".tabs{padding:9px!important;gap:6px!important;}",
    ".tab{min-height:36px!important;padding:0 10px!important;font-size:.68rem!important;}",
    ".panel-head{padding:12px!important;}",
    ".toolbar{padding:10px!important;gap:7px!important;}",
    ".form{padding:12px!important;gap:10px!important;}",
    "dialog{z-index:1200!important;}",
    "@media(max-width:520px){.metrics{grid-template-columns:repeat(2,minmax(0,1fr))!important;}.content{padding:9px 8px 24px!important;}.tabs{display:grid!important;grid-template-columns:1fr!important;}.tab{width:100%!important;}.form{grid-template-columns:1fr!important;}.client-preview{grid-template-columns:1fr 1fr!important;}}"
  ].join("");
  document.head.appendChild(style);
})();
