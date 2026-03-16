-- =============================================================================
-- DIAGNÓSTICO: Transações de matéria-prima que NÃO aparecem na Balança
-- =============================================================================
-- Uma transação aparece na Balança se tiver:
--   type = 'saida' AND material_id IS NOT NULL AND quantity IS NOT NULL AND quantity > 0
-- Este script identifica transações de compra que NÃO atendem esses critérios.
-- =============================================================================

-- 1. Todas as transações de saída recentes (últimos 3 meses) com dados de material
SELECT
    t.id,
    t.date,
    t.description,
    t.amount,
    t.quantity,
    t.material_id,
    t.supplier_id,
    m.name AS material_name,
    s.name AS supplier_name,
    CASE
        WHEN t.material_id IS NULL THEN 'SEM MATERIAL'
        WHEN t.quantity IS NULL THEN 'SEM QUANTIDADE'
        WHEN t.quantity <= 0 THEN 'QUANTIDADE ZERO'
        ELSE 'OK - Aparece na Balança'
    END AS status_balanca
FROM transactions t
LEFT JOIN materials m ON m.id = t.material_id
LEFT JOIN suppliers s ON s.id = t.supplier_id
WHERE t.type = 'saida'
  AND t.date >= NOW() - INTERVAL '3 months'
ORDER BY t.date DESC;

-- 2. Resumo: quantas transações estão OK vs com problemas
SELECT
    CASE
        WHEN material_id IS NULL THEN 'SEM MATERIAL'
        WHEN quantity IS NULL THEN 'SEM QUANTIDADE'
        WHEN quantity <= 0 THEN 'QUANTIDADE ZERO'
        ELSE 'OK'
    END AS status,
    COUNT(*) AS total
FROM transactions
WHERE type = 'saida'
  AND date >= NOW() - INTERVAL '3 months'
GROUP BY
    CASE
        WHEN material_id IS NULL THEN 'SEM MATERIAL'
        WHEN quantity IS NULL THEN 'SEM QUANTIDADE'
        WHEN quantity <= 0 THEN 'QUANTIDADE ZERO'
        ELSE 'OK'
    END
ORDER BY total DESC;

-- 3. Transações com problemas (não aparecem na balança) — para correção
SELECT
    t.id,
    t.date,
    t.description,
    t.amount,
    t.quantity,
    t.material_id,
    t.supplier_id,
    m.name AS material_name,
    s.name AS supplier_name
FROM transactions t
LEFT JOIN materials m ON m.id = t.material_id
LEFT JOIN suppliers s ON s.id = t.supplier_id
WHERE t.type = 'saida'
  AND t.date >= NOW() - INTERVAL '3 months'
  AND (t.material_id IS NULL OR t.quantity IS NULL OR t.quantity <= 0)
ORDER BY t.date DESC;

-- =============================================================================
-- CORREÇÃO: Se encontrar transações com material_id mas sem quantity,
-- você pode atualizar manualmente. Exemplo:
-- UPDATE transactions SET quantity = 120.5 WHERE id = 'UUID_AQUI';
--
-- Se encontrar transações sem material_id (mas que são compras de matéria-prima),
-- primeiro identifique o material correto:
-- SELECT id, name FROM materials WHERE is_active = true;
-- Depois atualize:
-- UPDATE transactions SET material_id = 'UUID_MATERIAL' WHERE id = 'UUID_TRANSACAO';
-- =============================================================================
