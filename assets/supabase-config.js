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
