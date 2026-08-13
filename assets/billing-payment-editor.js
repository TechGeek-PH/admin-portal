(function () {
  "use strict";

  const SUPABASE_URL = "https://tcexzfztdgximrzuosqs.supabase.co";
  const SUPABASE_KEY = "sb_publishable_8H8_S7NTWvzPCLvYUe2C4g_k3Ltjfiz";
  const BILLING_MESSENGER_URL = SUPABASE_URL + "/functions/v1/billing-messenger";
  const EDITOR_VERSION = "20260813-8";

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

  function formatMoney(value) {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP"
    }).format(Number(value || 0));
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
    if (!notice) return;
    notice.textContent = message;
    notice.className = "notice show" + (ok ? " ok" : "");
  }

  function styleSelect(select, status) {
    select.style.width = "100%";
    select.style.minHeight = "34px";
    select.style.border = "1px solid " + (status === "PAID" ? "#9fd4c2" : "#efb1c2");
    select.style.borderRadius = "7px";
    select.style.padding = "6px 8px";
    select.style.background = status === "PAID" ? "#f2fbf7" : "#fff5f7";
    select.style.color = status === "PAID" ? "#116447" : "#8f1838";
    select.style.fontSize = ".7rem";
    select.style.fontWeight = "800";
  }

  function styleConfirmationButton(button) {
    button.type = "button";
    button.style.minHeight = "30px";
    button.style.padding = "5px 8px";
    button.style.border = "1px solid #9fd4c2";
    button.style.borderRadius = "7px";
    button.style.background = "#f2fbf7";
    button.style.color = "#116447";
    button.style.fontSize = ".64rem";
    button.style.fontWeight = "800";
    button.style.cursor = "pointer";
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

  function syncVisibleAccountTags(account, tag) {
    document.querySelectorAll("#rows tr").forEach(function (row) {
      if (getAccountNo(row) !== account || !row.cells || row.cells.length < 9) return;
      const tagSelect = row.cells[8] && row.cells[8].querySelector(".tag-select");
      if (!tagSelect) return;

      const allowed = ["Active", "Pending", "Expired", "Disconnected"];
      if (!allowed.some(function (x) { return normalize(x) === normalize(tag); })) return;

      tagSelect.value = tag;
      tagSelect.dataset.current = tag;
      tagSelect.dataset.tone = normalize(tag).toLowerCase();
      const tagNote = row.cells[8].querySelector(".tag-note");
      if (tagNote) tagNote.textContent = "Editable account tag";
    });
  }

  async function setAccountActive(account) {
    const result = await db
      .from("clients")
      .update({ account_status: "Active" })
      .eq("account_no", account)
      .select("account_no,account_status,service_status")
      .maybeSingle();

    if (result.error) throw result.error;
    if (!result.data) throw new Error("Bill was saved, but the Account Tag could not be changed to Active.");

    const serviceResult = await db
      .from("clients")
      .update({ service_status: "Active" })
      .eq("account_no", account);
    if (serviceResult.error) {
      console.warn("Account tag changed to Active, but service_status could not be changed:", serviceResult.error);
    }

    return result.data;
  }

  async function queuePaymentConfirmation(billingId) {
    const sessionResult = await db.auth.getSession();
    if (sessionResult.error) throw sessionResult.error;
    const accessToken = sessionResult.data && sessionResult.data.session
      ? sessionResult.data.session.access_token
      : "";
    if (!accessToken) throw new Error("Session expired. Please sign in again before sending payment confirmation.");

    const response = await fetch(BILLING_MESSENGER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + accessToken,
        "apikey": SUPABASE_KEY
      },
      body: JSON.stringify({
        action: "QUEUE_PAYMENT_CONFIRMATION",
        billing_id: billingId
      })
    });

    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok || data.ok === false) {
      throw new Error(data.message || ("Payment confirmation request failed (HTTP " + response.status + ")."));
    }
    return data;
  }

  async function sendConfirmationNow(billingId, account, note, button) {
    if (!billingId) return;
    if (button) button.disabled = true;
    if (note) note.textContent = "Paid — sending confirmation…";

    try {
      const confirmation = await queuePaymentConfirmation(billingId);
      if (confirmation.triggered) {
        if (note) note.textContent = "Paid — confirmation triggered";
        showMessage(account + " payment confirmation was triggered to Messenger.", true);
      } else if (confirmation.code === "NO_VERIFIED_MESSENGER_MAPPING") {
        if (note) note.textContent = "Paid — no Messenger mapping";
        showMessage(account + " is Paid, but no verified Messenger mapping was found.", false);
      } else if (confirmation.already_in_progress_or_sent) {
        if (note) note.textContent = "Paid — confirmation already queued/sent";
        showMessage(account + " payment confirmation is already in progress or was already sent. Duplicate send was blocked.", true);
      } else if (confirmation.code === "DEFERRED_RECIPIENT_BUSY") {
        if (note) note.textContent = "Paid — confirmation queued";
        showMessage(account + " payment confirmation is queued and will send after the current Messenger job finishes.", true);
      } else {
        if (note) note.textContent = "Paid — confirmation queued";
        showMessage(account + " payment confirmation was queued.", true);
      }
      return confirmation;
    } catch (error) {
      console.warn("Payment confirmation could not be triggered:", error);
      if (note) note.textContent = "Paid — confirmation needs review";
      showMessage(account + " is Paid, but Messenger confirmation could not be triggered: " + (error.message || error), false);
      throw error;
    } finally {
      if (button) button.disabled = false;
    }
  }

  function makeEditor(row, billingId, ledger) {
    const status = currentPaymentStatus(ledger, row);
    const account = getAccountNo(row);
    const wrap = document.createElement("div");
    wrap.className = "billing-payment-editor tag-editor";
    wrap.dataset.editorVersion = EDITOR_VERSION;

    const select = document.createElement("select");
    select.className = "billing-status-select";
    select.dataset.billingId = billingId;
    select.dataset.account = account;
    select.dataset.previous = status;
    select.innerHTML =
      '<option value="UNPAID">Unpaid</option>' +
      '<option value="PAID">Paid</option>';
    select.value = status;
    styleSelect(select, status);

    const note = document.createElement("span");
    note.className = "tag-note";
    note.textContent = status === "PAID"
      ? "Paid — account Active"
      : "Editable for personal/cash payments";

    const sendButton = document.createElement("button");
    sendButton.className = "billing-send-confirmation";
    sendButton.textContent = "Send Confirmation";
    styleConfirmationButton(sendButton);
    sendButton.hidden = status !== "PAID";

    select.addEventListener("change", function (event) {
      event.stopPropagation();
      updateBillingStatus(row, select, note, sendButton);
    });

    sendButton.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      sendConfirmationNow(billingId, account, note, sendButton).catch(function () {});
    });

    wrap.appendChild(select);
    wrap.appendChild(note);
    wrap.appendChild(sendButton);
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
      await setAccountActive(account);
      if (tagSelect) {
        tagSelect.innerHTML =
          '<option value="Active">Active</option>' +
          '<option value="Pending">Pending</option>' +
          '<option value="Expired">Expired</option>' +
          '<option value="Disconnected">Disconnected</option>';
        syncVisibleAccountTags(account, "Active");
      }
    } catch (error) {
      console.warn("Unable to repair invalid account tag for " + account, error);
    } finally {
      repairingAccounts.delete(account);
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
        const existing = cell && cell.querySelector(".billing-payment-editor");
        if (cell && (!existing || existing.dataset.editorVersion !== EDITOR_VERSION)) {
          cell.innerHTML = "";
          cell.appendChild(makeEditor(row, billingId, ledger));
        }
        repairInvalidAccountTag(row, paymentStatus);
      });
    } finally {
      decorating = false;
    }
  }

  function updateVisibleBillingRow(row, status, amountDue) {
    if (!row || !row.cells || row.cells.length < 8) return;
    if (status === "PAID") {
      row.cells[5].textContent = formatMoney(amountDue);
      row.cells[6].textContent = formatMoney(0);
    } else {
      row.cells[5].textContent = formatMoney(0);
      row.cells[6].textContent = formatMoney(amountDue);
    }
  }

  function notifyPage(detail) {
    document.dispatchEvent(new CustomEvent("techgeek:billing-updated", { detail: detail || {} }));
  }

  async function updateBillingStatus(row, select, note, sendButton) {
    const billingId = select.dataset.billingId;
    const account = select.dataset.account;
    const previous = select.dataset.previous || "UNPAID";
    const next = select.value;
    const ledger = ledgerById.get(billingId) || {};
    const amountDue = rowAmountDue(row, ledger);

    if (next === previous) return;

    select.disabled = true;
    if (sendButton) sendButton.disabled = true;
    note.textContent = "Saving…";

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

      updateVisibleBillingRow(row, next, amountDue);

      if (next === "PAID") {
        await setAccountActive(account);
        syncVisibleAccountTags(account, "Active");

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
          .in("status", ["PENDING", "FAILED"])
          .neq("event_type", "PAYMENT_CONFIRMED");

        if (ledgerResult.data && Object.prototype.hasOwnProperty.call(ledgerResult.data, "billing_id")) {
          queueUpdate = queueUpdate.eq("billing_id", billingId);
        }
        const queueResult = await queueUpdate;
        if (queueResult.error) console.warn("Paid status saved, but reminder queue could not be updated:", queueResult.error);

        select.value = "PAID";
        select.dataset.previous = "PAID";
        styleSelect(select, "PAID");
        if (sendButton) {
          sendButton.hidden = false;
          sendButton.disabled = false;
        }

        try {
          await sendConfirmationNow(billingId, account, note, sendButton);
        } catch (_) {}
      } else {
        select.value = "UNPAID";
        select.dataset.previous = "UNPAID";
        styleSelect(select, "UNPAID");
        note.textContent = "Editable for personal/cash payments";
        if (sendButton) sendButton.hidden = true;
        showMessage(account + " changed to Unpaid. Full balance restored.", true);
      }

      notifyPage({
        account: account,
        billingId: billingId,
        status: next,
        amountDue: amountDue,
        amountPaid: next === "PAID" ? amountDue : 0,
        balance: next === "PAID" ? 0 : amountDue
      });
    } catch (error) {
      select.value = previous;
      styleSelect(select, previous);
      note.textContent = "Update failed";
      if (sendButton) sendButton.hidden = previous !== "PAID";
      showMessage(error.message || "Unable to update billing status.", false);
    } finally {
      select.disabled = false;
      if (sendButton) sendButton.disabled = false;
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