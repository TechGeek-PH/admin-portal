(function () {
  "use strict";

  if (!window.supabase || typeof window.supabase.createClient !== "function") return;
  if (window.__techgeekBillingUnpaidResetLoaded) return;
  window.__techgeekBillingUnpaidResetLoaded = true;

  const db = window.supabase.createClient(
    "https://tcexzfztdgximrzuosqs.supabase.co",
    "sb_publishable_8H8_S7NTWvzPCLvYUe2C4g_k3Ltjfiz",
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
  );
  const running = new Set();

  function notice(message, ok) {
    const el = document.querySelector("#notice");
    if (!el) return;
    el.textContent = message;
    el.className = "notice show" + (ok ? " ok" : "");
  }

  document.addEventListener("techgeek:billing-updated", async function (event) {
    const detail = event.detail || {};
    if (String(detail.status || "").toUpperCase() !== "UNPAID") return;

    const billingId = String(detail.billingId || "").trim();
    const account = String(detail.account || "").trim();
    if (!billingId || running.has(billingId)) return;

    running.add(billingId);
    try {
      const result = await db.rpc("reset_billing_payment_state", {
        p_billing_id: billingId
      });
      if (result.error) throw result.error;
      notice((account || billingId) + " changed to Unpaid. Balance restored and payment history for this billing period was reset.", true);
    } catch (error) {
      console.error("Payment history reset failed:", error);
      notice((account || billingId) + " is Unpaid, but payment history reset needs review: " + (error.message || error), false);
    } finally {
      running.delete(billingId);
    }
  });
})();