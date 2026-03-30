-- =============================================================================
-- MIGRATION 037: Allow unlinked deliveries (without purchase order)
-- Enables importing scale deliveries when supplier+material are known
-- but no open purchase order exists in the system.
-- =============================================================================

-- 1. Make transaction_id nullable
ALTER TABLE inbound_deliveries ALTER COLUMN transaction_id DROP NOT NULL;

-- 2. Add material_id and supplier_id columns
ALTER TABLE inbound_deliveries
    ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES materials(id),
    ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id);

-- 3. Backfill material_id and supplier_id from linked transactions
UPDATE inbound_deliveries d
SET
    material_id = t.material_id,
    supplier_id = t.supplier_id
FROM transactions t
WHERE d.transaction_id = t.id
  AND d.material_id IS NULL;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_inbound_deliveries_material_id ON inbound_deliveries(material_id);
CREATE INDEX IF NOT EXISTS idx_inbound_deliveries_supplier_id ON inbound_deliveries(supplier_id);

-- 5. Constraint: every delivery must be identifiable
-- Either linked to a transaction OR have material+supplier
ALTER TABLE inbound_deliveries
    ADD CONSTRAINT chk_delivery_identifiable
    CHECK (transaction_id IS NOT NULL OR (material_id IS NOT NULL AND supplier_id IS NOT NULL));
