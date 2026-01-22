-- Migration 005: Scale Module (Physical Entry Separation)

-- 1. Create inbound_deliveries table
CREATE TABLE IF NOT EXISTS inbound_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    plate TEXT NOT NULL,
    weight_measured DECIMAL(10, 2) NOT NULL, -- The actual weight measured at the scale
    driver_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Optional: Link to the user who registered it (operator)
    created_by UUID REFERENCES auth.users(id)
);

-- 2. Indexes for performance
CREATE INDEX idx_inbound_deliveries_transaction_id ON inbound_deliveries(transaction_id);
CREATE INDEX idx_inbound_deliveries_date ON inbound_deliveries(date);

-- Comments
COMMENT ON TABLE inbound_deliveries IS 'Registros de entrada física (pesagem) vinculados a uma compra financeira';
COMMENT ON COLUMN inbound_deliveries.weight_measured IS 'Peso líquido aferido na balança (em toneladas/kg conforme unidade do material)';
