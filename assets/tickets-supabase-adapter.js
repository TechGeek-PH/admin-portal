(function () {
  "use strict";

  const APPS_SCRIPT_MARKER = "script.google.com/macros/s/AKfycbxDY5TsonrB58YaN8LGbrrrc_ZD1QVpF1WK0p6jToIR2FBSqGaHfsgaE1CCiH1MvukV/exec";
  const nativeFetch = window.fetch.bind(window);

  function jsonResponse(payload) {
    return Promise.resolve(new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }));
  }

  function currentPortalUserName() {
    try {
      const raw = localStorage.getItem("techgeekph_admin_session") || localStorage.getItem("techgeekph_session") || "{}";
      const session = JSON.parse(raw);
      const user = session.user || {};
      return user.fullName || user.name || user.email || session.email || "TechGeekPH Admin";
    } catch (error) {
      return "TechGeekPH Admin";
    }
  }

  function isoDate() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function mapTicket(row) {
    return {
      "TicketID": row.ticket_no || "",
      "ticketId": row.ticket_no || "",
      "Date Created": row.created_date || "",
      "dateCreated": row.created_date || "",
      "ClientID": row.client_account_no || "",
      "clientId": row.client_account_no || "",
      "Account No.": row.client_account_no || "",
      "Client Name": row.client_name || "",
      "clientName": row.client_name || "",
      "Contact Number": row.contact_number || "",
      "contactNumber": row.contact_number || "",
      "Address": row.address || "",
      "address": row.address || "",
      "Ticket Type": row.ticket_type || "",
      "ticketType": row.ticket_type || "",
      "Issue/Purpose": row.issue_purpose || "",
      "issuePurpose": row.issue_purpose || "",
      "Priority": row.priority || "Normal",
      "priority": row.priority || "Normal",
      "Assigned Tech": row.assigned_tech || "",
      "assignedTech": row.assigned_tech || "",
      "Status": row.status || "Pending",
      "status": row.status || "Pending",
      "Schedule Date": row.schedule_date || "",
      "scheduleDate": row.schedule_date || "",
      "Photo Link": row.photo_link || "",
      "Tech Remarks": row.tech_remarks || "",
      "techRemarks": row.tech_remarks || "",
      "Admin Remarks": row.admin_remarks || "",
      "adminRemarks": row.admin_remarks || "",
      "Created By": row.created_by || ""
    };
  }

  function mapClient(row) {
    return {
      "Account No.": row.account_no || "",
      "Account Number": row.account_no || "",
      "accountNo": row.account_no || "",
      "ClientID": row.account_no || "",
      "clientId": row.account_no || "",
      "Client Name": row.client_name || "",
      "clientName": row.client_name || "",
      "Phone Number": row.phone || "",
      "Contact Number": row.phone || "",
      "Phone": row.phone || "",
      "RD / BLK": row.rd_blk || "",
      "RD/BLK": row.rd_blk || "",
      "rdBlk": row.rd_blk || "",
      "Service Address": row.service_address || "",
      "serviceAddress": row.service_address || "",
      "Address": row.service_address || "",
      "Google Maps Link": row.google_maps_link || "",
      "googleMapsLink": row.google_maps_link || "",
      "Plan": row.plan || "",
      "plan": row.plan || "",
      "Speed": row.speed || "",
      "speed": row.speed || "",
      "Monthly Bill": row.monthly_bill == null ? "" : row.monthly_bill,
      "monthlyBill": row.monthly_bill == null ? "" : row.monthly_bill,
      "Due Date": row.due_day ? "Every " + row.due_day : "",
      "dueDate": row.due_day ? "Every " + row.due_day : "",
      "Landmark": row.landmark || "",
      "landmark": row.landmark || ""
    };
  }

  async function dbClient() {
    if (window.TechGeekSupabase) return window.TechGeekSupabase;
    if (window.supabase && typeof window.supabase.createClient === "function") {
      window.TechGeekSupabase = window.supabase.createClient(
        "https://tcexzfztdgximrzuosqs.supabase.co",
        "sb_publishable_8H8_S7NTWvzPCLvYUe2C4g_k3Ltjfiz",
        { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
      );
      return window.TechGeekSupabase;
    }
    throw new Error("Supabase client is unavailable.");
  }

  async function nextTicketNo(db) {
    const prefix = "TCKT-" + isoDate().replace(/-/g, "") + "-";
    const result = await db
      .from("support_tickets")
      .select("ticket_no")
      .like("ticket_no", prefix + "%")
      .order("ticket_no", { ascending: false })
      .limit(1);

    if (result.error) throw result.error;
    let next = 1;
    if (result.data && result.data[0] && result.data[0].ticket_no) {
      const match = String(result.data[0].ticket_no).match(/(\d+)$/);
      if (match) next = Number(match[1]) + 1;
    }
    return prefix + String(next).padStart(3, "0");
  }

  async function findClientByAccount(db, accountNo) {
    if (!String(accountNo || "").trim()) return null;
    const result = await db
      .from("clients")
      .select("id,account_no,client_name,phone,service_address")
      .eq("account_no", String(accountNo).trim())
      .maybeSingle();
    if (result.error) throw result.error;
    return result.data || null;
  }

  async function handleAction(url) {
    try {
      const parsed = new URL(url, window.location.href);
      const action = parsed.searchParams.get("action") || parsed.searchParams.get("method") || "";
      const db = await dbClient();

      if (action === "listTickets") {
        const result = await db
          .from("support_tickets")
          .select("*")
          .order("created_date", { ascending: false })
          .order("ticket_no", { ascending: false })
          .limit(1000);
        if (result.error) throw result.error;
        const rows = (result.data || []).map(mapTicket);
        return jsonResponse({ ok: true, success: true, data: rows, tickets: rows });
      }

      if (action === "listClients") {
        const result = await db
          .from("clients")
          .select("id,account_no,client_name,phone,service_address,rd_blk,landmark,google_maps_link,plan,speed,monthly_bill,due_day,updated_at")
          .order("updated_at", { ascending: false })
          .limit(1000);
        if (result.error) throw result.error;
        const rows = (result.data || []).map(mapClient);
        return jsonResponse({ ok: true, success: true, data: rows, clients: rows });
      }

      if (action === "saveTicket") {
        const accountNo = parsed.searchParams.get("clientId") || "";
        const client = await findClientByAccount(db, accountNo);
        const ticketNo = await nextTicketNo(db);
        const payload = {
          ticket_no: ticketNo,
          created_date: isoDate(),
          client_id: client ? client.id : null,
          client_account_no: accountNo || (client && client.account_no) || null,
          client_name: parsed.searchParams.get("clientName") || (client && client.client_name) || null,
          contact_number: parsed.searchParams.get("contactNumber") || (client && client.phone) || null,
          address: parsed.searchParams.get("address") || (client && client.service_address) || null,
          ticket_type: parsed.searchParams.get("ticketType") || "Repair",
          issue_purpose: parsed.searchParams.get("issuePurpose") || null,
          priority: parsed.searchParams.get("priority") || "Normal",
          assigned_tech: parsed.searchParams.get("assignedTech") || null,
          status: parsed.searchParams.get("status") || "Pending",
          schedule_date: parsed.searchParams.get("scheduleDate") || null,
          admin_remarks: parsed.searchParams.get("adminRemarks") || null,
          created_by: parsed.searchParams.get("createdBy") || currentPortalUserName(),
          updated_at: new Date().toISOString()
        };
        const result = await db.from("support_tickets").insert(payload).select("*").single();
        if (result.error) throw result.error;
        return jsonResponse({ ok: true, success: true, data: mapTicket(result.data), ticket: mapTicket(result.data) });
      }

      if (["takeTicket", "startTicket", "forCheckingTicket", "resolveTicket", "cancelTicket"].indexOf(action) !== -1) {
        const ticketNo = parsed.searchParams.get("ticketId") || "";
        if (!ticketNo) throw new Error("Ticket ID is required.");
        const updates = { updated_at: new Date().toISOString() };
        if (action === "takeTicket") {
          updates.status = "Assigned";
          updates.assigned_tech = currentPortalUserName();
        }
        if (action === "startTicket") updates.status = "On Going";
        if (action === "forCheckingTicket") updates.status = "For Checking";
        if (action === "resolveTicket") updates.status = "Done";
        if (action === "cancelTicket") updates.status = "Cancelled";
        const remarks = parsed.searchParams.get("techRemarks") || parsed.searchParams.get("remarks") || "";
        if (remarks) updates.tech_remarks = remarks;

        const result = await db
          .from("support_tickets")
          .update(updates)
          .eq("ticket_no", ticketNo)
          .select("*")
          .single();
        if (result.error) throw result.error;
        return jsonResponse({ ok: true, success: true, data: mapTicket(result.data), ticket: mapTicket(result.data) });
      }

      return jsonResponse({ ok: false, success: false, message: "Unsupported ticket action: " + action });
    } catch (error) {
      console.error("Tickets Supabase adapter error:", error);
      return jsonResponse({ ok: false, success: false, message: error && error.message ? error.message : "Ticket database error." });
    }
  }

  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url ? input.url : "");
    if (url.indexOf(APPS_SCRIPT_MARKER) !== -1) {
      return handleAction(url);
    }
    return nativeFetch(input, init);
  };

  window.TechGeekTicketsSupabaseAdapter = true;
})();
