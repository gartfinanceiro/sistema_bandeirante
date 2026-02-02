-- Migration 031: Soft Delete for Inbound Deliveries

DO $$ 
BEGIN 
    -- Add deleted_at if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inbound_deliveries' AND column_name = 'deleted_at') THEN
        ALTER TABLE inbound_deliveries 
        ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;

    -- Add deleted_by if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inbound_deliveries' AND column_name = 'deleted_by') THEN
        ALTER TABLE inbound_deliveries 
        ADD COLUMN deleted_by UUID REFERENCES auth.users(id);
    END IF;

    -- Add status column if not exists (for explicit status control)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inbound_deliveries' AND column_name = 'status') THEN
        ALTER TABLE inbound_deliveries 
        ADD COLUMN status TEXT DEFAULT 'active';
    END IF;
END $$;
