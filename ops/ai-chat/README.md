# TechGeekPH AI Client Chat Support and Telegram Approvals

## Deployment (2026-11-01)
- Supabase project: TechGeekPH-Portal (tcexzfztdgximrzuosqs).
- Deployed Edge Functions: `tg-ai-chat-worker` (service-only), `tg-ai-support-admin` (Owner/Admin JWT), updated `client-chat-send` and `telegram-create-new-install-ticket`.
- Public Client Portal already uses `client-chat-send`; incoming messages asynchronously trigger the isolated worker.
- Admin page: `ai-chat-settings.html`, linked from `telegram-settings.html`.
- DB: `tg_ai_support_settings` and `tg_ai_chat_requests` with RLS enabled, no client-side privileges.

## Requirements
Set the OpenAI API key as a **Supabase Edge Functions secret** named `OPENAI_API_KEY`. Never store it in GitHub, browser code, or database public tables. The function uses the OpenAI Responses API with `gpt-4.1-mini`. ChatGPT Plus does not provide a backend API key.

If no key is configured, known troubleshooting/promotional/billing messages use safe predefined text and the worker routes conversations for staff. Full generative AI replies are **not** available until this secret is present.

An enabled Telegram private chat receiver and bot token are already configured in the admin `telegram-settings.html`. Approval callback requests must come from the configured private admin, carry the exact Telegram message ID and an unguessable one-use nonce, and have a non-expired, pending DB record.

## Guardrails
- The assistant identifies itself as `TechGeekPH Virtual Support (AI)`; it never pretends to be a real human.
- Routine responses may be auto-sent when the model classifies them as safe.
- Requests for reconnection, disconnection, relocation, plan changes, billing adjustments, refunds, and fee exceptions require Telegram approval.
- An approval **does not directly change a router, PPPoE session, payment, or billing record**. It authorizes staff processing and creates an ordinary support ticket through the existing verified RPC `telegram_create_client_chat_ticket`.
- Telegram decisions are idempotent and expire after 24h.
- Requests and decisions are auditable in `tg_ai_chat_requests`; no direct client access (RLS, no anon/authenticated grants).
- Model calls are bounded and do not use any dynamic user-supplied tools. Messages and account context are scoped to the verified Client Portal session.

## Operational testing before declaring fully live
1. Log in as OWNER/ADMIN and open `ai-chat-settings.html`. Check OpenAI credential configured and Telegram ready.
2. Use a dedicated verified test client (do **not** test on a real client's account without consent).
3. Send a standard inquiry (plans or LOS) and confirm a clearly labeled AI reply is received only once.
4. Send a test reconnection request; confirm Telegram receives a single pending request with Approve / Reject / Review buttons.
5. Approve a test request; check support ticket and client reply, with **no** changes to billing/payment/PPPoE.
6. Confirm a second tap is rejected, a forged nonce is rejected, expired requests cannot be approved, and unauthorized users cannot access admin settings.
7. Disable AI via the Admin Settings switch to roll back automatic message handling without changing the rest of Chat Support.

> This source snapshot of existing Supabase Edge Functions is versioned for rollback. Do not merge these snapshots over newer live functions without re-checking the latest deployed versions.
