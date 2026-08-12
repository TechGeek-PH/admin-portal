(function() {
  "use strict";

  const BUILD_KEY = "20260812-supabase-v1";
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
      return item.key === ADMIN_SESSION_KEY && isAdminRole(sessionRole(item.session));
    }) || candidates.find(function(item) {
      return isAdminRole(sessionRole(item.session));
    }) || null;
  }

  function syncAdminSession() {
    const active = findActiveAdminSession();
    if (!active) return null;

    const normalized = normalizeAdminSession(active.session);
    if (!normalized || !isAdminRole(sessionRole(normalized))) return null;

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

  const activeSession = syncAdminSession();
  window.addEventListener("pageshow", syncAdminSession);

  const currentFile = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  const currentSearch = String(window.location.search || "");

  if (currentFile === "statement_of_account.html" && currentSearch.indexOf("build=" + BUILD_KEY) === -1) {
    window.location.replace("statement_of_account_v3.html");
    return;
  }

  const sidebar = document.querySelector("[data-admin-sidebar]");
  if (sidebar) {
    const links = Array.prototype.slice.call(sidebar.querySelectorAll("a[href]"));

    links.forEach(function(link) {
      const rawHref = String(link.getAttribute("href") || "");
      const cleanHref = rawHref.split("#")[0].split("?")[0].toLowerCase();

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
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  async function fetchClientSummaryRows() {
    const session = syncAdminSession() || activeSession;
    const token = sessionToken(session);
    if (!token) throw new Error("Missing Supabase login session.");

    const select = [
      "id",
      "account_no",
      "client_name",
      "account_status",
      "service_status",
      "plan",
      "speed",
      "installer_technician",
      "updated_at"
    ].join(",");

    const url = SUPABASE_URL + "/rest/v1/clients?select=" + encodeURIComponent(select) +
      "&order=updated_at.desc.nullslast&limit=1000";

    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: "Bearer " + token,
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error("Supabase client summary request failed (" + response.status + ").");
    }

    return response.json();
  }

  function countActiveFamily(rows) {
    return (rows || []).filter(function(row) {
      return normalize(row.account_status).indexOf("active") === 0;
    }).length;
  }

  function applyClientsActiveMetric(rows) {
    if (currentFile !== "clients.html") return;
    const activeEl = document.querySelector("#activeClients");
    if (activeEl) activeEl.textContent = countActiveFamily(rows).toLocaleString();
  }

  function applyDashboardClients(rows) {
    if (currentFile !== "dashboard.html") return;

    const totalEl = document.querySelector("#totalClients");
    const activeEl = document.querySelector("#activeClients");
    const clientRowsEl = document.querySelector("#clientRows");

    if (totalEl) totalEl.textContent = (rows || []).length.toLocaleString();
    if (activeEl) activeEl.textContent = countActiveFamily(rows).toLocaleString();

    if (totalEl) {
      const small = totalEl.parentElement && totalEl.parentElement.querySelector("small");
      if (small) small.textContent = "Supabase client records";
    }

    if (activeEl) {
      const small = activeEl.parentElement && activeEl.parentElement.querySelector("small");
      if (small) small.textContent = "Active, Active free, and Active by Request";
    }

    if (clientRowsEl) {
      const recent = (rows || []).slice(0, 8);
      if (!recent.length) {
        clientRowsEl.innerHTML = '<tr><td colspan="5">No client records available.</td></tr>';
      } else {
        clientRowsEl.innerHTML = recent.map(function(row) {
          const status = row.account_status || row.service_status || "";
          const planSpeed = [row.plan, row.speed].filter(Boolean).join(" / ");
          return "<tr>" +
            "<td>" + escapeHtml(row.account_no) + "</td>" +
            "<td>" + escapeHtml(row.client_name) + "</td>" +
            "<td>" + escapeHtml(planSpeed) + "</td>" +
            "<td>" + escapeHtml(row.installer_technician || "-") + "</td>" +
            '<td><span class="status">' + escapeHtml(status || "-") + "</span></td>" +
          "</tr>";
        }).join("");
      }
    }
  }

  if (currentFile === "dashboard.html" || currentFile === "clients.html") {
    fetchClientSummaryRows().then(function(rows) {
      applyClientsActiveMetric(rows);
      applyDashboardClients(rows);

      if (currentFile === "dashboard.html") {
        [1200, 3000, 6000].forEach(function(delay) {
          window.setTimeout(function() {
            applyDashboardClients(rows);
          }, delay);
        });
      }
    }).catch(function(error) {
      console.warn("Supabase summary enhancement skipped:", error && error.message ? error.message : error);
    });
  }
})();
