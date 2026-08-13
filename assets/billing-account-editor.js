(function () {
  "use strict";

  const SUPABASE_URL = "https://tcexzfztdgximrzuosqs.supabase.co";
  const SUPABASE_KEY = "sb_publishable_8H8_S7NTWvzPCLvYUe2C4g_k3Ltjfiz";

  if (!window.supabase || typeof window.supabase.createClient !== "function") return;

  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const allowed = new Set(["ACTIVE", "PENDING", "EXPIRED", "DISCONNECTED"]);
  const saving = new Set();

  function norm(value) {
    return String(value == null ? "" : value).trim().toUpperCase();
  }

  function showMessage(message, ok) {
    const notice = document.querySelector("#notice");
    if (!notice) return;
    notice.textContent = message;
    notice.className = "notice show" + (ok ? " ok" : "");
  }

  function toneFor(tag) {
    const n = norm(tag);
    if (n === "ACTIVE") return "active";
    if (n === "PENDING") return "pending";
    if (n === "EXPIRED") return "expired";
    if (n === "DISCONNECTED") return "disconnected";
    return "";
  }

  async function bestEffortServiceStatus(account, tag) {
    const n = norm(tag);
    if (n !== "ACTIVE" && n !== "DISCONNECTED") return;

    const serviceStatus = n === "ACTIVE" ? "Active" : "Disconnected";
    const result = await db
      .from("clients")
      .update({ service_status: serviceStatus })
      .eq("account_no", account);

    if (result.error) {
      console.warn("Account tag saved; service_status was not changed:", result.error);
    }
  }

  async function skipDisconnectedReminders(account) {
    const result = await db
      .from("billing_notification_queue")
      .update({
        status: "SKIPPED",
        processing_started_at: null,
        context_loaded_at: null,
        next_attempt_at: null,
        last_error: "Skipped because account was tagged Disconnected after device pullout."
      })
      .eq("account_no", account)
      .in("status", ["PENDING", "FAILED"]);

    if (result.error) console.warn("Disconnected tag saved; queue update failed:", result.error);
  }

  async function saveTag(select) {
    const account = String(select.dataset.account || "").trim();
    const next = String(select.value || "").trim();
    const previous = String(select.dataset.current || "").trim() || next;

    if (!account || !allowed.has(norm(next)) || saving.has(account)) return;

    saving.add(account);
    select.disabled = true;

    try {
      const result = await db
        .from("clients")
        .update({ account_status: next })
        .eq("account_no", account)
        .select("account_no,account_status,service_status")
        .maybeSingle();

      if (result.error) throw result.error;
      if (!result.data) throw new Error("Account tag was not updated. Check Supabase update permission.");

      select.dataset.current = next;
      select.dataset.tone = toneFor(next);

      await bestEffortServiceStatus(account, next);
      if (norm(next) === "DISCONNECTED") await skipDisconnectedReminders(account);

      showMessage(account + " account tag changed to " + next + ".", true);

      window.setTimeout(function () {
        window.location.reload();
      }, 350);
    } catch (error) {
      select.value = previous;
      showMessage(error.message || "Unable to update account tag.", false);
    } finally {
      saving.delete(account);
      select.disabled = false;
    }
  }

  // Capture Account Tag changes before billing.html's older confirmation handler.
  document.addEventListener("change", function (event) {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    if (!target.classList.contains("tag-select")) return;
    if (target.classList.contains("billing-status-select")) return;
    if (!target.dataset.account) return;

    event.stopImmediatePropagation();
    saveTag(target);
  }, true);
})();
