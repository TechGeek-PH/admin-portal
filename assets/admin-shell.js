(function () {
  "use strict";

  const ADMIN_SESSION_KEY = "techgeekph_admin_session";
  const GENERIC_SESSION_KEY = "techgeekph_session";
  const EMPLOYEE_SESSION_KEY = "techgeekph_employee_session";
  const SUPABASE_URL = "https://tcexzfztdgximrzuosqs.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8H8_S7NTWvzPCLvYUe2C4g_k3Ltjfiz";

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

  function isAdminRole(role) {
    const clean = String(role || "").trim().toUpperCase();
    return clean === "OWNER" || clean === "ADMIN";
  }

  function findActiveAdminSession() {
    const candidates = [];
    const keys = [ADMIN_SESSION_KEY, GENERIC_SESSION_KEY, EMPLOYEE_SESSION_KEY];
    const storages = [localStorage, sessionStorage];

    storages.forEach(function (storage) {
      keys.forEach(function (key) {
        const session = parseStored(storage, key);
        if (session && sessionToken(session)) candidates.push({ key: key, session: session });
      });
    });

    return candidates.find(function (item) {
      return item.key === ADMIN_SESSION_KEY && isAdminRole(sessionRole(item.session));
    }) || candidates.find(function (item) {
      return isAdminRole(sessionRole(item.session));
    }) || null;
  }

  function syncAdminSession() {
    const active = findActiveAdminSession();
    if (!active) return null;

    const session = Object.assign({}, active.session);
    const token = sessionToken(session);
    const user = Object.assign({}, sessionUser(session));
    const role = String(user.role || session.role || "").trim().toUpperCase();

    if (!token || !isAdminRole(role)) return null;

    user.role = role;
    session.token = token;
    session.sessionToken = token;
    session.user = user;
    session.role = role;
    session.loginAt = session.loginAt || new Date().toISOString();

    const serialized = JSON.stringify(session);
    try {
      localStorage.setItem(ADMIN_SESSION_KEY, serialized);
      localStorage.setItem(GENERIC_SESSION_KEY, serialized);
    } catch (error) {}

    return session;
  }

  syncAdminSession();
  window.addEventListener("pageshow", syncAdminSession);

  const currentFile = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();

  const sidebar = document.querySelector("[data-admin-sidebar]");
  if (sidebar) {
    Array.prototype.slice.call(sidebar.querySelectorAll("a[href]")).forEach(function (link) {
      const href = String(link.getAttribute("href") || "").split("#")[0].split("?")[0].toLowerCase();
      const isSoa = currentFile === "statement_of_account.html" || currentFile === "statement_of_account_v3.html";
      const active = href === currentFile || (isSoa && (href === "statement_of_account.html" || href === "statement_of_account_v3.html"));
      link.classList.toggle("is-active", active);
      if (active) {
        const group = link.closest(".nav-group");
        if (group) {
          group.classList.add("is-open");
          const toggle = group.querySelector(".nav-toggle");
          if (toggle) toggle.classList.add("is-active");
        }
      }
    });
  }

  function loadSupabaseLibrary() {
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

      const existing = document.querySelector('script[data-techgeek-supabase-lib]');
      if (existing) {
        existing.addEventListener("load", createClient, { once: true });
        existing.addEventListener("error", function () { reject(new Error("Unable to load Supabase library.")); }, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      script.async = true;
      script.dataset.techgeekSupabaseLib = "1";
      script.onload = createClient;
      script.onerror = function () { reject(new Error("Unable to load Supabase library.")); };
      document.head.appendChild(script);
    });
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");
  }

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function activeFamilyCount(rows) {
    return (rows || []).filter(function (row) {
      return normalize(row.account_status).indexOf("active") === 0;
    }).length;
  }

  async function fetchClientRows() {
    const db = await loadSupabaseLibrary();
    const auth = await db.auth.getSession();
    if (auth.error) throw auth.error;
    if (!auth.data || !auth.data.session) throw new Error("Supabase login session not found.");

    const result = await db
      .from("clients")
      .select("id,account_no,client_name,account_status,service_status,plan,speed,installer_technician,updated_at")
      .order("updated_at", { ascending: false })
      .limit(1000);

    if (result.error) throw result.error;
    return result.data || [];
  }

  function applyDashboard(rows) {
    const totalEl = document.querySelector("#totalClients");
    const activeEl = document.querySelector("#activeClients");
    const pipelineEl = document.querySelector("#clientRows");

    if (totalEl) totalEl.textContent = rows.length.toLocaleString();
    if (activeEl) activeEl.textContent = activeFamilyCount(rows).toLocaleString();

    if (totalEl && totalEl.parentElement) {
      const small = totalEl.parentElement.querySelector("small");
      if (small) small.textContent = "Supabase client records";
    }
    if (activeEl && activeEl.parentElement) {
      const small = activeEl.parentElement.querySelector("small");
      if (small) small.textContent = "All Active account variants";
    }

    if (pipelineEl) {
      const recent = rows.slice(0, 8);
      pipelineEl.innerHTML = recent.length ? recent.map(function (row) {
        const planSpeed = [row.plan, row.speed].filter(Boolean).join(" / ");
        const status = row.account_status || row.service_status || "-";
        return "<tr>" +
          "<td>" + esc(row.account_no) + "</td>" +
          "<td>" + esc(row.client_name) + "</td>" +
          "<td>" + esc(planSpeed || "-") + "</td>" +
          "<td>" + esc(row.installer_technician || "-") + "</td>" +
          '<td><span class="status">' + esc(status) + "</span></td>" +
        "</tr>";
      }).join("") : '<tr><td colspan="5">No client records available.</td></tr>';
    }
  }

  function applyClientsMetric(rows) {
    const activeEl = document.querySelector("#activeClients");
    if (activeEl) activeEl.textContent = activeFamilyCount(rows).toLocaleString();
    if (activeEl && activeEl.parentElement) {
      const small = activeEl.parentElement.querySelector("small");
      if (small) small.textContent = "Active + Active free + Active by Request";
    }
  }

  if (currentFile === "dashboard.html" || currentFile === "clients.html") {
    fetchClientRows().then(function (rows) {
      if (currentFile === "dashboard.html") applyDashboard(rows);
      if (currentFile === "clients.html") applyClientsMetric(rows);
    }).catch(function (error) {
      console.warn("TechGeekPH Supabase page sync failed:", error && error.message ? error.message : error);
    });
  }
})();