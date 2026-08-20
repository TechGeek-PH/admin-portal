// TechGeekPH Admin Portal - Supabase browser client
// Publishable key only. Never place service_role or secret keys in this file.
(function () {
  "use strict";

  const SUPABASE_URL = "https://tcexzfztdgximrzuosqs.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8H8_S7NTWvzPCLvYUe2C4g_k3Ltjfiz";

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("Supabase JS library is not loaded.");
    return;
  }

  window.TechGeekSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

  window.TechGeekSupabaseConfig = {
    url: SUPABASE_URL,
    keyType: "publishable"
  };
})();

// Clients page enhancement: manual Messenger binding test.
// This is intentionally separate from the billing reminder queue so a test click
// cannot create or retry billing reminders.
(function () {
  "use strict";

  function isClientsPage() {
    return /(^|\/)clients\.html$/i.test(window.location.pathname) || /(^|\/)clients$/i.test(window.location.pathname);
  }

  if (!isClientsPage()) return;

  const TEST_ENDPOINT = "https://tcexzfztdgximrzuosqs.supabase.co/functions/v1/messenger-binding-test";

  function showClientNotice(message, type) {
    const notice = document.getElementById("notice");
    if (!notice) return;
    notice.textContent = message;
    notice.className = "notice" + (type ? " " + type : "");
    notice.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function decorateBindingCards() {
    const list = document.getElementById("messengerBindings");
    if (!list) return;

    list.querySelectorAll(".binding-card").forEach(function (card) {
      const head = card.querySelector(".binding-card-head");
      if (!head || head.querySelector("[data-binding-test-btn]")) return;

      const removeButton = head.querySelector('button[data-bind-action="remove"]');
      const button = document.createElement("button");
      button.type = "button";
      button.className = "small-btn";
      button.setAttribute("data-binding-test-btn", "1");

      const linkId = String(card.dataset.linkId || "").trim();
      if (!linkId) {
        button.textContent = "Save First";
        button.disabled = true;
        button.title = "Save this Messenger binding before sending a test message.";
      } else {
        button.textContent = "Send Test Message";
        button.title = "Send one manual binding test. This does not use the billing reminder queue.";
      }

      if (removeButton) head.insertBefore(button, removeButton);
      else head.appendChild(button);
    });
  }

  async function sendBindingTest(button) {
    const db = window.TechGeekSupabase;
    const card = button.closest(".binding-card");
    const linkId = String(card && card.dataset ? card.dataset.linkId || "" : "").trim();
    const accountNo = String((document.getElementById("accountNo") || {}).value || "").trim();

    if (!db) {
      showClientNotice("Unable to send binding test: Supabase client is not available.", "error");
      return;
    }
    if (!linkId) {
      showClientNotice("Save the Facebook/Messenger binding first, then click Send Test Message.", "error");
      return;
    }
    if (!accountNo) {
      showClientNotice("Open the client record first so the Account # can be verified before testing.", "error");
      return;
    }

    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = "Sending...";

    try {
      const sessionResult = await db.auth.getSession();
      if (sessionResult.error) throw sessionResult.error;
      const session = sessionResult.data && sessionResult.data.session;
      if (!session || !session.access_token) throw new Error("Your admin session expired. Please sign in again.");

      const response = await fetch(TEST_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + session.access_token
        },
        body: JSON.stringify({
          action: "SEND_TEST",
          link_id: Number(linkId),
          account_no: accountNo
        })
      });

      let data = {};
      try { data = await response.json(); } catch (_) { data = {}; }

      if (!response.ok || !data.ok) {
        throw new Error(data.message || "Messenger binding test could not be sent.");
      }

      if (data.sent) {
        showClientNotice("Messenger binding test sent successfully for account " + accountNo + ". No billing reminder was created.", "ok");
      } else if (data.triggered) {
        showClientNotice("Messenger binding test flow triggered for account " + accountNo + ". Check the client's Messenger conversation to confirm delivery. No billing reminder was created.", "ok");
      } else {
        showClientNotice("Messenger binding test request completed for account " + accountNo + ". Check Messenger to confirm delivery.", "ok");
      }
    } catch (error) {
      showClientNotice("Unable to send Messenger binding test: " + (error && error.message ? error.message : "Unknown error"), "error");
    } finally {
      button.disabled = false;
      button.textContent = oldText || "Send Test Message";
    }
  }

  function setupBindingTestEnhancement() {
    const list = document.getElementById("messengerBindings");
    if (!list) {
      window.setTimeout(setupBindingTestEnhancement, 250);
      return;
    }

    decorateBindingCards();

    const observer = new MutationObserver(function () {
      decorateBindingCards();
    });
    observer.observe(list, { childList: true, subtree: true });

    list.addEventListener("click", function (event) {
      const button = event.target.closest("button[data-binding-test-btn]");
      if (!button || button.disabled) return;
      event.preventDefault();
      event.stopPropagation();
      sendBindingTest(button);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupBindingTestEnhancement, { once: true });
  } else {
    setupBindingTestEnhancement();
  }
})();
