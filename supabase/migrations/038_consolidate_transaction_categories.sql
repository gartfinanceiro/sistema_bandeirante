-- 038_consolidate_transaction_categories.sql
-- Consolida categorias duplicadas (mesma semântica, slugs paralelos criados por
-- gerações automáticas de slug em importações sucessivas — daí os bugs de acento
-- tipo "consumiveis_de_operanao", "distribuinao_de_lucros").
--
-- Estratégia: re-apontar as transações do slug-RESÍDUO para o slug-CANÔNICO (o mais
-- usado de cada par) e DESATIVAR o resíduo (is_active=false) — não deletamos, p/
-- preservar histórico. Reversível via tabela _bkp_038_category_merge.
--
-- transactions.category_id guarda o SLUG (texto), não o uuid — por isso o UPDATE é por slug.
-- Total estimado de transações re-apontadas: 72.

begin;

-- 0) Backup das linhas afetadas (rollback manual: update t set category_id=b.category_id from _bkp... )
create table if not exists public._bkp_038_category_merge as
select id, category_id, now() as backed_up_at
from public.transactions
where category_id in (
  'combustiveis_e_lubrificantes','manutennao_mecanica_soldas','beneficios_e_provisoes',
  'distribuinao_de_lucros','manutencao_area_externa','venda_gusa','tarifas_bancarias',
  'salarios_folha_liquida','impostos_governamentais','admin_services','consumiveis_de_operanao'
);

-- 1) Re-apontar transações: RESÍDUO -> CANÔNICO
update public.transactions set category_id='fuel'                             where category_id='combustiveis_e_lubrificantes'; -- Combustíveis e Lubrificantes -> Combustíveis
update public.transactions set category_id='maintenance_mech'                 where category_id='manutennao_mecanica_soldas';    -- Manut. Mecânica/Soldas -> Manutenção Mecânica
update public.transactions set category_id='benefits'                         where category_id='beneficios_e_provisoes';         -- Benefícios e Provisões -> Benefícios
update public.transactions set category_id='dividends'                        where category_id='distribuinao_de_lucros';         -- Distrib. Lucros (dup) -> Distribuição de Lucros
update public.transactions set category_id='manutencao_areas_externas_jardim' where category_id='manutencao_area_externa';        -- Manut. Área Externa -> Áreas Externas/Jardim
update public.transactions set category_id='sale_pig_iron'                    where category_id='venda_gusa';                     -- Venda Gusa -> Venda de Ferro-Gusa
update public.transactions set category_id='bank_fees'                        where category_id='tarifas_bancarias';              -- Tarifas Bancárias (dup) -> Tarifas Bancárias
update public.transactions set category_id='salary'                           where category_id='salarios_folha_liquida';         -- Salários (Folha Líquida) -> Salários
update public.transactions set category_id='taxes'                            where category_id='impostos_governamentais';        -- Impostos Governamentais -> Impostos
update public.transactions set category_id='servinos_terceirizados'           where category_id='admin_services';                 -- Serviços Terceiros -> Serviços Terceirizados
update public.transactions set category_id='consumables'                      where category_id='consumiveis_de_operanao';        -- Consumíveis de Operação -> Consumíveis/EPIs

-- 2) Desativar as categorias-resíduo
update public.transaction_categories set is_active=false
where slug in (
  'combustiveis_e_lubrificantes','manutennao_mecanica_soldas','beneficios_e_provisoes',
  'distribuinao_de_lucros','manutencao_area_externa','venda_gusa','tarifas_bancarias',
  'salarios_folha_liquida','impostos_governamentais','admin_services','consumiveis_de_operanao'
);

commit;
