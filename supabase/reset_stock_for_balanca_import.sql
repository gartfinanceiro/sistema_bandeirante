-- =============================================================================
-- RESET DE ESTOQUE PARA REIMPORTAÇÃO VIA BALANÇA
-- =============================================================================
-- Objetivo: Zerar estoque de todas matérias-primas EXCETO carvão vegetal,
-- limpar inbound_deliveries e inventory_movements antigos, para permitir
-- reimportação correta dos dados da balança.
-- =============================================================================

-- =============================================================================
-- PASSO 1: DIAGNÓSTICO — Ver estado atual antes de limpar
-- =============================================================================

-- 1a. Materiais e seus estoques atuais
SELECT id, name, current_stock, unit, is_active
FROM materials
ORDER BY name;

-- 1b. Total de inventory_movements por material
SELECT
    m.name AS material,
    COUNT(im.id) AS total_movements,
    ROUND(SUM(CASE WHEN im.movement_type IN ('compra','producao_entrada','ajuste') THEN im.quantity ELSE -im.quantity END)::numeric, 2) AS saldo_calculado
FROM materials m
LEFT JOIN inventory_movements im ON im.material_id = m.id
GROUP BY m.id, m.name
ORDER BY m.name;

-- 1c. Total de inbound_deliveries por transação/material
SELECT
    m.name AS material,
    COUNT(id2.id) AS total_deliveries,
    ROUND(SUM(id2.weight_measured)::numeric, 2) AS total_peso_kg
FROM inbound_deliveries id2
JOIN transactions t ON t.id = id2.transaction_id
JOIN materials m ON m.id = t.material_id
WHERE id2.deleted_at IS NULL
GROUP BY m.id, m.name
ORDER BY m.name;

-- =============================================================================
-- PASSO 2: LIMPAR DADOS (EXCETO CARVÃO)
-- =============================================================================
-- ATENÇÃO: Rode o PASSO 1 primeiro para verificar o estado atual.
-- Só depois execute os comandos abaixo.

-- 2a. Identificar o material carvão (para excluir da limpeza)
-- SELECT id, name FROM materials WHERE name ILIKE '%carvão%' OR name ILIKE '%carvao%';

-- 2b. Deletar inventory_movements de materiais que NÃO são carvão
-- (movimentos do tipo 'compra' vinculados a transações de matéria-prima)
DELETE FROM inventory_movements
WHERE material_id NOT IN (
    SELECT id FROM materials
    WHERE name ILIKE '%carvão%' OR name ILIKE '%carvao%'
);

-- 2c. Deletar inbound_deliveries (entregas da balança)
-- Nota: Só deleta entregas vinculadas a transações de materiais não-carvão
DELETE FROM inbound_deliveries
WHERE transaction_id IN (
    SELECT t.id FROM transactions t
    WHERE t.material_id IS NOT NULL
      AND t.material_id NOT IN (
          SELECT id FROM materials
          WHERE name ILIKE '%carvão%' OR name ILIKE '%carvao%'
      )
);

-- 2d. Zerar current_stock de todos materiais exceto carvão
UPDATE materials
SET current_stock = 0
WHERE id NOT IN (
    SELECT id FROM materials
    WHERE name ILIKE '%carvão%' OR name ILIKE '%carvao%'
);

-- =============================================================================
-- PASSO 3: VERIFICAÇÃO PÓS-LIMPEZA
-- =============================================================================

-- 3a. Confirmar estoques zerados (exceto carvão)
SELECT name, current_stock, unit
FROM materials
ORDER BY name;

-- 3b. Confirmar que não há inventory_movements restantes (exceto carvão)
SELECT
    m.name,
    COUNT(im.id) AS movements_restantes
FROM materials m
LEFT JOIN inventory_movements im ON im.material_id = m.id
GROUP BY m.id, m.name
ORDER BY m.name;

-- 3c. Confirmar que não há inbound_deliveries restantes
SELECT COUNT(*) AS deliveries_restantes
FROM inbound_deliveries id2
JOIN transactions t ON t.id = id2.transaction_id
WHERE t.material_id NOT IN (
    SELECT id FROM materials
    WHERE name ILIKE '%carvão%' OR name ILIKE '%carvao%'
);

-- =============================================================================
-- NOTA: Após rodar este script, use o sistema (Balança > Importar) para
-- reimportar os tickets da planilha da balança. Os tickets serão vinculados
-- automaticamente às ordens de compra existentes no financeiro via FIFO.
-- =============================================================================
