-- =============================================================================
-- CORREÇÃO: Transações de matéria-prima com material_id NULL
-- =============================================================================
-- Problema: Quando uma transação de saída é criada com categoria estática
-- (raw_material_ore, raw_material_flux, etc.), o código não resolvia o
-- material_id da tabela transaction_categories. Isso resultava em transações
-- sem material_id, que não aparecem na Balança.
--
-- Este script corrige as transações existentes vinculando o material_id
-- correto baseado na categoria da transação.
-- =============================================================================

-- =============================================================================
-- PASSO 1: DIAGNÓSTICO — Ver transações sem material_id que deveriam ter
-- =============================================================================

-- 1a. Transações de saída com categoria de matéria-prima mas sem material_id
SELECT
    t.id,
    t.date,
    t.description,
    t.amount,
    t.quantity,
    t.material_id,
    t.supplier_id,
    t.category_id,
    tc.name AS category_name,
    tc.slug AS category_slug,
    tc.material_id AS category_material_id,
    s.name AS supplier_name
FROM transactions t
LEFT JOIN transaction_categories tc ON tc.slug = t.category_id
LEFT JOIN suppliers s ON s.id = t.supplier_id
WHERE t.type = 'saida'
  AND t.material_id IS NULL
  AND t.category_id IN ('raw_material_ore', 'raw_material_flux', 'raw_material_charcoal', 'raw_material_general')
  AND tc.material_id IS NOT NULL
ORDER BY t.date DESC;

-- 1b. Contagem por categoria
SELECT
    tc.name AS category_name,
    tc.slug AS category_slug,
    COUNT(*) AS transacoes_sem_material
FROM transactions t
JOIN transaction_categories tc ON tc.slug = t.category_id
WHERE t.type = 'saida'
  AND t.material_id IS NULL
  AND t.category_id IN ('raw_material_ore', 'raw_material_flux', 'raw_material_charcoal', 'raw_material_general')
  AND tc.material_id IS NOT NULL
GROUP BY tc.name, tc.slug
ORDER BY transacoes_sem_material DESC;

-- =============================================================================
-- PASSO 2: CORREÇÃO — Vincular material_id da categoria à transação
-- =============================================================================
-- ATENÇÃO: Rode o PASSO 1 primeiro para verificar quais transações serão afetadas.

-- 2a. Atualizar material_id nas transações baseado na categoria
UPDATE transactions t
SET material_id = tc.material_id
FROM transaction_categories tc
WHERE tc.slug = t.category_id
  AND t.type = 'saida'
  AND t.material_id IS NULL
  AND t.category_id IN ('raw_material_ore', 'raw_material_flux', 'raw_material_charcoal', 'raw_material_general')
  AND tc.material_id IS NOT NULL;

-- =============================================================================
-- PASSO 3: CORREÇÃO ADICIONAL — Transações sem categoria mas com fornecedor
-- =============================================================================
-- Algumas transações podem ter sido criadas sem category_id mas com supplier_id.
-- Podemos vincular o material via o fornecedor (suppliers.material_id).

-- 3a. Diagnóstico: transações com fornecedor de matéria-prima mas sem material_id
SELECT
    t.id,
    t.date,
    t.description,
    t.amount,
    t.quantity,
    t.material_id,
    t.supplier_id,
    s.name AS supplier_name,
    s.material_id AS supplier_material_id,
    m.name AS material_name
FROM transactions t
JOIN suppliers s ON s.id = t.supplier_id
JOIN materials m ON m.id = s.material_id
WHERE t.type = 'saida'
  AND t.material_id IS NULL
  AND s.material_id IS NOT NULL
ORDER BY t.date DESC;

-- 3b. Corrigir material_id via fornecedor
UPDATE transactions t
SET material_id = s.material_id
FROM suppliers s
WHERE s.id = t.supplier_id
  AND t.type = 'saida'
  AND t.material_id IS NULL
  AND s.material_id IS NOT NULL;

-- =============================================================================
-- PASSO 4: VERIFICAÇÃO PÓS-CORREÇÃO
-- =============================================================================

-- 4a. Conferir se ainda restam transações de matéria-prima sem material_id
SELECT
    t.id,
    t.date,
    t.description,
    t.amount,
    t.quantity,
    t.supplier_id,
    s.name AS supplier_name,
    tc.name AS category_name,
    tc.slug AS category_slug
FROM transactions t
LEFT JOIN transaction_categories tc ON tc.slug = t.category_id
LEFT JOIN suppliers s ON s.id = t.supplier_id
WHERE t.type = 'saida'
  AND t.material_id IS NULL
  AND (
    t.category_id IN ('raw_material_ore', 'raw_material_flux', 'raw_material_charcoal', 'raw_material_general')
    OR s.material_id IS NOT NULL
  )
ORDER BY t.date DESC;

-- 4b. Visão geral: transações de matéria-prima agora com material_id
SELECT
    m.name AS material,
    COUNT(*) AS total_transacoes,
    SUM(CASE WHEN t.quantity IS NOT NULL AND t.quantity > 0 THEN 1 ELSE 0 END) AS com_quantidade,
    SUM(CASE WHEN t.quantity IS NULL OR t.quantity = 0 THEN 1 ELSE 0 END) AS sem_quantidade,
    ROUND(SUM(t.amount)::numeric, 2) AS valor_total
FROM transactions t
JOIN materials m ON m.id = t.material_id
WHERE t.type = 'saida'
GROUP BY m.id, m.name
ORDER BY m.name;

-- =============================================================================
-- NOTA: Após rodar este script, as transações de matéria-prima terão
-- material_id preenchido. Transações que ainda estiverem sem quantity
-- precisam ser corrigidas manualmente no Financeiro (editar e preencher
-- a quantidade em toneladas).
--
-- Com o código atualizado (createTransaction, importSheetTransactions,
-- updateTransaction), novas transações de matéria-prima terão o material_id
-- preenchido automaticamente, mesmo quando a categoria estática é selecionada.
-- =============================================================================
