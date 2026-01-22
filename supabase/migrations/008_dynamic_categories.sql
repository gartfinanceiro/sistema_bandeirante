-- =============================================================================
-- MIGRATION: 008_dynamic_categories
-- Description: Adds columns for dynamic category management with system protection
-- Date: 2026-01-22
-- =============================================================================

-- 1. Add is_system flag to protect critical categories from deletion
ALTER TABLE transaction_categories
ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;

COMMENT ON COLUMN transaction_categories.is_system IS 'TRUE for system-critical categories (Carvão, Minério, Fundentes) that cannot be deleted';

-- 2. Add category_type for filtering categories by transaction type
ALTER TABLE transaction_categories
ADD COLUMN IF NOT EXISTS category_type VARCHAR(20) DEFAULT 'despesa';

-- Add check constraint for valid values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_category_type'
    ) THEN
        ALTER TABLE transaction_categories
        ADD CONSTRAINT chk_category_type 
        CHECK (category_type IN ('receita', 'despesa', 'ambos'));
    END IF;
END $$;

COMMENT ON COLUMN transaction_categories.category_type IS 'Type of transaction this category applies to: receita, despesa, or ambos';

-- 3. Mark system-critical categories that are linked to material/stock logic
UPDATE transaction_categories
SET is_system = true
WHERE slug IN (
    'raw_material_charcoal',  -- Carvão Vegetal
    'raw_material_ore',       -- Minério de Ferro
    'raw_material_flux'       -- Fundentes
);

-- 4. Set all existing expense categories as 'despesa' type (default behavior preserved)
-- Categories in operational cost centers are typically expenses
UPDATE transaction_categories
SET category_type = 'despesa'
WHERE category_type IS NULL;

-- 5. Create an index for common queries
CREATE INDEX IF NOT EXISTS idx_categories_system ON transaction_categories(is_system);
CREATE INDEX IF NOT EXISTS idx_categories_type ON transaction_categories(category_type);
