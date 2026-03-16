-- =============================================================================
-- CORREÇÃO: Estoque de Carvão — Adiantamentos sem inventory_movement
-- =============================================================================
-- Problema: Quando a descarga de carvão é vinculada ao adiantamento
-- (linkDischargeToAdvance), o estoque não era atualizado.
-- Este script identifica e corrige os adiantamentos finalizados ou
-- descarregados que possuem descarga vinculada mas sem inventory_movement.
-- =============================================================================

-- PASSO 1: DIAGNÓSTICO — Ver adiantamentos com descarga mas sem movimento de estoque
-- =============================================================================

SELECT
    ca.id AS advance_id,
    ca.status,
    ca.advance_amount,
    ca.advance_date,
    ca.discharge_id,
    ca.discharge_date,
    ca.complement_amount,
    ca.total_calculated_value,
    ca.advance_transaction_id,
    cd.weight_tons,
    cd.volume_mdc,
    cd.density,
    cd.discharge_date AS actual_discharge_date,
    CASE
        WHEN im.id IS NOT NULL THEN '✅ Tem movimento'
        ELSE '❌ SEM movimento'
    END AS stock_status
FROM carvao_advances ca
LEFT JOIN carvao_discharges cd ON cd.id = ca.discharge_id
LEFT JOIN inventory_movements im ON (
    im.reference_id = ca.advance_transaction_id
    AND im.movement_type = 'compra'
)
WHERE ca.discharge_id IS NOT NULL
ORDER BY ca.advance_date;


-- =============================================================================
-- PASSO 2: INSERIR MOVIMENTOS FALTANTES
-- =============================================================================
-- IMPORTANTE: Execute o PASSO 1 primeiro para verificar quais serão afetados.
-- Depois rode o INSERT abaixo.

-- Encontrar o ID do material carvão
-- SELECT id, name, current_stock FROM materials WHERE name ILIKE '%carvão%';

-- Inserir movimentos faltantes para adiantamentos com descarga vinculada
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
    cd.weight_tons AS quantity,
    CASE
        WHEN cd.weight_tons > 0 THEN
            COALESCE(ca.total_calculated_value, ca.advance_amount + COALESCE(ca.complement_amount, 0)) / cd.weight_tons
        ELSE 0
    END AS unit_price,
    COALESCE(ca.total_calculated_value, ca.advance_amount + COALESCE(ca.complement_amount, 0)) AS total_value,
    'compra' AS movement_type,
    ca.advance_transaction_id AS reference_id,
    FORMAT(
        'Correção estoque - Descarga adiantamento %s MDC × %s = %s t (advance_id: %s)',
        ROUND(cd.volume_mdc::numeric, 1),
        ROUND(cd.density::numeric, 3),
        ROUND(cd.weight_tons::numeric, 2),
        ca.id
    ) AS notes
FROM carvao_advances ca
JOIN carvao_discharges cd ON cd.id = ca.discharge_id
WHERE ca.status IN ('descarregado', 'finalizado')
  AND ca.discharge_id IS NOT NULL
  AND cd.weight_tons > 0
  AND NOT EXISTS (
      SELECT 1 FROM inventory_movements im
      WHERE im.reference_id = ca.advance_transaction_id
        AND im.movement_type = 'compra'
  );


-- =============================================================================
-- PASSO 3: RECALCULAR current_stock DO CARVÃO
-- =============================================================================
-- Após inserir os movimentos, recalcule o saldo:

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

-- Verificar resultado:
SELECT name, current_stock, unit FROM materials WHERE name ILIKE '%carvão%';


-- =============================================================================
-- BÔNUS: Limpar estoque de Ferro-Gusa (dados de teste)
-- =============================================================================
-- Se confirmar que os 25t são de teste, rode:

-- Ver movimentos de gusa:
-- SELECT * FROM inventory_movements
-- WHERE material_id = (SELECT id FROM materials WHERE name ILIKE '%gusa%')
-- ORDER BY date;

-- Deletar movimentos de teste:
-- DELETE FROM inventory_movements
-- WHERE material_id = (SELECT id FROM materials WHERE name ILIKE '%gusa%');

-- Zerar estoque:
-- UPDATE materials SET current_stock = 0 WHERE name ILIKE '%gusa%';
