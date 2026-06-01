-- 043_review_flag.sql
-- Fase 3: suporte à importação automática com revisão por exceção.
--   * needs_review: marca lançamentos cuja categoria foi palpite incerto (badge no app).
--   * Bucket "A Classificar": centro + categoria para itens sem palpite, formando um grupo
--     visível no relatório que você "zera" revisando.

alter table public.transactions add column if not exists needs_review boolean not null default false;
create index if not exists idx_transactions_needs_review on public.transactions(needs_review) where needs_review;

-- Centro de custo dedicado (type reusa enum existente; fora do CPT)
insert into public.cost_centers (id, code, name, type, affects_cpt, display_order, is_active)
select gen_random_uuid(), 'AC', 'A Classificar', 'nao_operacional', false, 99, true
where not exists (select 1 from public.cost_centers where code = 'AC');

-- Categoria bucket
insert into public.transaction_categories (id, cost_center_id, name, slug, category_type, is_active, display_order)
select gen_random_uuid(), cc.id, 'A Classificar', 'a_classificar', 'despesa', true, 99
from public.cost_centers cc
where cc.code = 'AC'
on conflict (slug) do nothing;
