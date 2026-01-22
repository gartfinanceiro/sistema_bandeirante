-- =============================================================================
-- MIGRATION: 006_categories_seed
-- Description: Adds slug to transaction_categories and seeds standard categories
-- =============================================================================

-- 1. Add slug column
ALTER TABLE transaction_categories 
ADD COLUMN IF NOT EXISTS slug VARCHAR(50) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_categories_slug ON transaction_categories(slug);

COMMENT ON COLUMN transaction_categories.slug IS 'Identificador único amigável para uso no frontend (hardcoded)';

-- 2. Seed Data (Upsert based on slug or name)
-- We need to look up Cost Center IDs or Insert them if missing.

DO $$
DECLARE
    -- Cost Center IDs
    cc_od UUID;
    cc_oi UUID;
    cc_rh UUID;
    cc_adm UUID;
    cc_nop UUID;
    
    -- Material IDs (for mapping)
    mat_charcoal UUID;
    mat_ore UUID;
    mat_flux UUID;
BEGIN
    -- -------------------------------------------------------------------------
    -- Ensure Cost Centers Exist (Upsert by code)
    -- -------------------------------------------------------------------------
    
    -- Operacional Direto (OD)
    INSERT INTO cost_centers (code, name, type, display_order)
    VALUES ('OD', 'Operacional Direto', 'operacional_direto', 10)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO cc_od;
    
    -- Operacional Indireto (OI)
    INSERT INTO cost_centers (code, name, type, display_order)
    VALUES ('OI', 'Operacional Indireto', 'operacional_indireto', 20)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO cc_oi;

    -- RH (RH)
    INSERT INTO cost_centers (code, name, type, display_order)
    VALUES ('RH', 'Recursos Humanos', 'recursos_humanos', 30)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO cc_rh;

    -- Administrativo (ADM)
    INSERT INTO cost_centers (code, name, type, display_order)
    VALUES ('ADM', 'Administrativo / Financeiro', 'administrativo', 40)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO cc_adm;

    -- Não Operacional (NOP)
    INSERT INTO cost_centers (code, name, type, display_order)
    VALUES ('NOP', 'Não Operacional', 'nao_operacional', 90)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO cc_nop;

    -- -------------------------------------------------------------------------
    -- Find Materials (for linking)
    -- -------------------------------------------------------------------------
    SELECT id INTO mat_charcoal FROM materials WHERE name ILIKE '%carvão%' LIMIT 1;
    SELECT id INTO mat_ore FROM materials WHERE name ILIKE '%minério%' OR name ILIKE '%ferro%' LIMIT 1;
    SELECT id INTO mat_flux FROM materials WHERE name ILIKE '%fundente%' OR name ILIKE '%cal%' LIMIT 1;

    -- -------------------------------------------------------------------------
    -- Upsert Categories
    -- -------------------------------------------------------------------------

    -- OD: Carvão Vegetal -> raw_material_charcoal
    INSERT INTO transaction_categories (cost_center_id, name, slug, material_id, requires_weight, display_order)
    VALUES (cc_od, 'Carvão Vegetal', 'raw_material_charcoal', mat_charcoal, true, 1)
    ON CONFLICT (cost_center_id, name) DO UPDATE 
    SET slug = 'raw_material_charcoal', material_id = mat_charcoal, requires_weight = true;

    -- OD: Minério de Ferro -> raw_material_ore
    INSERT INTO transaction_categories (cost_center_id, name, slug, material_id, requires_weight, display_order)
    VALUES (cc_od, 'Minério de Ferro', 'raw_material_ore', mat_ore, true, 2)
    ON CONFLICT (cost_center_id, name) DO UPDATE 
    SET slug = 'raw_material_ore', material_id = mat_ore, requires_weight = true;
    
    -- OD: Fundentes -> raw_material_flux
    INSERT INTO transaction_categories (cost_center_id, name, slug, material_id, requires_weight, display_order)
    VALUES (cc_od, 'Fundentes', 'raw_material_flux', mat_flux, true, 3)
    ON CONFLICT (cost_center_id, name) DO UPDATE 
    SET slug = 'raw_material_flux', material_id = mat_flux, requires_weight = true;

    -- OD: Energia Elétrica -> energy
    INSERT INTO transaction_categories (cost_center_id, name, slug, display_order)
    VALUES (cc_od, 'Energia Elétrica', 'energy', 4)
    ON CONFLICT (cost_center_id, name) DO UPDATE SET slug = 'energy';

    -- OD: Fretes de Insumos -> freight
    INSERT INTO transaction_categories (cost_center_id, name, slug, display_order)
    VALUES (cc_od, 'Fretes de Insumos', 'freight', 5)
    ON CONFLICT (cost_center_id, name) DO UPDATE SET slug = 'freight';


    -- OI: Manutenção Mecânica -> maintenance_mech
    INSERT INTO transaction_categories (cost_center_id, name, slug, display_order)
    VALUES (cc_oi, 'Manutenção Mecânica', 'maintenance_mech', 1)
    ON CONFLICT (cost_center_id, name) DO UPDATE SET slug = 'maintenance_mech';

    -- OI: Manutenção Elétrica -> maintenance_elec
    INSERT INTO transaction_categories (cost_center_id, name, slug, display_order)
    VALUES (cc_oi, 'Manutenção Elétrica', 'maintenance_elec', 2)
    ON CONFLICT (cost_center_id, name) DO UPDATE SET slug = 'maintenance_elec';

    -- OI: Consumíveis/EPIs -> consumables
    INSERT INTO transaction_categories (cost_center_id, name, slug, display_order)
    VALUES (cc_oi, 'Consumíveis/EPIs', 'consumables', 3)
    ON CONFLICT (cost_center_id, name) DO UPDATE SET slug = 'consumables';

    -- OI: Combustíveis -> fuel
    INSERT INTO transaction_categories (cost_center_id, name, slug, display_order)
    VALUES (cc_oi, 'Combustíveis', 'fuel', 4)
    ON CONFLICT (cost_center_id, name) DO UPDATE SET slug = 'fuel';


    -- RH: Salários -> salary
    INSERT INTO transaction_categories (cost_center_id, name, slug, display_order)
    VALUES (cc_rh, 'Salários', 'salary', 1)
    ON CONFLICT (cost_center_id, name) DO UPDATE SET slug = 'salary';

    -- RH: Benefícios -> benefits
    INSERT INTO transaction_categories (cost_center_id, name, slug, display_order)
    VALUES (cc_rh, 'Benefícios', 'benefits', 2)
    ON CONFLICT (cost_center_id, name) DO UPDATE SET slug = 'benefits';


    -- ADM: Serviços Terceiros -> admin_services
    INSERT INTO transaction_categories (cost_center_id, name, slug, display_order)
    VALUES (cc_adm, 'Serviços Terceiros', 'admin_services', 1)
    ON CONFLICT (cost_center_id, name) DO UPDATE SET slug = 'admin_services';

    -- ADM: Impostos -> taxes
    INSERT INTO transaction_categories (cost_center_id, name, slug, display_order)
    VALUES (cc_adm, 'Impostos', 'taxes', 2)
    ON CONFLICT (cost_center_id, name) DO UPDATE SET slug = 'taxes';
    
    -- ADM: Tarifas Bancárias -> bank_fees
    INSERT INTO transaction_categories (cost_center_id, name, slug, display_order)
    VALUES (cc_adm, 'Tarifas Bancárias', 'bank_fees', 3)
    ON CONFLICT (cost_center_id, name) DO UPDATE SET slug = 'bank_fees';

    -- ADM: Telecomunicações (Internet/Telefonia) -> telecom
    INSERT INTO transaction_categories (cost_center_id, name, slug, display_order)
    VALUES (cc_adm, 'Telecomunicações (Internet/Telefonia)', 'telecom', 4)
    ON CONFLICT (cost_center_id, name) DO UPDATE SET slug = 'telecom';


    -- NOP: Distribuição de Lucros -> dividends
    INSERT INTO transaction_categories (cost_center_id, name, slug, display_order)
    VALUES (cc_nop, 'Distribuição de Lucros', 'dividends', 1)
    ON CONFLICT (cost_center_id, name) DO UPDATE SET slug = 'dividends';

    -- NOP: Investimentos -> investments
    INSERT INTO transaction_categories (cost_center_id, name, slug, display_order)
    VALUES (cc_nop, 'Investimentos', 'investments', 2)
    ON CONFLICT (cost_center_id, name) DO UPDATE SET slug = 'investments';

END $$;
