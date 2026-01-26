-- =============================================================================
-- MIGRATION: 013_fiscal_schema
-- Add ICMS control to Contracts and Shipments (Outputs/Debits)
-- =============================================================================

-- 1. Add icms_rate to CONTRACTS (Default Output Rate)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'icms_rate') THEN
        ALTER TABLE contracts ADD COLUMN icms_rate DECIMAL(5,2) DEFAULT 12.00; -- Default Interstate Rate
    END IF;
END $$;

COMMENT ON COLUMN contracts.icms_rate IS 'Alíquota de ICMS padrão para este contrato (%)';

-- 2. Add icms fields to SHIPMENTS (Snapshot per shipment)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'icms_rate') THEN
        ALTER TABLE shipments ADD COLUMN icms_rate DECIMAL(5,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'icms_value') THEN
        ALTER TABLE shipments ADD COLUMN icms_value DECIMAL(15,2);
    END IF;
END $$;

COMMENT ON COLUMN shipments.icms_rate IS 'Snapshot da alíquota de ICMS aplicada nesta expedição';
COMMENT ON COLUMN shipments.icms_value IS 'Valor de ICMS (Débito) gerado por esta expedição';

-- 3. Function to calculate ICMS on Shipment
CREATE OR REPLACE FUNCTION calculate_shipment_icms()
RETURNS TRIGGER AS $$
DECLARE
    contract_icms_rate DECIMAL(5,2);
BEGIN
    -- Only calculate if status is final or relevant (e.g. not 'em_usina') 
    -- BUT for projection cards, we might want to calculate as soon as values are known.
    -- Let's calculate whenever total_value is present.

    -- 1. If icms_rate is not provided, fetch from contract
    IF NEW.icms_rate IS NULL AND NEW.contract_id IS NOT NULL THEN
        SELECT icms_rate INTO contract_icms_rate 
        FROM contracts 
        WHERE id = NEW.contract_id;
        
        NEW.icms_rate := COALESCE(contract_icms_rate, 12.00); -- Fallback to 12%
    END IF;

    -- 2. Calculate Value
    IF NEW.total_value IS NOT NULL AND NEW.total_value > 0 AND NEW.icms_rate IS NOT NULL THEN
        NEW.icms_value := ROUND(NEW.total_value * (NEW.icms_rate / 100), 2);
    ELSE
        NEW.icms_value := 0;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger
DROP TRIGGER IF EXISTS trigger_calculate_shipment_icms ON shipments;

CREATE TRIGGER trigger_calculate_shipment_icms
    BEFORE INSERT OR UPDATE OF total_value, icms_rate, contract_id ON shipments
    FOR EACH ROW EXECUTE FUNCTION calculate_shipment_icms();
