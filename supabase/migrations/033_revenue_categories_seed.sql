-- =============================================================================
-- MIGRATION: 033_revenue_categories_seed (Part 2)
-- Description: Creates revenue cost center and categories for 'entrada' transactions
-- Date: 2026-02-26
-- Depends on: 032 (enum value 'receita' must already be committed)
-- =============================================================================

-- 1. Create "Receitas" cost center
INSERT INTO cost_centers (code, name, type, affects_cpt, display_order, description, is_active)
VALUES ('REC', 'Receitas', 'receita', false, 5, 'Categorias de receita e faturamento', true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = true;

-- 2. Seed revenue categories
DO $$
DECLARE
    cc_rec UUID;
BEGIN
    SELECT id INTO cc_rec FROM cost_centers WHERE code = 'REC';

    -- Venda de Ferro-Gusa (primary revenue)
    INSERT INTO transaction_categories (cost_center_id, name, slug, category_type, display_order, is_system)
    VALUES (cc_rec, 'Venda de Ferro-Gusa', 'sale_pig_iron', 'receita', 1, true)
    ON CONFLICT (cost_center_id, name) DO UPDATE
    SET slug = 'sale_pig_iron', category_type = 'receita', is_system = true;

    -- Venda Fazenda
    INSERT INTO transaction_categories (cost_center_id, name, slug, category_type, display_order)
    VALUES (cc_rec, 'Venda Fazenda', 'sale_farm', 'receita', 2)
    ON CONFLICT (cost_center_id, name) DO UPDATE
    SET slug = 'sale_farm', category_type = 'receita';

    -- Receita Financeira
    INSERT INTO transaction_categories (cost_center_id, name, slug, category_type, display_order)
    VALUES (cc_rec, 'Receita Financeira', 'financial_income', 'receita', 3)
    ON CONFLICT (cost_center_id, name) DO UPDATE
    SET slug = 'financial_income', category_type = 'receita';

    -- Outras Receitas (catch-all)
    INSERT INTO transaction_categories (cost_center_id, name, slug, category_type, display_order)
    VALUES (cc_rec, 'Outras Receitas', 'other_revenue', 'receita', 10)
    ON CONFLICT (cost_center_id, name) DO UPDATE
    SET slug = 'other_revenue', category_type = 'receita';
END $$;

-- 3. If there's an existing "Ferro-Gusa" category in expense groups, mark it as 'receita'
UPDATE transaction_categories
SET category_type = 'receita'
WHERE LOWER(name) LIKE '%ferro-gusa%'
  AND category_type = 'despesa';
