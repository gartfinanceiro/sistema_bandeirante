-- 039_consolidate_cost_centers.sql
-- Consolida centros de custo sobrepostos, separando Administrativo de Financeiro/Tributário.
--
-- Reaproveita centros existentes:
--   * "Administrativo e Apoio" (e552eae4, administrativo)         -> renomeado "Administrativo"
--   * "Financeiro e Tributário" (1f7b5b02, financeiro_tributario) -> renomeado "Financeiro / Tributário"
--   * Aposenta "Administrativo / Financeiro" (3da6d041) e "Não Operacional" (0737e888), agora vazios.
--
-- Também corrige uma lacuna da 038: repointar recurring_bills (não só transactions) que
-- ainda apontavam para slugs-resíduo; e renomeia os 2 resíduos desativados cujo nome
-- colidiria com a canônica movida (unique cost_center_id,name).

begin;

-- 0a) Lacuna da 038: contas fixas que apontavam p/ resíduo -> canônica
update public.recurring_bills set category_id='servinos_terceirizados' where category_id='admin_services';

-- 0b) Liberar nomes: resíduos desativados (038) que colidiriam com a canônica movida
update public.transaction_categories set name = name || ' [mesclada 038]'
  where slug in ('tarifas_bancarias','distribuinao_de_lucros') and is_active = false;

-- 1) Categorias financeiras -> Financeiro / Tributário (1f7b5b02). Juros e Empréstimos já está lá.
update public.transaction_categories set cost_center_id='1f7b5b02-dead-4ca1-abb4-d87ca3922acf'
  where slug in ('taxes','bank_fees','saque','saldo_inicial');

-- 2) Telecom (overhead administrativo) -> Administrativo (e552eae4)
update public.transaction_categories set cost_center_id='e552eae4-541b-4a8a-800a-5358d08fd80a'
  where slug='telecom';

-- 3) Distribuição de Lucros + Investimentos -> Não Operacional / Patrimonial (53998ff6)
update public.transaction_categories set cost_center_id='53998ff6-12da-4bff-aff7-11b0092c26df'
  where slug in ('dividends','investments');

-- 4) Renomear os centros canônicos
update public.cost_centers set name='Administrativo'          where id='e552eae4-541b-4a8a-800a-5358d08fd80a';
update public.cost_centers set name='Financeiro / Tributário' where id='1f7b5b02-dead-4ca1-abb4-d87ca3922acf';

-- 5) Desativar os centros agora vazios
update public.cost_centers set is_active=false where id in (
  '3da6d041-74b7-459a-9fee-748901f3d841', -- Administrativo / Financeiro
  '0737e888-e095-469b-8230-46aadca5c02d'  -- Não Operacional
);

commit;
