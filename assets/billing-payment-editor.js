(function () {
  "use strict";

  const SUPABASE_URL = "https://tcexzfztdgximrzuosqs.supabase.co";
  const SUPABASE_KEY = "sb_publishable_8H8_S7NTWvzPCLvYUe2C4g_k3Ltjfiz";

  if (!window.supabase || typeof window.supabase.createClient !== "function") return;

  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const ledgerById = new Map();
  const repairingAccounts = new Set();
  let loading = false;
  let decorating = false;

  function normalize(value) {
    return String(value == null ? "" : value).trim().toUpperCase();
  }

  function parseMoney(value) {
    return Number(String(value == null ? "" : value).replace(/[^0-9.-]/g, "")) || 0;
  }

  function getBillingId(row) {
    const cell = row && row.cells && row.cells[2];
    if (!cell) return "";
    const strong = cell.querySelector("strong");
    return String((strong && strong.textContent) || cell.textContent || "").trim().split(/\s+/)[0];
  }

  function getAccountNo(row) {
    const account = row && row.querySelector(".account");
    return String((account && account.textContent) || "").trim();
  }

  function rowAmountDue(row, ledger) {
    const candidates = ["amount_due", "monthly_bill", "current_bill"];
    for (const key of candidates) {
      if (ledger && ledger[key] !== undefined && ledger[key] !== null && ledger[key] !== "") {
        return Number(ledger[key]) || 0;
      }
    }
    return row && row.cells && row.cells[4] ? parseMoney(row.cells[4].textContent) : 0;
  }

  function currentPaymentStatus(ledger, row) {
    if (ledger) {
      const direct = normalize(ledger.payment_status || ledger.billing_status || "");
      const due = Number(ledger.amount_due || ledger.monthly_bill || ledger.current_bill || 0) || 0;
      const paid = Number(ledger.amount_paid || 0) || 0;
      const bal = Number(ledger.balance != null ? ledger.balance : ledger.remaining_balance || 0) || 0;

      if (direct === "PAID" || direct === "SETTLED") return "PAID";
      if (due > 0 && paid >= due) return "PAID";
      if (due > 0 && bal <= 0) return "PAID";
    }

    const cell = row && row.cells && row.cells[7];
    return normalize(cell && cell.textContent).includes("PAID") ? "PAID" : "UNPAID";
  }

  function showMessage(message, ok) {
    const notice = document.querySelector("#notice");
    if (!notice) {
      window.alert(message);
      return;
    }
    notice.textContent = message;
    notice.className = "notice show" + (ok ? " ok" : "");
    notice.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function loadLedger() {
    if (loading) return;
    loading = true;
    try {
      const auth = await db.auth.getSession();
      if (auth.error) throw auth.error;
      if (!auth.data || !auth.data.session) return;

      const result = await db.from("billing_ledger").select("*").limit(2500);
      if (result.error) throw result.error;
      ledgerById.clear();
      (result.data || []).forEach(function (row) {
        const id = String(row.billing_id || row.id || "").trim();
        if (id) ledgerById.set(id, row);
      });
      decorate();
    } catch (error) {
      console.error("Billing payment editor load failed:", error);
    } finally {
      loading = false;
    }
  }

  function makeEditor(row, billingId, ledger) {
    const status = currentPaymentStatus(ledger, row);
    const wrap = document.createElement("div");
    wrap.className = "billing-payment-editor tag-editor";

    const select = document.createElement("select");
    // Do NOT share the generic .tag-select class with Account Tag.
    select.className = "billing-status-select";
    select.dataset.billingId = billingId;
    select.dataset.account = getAccountNo(row);
    select.dataset.previous = status;
    select.innerHTML =
      '<option value="UNPAID">Unpaid</option>' +
      '<option value="PAID">Paid</option>';
    select.value = status;

    select.style.width = "100%";
    select.style.minHeight = "34px";
    select.style.border = "1px solid " + (status === "PAID" ? "#9fd4c2" : "#efb1c2");
    select.style.borderRadius = "7px";
    select.style.padding = "6px 8px";
    select.style.background = status === "PAID" ? "#f2fbf7" : "#fff5f7";
    select.style.color = status === "PAID" ? "#116447" : "#8f1838";
    select.style.fontSize = ".7rem";
    select.style.fontWeight = "800";

    const note = document.createElement("span");
    note.className = "tag-note";
    note.textContent = status === "PAID"
      ? "Paid — account should be Active"
      : "Editable for personal/cash payments";

    select.addEventListener("change", function (event) {
      event.stopPropagation();
      updateBillingStatus(row, select, note);
    });

    wrap.appendChild(select);
    wrap.appendChild(note);
    return wrap;
  }

  async function repairInvalidAccountTag(row, paymentStatus) {
    if (paymentStatus !== "PAID" || !row || !row.cells || row.cells.length < 9) return;
    const account = getAccountNo(row);
    if (!account || repairingAccounts.has(account)) return;

    const tagSelect = row.cells[8] && row.cells[8].querySelector(".tag-select");
    const badTag = normalize(tagSelect && tagSelect.value);
    if (badTag !== "PAID" && badTag !== "UNPAID") return;

    repairingAccounts.add(account);
    try {
      const result = await db
        .from("clients")
        .update({ account_status: "Active", service_status: "Active" })
        .eq("account_no", account)
        .select("account_no")
        .maybeSingle();
      if (result.error) throw result.error;
      if (tagSelect) {
        tagSelect.innerHTML =
          '<option value="Active">Active</option>' +
          '<option value="Pending">Pending</option>' +
          '<option value="Expired">Expired</option>' +
          '<option value="Disconnected">Disconnected</option>';
        tagSelect.value = "Active";
        tagSelect.dataset.current = "Active";
        tagSelect.dataset.tone = "active";
      }
      console.info("Repaired invalid billing-derived account tag for", account);
    } catch (error) {
      console.warn("Unable to repair invalid account tag for " + account, error);
    }
  }

  function decorate() {
    if (decorating) return;
    decorating = true;
    try {
      document.querySelectorAll("#rows tr").forEach(function (row) {
        if (!row.cells || row.cells.length < 10) return;
        const billingId = getBillingId(row);
        if (!billingId) return;
        const ledger = ledgerById.get(billingId);
        const paymentStatus = currentPaymentStatus(ledger, row);
        const cell = row.cells[7];
        if (cell && !cell.querySelector(".billing-payment-editor")) {
          cell.innerHTML = "";
          cell.appendChild(makeEditor(row, billingId, ledger));
        }
        repairInvalidAccountTag(row, paymentStatus);
      });
    } finally {
      decorating = false;
    }
  }

  async function updateBillingStatus(row, select, note) {
    const billingId = select.dataset.billingId;
    const account = select.dataset.account;
    const previous = select.dataset.previous || "UNPAID";
    const next = select.value;
    const ledger = ledgerById.get(billingId) || {};
    const amountDue = rowAmountDue(row, ledger);

    if (next === previous) return;

    if (next === "PAID") {
      const confirmed = window.confirm(
        "Mark " + account + " / " + billingId + " as PAID?\n\n" +
        "Use this when payment was personally received/cash. The bill balance will become ₱0, pending reminders for this bill will be stopped, and the client account will automatically be set to Active."
      );
      if (!confirmed) {
        select.value = previous;
        return;
      }
    } else {
      const confirmed = window.confirm(
        "Change " + account + " / " + billingId + " back to UNPAID?\n\n" +
        "This will reset Amount Paid for this bill to ₱0 and restore the full bill balance. The account tag will NOT be disconnected automatically, and old reminders will NOT be automatically re-sent."
      );
      if (!confirmed) {
        select.value = previous;
        return;
      }
    }

    select.disabled = true;
    note.textContent = "Saving to Supabase…";

    try {
      const patch = {};
      if (Object.prototype.hasOwnProperty.call(ledger, "amount_paid")) patch.amount_paid = next === "PAID" ? amountDue : 0;
      if (Object.prototype.hasOwnProperty.call(ledger, "balance")) patch.balance = next === "PAID" ? 0 : amountDue;
      if (Object.prototype.hasOwnProperty.call(ledger, "remaining_balance")) patch.remaining_balance = next === "PAID" ? 0 : amountDue;
      if (Object.prototype.hasOwnProperty.call(ledger, "payment_status")) patch.payment_status = next;
      if (Object.prototype.hasOwnProperty.call(ledger, "billing_status")) patch.billing_status = next;

      if (next === "PAID") {
        const today = new Date().toISOString().slice(0, 10);
        if (Object.prototype.hasOwnProperty.call(ledger, "date_paid")) patch.date_paid = today;
        const nowIso = new Date().toISOString();
        if (Object.prototype.hasOwnProperty.call(ledger, "last_payment_date")) patch.last_payment_date = nowIso;
        if (Object.prototype.hasOwnProperty.call(ledger, "paid_at")) patch.paid_at = nowIso;
      } else if (Object.prototype.hasOwnProperty.call(ledger, "date_paid")) {
        patch.date_paid = null;
      }

      if (!Object.keys(patch).length) throw new Error("Billing Ledger payment columns were not detected.");

      let ledgerUpdate = db.from("billing_ledger").update(patch);
      if (ledger.billing_id !== undefined) ledgerUpdate = ledgerUpdate.eq("billing_id", billingId);
      else ledgerUpdate = ledgerUpdate.eq("id", billingId);

      const ledgerResult = await ledgerUpdate.select("*").maybeSingle();
      if (ledgerResult.error) throw ledgerResult.error;
      if (!ledgerResult.data) throw new Error("Billing record was not updated. Check Supabase update permission.");
      ledgerById.set(billingId, ledgerResult.data);

      if (next === "PAID") {
        const clientResult = await db
          .from("clients")
          .update({ account_status: "Active", service_status: "Active" })
          .eq("account_no", account)
          .select("account_no")
          .maybeSingle();
        if (clientResult.error) throw clientResult.error;

        let queueUpdate = db
          .from("billing_notification_queue")
          .update({
            status: "SKIPPED",
            processing_started_at: null,
            context_loaded_at: null,
            next_attempt_at: null,
            last_error: "Skipped because billing was manually marked Paid from Billing Control."
          })
          .eq("account_no", account)
          .in("status", ["PENDING", "FAILED"]);

        if (ledgerResult.data && Object.prototype.hasOwnProperty.call(ledgerResult.data, "billing_id")) {
          queueUpdate = queueUpdate.eq("billing_id", billingId);
        }
        const queueResult = await queueUpdate;
        if (queueResult.error) console.warn("Paid status saved, but reminder queue could not be updated:", queueResult.error);

        showMessage(account + " marked PAID. Account automatically changed to Active and pending reminders for this bill were stopped.", true);
      } else {
        showMessage(account + " changed back to UNPAID. Full balance restored. Old reminders were not automatically requeued.", true);
      }

      select.dataset.previous = next;
      window.setTimeout(function () {
        const url = new URL(window.location.href);
        url.searchParams.set("refresh", Date.now().toString());
        window.location.replace(url.toString());
      }, 700);
    } catch (error) {
      select.value = previous;
      select.disabled = false;
      note.textContent = "Update failed";
      showMessage(error.message || "Unable to update billing status.", false);
    }
  }

  const rows = document.querySelector("#rows");
  if (rows) {
    const observer = new MutationObserver(function () {
      window.setTimeout(decorate, 0);
    });
    observer.observe(rows, { childList: true, subtree: true });
  }

  loadLedger();
  window.setInterval(decorate, 1500);
})();
