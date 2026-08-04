-- Track whether ledger USD is OpenRouter-billed or a local estimate.
alter table public.cost_ledger
  add column if not exists cost_source text not null default 'estimate';

alter table public.cost_ledger
  add column if not exists generation_id text;
