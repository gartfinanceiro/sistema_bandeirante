-- Tabela de contas fixas mensais
CREATE TABLE IF NOT EXISTS recurring_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id VARCHAR(100) REFERENCES transaction_categories(slug),
    supplier_id UUID REFERENCES suppliers(id),
    expected_amount DECIMAL(12,2),      -- Valor esperado (null = variável sem estimativa)
    is_fixed_amount BOOLEAN DEFAULT false,  -- true = valor sempre igual
    due_day INTEGER NOT NULL CHECK (due_day >= 1 AND due_day <= 31),  -- Dia do vencimento
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_recurring_bills_active ON recurring_bills(is_active) WHERE is_active = true;
CREATE INDEX idx_recurring_bills_category ON recurring_bills(category_id);

-- RLS
ALTER TABLE recurring_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage recurring bills"
    ON recurring_bills FOR ALL
    TO authenticated
    USING (true) WITH CHECK (true);
