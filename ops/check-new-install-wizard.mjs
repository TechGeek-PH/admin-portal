// Read-only regression guard for the Technician Tickets New Installation page.
// No Supabase credentials or production data are used.
import { readFileSync } from "node:fs";
import { Script } from "node:vm";

const html = readFileSync(new URL("../app-tickets.html", import.meta.url), "utf8");
const inlineScripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1].trim())
  .filter(Boolean);

if (!inlineScripts.length) throw new Error("No inline Technician Tickets JavaScript found.");
for (const [index, code] of inlineScripts.entries()) {
  try {
    new Script(code, { filename: `app-tickets-inline-${index}.js` });
  } catch (error) {
    throw new Error(`Technician Tickets inline JS syntax failure: ${error.message}`);
  }
}

const required = [
  "async function loadFinancialPreview()",
  "async function completeInstall()",
  "get_new_install_financial_preview",
  "complete_new_install_wizard",
  "proratedPaymentStatus",
  "savePaymentChoice",
  "sel.disabled=true",
  "Payment status cannot be confirmed until the prorated calculation loads.",
  "money(f.cashout_amount??800)"
];
for (const marker of required) {
  if (!html.includes(marker)) throw new Error(`Missing required wizard behavior: ${marker}`);
}
if (html.includes("Number(f.cashout_amount||800)") || html.includes("money(f.cashout_amount||800)")) {
  throw new Error("A zero installation cashout must not be replaced with ₱800.");
}
console.log("Technician New Installation wizard syntax and core integration guards PASS.");
