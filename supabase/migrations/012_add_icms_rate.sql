-- Add icms_rate column to suppliers table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'icms_rate') THEN
        ALTER TABLE suppliers ADD COLUMN icms_rate DECIMAL(5,2) DEFAULT 0;
    END IF;
END $$;
