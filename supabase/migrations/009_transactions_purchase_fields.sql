-- =============================================================================
-- MIGRATION: 009_transactions_purchase_fields
-- Description: Adds supplier_id and quantity columns to transactions for Balança integration
-- Date: 2026-01-22
-- =============================================================================

-- 1. Add supplier_id column with FK to suppliers
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;

COMMENT ON COLUMN transactions.supplier_id IS 'Fornecedor vinculado (para compras de matéria-prima)';

-- 2. Add quantity column for material purchases
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS quantity DECIMAL(15, 3);

COMMENT ON COLUMN transactions.quantity IS 'Quantidade esperada de material (usado na Balança para calcular saldo pendente)';

-- 3. Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_transactions_supplier ON transactions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_transactions_material ON transactions(material_id);
