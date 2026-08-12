(function () {
  "use strict";

  const SUPABASE_URL = "https://tcexzfztdgximrzuosqs.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8H8_S7NTWvzPCLvYUe2C4g_k3Ltjfiz";
  const ADMIN_SESSION_KEY = "techgeekph_admin_session";

  function readPortalSession() {
    try { return JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY) || "{}"); }
    catch (error) { return {}; }
  }

  function savePortalSession(authSession) {
    if (!authSession || !authSession.access_token) return;
    const portal = readPortalSession();
    const authUser = authSession.user || {};
    portal.provider = "supabase";
    portal.token = authSession.access_token;
    portal.sessionToken = authSession.access_token;
    portal.accessToken = authSession.access_token;
    portal.user = Object.assign({}, portal.user || {}, {
      id: authUser.id || (portal.user && portal.user.id) || "",
      email: authUser.email || (portal.user && portal.user.email) || ""
    });
    portal.email = authUser.email || portal.email || "";
    portal.sessionRefreshedAt = new Date().toISOString();
    try { localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(portal)); } catch (error) {}
  }

  function clearPortalSession() {
    try { localStorage.removeItem(ADMIN_SESSION_KEY); } catch (error) {}
    try { sessionStorage.removeItem(ADMIN_SESSION_KEY); } catch (error) {}
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

  async function ensureSession() {
    const db = await loadSupabase();
    let result = await db.auth.getSession();
    let session = result && result.data ? result.data.session : null;

    if (!session) {
      const refreshed = await db.auth.refreshSession();
      session = refreshed && refreshed.data ? refreshed.data.session : null;
    }

    if (!session) {
      const portal = readPortalSession();
      if (portal && portal.provider === "supabase") {
        clearPortalSession();
        if (!/index\.html$/i.test(window.location.pathname)) {
          window.location.replace("index.html?reason=session_expired");
        }
      }
      return null;
    }

    savePortalSession(session);

    db.auth.onAuthStateChange(function (event, nextSession) {
      if (nextSession) savePortalSession(nextSession);
      if (event === "SIGNED_OUT") clearPortalSession();
    });

    return session;
  }

  window.TechGeekEnsureSupabaseSession = ensureSession;
  window.TechGeekAuthReady = ensureSession().catch(function (error) {
    console.warn("TechGeekPH auth session bridge failed:", error && error.message ? error.message : error);
    return null;
  });
})();
