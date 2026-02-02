-- Add weight_fiscal column to inbound_deliveries
-- Use numeric(10,2) or similar to match weight_measured (assuming numeric)

DO $$ 
BEGIN 
    -- Add column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inbound_deliveries' AND column_name = 'weight_fiscal') THEN
        ALTER TABLE inbound_deliveries 
        ADD COLUMN weight_fiscal numeric;
    END IF;

    -- Add basic validation constraint
    -- ALTER TABLE inbound_deliveries ADD CONSTRAINT weight_fiscal_positive CHECK (weight_fiscal >= 0);
END $$;
