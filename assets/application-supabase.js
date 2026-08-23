// TechGeekPH Application Form Supabase core loader.
// Reuses the proven form/database implementation while routing all client-master
// changes through a secured SECURITY DEFINER RPC for employee field forms.
(function () {
  "use strict";

  if (!/(^|\/)application_form\.html$/i.test(window.location.pathname)) return;

  const LEGACY_BUILD = "aa669f71fc242f8dcf04ca76fb38f0fc41e1e1ed";
  const CORE_URL = "https://cdn.jsdelivr.net/gh/TechGeek-PH/admin-portal@" + LEGACY_BUILD + "/assets/application-supabase.js";

  function installCore(source) {
    let code = String(source || "");

    // Field employees use these forms as part of assigned installation/repair work.
    code = code.replace(
      '["OWNER", "ADMIN"].indexOf(String(profile.role || "").toUpperCase()) === -1',
      '["OWNER", "ADMIN", "EMPLOYEE"].indexOf(String(profile.role || "").toUpperCase()) === -1'
    );
    code = code.replace(
      'This account is not authorized to save admin forms.',
      'This account is not authorized to save field service forms.'
    );

    // Dedicated app modules hide/lock the Form Type control. A disabled select is
    // excluded from FormData, so restore the correct mode from the module URL.
    const formDataNeedle = [
      '    fd.forEach(function (value, key) {',
      '      if (value instanceof File) return;',
      '      data[key] = value;',
      '    });',
      '',
      '    const terms = $("#termsAccepted");'
    ].join('\n');
    const formDataReplacement = [
      '    fd.forEach(function (value, key) {',
      '      if (value instanceof File) return;',
      '      data[key] = value;',
      '    });',
      '',
      '    const tgRequestedForm = String(new URLSearchParams(window.location.search).get("form") || "").toLowerCase();',
      '    if (tgRequestedForm) {',
      '      data["Form Type"] = tgRequestedForm.indexOf("repair") !== -1 ? "Repair" :',
      '        (tgRequestedForm.indexOf("relocation") !== -1 ? "Relocation" : "New Application");',
      '      data["Record Type"] = data["Form Type"];',
      '    }',
      '',
      '    const terms = $("#termsAccepted");'
    ].join('\n');
    if (code.indexOf(formDataNeedle) === -1) {
      throw new Error("Application core patch failed: FormData block not found.");
    }
    code = code.replace(formDataNeedle, formDataReplacement);

    // The old core directly INSERT/UPDATEs public.clients. That is intentionally
    // blocked by RLS for employees. Sync the client master through the secured RPC
    // first, then let the proven core save the form record, files, and support ticket.
    const clientSyncNeedle = [
      '      const accountNo = String(data["Account No."] || "").trim();',
      '      let client = await findClient(ctx.db, accountNo);',
      '      if (normalize(data["Form Type"]).indexOf("new application") !== -1 && accountNo) {',
      '        showNotice("Saving application and syncing client account...");',
      '        client = await syncNewApplicationClient(ctx.db, data, client);',
      '      }',
      '',
      '      const submissionPayload = {'
    ].join('\n');
    const clientSyncReplacement = [
      '      const accountNo = String(data["Account No."] || "").trim();',
      '      let client = await findClient(ctx.db, accountNo);',
      '      showNotice("Saving form and syncing client account...");',
      '      const tgClientSync = await ctx.db.rpc("staff_sync_client_master_from_form", { p_data: data });',
      '      if (tgClientSync.error) throw tgClientSync.error;',
      '      if (tgClientSync.data && tgClientSync.data.client_id) {',
      '        client = Object.assign({}, client || {}, {',
      '          id: tgClientSync.data.client_id,',
      '          account_no: tgClientSync.data.account_no || accountNo',
      '        });',
      '      }',
      '',
      '      const submissionPayload = {'
    ].join('\n');
    if (code.indexOf(clientSyncNeedle) === -1) {
      throw new Error("Application core patch failed: client sync block not found.");
    }
    code = code.replace(clientSyncNeedle, clientSyncReplacement);

    const script = document.createElement("script");
    script.textContent = code + "\n//# sourceURL=application-supabase-core.js";
    script.dataset.techgeekApplicationSupabaseCore = "1";
    document.head.appendChild(script);
  }

  fetch(CORE_URL, { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) throw new Error("Application database core HTTP " + response.status);
      return response.text();
    })
    .then(installCore)
    .catch(function (error) {
      console.error("Unable to load TechGeekPH Application Form database core:", error && error.message ? error.message : error);
      const notice = document.getElementById("notice");
      if (notice) {
        notice.textContent = "Unable to load the Application Form database module. Please refresh the app and try again.";
        notice.classList.remove("is-hidden", "ok");
        notice.classList.add("error");
      }
    });
})();
