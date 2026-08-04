-- Octivate ops: server config, usage stats, cost ledger, agent run records.
-- Applied via Management API / scripts/supabase-migrate-ops.mjs

create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_snapshots (
  period text primary key,
  tokens_used bigint not null default 0,
  tokens_limit bigint not null default 0,
  estimated_cost_usd numeric(14, 6) not null default 0,
  briefs_generated integer not null default 0,
  sessions_run integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.cost_ledger (
  id text primary key,
  at timestamptz not null default now(),
  model text not null,
  tokens integer not null default 0,
  cost_usd numeric(14, 6) not null default 0,
  session_id text,
  label text not null,
  premium boolean not null default false,
  channel text not null default 'other',
  created_at timestamptz not null default now()
);

create index if not exists cost_ledger_at_idx on public.cost_ledger (at desc);
create index if not exists cost_ledger_session_idx on public.cost_ledger (session_id);

create table if not exists public.agent_sessions (
  id text primary key,
  project_id text not null,
  status text not null,
  started_at timestamptz not null,
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  tokens_used integer not null default 0,
  estimated_cost_usd numeric(14, 6) not null default 0,
  model_used text,
  used_premium boolean not null default false,
  usage_recorded boolean not null default false,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists agent_sessions_started_idx on public.agent_sessions (started_at desc);
create index if not exists agent_sessions_project_idx on public.agent_sessions (project_id);
create index if not exists agent_sessions_status_idx on public.agent_sessions (status);

alter table public.app_config enable row level security;
alter table public.usage_snapshots enable row level security;
alter table public.cost_ledger enable row level security;
alter table public.agent_sessions enable row level security;

-- Service role bypasses RLS; deny public/anon by default (no policies).
