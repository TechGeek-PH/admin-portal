-- Applied to the TechGeekPH-Portal production database 2026-11-01.
-- Idempotent SQL reference for the AI chat worker and approval queue.
create table if not exists public.tg_ai_support_settings (
 id smallint primary key check (id=1),
 enabled boolean not null default true,
 allow_auto_replies boolean not null default true,
 require_telegram_approval boolean not null default true,
 updated_at timestamptz not null default now()
);
insert into public.tg_ai_support_settings(id,enabled,allow_auto_replies,require_telegram_approval)
values(1,true,true,true) on conflict(id) do nothing;
create table if not exists public.tg_ai_chat_requests (
 source_message_id bigint primary key references public.client_chat_messages(id) on delete cascade,
 conversation_id uuid not null references public.client_chat_conversations(id) on delete cascade,
 client_id bigint not null references public.clients(id),
 status text not null default 'PROCESSING' check(status in('PROCESSING','AUTO_REPLIED','PENDING_APPROVAL','APPROVED','REJECTED','NEEDS_STAFF','FAILED','EXPIRED')),
 request_type text not null default 'GENERAL',
 request_summary text,
 suggested_reply text,
 telegram_message_id bigint,
 expires_at timestamptz,
 decided_at timestamptz,
 decided_by text,
 fulfillment_status text not null default 'NOT_APPLICABLE' check(fulfillment_status in('NOT_APPLICABLE','STAFF_ACTION_REQUIRED','COMPLETED')),
 error_code text,
 attempts integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 approval_nonce text
);
alter table public.tg_ai_chat_requests add column if not exists approval_nonce text;
create index if not exists tg_ai_chat_requests_pending_idx on public.tg_ai_chat_requests(status,created_at) where status='PENDING_APPROVAL';
create index if not exists tg_ai_chat_requests_conv_idx on public.tg_ai_chat_requests(conversation_id,created_at desc);
alter table public.tg_ai_support_settings enable row level security;
alter table public.tg_ai_chat_requests enable row level security;
revoke all on public.tg_ai_support_settings from anon, authenticated;
revoke all on public.tg_ai_chat_requests from anon, authenticated;
