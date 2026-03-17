-- =============================================================================
-- CORREÇÃO DEFINITIVA: Estoque de Carvão Vegetal
-- =============================================================================
-- Baseado no diagnóstico de 17/03/2026
--
-- Estoque atual (inventory_movements): 2.193,85 m³
-- Meta (planilha): ~3.100 m³
--
-- CAUSA 1: 4 movimentos duplicados "Correção estoque" = 463 m³ (INFLAM o estoque)
-- CAUSA 2: 6 compras diretas com volume na descrição SEM movement = 537,95 m³
-- CAUSA 3: 7 adiantamentos Maciel Prado finalizados SEM movement = ??? m³
--
-- Cálculo: 2.193,85 - 463 + 537,95 = 2.268,80 m³ (faltam ~831 m³ dos adiantamentos)
-- =============================================================================

-- =============================================================================
-- PASSO 0: Obter material_id do Carvão
-- =============================================================================
-- RODE PRIMEIRO e anote o ID retornado para confirmar.

SELECT id, name, current_stock, unit
FROM materials
WHERE name ILIKE '%carvão%' OR name ILIKE '%carvao%';

-- =============================================================================
-- PASSO 1: REMOVER 4 movimentos duplicados "Correção estoque" (Janeiro)
-- =============================================================================
-- Estes movimentos duplicam "Compra Carvão (Importação Planilha)" das mesmas datas.
-- IDs confirmados pelo diagnóstico:

DELETE FROM inventory_movements
WHERE id IN (
    '03c5dbd3-5ccd-4e12-80a7-86f2282d130a',  -- 2026-01-26: 131 m³
    '3f9bbd72-53b8-405f-874b-76de5d90b315',  -- 2026-01-27: 127 m³
    '2138c0d8-30eb-4ea5-87bc-11169b351dec',  -- 2026-01-28: 84 m³
    '64a42132-57e8-49b4-bb44-cfd72b7cb3d2'   -- 2026-01-28: 121 m³
);
-- Resultado esperado: 4 rows deleted (= -463 m³)

-- =============================================================================
-- PASSO 2: CRIAR movimentos para 6 compras diretas com volume conhecido
-- =============================================================================
-- Volume extraído da descrição da transação.
-- Usando subquery para material_id do carvão.

-- 2a. Edward Borba Costa - 77,7m (05/03)
INSERT INTO inventory_movements (material_id, date, quantity, unit_price, total_value, movement_type, reference_id, notes)
SELECT m.id, '2026-03-05', 77.7, 23725.69/77.7, 23725.69, 'compra',
    'ba3dbe29-92d2-4852-94c8-d1cc1302cbf9',
    'Compra Carvão - Edward Borba Costa - 77,7 MDC (correção)'
FROM materials m WHERE m.name ILIKE '%carvão%' OR m.name ILIKE '%carvao%' LIMIT 1;

-- 2b. Dias E Viana - 118m (06/03)
INSERT INTO inventory_movements (material_id, date, quantity, unit_price, total_value, movement_type, reference_id, notes)
SELECT m.id, '2026-03-06', 118.0, 37760.00/118.0, 37760.00, 'compra',
    'e1971a3b-1462-478d-85bc-9208ec4fb77e',
    'Compra Carvão - Dias E Viana - 118 MDC (correção)'
FROM materials m WHERE m.name ILIKE '%carvão%' OR m.name ILIKE '%carvao%' LIMIT 1;

-- 2c. Edward Borba Costa - 77,7m (09/03)
INSERT INTO inventory_movements (material_id, date, quantity, unit_price, total_value, movement_type, reference_id, notes)
SELECT m.id, '2026-03-09', 77.7, 23737.35/77.7, 23737.35, 'compra',
    '072c44bc-b2cc-4ed0-889a-080f51ebb86d',
    'Compra Carvão - Edward Borba Costa - 77,7 MDC (correção)'
FROM materials m WHERE m.name ILIKE '%carvão%' OR m.name ILIKE '%carvao%' LIMIT 1;

-- 2d. Rocha Empreendimentos - 70,8m (09/03)
INSERT INTO inventory_movements (material_id, date, quantity, unit_price, total_value, movement_type, reference_id, notes)
SELECT m.id, '2026-03-09', 70.8, 22656.00/70.8, 22656.00, 'compra',
    '85d541bc-5331-489d-a762-aeb216d1a84f',
    'Compra Carvão - Rocha Empreendimentos - 70,8 MDC (correção)'
FROM materials m WHERE m.name ILIKE '%carvão%' OR m.name ILIKE '%carvao%' LIMIT 1;

-- 2e. Salvio Nonato - 125,9m (10/03)
INSERT INTO inventory_movements (material_id, date, quantity, unit_price, total_value, movement_type, reference_id, notes)
SELECT m.id, '2026-03-10', 125.9, 36511.00/125.9, 36511.00, 'compra',
    '1822822b-bedc-4144-9e1a-67155a660c90',
    'Compra Carvão - Salvio Nonato - 125,9 MDC (correção)'
FROM materials m WHERE m.name ILIKE '%carvão%' OR m.name ILIKE '%carvao%' LIMIT 1;

-- 2f. Armando Machado Da Fonseca - 67,85m (13/03)
INSERT INTO inventory_movements (material_id, date, quantity, unit_price, total_value, movement_type, reference_id, notes)
SELECT m.id, '2026-03-13', 67.85, 19715.51/67.85, 19715.51, 'compra',
    'fea7e5ec-bf72-425d-94f7-b50da873577f',
    'Compra Carvão - Armando Machado Da Fonseca - 67,85 MDC (correção)'
FROM materials m WHERE m.name ILIKE '%carvão%' OR m.name ILIKE '%carvao%' LIMIT 1;

-- Resultado esperado: 6 rows inserted (= +537,95 m³)

-- =============================================================================
-- PASSO 3: CRIAR movimentos para 7 adiantamentos Maciel Prado SEM movement
-- =============================================================================
-- ⚠️  ATENÇÃO: Preciso que você informe o VOLUME (MDC) de cada carga.
-- O 8º adiantamento (11/03 → 16/03, R$5.592) JÁ TEM movimento (126,8 m³).
--
-- Substitua <VOLUME> pelo volume real de cada carga antes de rodar.
-- O valor total de cada carga = advance_amount + complement_amount.

-- 3a. Maciel Prado - Adiantamento 11/02, Complemento 13/02 (R$35.000 + R$3.055 = R$38.055)
-- INSERT INTO inventory_movements (material_id, date, quantity, unit_price, total_value, movement_type, reference_id, notes)
-- SELECT m.id, '2026-02-13', <VOLUME>, 38055.00/<VOLUME>, 38055.00, 'compra',
--     '241b6c06-ab29-441f-8853-715c421f574e',
--     'Adiantamento Carvão - Maciel Prado - <VOLUME> MDC (correção)'
-- FROM materials m WHERE m.name ILIKE '%carvão%' OR m.name ILIKE '%carvao%' LIMIT 1;

-- 3b. Maciel Prado - Adiantamento 11/02, Complemento 14/02 (R$35.000 + R$1 = R$35.001)
-- INSERT INTO inventory_movements (material_id, date, quantity, unit_price, total_value, movement_type, reference_id, notes)
-- SELECT m.id, '2026-02-14', <VOLUME>, 35001.00/<VOLUME>, 35001.00, 'compra',
--     'e4ba0ecf-3dbc-4a32-a8c2-9962235a6fb6',
--     'Adiantamento Carvão - Maciel Prado - <VOLUME> MDC (correção)'
-- FROM materials m WHERE m.name ILIKE '%carvão%' OR m.name ILIKE '%carvao%' LIMIT 1;

-- 3c. Maciel Prado - Adiantamento 19/02, Complemento 20/02 (R$35.000 + R$4.968 = R$39.968)
-- INSERT INTO inventory_movements (material_id, date, quantity, unit_price, total_value, movement_type, reference_id, notes)
-- SELECT m.id, '2026-02-20', <VOLUME>, 39968.00/<VOLUME>, 39968.00, 'compra',
--     'a0184b74-044f-4722-967d-c01a271cdb37',
--     'Adiantamento Carvão - Maciel Prado - <VOLUME> MDC (correção)'
-- FROM materials m WHERE m.name ILIKE '%carvão%' OR m.name ILIKE '%carvao%' LIMIT 1;

-- 3d. Maciel Prado - Adiantamento 19/02, Complemento 27/02 (R$35.000 + R$4.811 = R$39.811)
-- INSERT INTO inventory_movements (material_id, date, quantity, unit_price, total_value, movement_type, reference_id, notes)
-- SELECT m.id, '2026-02-27', <VOLUME>, 39811.00/<VOLUME>, 39811.00, 'compra',
--     '6d181145-fd27-4459-8ec7-55c1517a8dc6',
--     'Adiantamento Carvão - Maciel Prado - <VOLUME> MDC (correção)'
-- FROM materials m WHERE m.name ILIKE '%carvão%' OR m.name ILIKE '%carvao%' LIMIT 1;

-- 3e. Maciel Prado - Adiantamento 23/02, Complemento 03/03 (R$35.000 + R$5.912 = R$40.912)
-- INSERT INTO inventory_movements (material_id, date, quantity, unit_price, total_value, movement_type, reference_id, notes)
-- SELECT m.id, '2026-03-03', <VOLUME>, 40912.00/<VOLUME>, 40912.00, 'compra',
--     'fc8f3ec9-d042-483f-86d2-c1a4548ac030',
--     'Adiantamento Carvão - Maciel Prado - <VOLUME> MDC (correção)'
-- FROM materials m WHERE m.name ILIKE '%carvão%' OR m.name ILIKE '%carvao%' LIMIT 1;

-- 3f. Maciel Prado - Adiantamento 23/02, Complemento 05/03 (R$35.000 + R$3.400 = R$38.400)
-- INSERT INTO inventory_movements (material_id, date, quantity, unit_price, total_value, movement_type, reference_id, notes)
-- SELECT m.id, '2026-03-05', <VOLUME>, 38400.00/<VOLUME>, 38400.00, 'compra',
--     '958dded0-12ea-4918-a15d-cce2b6e3fbd4',
--     'Adiantamento Carvão - Maciel Prado - <VOLUME> MDC (correção)'
-- FROM materials m WHERE m.name ILIKE '%carvão%' OR m.name ILIKE '%carvao%' LIMIT 1;

-- 3g. Maciel Prado - Adiantamento 06/03, Complemento 11/03 (R$35.000 + R$4.028,50 = R$39.028,50)
-- INSERT INTO inventory_movements (material_id, date, quantity, unit_price, total_value, movement_type, reference_id, notes)
-- SELECT m.id, '2026-03-11', <VOLUME>, 39028.50/<VOLUME>, 39028.50, 'compra',
--     'dac1034c-db1f-4b33-97ad-09b68c3cd48f',
--     'Adiantamento Carvão - Maciel Prado - <VOLUME> MDC (correção)'
-- FROM materials m WHERE m.name ILIKE '%carvão%' OR m.name ILIKE '%carvao%' LIMIT 1;

-- =============================================================================
-- PASSO 4: RECALCULAR current_stock
-- =============================================================================

UPDATE materials
SET current_stock = (
    SELECT COALESCE(SUM(
        CASE
            WHEN im.movement_type IN ('compra', 'producao_entrada', 'ajuste') THEN im.quantity
            WHEN im.movement_type IN ('consumo_producao', 'venda') THEN -im.quantity
            ELSE 0
        END
    ), 0)
    FROM inventory_movements im
    WHERE im.material_id = materials.id
)
WHERE name ILIKE '%carvão%' OR name ILIKE '%carvao%';

-- =============================================================================
-- PASSO 5: VERIFICAÇÃO FINAL
-- =============================================================================

SELECT
    name,
    ROUND(current_stock::numeric, 2) AS current_stock_m3,
    unit,
    (SELECT COUNT(*) FROM inventory_movements im WHERE im.material_id = materials.id) AS total_movements,
    (SELECT ROUND(SUM(
        CASE
            WHEN im.movement_type IN ('compra', 'producao_entrada', 'ajuste') THEN im.quantity
            WHEN im.movement_type IN ('consumo_producao', 'venda') THEN -im.quantity
            ELSE 0
        END
    )::numeric, 2) FROM inventory_movements im WHERE im.material_id = materials.id) AS soma_movements
FROM materials
WHERE name ILIKE '%carvão%' OR name ILIKE '%carvao%';
