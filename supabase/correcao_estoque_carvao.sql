-- =============================================================================
-- CORREÇÃO: Estoque de Carvão Vegetal
-- =============================================================================
-- IMPORTANTE: Rode o diagnóstico (diagnostico_carvao_completo.sql) ANTES
-- deste script para identificar exatamente quais registros corrigir.
--
-- Este script deve ser executado PASSO A PASSO, verificando cada resultado.
-- =============================================================================

-- =============================================================================
-- PASSO 1: Obter o material_id do Carvão Vegetal
-- =============================================================================
-- Guarde este ID para usar nos próximos passos.

SELECT id, name, current_stock, unit
FROM materials
WHERE name ILIKE '%carvão%' OR name ILIKE '%carvao%';

-- =============================================================================
-- PASSO 2: REMOVER movimentos duplicados "Correção estoque"
-- =============================================================================
-- Em Janeiro foram criados movimentos de "Correção estoque" que DUPLICAM
-- os movimentos de "Compra Carvão (Importação Planilha)" para as mesmas datas.
--
-- PRIMEIRO: Rode a query abaixo para ver quais serão removidos:

SELECT
    im.id,
    im.date,
    im.quantity,
    im.notes,
    im.created_at
FROM inventory_movements im
JOIN materials m ON m.id = im.material_id
WHERE (m.name ILIKE '%carvão%' OR m.name ILIKE '%carvao%')
  AND im.notes ILIKE '%correção%estoque%'
ORDER BY im.date;

-- DEPOIS: Se confirmado que são duplicados, remova-os:
-- (Substitua os IDs abaixo pelos IDs reais encontrados na query acima)

-- DELETE FROM inventory_movements
-- WHERE id IN (
--     SELECT im.id
--     FROM inventory_movements im
--     JOIN materials m ON m.id = im.material_id
--     WHERE (m.name ILIKE '%carvão%' OR m.name ILIKE '%carvao%')
--       AND im.notes ILIKE '%correção%estoque%'
-- );

-- =============================================================================
-- PASSO 3: CRIAR movimentos para compras diretas sem movement
-- =============================================================================
-- Transações de carvão que possuem volume na descrição mas não geraram
-- inventory_movement. Extraia o volume da descrição de cada transação.
--
-- PRIMEIRO: Identifique quais transações precisam de movimento:

SELECT
    t.id AS transaction_id,
    t.date,
    t.description,
    t.amount,
    t.quantity,
    s.name AS supplier_name
FROM transactions t
LEFT JOIN suppliers s ON s.id = t.supplier_id
WHERE t.type = 'saida'
  AND (t.category_id = 'raw_material_charcoal'
       OR t.description ILIKE '%carvão%'
       OR t.description ILIKE '%carvao%')
  AND NOT EXISTS (
    SELECT 1 FROM inventory_movements im
    WHERE im.reference_id = t.id
  )
ORDER BY t.date;

-- DEPOIS: Para CADA transação acima que tenha volume conhecido,
-- insira o movement manualmente. Exemplo:
--
-- INSERT INTO inventory_movements (material_id, date, quantity, unit_price, total_value, movement_type, reference_id, notes)
-- VALUES (
--     '<MATERIAL_ID_CARVAO>',
--     '<DATA_DA_TRANSAÇÃO>',
--     <VOLUME_MDC>,
--     <VALOR / VOLUME>,
--     <VALOR_TOTAL>,
--     'compra',
--     '<TRANSACTION_ID>',
--     'Compra carvão (correção manual) - <VOLUME> MDC'
-- );

-- =============================================================================
-- PASSO 4: CRIAR movimentos para adiantamentos finalizados sem movement
-- =============================================================================
-- Adiantamentos (Maciel Prado) que foram finalizados com complemento
-- mas não geraram inventory_movement.
--
-- CONTEXTO: Os complementos são os pagamentos da "diferença em aberto".
-- O volume da carga deve ter sido informado ao finalizar o adiantamento.
-- Se o volume não foi salvo em lugar nenhum, precisará ser informado manualmente.

-- 4a. Verificar quais adiantamentos finalizados não têm movement:

SELECT
    ca.id AS advance_id,
    ca.advance_date,
    ca.advance_amount,
    ca.complement_amount,
    ca.complement_date,
    ca.advance_transaction_id,
    ca.complement_transaction_id,
    ca.discharge_id,
    ca.total_calculated_value,
    cs.name AS carvao_supplier_name,
    -- Tentar pegar volume da descarga vinculada (se houver)
    cd.volume_mdc AS discharge_volume,
    cd.weight_tons AS discharge_weight,
    cd.density AS discharge_density
FROM carvao_advances ca
LEFT JOIN carvao_suppliers cs ON cs.id = ca.carvao_supplier_id
LEFT JOIN carvao_discharges cd ON cd.id = ca.discharge_id
WHERE ca.status = 'finalizado'
  AND NOT EXISTS (
    SELECT 1 FROM inventory_movements im
    WHERE im.reference_id = ca.advance_transaction_id
       OR im.reference_id = ca.complement_transaction_id
       OR (ca.discharge_id IS NOT NULL AND im.reference_id = ca.discharge_id)
  )
ORDER BY ca.advance_date;

-- 4b. Para CADA adiantamento acima, insira o movement:
-- (Se discharge_volume está preenchido, use-o como quantity)
-- (Se não tem volume, será necessário informar manualmente)
--
-- INSERT INTO inventory_movements (material_id, date, quantity, unit_price, total_value, movement_type, reference_id, notes)
-- VALUES (
--     '<MATERIAL_ID_CARVAO>',
--     '<COMPLEMENT_DATE ou ADVANCE_DATE>',
--     <VOLUME_MDC>,
--     (<ADVANCE_AMOUNT + COMPLEMENT_AMOUNT>) / <VOLUME_MDC>,
--     <ADVANCE_AMOUNT + COMPLEMENT_AMOUNT>,
--     'compra',
--     '<ADVANCE_TRANSACTION_ID>',
--     'Adiantamento carvão (correção manual) - <VOLUME> MDC - <SUPPLIER>'
-- );

-- =============================================================================
-- PASSO 5: RECALCULAR current_stock a partir dos movimentos
-- =============================================================================
-- Após todos os ajustes acima, recalcule o estoque final:

-- 5a. Calcular o estoque correto a partir de inventory_movements
SELECT
    ROUND(SUM(
        CASE
            WHEN movement_type IN ('compra', 'producao_entrada', 'ajuste') THEN quantity
            WHEN movement_type IN ('consumo_producao', 'venda') THEN -quantity
            ELSE 0
        END
    )::numeric, 2) AS estoque_calculado
FROM inventory_movements im
JOIN materials m ON m.id = im.material_id
WHERE m.name ILIKE '%carvão%' OR m.name ILIKE '%carvao%';

-- 5b. Atualizar current_stock (descomentar após confirmar o valor acima)
-- UPDATE materials
-- SET current_stock = (
--     SELECT COALESCE(SUM(
--         CASE
--             WHEN movement_type IN ('compra', 'producao_entrada', 'ajuste') THEN quantity
--             WHEN movement_type IN ('consumo_producao', 'venda') THEN -quantity
--             ELSE 0
--         END
--     ), 0)
--     FROM inventory_movements im
--     WHERE im.material_id = materials.id
-- )
-- WHERE name ILIKE '%carvão%' OR name ILIKE '%carvao%';

-- =============================================================================
-- PASSO 6: VERIFICAÇÃO FINAL
-- =============================================================================

SELECT id, name, ROUND(current_stock::numeric, 2) AS current_stock, unit
FROM materials
WHERE name ILIKE '%carvão%' OR name ILIKE '%carvao%';
