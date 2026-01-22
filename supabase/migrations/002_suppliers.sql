-- Suppliers table for raw material vendors
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    material_type VARCHAR(50) NOT NULL CHECK (material_type IN ('carvao', 'minerio', 'fundentes')),
    default_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    has_icms BOOLEAN DEFAULT false,
    icms_rate DECIMAL(5, 2) DEFAULT 0,
    contact_name VARCHAR(255),
    contact_phone VARCHAR(50),
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for active suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(is_active, material_type);

-- Insert some default suppliers for testing
INSERT INTO suppliers (name, material_type, default_price, has_icms) VALUES
('Carvoaria São José', 'carvao', 180.00, true),
('Mineradora Vale Verde', 'minerio', 350.00, true),
('Fundentes MG', 'fundentes', 120.00, false)
ON CONFLICT DO NOTHING;
