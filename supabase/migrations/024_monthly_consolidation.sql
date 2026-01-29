-- Migration 024: Monthly Consolidation
-- Description: Adds monthly closure control, reporting view, and immutability triggers.

-- 1. Create Monthly Closures Table
CREATE TABLE IF NOT EXISTS carvao_monthly_closures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_date DATE NOT NULL, -- First day of the month (e.g., 2026-01-01)
    is_closed BOOLEAN DEFAULT false NOT NULL,
    closed_at TIMESTAMP WITH TIME ZONE,
    closed_by UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT carvao_monthly_closures_reference_date_key UNIQUE (reference_date)
);

-- Enable RLS
ALTER TABLE carvao_monthly_closures ENABLE ROW LEVEL SECURITY;

-- Policies for carvao_monthly_closures
-- View: Authenticated users can view
CREATE POLICY "Users can view monthly closures" ON carvao_monthly_closures
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Manage: Only Admins/Gerentes can manage (simplified for now to authenticated, ideally role-based)
-- Using existing pattern for convenience, or restricting if roles exist.
-- Assuming 'authenticated' for now, can be refined later with specific roles.
CREATE POLICY "Users can manage monthly closures" ON carvao_monthly_closures
    FOR ALL
    USING (auth.role() = 'authenticated');


-- 2. Create Reporting View
-- Flattens the data structure for easier Excel export
CREATE OR REPLACE VIEW carvao_monthly_report_view AS
SELECT
    d.id AS discharge_id,
    d.discharge_date,
    to_char(d.discharge_date, 'YYYY-MM') AS month_year,
    
    -- Supplier Info
    s.name AS supplier_name,
    
    -- Schedule/Invoice Info
    sch.truck_plate,
    sch.invoice_number,
    sch.gca_number,
    
    -- Discharge Data
    d.volume_mdc,
    d.density,
    d.moisture_content,
    d.impurity_content,
    d.observations,
    d.is_confirmed,
    
    -- Timestamps
    d.created_at,
    d.updated_at

FROM carvao_discharges d
JOIN carvao_suppliers s ON d.supplier_id = s.id
JOIN carvao_discharge_schedule sch ON d.schedule_id = sch.id
WHERE d.is_confirmed = true; -- Only confirmed discharges appear in official reports


-- 3. Immutability Trigger
-- Function to check if the month is closed
CREATE OR REPLACE FUNCTION check_carvao_month_closed()
RETURNS TRIGGER AS $$
DECLARE
    row_date DATE;
    month_start DATE;
    is_month_closed BOOLEAN;
BEGIN
    -- Determine the date to check
    IF (TG_OP = 'DELETE') THEN
        row_date := OLD.discharge_date;
    ELSE
        row_date := NEW.discharge_date;
    END IF;

    -- Calculate first day of the month
    month_start := date_trunc('month', row_date)::DATE;

    -- Check if closure exists and is closed
    SELECT is_closed INTO is_month_closed
    FROM carvao_monthly_closures
    WHERE reference_date = month_start;

    -- If record exists and is_closed is true, block operation
    IF is_month_closed THEN
        RAISE EXCEPTION 'Operação bloqueada: O mês de % está fechado para edições.', to_char(row_date, 'MM/YYYY');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to carvao_discharges
CREATE TRIGGER check_month_closed_discharges
    BEFORE INSERT OR UPDATE OR DELETE ON carvao_discharges
    FOR EACH ROW
    EXECUTE FUNCTION check_carvao_month_closed();

-- Apply trigger to carvao_discharge_schedule (optional, but good practice if schedule date changes affect month)
-- Skipping for schedule for now to keep it simple, focusing on the actual discharge record which is the financial fact.

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON carvao_monthly_closures TO authenticated;
GRANT SELECT ON carvao_monthly_report_view TO authenticated;
