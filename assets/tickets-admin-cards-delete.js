// TechGeekPH Tickets Admin UI enhancement.
// Converts ticket queue tables into responsive cards and adds secure Admin/Owner delete.
(function () {
  "use strict";

  if (!/(^|\/)tickets\.html$/i.test(window.location.pathname) || window.__tgTicketAdminCardsLoaded) return;
  window.__tgTicketAdminCardsLoaded = true;

  const SUPABASE_URL = "https://tcexzfztdgximrzuosqs.supabase.co";
  const SUPABASE_KEY = "sb_publishable_8H8_S7NTWvzPCLvYUe2C4g_k3Ltjfiz";

  function ensureStyles() {
    if (document.getElementById("tg-ticket-card-style")) return;
    const style = document.createElement("style");
    style.id = "tg-ticket-card-style";
    style.textContent = `
      #queuePane .table-wrap,#closedPane .table-wrap{overflow:visible!important;padding:12px;background:#f6f8fb}
      #queuePane table,#closedPane table{display:block!important;width:100%!important;min-width:0!important;border-collapse:separate!important}
      #queuePane thead,#closedPane thead{display:none!important}
      #queuePane tbody,#closedPane tbody{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:12px;width:100%}
      #queuePane tbody tr,#closedPane tbody tr{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 10px;position:relative;background:#fff;border:1px solid #dce4ed;border-left:5px solid #0b6ca8;border-radius:14px;padding:13px;box-shadow:0 7px 22px rgba(20,43,70,.06);overflow:hidden}
      #closedPane tbody tr{border-left-color:#17825f}
      #queuePane tbody td,#closedPane tbody td{display:block!important;min-width:0;padding:7px 5px!important;border:0!important;font-size:.72rem!important;line-height:1.38;overflow-wrap:anywhere;word-break:break-word}
      #queuePane tbody td::before,#closedPane tbody td::before{display:block;margin-bottom:3px;color:#748297;font-size:.55rem;font-weight:900;letter-spacing:.045em;text-transform:uppercase}
      #queuePane tbody td:nth-child(1)::before,#closedPane tbody td:nth-child(1)::before{content:"Ticket"}
      #queuePane tbody td:nth-child(2)::before,#closedPane tbody td:nth-child(2)::before{content:"Client"}
      #queuePane tbody td:nth-child(3)::before,#closedPane tbody td:nth-child(3)::before{content:"Category"}
      #queuePane tbody td:nth-child(4)::before,#closedPane tbody td:nth-child(4)::before{content:"Concern"}
      #queuePane tbody td:nth-child(5)::before,#closedPane tbody td:nth-child(5)::before{content:"Service Type"}
      #queuePane tbody td:nth-child(6)::before,#closedPane tbody td:nth-child(6)::before{content:"Priority"}
      #queuePane tbody td:nth-child(7)::before,#closedPane tbody td:nth-child(7)::before{content:"Assigned Tech"}
      #queuePane tbody td:nth-child(8)::before,#closedPane tbody td:nth-child(8)::before{content:"Status"}
      #queuePane tbody td:nth-child(9)::before,#closedPane tbody td:nth-child(9)::before{content:"Schedule"}
      #queuePane tbody td:nth-child(10)::before,#closedPane tbody td:nth-child(10)::before{content:"Resolution"}
      #queuePane tbody td:nth-child(11)::before,#closedPane tbody td:nth-child(11)::before{content:"Actions"}
      #queuePane tbody td:nth-child(1),#closedPane tbody td:nth-child(1),#queuePane tbody td:nth-child(2),#closedPane tbody td:nth-child(2),#queuePane tbody td:nth-child(4),#closedPane tbody td:nth-child(4),#queuePane tbody td:nth-child(11),#closedPane tbody td:nth-child(11){grid-column:1/-1}
      #queuePane tbody td:nth-child(1) b,#closedPane tbody td:nth-child(1) b{color:#064f83;font-size:.9rem!important}
      #queuePane .row-actions,#closedPane .row-actions{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;width:100%}
      #queuePane .row-actions .small,#closedPane .row-actions .small{min-height:38px!important;width:100%;border-radius:9px!important;font-size:.67rem!important}
      .tg-ticket-delete{border:1px solid #f0bdc8!important;background:#fff2f5!important;color:#a3153d!important}
      .tg-ticket-delete:disabled{opacity:.55;cursor:wait}
      #queuePane tbody tr:has(td.empty),#closedPane tbody tr:has(td.empty){display:block!important;grid-column:1/-1;border-left-width:1px;padding:0}
      #queuePane td.empty::before,#closedPane td.empty::before{display:none!important}
      @media(max-width:620px){#queuePane tbody,#closedPane tbody{grid-template-columns:1fr}#queuePane tbody tr,#closedPane tbody tr{grid-template-columns:1fr}#queuePane tbody td,#closedPane tbody td{grid-column:1/-1!important}#queuePane .row-actions,#closedPane .row-actions{grid-template-columns:1fr 1fr}.tg-ticket-delete{grid-column:1/-1}}
    `;
    document.head.appendChild(style);
  }

  function notice(message, error) {
    const box = document.getElementById("notice");
    if (!box) return;
    box.textContent = message;
    box.className = "notice show" + (error ? " err" : "");
    if (!error) window.setTimeout(function () {
      if (box.textContent === message) box.className = "notice";
    }, 4500);
  }

  function getDb() {
    if (window.TechGeekSupabase) return window.TechGeekSupabase;
    if (window.supabase && typeof window.supabase.createClient === "function") {
      window.TechGeekSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
      return window.TechGeekSupabase;
    }
    return null;
  }

  async function deleteTicket(button) {
    const id = Number(button.dataset.deleteTicket || 0);
    const row = button.closest("tr");
    const ticketNo = row && row.querySelector("td:first-child b") ? row.querySelector("td:first-child b").textContent.trim() : "this ticket";
    if (!id) return notice("Unable to identify the ticket to delete.", true);

    const ok = window.confirm("Delete " + ticketNo + " permanently?\n\nThis will also remove its technician checklist. This cannot be undone.");
    if (!ok) return;

    const db = getDb();
    if (!db) return notice("Database connection is unavailable. Refresh the app and try again.", true);

    button.disabled = true;
    button.textContent = "Deleting…";
    try {
      const result = await db.rpc("admin_delete_support_ticket", { p_ticket_id: id });
      if (result.error) throw result.error;
      notice(ticketNo + " deleted successfully.", false);
      const refresh = document.getElementById("refreshBtn");
      if (refresh) refresh.click();
      else window.location.reload();
    } catch (error) {
      notice("Unable to delete ticket: " + (error && error.message ? error.message : "Unknown error"), true);
      button.disabled = false;
      button.textContent = "Delete";
    }
  }

  function enhanceRows() {
    [document.getElementById("activeRows"), document.getElementById("closedRows")].forEach(function (body) {
      if (!body) return;
      body.querySelectorAll("tr").forEach(function (row) {
        const edit = row.querySelector("[data-edit]");
        const actions = row.querySelector(".row-actions");
        if (!edit || !actions || actions.querySelector(".tg-ticket-delete")) return;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "small tg-ticket-delete";
        button.textContent = "Delete";
        button.dataset.deleteTicket = edit.dataset.edit;
        button.addEventListener("click", function () { deleteTicket(button); });
        actions.appendChild(button);
      });
    });
  }

  function setup() {
    ensureStyles();
    enhanceRows();
    const targets = [document.getElementById("activeRows"), document.getElementById("closedRows")].filter(Boolean);
    targets.forEach(function (target) {
      new MutationObserver(enhanceRows).observe(target, { childList: true, subtree: true });
    });
    window.setInterval(enhanceRows, 1500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup, { once: true });
  else setup();
})();
