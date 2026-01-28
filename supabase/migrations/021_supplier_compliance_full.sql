-- =============================================================================
-- Migration: 021 - Compliance completo (planilha digital)
-- Descrição: Planilha digital que substitui Excel de documentação
-- Data: 2026-01-28
-- =============================================================================

-- Tabela: carvao_supplier_compliance
-- Espelha exatamente a planilha Excel de documentação de fornecedores
-- 1 registro por fornecedor (não normalizado intencionalmente)
-- -----------------------------------------------------------------------------

CREATE TABLE carvao_supplier_compliance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES carvao_suppliers(id) ON DELETE CASCADE,

  -- ===========================================
  -- Dados da Propriedade
  -- ===========================================
  property_name TEXT,
  municipality TEXT,
  uf CHAR(2),
  owner_name TEXT,
  owner_document TEXT,

  -- ===========================================
  -- Documentos Ambientais
  -- ===========================================
  dcf TEXT,
  car TEXT,
  dae_forestal TEXT,
  dae_payment_date DATE,
  dae_volume_area TEXT,
  dstc TEXT,
  authorized_area TEXT,
  species TEXT,

  -- ===========================================
  -- Contrato
  -- ===========================================
  has_contract BOOLEAN,
  contract_signed BOOLEAN,
  contract_volume TEXT,
  contract_value TEXT,

  -- ===========================================
  -- Arrendamento / Intermediação
  -- ===========================================
  has_arrendamento BOOLEAN,
  intermediary_name TEXT,

  -- ===========================================
  -- Observações Gerais
  -- ===========================================
  notes TEXT,

  -- ===========================================
  -- Controle
  -- ===========================================
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraint: 1 registro de compliance por fornecedor
  UNIQUE (supplier_id)
);

-- =============================================================================
-- Índices
-- =============================================================================

CREATE INDEX idx_compliance_supplier ON carvao_supplier_compliance(supplier_id);

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================

ALTER TABLE carvao_supplier_compliance ENABLE ROW LEVEL SECURITY;

-- Política de leitura: usuários autenticados
CREATE POLICY carvao_compliance_select 
  ON carvao_supplier_compliance
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Política de inserção: usuários autenticados
CREATE POLICY carvao_compliance_insert 
  ON carvao_supplier_compliance
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Política de atualização: usuários autenticados
CREATE POLICY carvao_compliance_update 
  ON carvao_supplier_compliance
  FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Não permitir DELETE (manter histórico)
-- Se necessário apagar, será via CASCADE do fornecedor

-- =============================================================================
-- Triggers
-- =============================================================================

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON carvao_supplier_compliance
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Grants
-- =============================================================================

GRANT SELECT, INSERT, UPDATE ON carvao_supplier_compliance TO authenticated;

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE carvao_supplier_compliance IS 
  'Planilha digital de compliance - replica exata da planilha Excel de documentação';

COMMENT ON COLUMN carvao_supplier_compliance.supplier_id IS 
  'Referência ao fornecedor (1:1)';

COMMENT ON COLUMN carvao_supplier_compliance.dcf IS 
  'Documento de Controle Florestal';

COMMENT ON COLUMN carvao_supplier_compliance.car IS 
  'Cadastro Ambiental Rural';

COMMENT ON COLUMN carvao_supplier_compliance.dae_forestal IS 
  'DAE Taxa Florestal';

COMMENT ON COLUMN carvao_supplier_compliance.dstc IS 
  'Declaração de Substituição da Taxa de Controle';

COMMENT ON COLUMN carvao_supplier_compliance.has_contract IS 
  'Indica se existe contrato';

COMMENT ON COLUMN carvao_supplier_compliance.contract_signed IS 
  'Indica se contrato está assinado';

COMMENT ON COLUMN carvao_supplier_compliance.has_arrendamento IS 
  'Indica se existe arrendamento';
