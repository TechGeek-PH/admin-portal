(function() {
  const BUILD_KEY = "20260711-session-v5";
  const ADMIN_SESSION_KEY = "techgeekph_admin_session";
  const GENERIC_SESSION_KEY = "techgeekph_session";
  const EMPLOYEE_SESSION_KEY = "techgeekph_employee_session";

  function parseStored(storage, key) {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function sessionToken(session) {
    const value = session || {};
    const data = value.data || {};
    return value.token || value.sessionToken || value.accessToken ||
      data.token || data.sessionToken || data.accessToken || "";
  }

  function sessionUser(session) {
    const value = session || {};
    const data = value.data || {};
    return value.user || data.user || {};
  }

  function sessionRole(session) {
    const value = session || {};
    const data = value.data || {};
    const user = sessionUser(value);
    return String(user.role || value.role || data.role || "").trim().toUpperCase();
  }

  function normalizeAdminSession(session) {
    const value = session || {};
    const token = sessionToken(value);
    const user = Object.assign({}, sessionUser(value));

    if (!token) return null;

    user.role = String(user.role || value.role || "ADMIN").trim().toUpperCase();

    return Object.assign({}, value, {
      token: token,
      sessionToken: token,
      user: user,
      role: user.role,
      loginAt: value.loginAt || new Date().toISOString()
    });
  }

  function findActiveAdminSession() {
    const candidates = [];
    const keys = [ADMIN_SESSION_KEY, GENERIC_SESSION_KEY, EMPLOYEE_SESSION_KEY];
    const storages = [localStorage, sessionStorage];

    storages.forEach(function(storage) {
      keys.forEach(function(key) {
        const session = parseStored(storage, key);
        if (session && sessionToken(session)) {
          candidates.push({ key: key, session: session });
        }
      });
    });

    return candidates.find(function(item) {
      return item.key === ADMIN_SESSION_KEY || sessionRole(item.session) === "ADMIN";
    }) || null;
  }

  function syncAdminSession() {
    const active = findActiveAdminSession();
    if (!active) return null;

    const normalized = normalizeAdminSession(active.session);
    if (!normalized || sessionRole(normalized) !== "ADMIN") return null;

    const serialized = JSON.stringify(normalized);

    try {
      localStorage.setItem(ADMIN_SESSION_KEY, serialized);
      localStorage.setItem(GENERIC_SESSION_KEY, serialized);
    } catch (error) {}

    try {
      sessionStorage.setItem(ADMIN_SESSION_KEY, serialized);
      sessionStorage.setItem(GENERIC_SESSION_KEY, serialized);
    } catch (error) {}

    return normalized;
  }

  // Keep both the dedicated admin key and the legacy generic key synchronized.
  // This prevents older or cached admin pages from treating a fresh admin login
  // as missing and immediately sending the user back to index.html.
  syncAdminSession();
  window.addEventListener("pageshow", syncAdminSession);

  const currentFile = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  const currentSearch = String(window.location.search || "");

  // Force the Statement of Account page to open the latest deployed build.
  if (currentFile === "statement_of_account.html" && currentSearch.indexOf("build=" + BUILD_KEY) === -1) {
    window.location.replace("statement_of_account_v3.html");
    return;
  }

  const sidebar = document.querySelector("[data-admin-sidebar]");
  if (!sidebar) return;

  const links = Array.prototype.slice.call(sidebar.querySelectorAll("a[href]"));

  links.forEach(function(link) {
    const rawHref = String(link.getAttribute("href") || "");
    const cleanHref = rawHref.split("#")[0].split("?")[0].toLowerCase();

    // All admin pages now open the cache-busting SOA loader.
    if (cleanHref === "statement_of_account.html" || cleanHref === "statement_of_account_v3.html") {
      link.setAttribute("href", "statement_of_account_v3.html");
    }

    const activeHref = String(link.getAttribute("href") || "").split("#")[0].split("?")[0].toLowerCase();
    const isSoaPage = currentFile === "statement_of_account.html" || currentFile === "statement_of_account_v3.html";
    const isActive = activeHref === currentFile || (isSoaPage && activeHref === "statement_of_account_v3.html");
    link.classList.toggle("is-active", isActive);

    if (isActive) {
      const group = link.closest(".nav-group");
      if (group) {
        group.classList.add("is-open");
        const toggle = group.querySelector(".nav-toggle");
        if (toggle) toggle.classList.add("is-active");
      }
    }
  });
})();
