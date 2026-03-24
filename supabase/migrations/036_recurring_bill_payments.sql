-- =============================================================================
-- Migration 036: Tabela de vinculo persistido entre contas fixas e pagamentos
-- =============================================================================
-- Resolve o problema de auto-match por category_id que vincula a transacao
-- errada quando multiplas contas fixas compartilham a mesma categoria.

CREATE TABLE IF NOT EXISTS recurring_bill_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recurring_bill_id UUID NOT NULL REFERENCES recurring_bills(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    reference_month INTEGER NOT NULL CHECK (reference_month >= 1 AND reference_month <= 12),
    reference_year INTEGER NOT NULL CHECK (reference_year >= 2020 AND reference_year <= 2100),
    linked_at TIMESTAMPTZ DEFAULT NOW(),
    linked_by TEXT DEFAULT 'auto', -- 'auto' ou 'manual'

    -- Uma conta fixa so pode ter um pagamento por mes
    UNIQUE(recurring_bill_id, reference_month, reference_year),
    -- Uma transacao so pode estar vinculada a uma conta fixa por mes
    UNIQUE(transaction_id, reference_month, reference_year)
);

CREATE INDEX idx_rbp_bill_month ON recurring_bill_payments(recurring_bill_id, reference_year, reference_month);
CREATE INDEX idx_rbp_transaction ON recurring_bill_payments(transaction_id);

-- RLS
ALTER TABLE recurring_bill_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage recurring bill payments"
    ON recurring_bill_payments FOR ALL
    TO authenticated
    USING (true) WITH CHECK (true);
