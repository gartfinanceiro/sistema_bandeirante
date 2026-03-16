-- =============================================================================
-- CORREÇÃO COMPLETA: Estoque de Carvão
-- =============================================================================
-- O módulo Carvão (descargas) estava desconectado do estoque.
-- Nem createDischarge() nem confirmDischarge() criavam inventory_movements.
-- Este script corrige retroativamente TODAS as descargas sem movimento.
-- =============================================================================

-- =============================================================================
-- PASSO 1: DIAGNÓSTICO — Ver a diferença entre descargas e movimentos
-- =============================================================================

-- 1a. Total de descargas registradas vs inventory_movements existentes
SELECT
    'Descargas registradas' AS fonte,
    COUNT(*) AS qtd,
    ROUND(SUM(volume_mdc)::numeric, 2) AS total_mdc,
    ROUND(SUM(weight_tons)::numeric, 2) AS total_tons
FROM carvao_discharges

UNION ALL

SELECT
    'Inventory movements (carvão)' AS fonte,
    COUNT(*) AS qtd,
    ROUND(SUM(quantity)::numeric, 2) AS total_mdc,
    NULL AS total_tons
FROM inventory_movements
WHERE material_id = (SELECT id FROM materials WHERE name ILIKE '%carvão%' LIMIT 1)
  AND movement_type = 'compra';

-- 1b. Descargas que NÃO possuem inventory_movement correspondente
-- (nem pelo discharge_id nem pelo advance_transaction_id)
SELECT
    cd.id AS discharge_id,
    cd.discharge_date,
    cd.volume_mdc,
    cd.density,
    cd.weight_tons,
    cd.is_confirmed,
    cd.price_per_ton,
    cd.net_value,
    ca.id AS advance_id,
    ca.advance_transaction_id,
    '❌ SEM movimento' AS status_estoque
FROM carvao_discharges cd
LEFT JOIN carvao_advances ca ON ca.discharge_id = cd.id
WHERE NOT EXISTS (
    -- Não tem movement referenciando o discharge_id
    SELECT 1 FROM inventory_movements im
    WHERE im.reference_id = cd.id
      AND im.movement_type = 'compra'
)
AND NOT EXISTS (
    -- Não tem movement referenciando o advance_transaction_id (se existir)
    SELECT 1 FROM inventory_movements im
    WHERE ca.advance_transaction_id IS NOT NULL
      AND im.reference_id = ca.advance_transaction_id
      AND im.movement_type = 'compra'
)
ORDER BY cd.discharge_date;


-- =============================================================================
-- PASSO 2: INSERIR MOVIMENTOS FALTANTES PARA TODAS AS DESCARGAS
-- =============================================================================
-- ATENÇÃO: Rode o PASSO 1 primeiro para verificar quais serão afetados.
-- Só depois execute o INSERT abaixo.

INSERT INTO inventory_movements (
    material_id,
    date,
    quantity,
    unit_price,
    total_value,
    movement_type,
    reference_id,
    notes
)
SELECT
    (SELECT id FROM materials WHERE name ILIKE '%carvão%' LIMIT 1) AS material_id,
    cd.discharge_date AS date,
    cd.volume_mdc AS quantity,  -- Unidade do carvão é m³ (MDC), NÃO toneladas
    CASE
        WHEN cd.volume_mdc > 0 AND cd.net_value IS NOT NULL AND cd.net_value > 0
            THEN cd.net_value / cd.volume_mdc
        WHEN cd.volume_mdc > 0 AND cd.price_per_ton IS NOT NULL AND cd.price_per_ton > 0
            THEN (cd.weight_tons * cd.price_per_ton) / cd.volume_mdc
        ELSE 0
    END AS unit_price,
    COALESCE(cd.net_value, cd.weight_tons * COALESCE(cd.price_per_ton, 0), 0) AS total_value,
    'compra' AS movement_type,
    cd.id AS reference_id,
    FORMAT(
        'Correção estoque - Descarga %s: %s MDC (%s t)',
        cd.discharge_date,
        ROUND(cd.volume_mdc::numeric, 1),
        ROUND(cd.weight_tons::numeric, 2)
    ) AS notes
FROM carvao_discharges cd
LEFT JOIN carvao_advances ca ON ca.discharge_id = cd.id
WHERE cd.volume_mdc > 0
  AND NOT EXISTS (
      SELECT 1 FROM inventory_movements im
      WHERE im.reference_id = cd.id
        AND im.movement_type = 'compra'
  )
  AND NOT EXISTS (
      SELECT 1 FROM inventory_movements im
      WHERE ca.advance_transaction_id IS NOT NULL
        AND im.reference_id = ca.advance_transaction_id
        AND im.movement_type = 'compra'
  );


-- =============================================================================
-- PASSO 3: RECALCULAR current_stock DO CARVÃO
-- =============================================================================

UPDATE materials
SET current_stock = (
    SELECT COALESCE(SUM(
        CASE
            WHEN movement_type IN ('compra', 'producao_entrada', 'ajuste') THEN quantity
            WHEN movement_type IN ('consumo_producao', 'venda') THEN -quantity
            ELSE 0
        END
    ), 0)
    FROM inventory_movements
    WHERE material_id = materials.id
)
WHERE name ILIKE '%carvão%';

-- Verificar resultado final:
SELECT name, current_stock, unit FROM materials WHERE name ILIKE '%carvão%';


-- =============================================================================
-- BÔNUS: Limpar estoque de Ferro-Gusa (dados de teste)
-- =============================================================================

-- DELETE FROM inventory_movements
-- WHERE material_id = (SELECT id FROM materials WHERE name ILIKE '%gusa%');
-- UPDATE materials SET current_stock = 0 WHERE name ILIKE '%gusa%';
