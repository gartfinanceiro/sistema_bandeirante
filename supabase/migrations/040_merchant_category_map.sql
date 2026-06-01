-- 040_merchant_category_map.sql
-- "Cérebro" da auto-categorização: mapa fornecedor(normalizado) -> categoria, por voto
-- majoritário do histórico. Atualizável a cada correção (auto-aprende). Aditivo; o motor
-- de importação só passará a consultá-lo na Fase 2.
--
-- merchant_key = descrição normalizada (minúscula, trim, espaços colapsados, parte antes do "-").
-- Mesma normalização DEVE ser replicada no runtime (TS) na Fase 2.

create table if not exists public.merchant_category_map (
  merchant_key   text primary key,
  category_slug  text not null,
  vote_count     int  not null,
  total_count    int  not null,
  confidence     numeric generated always as (round(vote_count::numeric / nullif(total_count,0), 3)) stored,
  is_ambiguous   boolean not null default false,
  source         text not null default 'seed',   -- 'seed' | 'correction' | 'manual'
  updated_at     timestamptz not null default now()
);

comment on table public.merchant_category_map is 'Mapa aprendido fornecedor->categoria p/ auto-categorização da importação financeira';

-- Seed por voto majoritário (winner = categoria mais usada por merchant_key).
-- Marca is_ambiguous quando a dominante tem < 60% dos votos.
insert into public.merchant_category_map (merchant_key, category_slug, vote_count, total_count, is_ambiguous, source)
select merchant_key, category_slug, votes, total, (votes::numeric / total) < 0.60, 'seed'
from (
  select merchant_key, category_slug, votes,
         sum(votes) over (partition by merchant_key) as total,
         row_number() over (partition by merchant_key order by votes desc, category_slug) as rn
  from (
    select lower(trim(regexp_replace(split_part(description, '-', 1), '\s+', ' ', 'g'))) as merchant_key,
           category_id as category_slug,
           count(*) as votes
    from public.transactions
    where category_id is not null and description is not null and length(trim(description)) > 0
    group by 1, 2
  ) per_cat
) ranked
where rn = 1
on conflict (merchant_key) do nothing;

-- RLS: tabela de referência interna; libera p/ usuários autenticados (app single-tenant admin).
alter table public.merchant_category_map enable row level security;
create policy merchant_map_authenticated_all on public.merchant_category_map
  for all to authenticated using (true) with check (true);
