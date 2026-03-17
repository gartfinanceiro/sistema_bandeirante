-- =============================================================================
-- DIAGNÓSTICO COMPLETO: Estoque de Carvão Vegetal
-- =============================================================================
-- Sistema mostra: 2.193,85 m³
-- Planilha mostra: ~3.100 m³
-- Gap: ~906 m³
-- =============================================================================

-- =============================================================================
-- PARTE 1: Estado atual dos inventory_movements de carvão
-- =============================================================================

-- 1a. Todos os movimentos de carvão (fonte de verdade do estoque)
SELECT
    im.id,
    im.date,
    im.quantity,
    im.movement_type,
    im.reference_id,
    im.notes,
    im.created_at
FROM inventory_movements im
JOIN materials m ON m.id = im.material_id
WHERE m.name ILIKE '%carvão%' OR m.name ILIKE '%carvao%'
ORDER BY im.date, im.created_at;

-- 1b. Soma total
SELECT
    movement_type,
    COUNT(*) AS qtd,
    ROUND(SUM(quantity)::numeric, 2) AS total_m3
FROM inventory_movements im
JOIN materials m ON m.id = im.material_id
WHERE m.name ILIKE '%carvão%' OR m.name ILIKE '%carvao%'
GROUP BY movement_type;

-- =============================================================================
-- PARTE 2: Identificar movimentos duplicados "Correção estoque"
-- =============================================================================
-- Em Janeiro, foram criados 4 movimentos de "Correção estoque" que duplicam
-- movimentos de "Compra Carvão (Importação Planilha)" para as mesmas datas.

SELECT
    im.id,
    im.date,
    im.quantity,
    im.notes,
    im.created_at
FROM inventory_movements im
JOIN materials m ON m.id = im.material_id
WHERE (m.name ILIKE '%carvão%' OR m.name ILIKE '%carvao%')
  AND im.notes ILIKE '%correção%'
ORDER BY im.date;

-- =============================================================================
-- PARTE 3: Transações de carvão SEM inventory_movement correspondente
-- =============================================================================
-- Compras diretas que não geraram movimento de estoque

SELECT
    t.id,
    t.date,
    t.description,
    t.amount,
    t.quantity,
    t.supplier_id,
    s.name AS supplier_name,
    t.category_id
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

-- =============================================================================
-- PARTE 4: Adiantamentos de carvão (carvao_advances)
-- =============================================================================

-- 4a. Todos os adiantamentos e seu status
SELECT
    ca.id,
    ca.status,
    ca.advance_amount,
    ca.advance_date,
    ca.discharge_id,
    ca.discharge_date,
    ca.complement_amount,
    ca.complement_date,
    ca.total_calculated_value,
    ca.advance_transaction_id,
    ca.complement_transaction_id,
    cs.name AS carvao_supplier_name
FROM carvao_advances ca
LEFT JOIN carvao_suppliers cs ON cs.id = ca.carvao_supplier_id
ORDER BY ca.advance_date;

-- 4b. Adiantamentos finalizados SEM inventory_movement
SELECT
    ca.id AS advance_id,
    ca.status,
    ca.advance_amount,
    ca.advance_date,
    ca.complement_amount,
    ca.complement_date,
    ca.advance_transaction_id,
    ca.complement_transaction_id,
    ca.discharge_id,
    cs.name AS carvao_supplier_name,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM inventory_movements im
            WHERE im.reference_id = ca.advance_transaction_id
               OR im.reference_id = ca.complement_transaction_id
               OR (ca.discharge_id IS NOT NULL AND im.reference_id = ca.discharge_id)
        ) THEN 'TEM MOVIMENTO'
        ELSE 'SEM MOVIMENTO'
    END AS movement_status
FROM carvao_advances ca
LEFT JOIN carvao_suppliers cs ON cs.id = ca.carvao_supplier_id
WHERE ca.status = 'finalizado'
ORDER BY ca.advance_date;

-- =============================================================================
-- PARTE 5: Descargas de carvão e seus volumes
-- =============================================================================
-- Para os adiantamentos finalizados SEM descarga vinculada,
-- precisamos saber o volume de cada complemento

SELECT
    cd.id AS discharge_id,
    cd.discharge_date,
    cd.weight_tons,
    cd.volume_mdc,
    cd.density,
    cd.is_confirmed,
    ca.id AS advance_id,
    ca.advance_amount,
    ca.complement_amount,
    ca.advance_date,
    ca.complement_date,
    ca.status AS advance_status
FROM carvao_discharges cd
LEFT JOIN carvao_advances ca ON ca.discharge_id = cd.id
ORDER BY cd.discharge_date;

-- =============================================================================
-- PARTE 6: Transações de complemento (diferença em aberto)
-- =============================================================================
-- Os complementos de adiantamento (R$ 4.811, R$ 4.968, etc.)
-- são as transações onde o volume deveria ter sido registrado

SELECT
    t.id,
    t.date,
    t.description,
    t.amount,
    t.quantity,
    ca.id AS advance_id,
    ca.status AS advance_status,
    ca.advance_amount,
    ca.complement_amount,
    ca.discharge_id
FROM transactions t
JOIN carvao_advances ca ON ca.complement_transaction_id = t.id
ORDER BY t.date;

-- =============================================================================
-- PARTE 7: Resumo final — gap de estoque
-- =============================================================================

-- Total em inventory_movements
SELECT 'Movimentos existentes' AS categoria,
    ROUND(SUM(CASE WHEN movement_type IN ('compra', 'producao_entrada', 'ajuste') THEN quantity ELSE -quantity END)::numeric, 2) AS total_m3
FROM inventory_movements im
JOIN materials m ON m.id = im.material_id
WHERE m.name ILIKE '%carvão%' OR m.name ILIKE '%carvao%';

-- current_stock na tabela materials
SELECT 'current_stock (materials)' AS categoria,
    ROUND(current_stock::numeric, 2) AS total_m3
FROM materials
WHERE name ILIKE '%carvão%' OR name ILIKE '%carvao%';
