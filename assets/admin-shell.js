(function () {
  "use strict";

  const ADMIN_SESSION_KEY = "techgeekph_admin_session";
  const GENERIC_SESSION_KEY = "techgeekph_session";
  const EMPLOYEE_SESSION_KEY = "techgeekph_employee_session";
  const SUPABASE_URL = "https://tcexzfztdgximrzuosqs.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8H8_S7NTWvzPCLvYUe2C4g_k3Ltjfiz";
  const currentFile = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();

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

  const sidebar = document.querySelector("[data-admin-sidebar]");
  if (sidebar) {
    Array.prototype.slice.call(sidebar.querySelectorAll("a[href]")).forEach(function (link) {
      let href = String(link.getAttribute("href") || "").split("#")[0].split("?")[0].toLowerCase();

      if (href === "statement_of_account.html") {
        link.setAttribute("href", "statement_of_account_v3.html");
        href = "statement_of_account_v3.html";
      }

      const isSoa = currentFile === "statement_of_account.html" || currentFile === "statement_of_account_v3.html";
      const active = href === currentFile || (isSoa && href === "statement_of_account_v3.html");
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
        existing.addEventListener("error", function () {
          reject(new Error("Unable to load Supabase library."));
        }, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      script.async = true;
      script.dataset.techgeekSupabaseLib = "1";
      script.onload = createClient;
      script.onerror = function () {
        reject(new Error("Unable to load Supabase library."));
      };
      document.head.appendChild(script);
    });
  }

  async function getDb() {
    const db = await loadSupabaseLibrary();
    const auth = await db.auth.getSession();
    if (auth.error) throw auth.error;
    if (!auth.data || !auth.data.session) throw new Error("Supabase login session not found.");
    return db;
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function activeFamilyCount(rows) {
    return (rows || []).filter(function (row) {
      return normalize(row.account_status).indexOf("active") === 0;
    }).length;
  }

  function isOpenTicket(status) {
    return ["pending", "assigned", "on going", "ongoing", "for checking"].indexOf(normalize(status)) !== -1;
  }

  function localIsoDate() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function currentUserName() {
    const session = syncAdminSession() || {};
    const user = sessionUser(session);
    return user.name || user.fullName || user.email || session.email || "Portal User";
  }

  async function fetchClientRows(full) {
    const db = await getDb();
    let select = "id,account_no,client_name,account_status,service_status,plan,speed,installer_technician,updated_at";
    if (full) {
      select = "id,account_no,client_name,account_status,service_status,phone,email,rd_blk,service_address,permanent_address,google_maps_link,monthly_bill,due_day,plan,speed,installer_technician,updated_at";
    }

    const result = await db
      .from("clients")
      .select(select)
      .order("updated_at", { ascending: false })
      .limit(1000);

    if (result.error) throw result.error;
    return result.data || [];
  }

  async function fetchTicketRows() {
    const db = await getDb();
    const result = await db
      .from("support_tickets")
      .select("*")
      .order("created_date", { ascending: false })
      .order("ticket_no", { ascending: false })
      .limit(1000);

    if (result.error) throw result.error;
    return result.data || [];
  }

  function applyDashboardClients(rows) {
    const totalEl = document.querySelector("#totalClients");
    const activeEl = document.querySelector("#activeClients");
    const pipelineEl = document.querySelector("#clientRows");

    if (totalEl && totalEl.textContent !== String(rows.length)) totalEl.textContent = rows.length.toLocaleString();
    if (activeEl && activeEl.textContent !== String(activeFamilyCount(rows))) activeEl.textContent = activeFamilyCount(rows).toLocaleString();

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
      const html = recent.length ? recent.map(function (row) {
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

      if (pipelineEl.innerHTML !== html) pipelineEl.innerHTML = html;
    }
  }

  function applyDashboardTickets(rows) {
    const openEl = document.querySelector("#openTickets");
    const ticketRowsEl = document.querySelector("#ticketRows");
    const openCount = rows.filter(function (row) { return isOpenTicket(row.status); }).length;

    if (openEl) openEl.textContent = openCount.toLocaleString();
    if (openEl && openEl.parentElement) {
      const small = openEl.parentElement.querySelector("small");
      if (small) small.textContent = "Live Supabase open work queue";
    }

    if (ticketRowsEl) {
      const latest = rows.slice(0, 8);
      const html = latest.length ? latest.map(function (row) {
        return "<tr>" +
          "<td>" + esc(row.ticket_no) + "</td>" +
          "<td>" + esc(row.client_name || "-") + "</td>" +
          "<td>" + esc(row.ticket_type || "-") + "</td>" +
          "<td>" + esc(row.assigned_tech || "-") + "</td>" +
          '<td><span class="status">' + esc(row.status || "Pending") + "</span></td>" +
        "</tr>";
      }).join("") : '<tr><td colspan="5">No ticket records available.</td></tr>';

      if (ticketRowsEl.innerHTML !== html) ticketRowsEl.innerHTML = html;
    }
  }

  function keepDashboardSupabaseLive(clientRows, ticketRows) {
    function apply() {
      applyDashboardClients(clientRows);
      applyDashboardTickets(ticketRows);
    }

    apply();
    [800, 1800, 3500, 6000, 10000].forEach(function (delay) {
      window.setTimeout(apply, delay);
    });
  }

  function applyClientsMetric(rows) {
    const activeEl = document.querySelector("#activeClients");
    if (!activeEl) return;

    const expected = activeFamilyCount(rows).toLocaleString();
    if (activeEl.textContent !== expected) activeEl.textContent = expected;

    if (activeEl.parentElement) {
      const small = activeEl.parentElement.querySelector("small");
      if (small) small.textContent = "Active + Active free + Active by Request";
    }

    const observer = new MutationObserver(function () {
      if (activeEl.textContent !== expected) activeEl.textContent = expected;
    });
    observer.observe(activeEl, { childList: true, characterData: true, subtree: true });
  }

  const ticketState = {
    tickets: [],
    clients: [],
    selectedClient: null
  };

  function ticketNotice(message, type) {
    const el = document.querySelector("#notice");
    if (!el) return;
    el.textContent = message || "";
    el.classList.remove("is-hidden", "ok", "error");
    if (!message) el.classList.add("is-hidden");
    if (type === "ok") el.classList.add("ok");
    if (type === "error") el.classList.add("error");
  }

  function ticketStatusClass(status) {
    const text = normalize(status).replace(/\s+/g, "");
    if (text === "pending") return "pending";
    if (text === "assigned") return "assigned";
    if (text === "ongoing") return "ongoing";
    if (text === "forchecking") return "checking";
    if (text === "done") return "done";
    if (text === "cancelled" || text === "canceled") return "cancelled";
    return "";
  }

  function ticketActionButton(label, action, ticketNo, className) {
    return '<button class="small-btn ' + esc(className || "") + '" type="button" data-ticket-action="' + esc(action) + '" data-ticket-id="' + esc(ticketNo) + '">' + esc(label) + '</button>';
  }

  function ticketActions(row) {
    const status = normalize(row.status);
    if (status === "done") return '<span class="status-pill done">Resolved</span>';
    if (status === "cancelled" || status === "canceled") return '<span class="status-pill cancelled">Cancelled</span>';

    const buttons = [];
    if (!status || status === "pending") buttons.push(ticketActionButton("Take", "takeTicket", row.ticket_no, "take-btn"));
    if (status === "assigned") buttons.push(ticketActionButton("Start", "startTicket", row.ticket_no, "start-btn"));
    if (status === "on going" || status === "ongoing") {
      buttons.push(ticketActionButton("For Checking", "forCheckingTicket", row.ticket_no, "check-btn"));
      buttons.push(ticketActionButton("Resolve", "resolveTicket", row.ticket_no, "resolve-btn"));
    }
    if (status === "for checking") buttons.push(ticketActionButton("Resolve", "resolveTicket", row.ticket_no, "resolve-btn"));
    buttons.push(ticketActionButton("Cancel", "cancelTicket", row.ticket_no, "cancel-btn"));
    return '<div class="ticket-update-actions">' + buttons.join("") + '</div>';
  }

  function ticketSearchText(row) {
    return [row.ticket_no, row.client_account_no, row.client_name, row.contact_number, row.ticket_type,
      row.issue_purpose, row.assigned_tech, row.status, row.priority].map(function (v) {
        return String(v || "");
      }).join(" ").toLowerCase();
  }

  function filteredTicketRows() {
    const searchEl = document.querySelector("#searchInput");
    const statusEl = document.querySelector("#statusFilter");
    const q = normalize(searchEl && searchEl.value);
    const status = normalize(statusEl && statusEl.value);

    return ticketState.tickets.filter(function (row) {
      return (!q || ticketSearchText(row).indexOf(q) !== -1) &&
        (!status || normalize(row.status) === status);
    });
  }

  function renderTicketMetrics() {
    const total = document.querySelector("#metricTotal");
    const open = document.querySelector("#metricOpen");
    const done = document.querySelector("#metricDone");
    const urgent = document.querySelector("#metricUrgent");

    if (total) total.textContent = ticketState.tickets.length.toLocaleString();
    if (open) open.textContent = ticketState.tickets.filter(function (r) { return isOpenTicket(r.status); }).length.toLocaleString();
    if (done) done.textContent = ticketState.tickets.filter(function (r) { return normalize(r.status) === "done"; }).length.toLocaleString();
    if (urgent) urgent.textContent = ticketState.tickets.filter(function (r) {
      return normalize(r.priority) === "urgent" || normalize(r.priority) === "high";
    }).length.toLocaleString();
  }

  function renderTicketQueue() {
    renderTicketMetrics();
    const tbody = document.querySelector("#ticketRows");
    if (!tbody) return;

    const rows = filteredTicketRows();
    if (!rows.length) {
      tbody.innerHTML = '<tr><td data-label="Status" colspan="12">No tickets found.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(function (row) {
      return "<tr>" +
        '<td data-label="Ticket ID">' + esc(row.ticket_no) + "</td>" +
        '<td data-label="Date Created">' + esc(row.created_date || "") + "</td>" +
        '<td data-label="Account #">' + esc(row.client_account_no || "") + "</td>" +
        '<td data-label="Client">' + esc(row.client_name || "") + "</td>" +
        '<td data-label="Phone">' + esc(row.contact_number || "") + "</td>" +
        '<td data-label="Ticket Type">' + esc(row.ticket_type || "") + "</td>" +
        '<td data-label="Issue / Purpose" class="issue-cell">' + esc(row.issue_purpose || "") + "</td>" +
        '<td data-label="Priority">' + esc(row.priority || "Normal") + "</td>" +
        '<td data-label="Assigned Tech">' + esc(row.assigned_tech || "") + "</td>" +
        '<td data-label="Status"><span class="status-pill ' + ticketStatusClass(row.status) + '">' + esc(row.status || "Pending") + "</span></td>" +
        '<td data-label="Schedule Date">' + esc(row.schedule_date || "") + "</td>" +
        '<td data-label="Action">' + ticketActions(row) + "</td>" +
      "</tr>";
    }).join("");
  }

  function ticketClientSearchText(row) {
    return [row.account_no, row.client_name, row.phone, row.rd_blk, row.service_address]
      .map(function (v) { return String(v || ""); }).join(" ").toLowerCase();
  }

  function renderTicketClientOptions() {
    const searchEl = document.querySelector("#clientSearchInput");
    const selectEl = document.querySelector("#existingClientSelect");
    if (!selectEl) return;

    const q = normalize(searchEl && searchEl.value);
    const current = selectEl.value;
    const rows = ticketState.clients.filter(function (row) {
      return !q || ticketClientSearchText(row).indexOf(q) !== -1;
    }).slice(0, 300);

    selectEl.innerHTML = '<option value="">Select existing client</option>' + rows.map(function (row) {
      const label = [row.account_no, row.client_name, row.rd_blk, row.phone].filter(Boolean).join(" - ");
      return '<option value="' + esc(row.account_no) + '">' + esc(label) + '</option>';
    }).join("");

    if (current && rows.some(function (row) { return row.account_no === current; })) selectEl.value = current;
  }

  function ticketMoney(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "-";
    return "₱ " + number.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function ticketClientInfo(label, value, isHtml) {
    return '<div class="client-info-item"><span>' + esc(label) + '</span><strong>' +
      (isHtml ? value : esc(value == null || value === "" ? "-" : value)) + '</strong></div>';
  }

  function setTicketSelectedClient(row) {
    ticketState.selectedClient = row || null;
    const preview = document.querySelector("#clientPreview");
    const oldClientId = document.querySelector("#oldClientId");
    const oldClientName = document.querySelector("#oldClientName");
    const oldContact = document.querySelector("#oldContactNumber");
    const oldAddress = document.querySelector("#oldAddress");

    if (!row) {
      if (oldClientId) oldClientId.value = "";
      if (oldClientName) oldClientName.value = "";
      if (oldContact) oldContact.value = "";
      if (oldAddress) oldAddress.value = "";
      if (preview) preview.innerHTML = '<p class="notice">Select existing client para lumabas dito ang Account #, Name, RD/BLK, Phone, Bill / Month, Due Date, Service Address, at Google Maps Link.</p>';
      return;
    }

    if (oldClientId) oldClientId.value = row.account_no || "";
    if (oldClientName) oldClientName.value = row.client_name || "";
    if (oldContact) oldContact.value = row.phone || "";
    if (oldAddress) oldAddress.value = row.service_address || "";

    if (preview) {
      const mapsHtml = row.google_maps_link
        ? '<a href="' + esc(row.google_maps_link) + '" target="_blank" rel="noopener">Open Maps</a>'
        : "-";

      preview.innerHTML = '<div class="client-preview-grid">' +
        ticketClientInfo("Account #", row.account_no) +
        ticketClientInfo("Name", row.client_name) +
        ticketClientInfo("RD/BLK", row.rd_blk) +
        ticketClientInfo("Phone", row.phone) +
        ticketClientInfo("Bill / Month", ticketMoney(row.monthly_bill)) +
        ticketClientInfo("Due Date", row.due_day) +
        ticketClientInfo("Service Address", row.service_address) +
        ticketClientInfo("Google Maps Link", mapsHtml, true) +
      '</div>';
    }
  }

  async function loadTicketPageData() {
    ticketNotice("Loading tickets from Supabase...");
    try {
      const data = await Promise.all([fetchTicketRows(), fetchClientRows(true)]);
      ticketState.tickets = data[0];
      ticketState.clients = data[1];
      renderTicketQueue();
      renderTicketClientOptions();
      ticketNotice("");
    } catch (error) {
      ticketState.tickets = [];
      ticketState.clients = [];
      renderTicketQueue();
      renderTicketClientOptions();
      ticketNotice("Unable to load Supabase tickets: " + (error && error.message ? error.message : "Unknown error"), "error");
    }
  }

  function nextTicketNo(rows) {
    let max = 0;
    (rows || []).forEach(function (row) {
      const match = String(row.ticket_no || "").match(/^TKT-(\d+)$/i);
      if (match) max = Math.max(max, Number(match[1]) || 0);
    });
    return "TKT-" + String(max + 1).padStart(4, "0");
  }

  function ticketAdminRemarks(formData) {
    const lines = [];
    const rdBlk = String(formData.get("rdBlk") || "").trim();
    const maps = String(formData.get("googleMapsLink") || "").trim();
    if (rdBlk) lines.push("RD/BLK: " + rdBlk);
    if (maps) lines.push("Google Maps: " + maps);
    return lines.length ? lines.join("\n") : null;
  }

  async function submitSupabaseTicket(form) {
    const button = form.querySelector('button[type="submit"]');
    const oldText = button ? button.textContent : "";
    if (button) {
      button.disabled = true;
      button.textContent = "Saving...";
    }

    try {
      const db = await getDb();
      const latestTickets = await fetchTicketRows();
      ticketState.tickets = latestTickets;
      const fd = new FormData(form);
      const isOldConcern = form.id === "oldConcernForm";
      const selected = isOldConcern ? ticketState.selectedClient : null;

      if (isOldConcern && !selected) throw new Error("Please select an existing client first.");

      const accountNo = isOldConcern
        ? selected.account_no
        : String(fd.get("clientId") || "").trim() || null;

      const matchedClient = accountNo
        ? ticketState.clients.find(function (row) { return normalize(row.account_no) === normalize(accountNo); }) || null
        : null;

      const payload = {
        ticket_no: nextTicketNo(latestTickets),
        created_date: localIsoDate(),
        client_id: isOldConcern ? selected.id : (matchedClient ? matchedClient.id : null),
        client_account_no: accountNo,
        client_name: isOldConcern ? selected.client_name : String(fd.get("clientName") || "").trim(),
        contact_number: isOldConcern ? selected.phone : String(fd.get("contactNumber") || "").trim() || null,
        address: isOldConcern ? selected.service_address : String(fd.get("address") || "").trim() || null,
        ticket_type: String(fd.get("ticketType") || (isOldConcern ? "Repair" : "Installation")).trim(),
        issue_purpose: String(fd.get("issuePurpose") || "").trim() || null,
        priority: String(fd.get("priority") || "Normal").trim(),
        assigned_tech: String(fd.get("assignedTech") || "").trim() || null,
        status: "Pending",
        schedule_date: String(fd.get("scheduleDate") || "").trim() || null,
        photo_link: null,
        tech_remarks: null,
        admin_remarks: isOldConcern ? null : ticketAdminRemarks(fd),
        created_by: currentUserName()
      };

      if (!payload.client_name) throw new Error("Client Name is required.");
      if (isOldConcern && !payload.issue_purpose) throw new Error("Concern / Issue is required.");

      ticketNotice("Saving ticket to Supabase...");
      const result = await db.from("support_tickets").insert(payload).select("*").single();
      if (result.error) throw result.error;

      form.reset();
      if (isOldConcern) {
        const select = document.querySelector("#existingClientSelect");
        if (select) select.value = "";
        setTicketSelectedClient(null);
      }

      ticketNotice("Ticket " + result.data.ticket_no + " saved successfully.", "ok");
      await loadTicketPageData();
    } catch (error) {
      ticketNotice("Unable to save ticket: " + (error && error.message ? error.message : "Unknown error"), "error");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = oldText;
      }
    }
  }

  async function updateSupabaseTicket(action, ticketNo) {
    const row = ticketState.tickets.find(function (item) { return item.ticket_no === ticketNo; });
    if (!row) {
      ticketNotice("Ticket not found.", "error");
      return;
    }

    const actionNames = {
      takeTicket: "take this ticket",
      startTicket: "start this ticket",
      forCheckingTicket: "mark this ticket for checking",
      resolveTicket: "resolve this ticket",
      cancelTicket: "cancel this ticket"
    };

    if (!window.confirm("Proceed to " + (actionNames[action] || "update this ticket") + "?")) return;

    const changes = {};
    if (action === "takeTicket") {
      changes.status = "Assigned";
      if (!row.assigned_tech) changes.assigned_tech = currentUserName();
    }
    if (action === "startTicket") {
      changes.status = "On Going";
      changes.tech_remarks = "Work started.";
    }
    if (action === "forCheckingTicket") {
      changes.status = "For Checking";
      changes.tech_remarks = window.prompt("Tech remarks / checking notes:", "For checking / verification.") || "For checking / verification.";
    }
    if (action === "resolveTicket") {
      changes.status = "Done";
      changes.tech_remarks = window.prompt("Resolution remarks:", "Resolved.") || "Resolved.";
    }
    if (action === "cancelTicket") {
      changes.status = "Cancelled";
      changes.tech_remarks = window.prompt("Reason for cancellation:", "Cancelled.") || "Cancelled.";
    }

    try {
      ticketNotice("Updating ticket in Supabase...");
      const db = await getDb();
      const result = await db.from("support_tickets").update(changes).eq("ticket_no", ticketNo).select("*").single();
      if (result.error) throw result.error;
      ticketNotice("Ticket updated successfully.", "ok");
      await loadTicketPageData();
    } catch (error) {
      ticketNotice("Unable to update ticket: " + (error && error.message ? error.message : "Unknown error"), "error");
    }
  }

  async function signOutPortal() {
    try {
      const db = await loadSupabaseLibrary();
      await db.auth.signOut();
    } catch (error) {}

    [ADMIN_SESSION_KEY, GENERIC_SESSION_KEY, EMPLOYEE_SESSION_KEY, "techgeekph_client_session"].forEach(function (key) {
      try { localStorage.removeItem(key); } catch (error) {}
      try { sessionStorage.removeItem(key); } catch (error) {}
    });
    window.location.href = "index.html";
  }

  document.addEventListener("click", function (event) {
    const logout = event.target.closest("#logoutBtn");
    if (logout) {
      event.preventDefault();
      event.stopImmediatePropagation();
      signOutPortal();
      return;
    }

    if (currentFile !== "tickets.html") return;

    const action = event.target.closest("button[data-ticket-action]");
    if (action) {
      event.preventDefault();
      event.stopImmediatePropagation();
      updateSupabaseTicket(action.dataset.ticketAction, action.dataset.ticketId);
      return;
    }

    const refresh = event.target.closest("#refreshBtn");
    if (refresh) {
      event.preventDefault();
      event.stopImmediatePropagation();
      loadTicketPageData();
      return;
    }

    const clear = event.target.closest("#clearSelectedClientBtn");
    if (clear) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const search = document.querySelector("#clientSearchInput");
      const select = document.querySelector("#existingClientSelect");
      if (search) search.value = "";
      if (select) select.value = "";
      renderTicketClientOptions();
      setTicketSelectedClient(null);
    }
  }, true);

  if (currentFile === "tickets.html") {
    document.addEventListener("submit", function (event) {
      const form = event.target;
      if (!form || (form.id !== "newInstallForm" && form.id !== "oldConcernForm")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      submitSupabaseTicket(form);
    }, true);

    document.addEventListener("input", function (event) {
      if (event.target && event.target.id === "searchInput") {
        event.stopImmediatePropagation();
        renderTicketQueue();
      }
      if (event.target && event.target.id === "clientSearchInput") {
        event.stopImmediatePropagation();
        renderTicketClientOptions();
      }
    }, true);

    document.addEventListener("change", function (event) {
      if (!event.target) return;
      if (event.target.id === "statusFilter") {
        event.stopImmediatePropagation();
        renderTicketQueue();
      }
      if (event.target.id === "existingClientSelect") {
        event.stopImmediatePropagation();
        const accountNo = event.target.value;
        const row = ticketState.clients.find(function (client) {
          return normalize(client.account_no) === normalize(accountNo);
        }) || null;
        setTicketSelectedClient(row);
      }
    }, true);

    loadTicketPageData();
  }

  if (currentFile === "dashboard.html") {
    Promise.all([fetchClientRows(false), fetchTicketRows()]).then(function (data) {
      keepDashboardSupabaseLive(data[0], data[1]);
    }).catch(function (error) {
      console.warn("TechGeekPH dashboard Supabase sync failed:", error && error.message ? error.message : error);
    });
  }

  if (currentFile === "clients.html") {
    fetchClientRows(false).then(function (rows) {
      applyClientsMetric(rows);
    }).catch(function (error) {
      console.warn("TechGeekPH clients metric sync failed:", error && error.message ? error.message : error);
    });
  }
})();