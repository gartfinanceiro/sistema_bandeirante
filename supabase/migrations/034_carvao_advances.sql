-- =============================================================================
-- MIGRATION: 034_carvao_advances
-- Description: Creates carvao_advances table to track charcoal advance payments
--              and link financial transactions to operational discharges
-- Date: 2026-03-13
-- =============================================================================
--
-- FLUXO DO ADIANTAMENTO:
-- 1. Adiantamento pago → cria transaction (saída) + carvao_advances (status: adiantamento_pago)
--    SEM movimento de estoque, SEM volume (metragem ainda desconhecida)
--
-- 2. Carvão descarregado → operador vincula descarga ao adiantamento
--    Volume medido, estoque atualizado, status → descarregado
--    Sistema calcula valor total (peso × preço/ton) e saldo pendente
--
-- 3. Complemento pago → cria transaction do complemento, status → finalizado
--
-- IMPORTANTE:
-- - Conecta o mundo financeiro (transactions) ao operacional (carvao_discharges)
-- - Não altera tabelas existentes
-- - carvao_supplier_id e supplier_id são mantidos separados (dois sistemas)
-- =============================================================================


-- =============================================================================
-- SEÇÃO 1: TIPO ENUMERADO
-- =============================================================================

CREATE TYPE carvao_advance_status AS ENUM (
    'adiantamento_pago',   -- Adiantamento pago, aguardando descarga
    'descarregado',        -- Descarga vinculada, aguardando complemento
    'finalizado'           -- Complemento pago, ciclo encerrado
);

COMMENT ON TYPE carvao_advance_status IS 'Status do ciclo de adiantamento de carvão';


-- =============================================================================
-- SEÇÃO 2: TABELA PRINCIPAL
-- =============================================================================

CREATE TABLE carvao_advances (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Fornecedor (dois sistemas separados)
    carvao_supplier_id UUID REFERENCES carvao_suppliers(id) ON DELETE RESTRICT,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,

    -- Status do ciclo
    status carvao_advance_status NOT NULL DEFAULT 'adiantamento_pago',

    -- Adiantamento (pagamento inicial)
    advance_transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
    advance_amount DECIMAL(15, 2) NOT NULL,
    advance_date DATE NOT NULL,

    -- Descarga vinculada (NULL até a descarga acontecer)
    discharge_id UUID REFERENCES carvao_discharges(id) ON DELETE SET NULL,
    discharge_date DATE,

    -- Valor total calculado após descarga (peso × preço/ton)
    total_calculated_value DECIMAL(15, 2),
    price_per_ton_used DECIMAL(10, 2),

    -- Complemento (pagamento da diferença)
    complement_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    complement_amount DECIMAL(15, 2),
    complement_date DATE,

    -- Observações
    notes TEXT,

    -- Controle
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE carvao_advances IS
    'Rastreamento de adiantamentos de carvão - conecta pagamentos financeiros a descargas operacionais';

COMMENT ON COLUMN carvao_advances.carvao_supplier_id IS
    'Fornecedor no módulo operacional Carvão (opcional se não cadastrado)';

COMMENT ON COLUMN carvao_advances.supplier_id IS
    'Fornecedor no módulo financeiro (para vincular à transaction)';

COMMENT ON COLUMN carvao_advances.advance_transaction_id IS
    'Transação financeira do adiantamento (saída)';

COMMENT ON COLUMN carvao_advances.advance_amount IS
    'Valor pago como adiantamento (R$)';

COMMENT ON COLUMN carvao_advances.discharge_id IS
    'Descarga vinculada - NULL até o carvão ser descarregado';

COMMENT ON COLUMN carvao_advances.total_calculated_value IS
    'Valor total calculado após descarga (peso_tons × price_per_ton_used)';

COMMENT ON COLUMN carvao_advances.price_per_ton_used IS
    'Preço por tonelada usado no cálculo do valor total';

COMMENT ON COLUMN carvao_advances.complement_transaction_id IS
    'Transação financeira do complemento (diferença entre total e adiantamento)';

COMMENT ON COLUMN carvao_advances.complement_amount IS
    'Valor do complemento pago (R$)';


-- =============================================================================
-- SEÇÃO 3: ÍNDICES
-- =============================================================================

CREATE INDEX idx_carvao_advances_status ON carvao_advances(status);
CREATE INDEX idx_carvao_advances_supplier ON carvao_advances(carvao_supplier_id) WHERE carvao_supplier_id IS NOT NULL;
CREATE INDEX idx_carvao_advances_financial_supplier ON carvao_advances(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX idx_carvao_advances_discharge ON carvao_advances(discharge_id) WHERE discharge_id IS NOT NULL;
CREATE INDEX idx_carvao_advances_advance_tx ON carvao_advances(advance_transaction_id);
CREATE INDEX idx_carvao_advances_complement_tx ON carvao_advances(complement_transaction_id) WHERE complement_transaction_id IS NOT NULL;
CREATE INDEX idx_carvao_advances_date ON carvao_advances(advance_date DESC);


-- =============================================================================
-- SEÇÃO 4: TRIGGER updated_at
-- =============================================================================

CREATE TRIGGER trigger_carvao_advances_updated_at
    BEFORE UPDATE ON carvao_advances
    FOR EACH ROW EXECUTE FUNCTION update_carvao_updated_at();


-- =============================================================================
-- SEÇÃO 5: RLS POLICIES
-- =============================================================================

ALTER TABLE carvao_advances ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read
CREATE POLICY "carvao_advances_select" ON carvao_advances
    FOR SELECT TO authenticated
    USING (true);

-- Authenticated users can insert
CREATE POLICY "carvao_advances_insert" ON carvao_advances
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Authenticated users can update
CREATE POLICY "carvao_advances_update" ON carvao_advances
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);


-- =============================================================================
-- FIM DA MIGRATION
-- =============================================================================
