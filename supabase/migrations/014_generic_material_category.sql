-- =============================================================================
-- MIGRATION: 014_generic_material_category
-- Add generic 'Insumos Gerais' category for dynamic materials
-- =============================================================================

DO $$
DECLARE
    cc_od UUID;
BEGIN
    -- Get cost center OD
    SELECT id INTO cc_od FROM cost_centers WHERE code = 'OD';

    IF cc_od IS NOT NULL THEN
        INSERT INTO transaction_categories (cost_center_id, name, slug, requires_weight, display_order)
        VALUES (cc_od, 'Outros Insumos', 'raw_material_general', true, 6)
        ON CONFLICT (slug) DO NOTHING;
    END IF;
END $$;
