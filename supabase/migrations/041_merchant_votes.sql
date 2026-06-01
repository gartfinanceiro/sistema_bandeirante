-- 041_merchant_votes.sql
-- Reestrutura o mapa aprendido para VOTOS POR CATEGORIA (substitui a 040, que guardava só
-- o vencedor). Necessário para aprendizado real: cada confirmação/correção é +1 voto, e o
-- vencedor pode mudar quando você corrige. A view merchant_best_category resolve o vencedor.

drop table if exists public.merchant_category_map;

create table public.merchant_category_votes (
  merchant_key   text not null,
  category_slug  text not null,
  votes          int  not null default 0,
  updated_at     timestamptz not null default now(),
  primary key (merchant_key, category_slug)
);

comment on table public.merchant_category_votes is 'Votos fornecedor×categoria p/ auto-categorização (seed do histórico + aprende com correções)';

-- Seed: contagem por par fornecedor×categoria. Normalização IDÊNTICA ao merchant-key.ts (TS).
insert into public.merchant_category_votes (merchant_key, category_slug, votes)
select lower(trim(regexp_replace(split_part(description, '-', 1), '\s+', ' ', 'g'))) as merchant_key,
       category_id as category_slug,
       count(*) as votes
from public.transactions
where category_id is not null and description is not null and length(trim(description)) > 0
group by 1, 2;

-- View do vencedor por fornecedor (+ confiança e flag de ambiguidade < 60%).
create or replace view public.merchant_best_category
with (security_invoker = true) as
select distinct on (merchant_key)
  merchant_key,
  category_slug as best_category_slug,
  votes         as best_votes,
  sum(votes) over (partition by merchant_key)                                    as total_votes,
  round(votes::numeric / sum(votes) over (partition by merchant_key), 3)         as confidence,
  (votes::numeric / sum(votes) over (partition by merchant_key)) < 0.60          as is_ambiguous
from public.merchant_category_votes
order by merchant_key, votes desc, category_slug;

-- RLS (tabela de referência interna; app single-tenant admin)
alter table public.merchant_category_votes enable row level security;
create policy merchant_votes_authenticated_all on public.merchant_category_votes
  for all to authenticated using (true) with check (true);
