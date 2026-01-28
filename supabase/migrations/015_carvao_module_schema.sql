-- =============================================================================
-- BANDEIRANTE | CARVÃO - Módulo Operacional de Compra e Descarga de Carvão
-- Migration: 015_carvao_module_schema.sql
-- Versão: 1.0.0
-- Data: 2026-01-28
-- =============================================================================
-- 
-- Este script cria toda a estrutura do módulo Bandeirante | Carvão,
-- um sistema operacional separado do core financeiro para gestão de:
-- - Fornecedores de carvão
-- - Compliance documental
-- - Agenda de descarga
-- - Registro de descargas
-- - Consolidação mensal
--
-- IMPORTANTE: 
-- - Este módulo NÃO gerencia transações financeiras
-- - Não altera tabelas do core (transactions, materials, etc)
-- - Integração com core via eventos (a ser implementada posteriormente)
-- =============================================================================


-- =============================================================================
-- SEÇÃO 1: TIPOS ENUMERADOS (ENUMs)
-- =============================================================================

-- Status comercial da negociação com fornecedor
CREATE TYPE carvao_commercial_status AS ENUM (
  'em_prospeccao',   -- Primeiro contato, fase inicial
  'em_negociacao',   -- Negociação ativa de preços/condições
  'interessado',     -- Demonstrou interesse, aguardando próximos passos
  'inativo'          -- Sem negociação ativa no momento
);

COMMENT ON TYPE carvao_commercial_status IS 'Status do processo de negociação comercial com fornecedor de carvão';


-- Status documental/compliance do fornecedor
CREATE TYPE carvao_compliance_status AS ENUM (
  'pendente',        -- Documentação não enviada ou incompleta
  'em_analise',      -- Documentos recebidos, em processo de análise
  'aprovado',        -- Aprovado para operar (pode agendar descarga)
  'reprovado',       -- Reprovado - não pode agendar descarga
  'vencido'          -- Documentação expirada - bloqueado até renovação
);

COMMENT ON TYPE carvao_compliance_status IS 'Status da aprovação documental do fornecedor';


-- Status de documentos individuais
CREATE TYPE carvao_document_status AS ENUM (
  'pendente',        -- Aguardando upload do fornecedor
  'em_analise',      -- Documento enviado, aguardando análise
  'aprovado',        -- Documento aprovado
  'reprovado',       -- Documento reprovado - necessita reenvio
  'expirado'         -- Documento vencido
);

COMMENT ON TYPE carvao_document_status IS 'Status de validação de documentos individuais';


-- Status da carga agendada
CREATE TYPE carvao_schedule_status AS ENUM (
  'aguardando',      -- Agendado, aguardando o dia da descarga
  'confirmada',      -- Confirmada presença do caminhão
  'descarregada',    -- Descarga realizada (migra para carvao_discharges)
  'nao_compareceu'   -- Não compareceu no dia agendado
);

COMMENT ON TYPE carvao_schedule_status IS 'Status da carga agendada na fila de descarga';


-- =============================================================================
-- SEÇÃO 2: TABELAS PRINCIPAIS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabela: carvao_suppliers
-- Cadastro de fornecedores de carvão com gestão comercial e compliance
-- -----------------------------------------------------------------------------
CREATE TABLE carvao_suppliers (
  -- Identificação
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  legal_name VARCHAR(200),
  document VARCHAR(20),
  
  -- Contato
  contact_name VARCHAR(100),
  contact_phone VARCHAR(20),
  contact_email VARCHAR(100),
  
  -- Gestão comercial
  buyer_responsible UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  commercial_status carvao_commercial_status NOT NULL DEFAULT 'em_prospeccao',
  last_contact_date DATE,
  
  -- Compliance documental
  compliance_status carvao_compliance_status NOT NULL DEFAULT 'pendente',
  compliance_approved_at TIMESTAMPTZ,
  compliance_approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Observações
  notes TEXT,
  
  -- Controle
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE carvao_suppliers IS 'Cadastro de fornecedores de carvão com status comercial e compliance';
COMMENT ON COLUMN carvao_suppliers.buyer_responsible IS 'Comprador responsável pela negociação';
COMMENT ON COLUMN carvao_suppliers.compliance_status IS 'Status da aprovação documental - apenas "aprovado" pode agendar descarga';
COMMENT ON COLUMN carvao_suppliers.commercial_status IS 'Status da negociação comercial';


-- -----------------------------------------------------------------------------
-- Tabela: carvao_supplier_documents
-- Documentação obrigatória e compliance dos fornecedores
-- -----------------------------------------------------------------------------
CREATE TABLE carvao_supplier_documents (
  -- Identificação
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES carvao_suppliers(id) ON DELETE CASCADE,
  
  -- Tipo e status
  document_type VARCHAR(100) NOT NULL,
  status carvao_document_status NOT NULL DEFAULT 'pendente',
  
  -- Arquivo (Supabase Storage)
  file_path TEXT,
  file_name VARCHAR(255),
  file_size_bytes BIGINT,
  
  -- Upload
  uploaded_at TIMESTAMPTZ,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Validade
  expiry_date DATE,
  
  -- Análise/Aprovação
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  
  -- Controle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE carvao_supplier_documents IS 'Documentação obrigatória dos fornecedores com rastreabilidade completa';
COMMENT ON COLUMN carvao_supplier_documents.document_type IS 'Tipo de documento (ex: Contrato, Alvará Ambiental, Certidões)';
COMMENT ON COLUMN carvao_supplier_documents.file_path IS 'Caminho do arquivo no Supabase Storage';
COMMENT ON COLUMN carvao_supplier_documents.expiry_date IS 'Data de validade do documento (se aplicável)';


-- -----------------------------------------------------------------------------
-- Tabela: carvao_discharge_schedule
-- Agenda diária de descarga com ordem sequencial
-- -----------------------------------------------------------------------------
CREATE TABLE carvao_discharge_schedule (
  -- Identificação
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES carvao_suppliers(id) ON DELETE RESTRICT,
  
  -- Agendamento
  scheduled_date DATE NOT NULL,
  sequence_order INT NOT NULL CHECK (sequence_order > 0),
  
  -- Dados da carga
  truck_plate VARCHAR(20) NOT NULL,
  invoice_number VARCHAR(50) NOT NULL,
  gca_number VARCHAR(50) NOT NULL,
  estimated_volume_mdc DECIMAL(10, 3) NOT NULL,
  
  -- Status
  status carvao_schedule_status NOT NULL DEFAULT 'aguardando',
  confirmed_at TIMESTAMPTZ,
  no_show_reason TEXT,
  
  -- Observações
  notes TEXT,
  
  -- Controle
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints de unicidade
  CONSTRAINT unique_schedule_order UNIQUE (scheduled_date, sequence_order),
  CONSTRAINT unique_schedule_invoice UNIQUE (scheduled_date, invoice_number)
);

COMMENT ON TABLE carvao_discharge_schedule IS 'Agenda de descarga diária com fila sequencial (1º, 2º, 3º do dia)';
COMMENT ON COLUMN carvao_discharge_schedule.sequence_order IS 'Ordem da descarga no dia (1º, 2º, 3º...)';
COMMENT ON COLUMN carvao_discharge_schedule.estimated_volume_mdc IS 'Volume estimado em MDC (metros de carvão)';
COMMENT ON COLUMN carvao_discharge_schedule.gca_number IS 'Número do GCA - Guia de Controle Ambiental';

COMMENT ON CONSTRAINT unique_schedule_order ON carvao_discharge_schedule IS 
  'Garante que não haja duplicação de ordem de descarga no mesmo dia';
COMMENT ON CONSTRAINT unique_schedule_invoice ON carvao_discharge_schedule IS 
  'Previne agendamento duplicado da mesma NF no mesmo dia';


-- -----------------------------------------------------------------------------
-- Tabela: carvao_discharges
-- Registro definitivo de descargas realizadas (IMUTÁVEL após confirmação)
-- -----------------------------------------------------------------------------
CREATE TABLE carvao_discharges (
  -- Identificação
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES carvao_discharge_schedule(id) ON DELETE SET NULL,
  supplier_id UUID NOT NULL REFERENCES carvao_suppliers(id) ON DELETE RESTRICT,
  
  -- Data efetiva
  discharge_date DATE NOT NULL,
  
  -- Dados da carga
  truck_plate VARCHAR(20) NOT NULL,
  invoice_number VARCHAR(50) NOT NULL,
  gca_number VARCHAR(50) NOT NULL,
  
  -- Medições
  volume_mdc DECIMAL(10, 3) NOT NULL,
  density DECIMAL(10, 3) NOT NULL,
  weight_tons DECIMAL(10, 3),  -- Calculado automaticamente por trigger
  
  -- Observações
  observations TEXT,
  
  -- Confirmação (torna registro imutável)
  is_confirmed BOOLEAN NOT NULL DEFAULT false,
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Consolidação mensal
  consolidation_month VARCHAR(7),  -- Formato: YYYY-MM
  is_consolidated BOOLEAN NOT NULL DEFAULT false,
  
  -- Controle
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraint: previne duplicação de carga (mesma NF + GCA)
  CONSTRAINT unique_discharge_invoice_gca UNIQUE (invoice_number, gca_number)
);

COMMENT ON TABLE carvao_discharges IS 'Registro definitivo de descargas - IMUTÁVEL após confirmação';
COMMENT ON COLUMN carvao_discharges.volume_mdc IS 'Volume real descarregado em MDC (metros de carvão)';
COMMENT ON COLUMN carvao_discharges.density IS 'Densidade da carga em kg/mdc';
COMMENT ON COLUMN carvao_discharges.weight_tons IS 'Peso calculado: (volume_mdc × density) ÷ 1000';
COMMENT ON COLUMN carvao_discharges.is_confirmed IS 'Quando TRUE, campos críticos tornam-se imutáveis';
COMMENT ON COLUMN carvao_discharges.consolidation_month IS 'Mês de consolidação (YYYY-MM) para agrupamento';

COMMENT ON CONSTRAINT unique_discharge_invoice_gca ON carvao_discharges IS 
  'Garante unicidade da carga - previne duplicação de NF + GCA';


-- -----------------------------------------------------------------------------
-- Tabela: carvao_monthly_consolidation
-- Snapshot mensal imutável para histórico e relatórios
-- -----------------------------------------------------------------------------
CREATE TABLE carvao_monthly_consolidation (
  -- Identificação
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month VARCHAR(7) NOT NULL UNIQUE,  -- Formato: YYYY-MM
  
  -- Totalizadores
  total_discharges INT NOT NULL DEFAULT 0,
  total_volume_mdc DECIMAL(15, 3) NOT NULL DEFAULT 0,
  total_weight_tons DECIMAL(15, 3) NOT NULL DEFAULT 0,
  
  -- Fechamento (torna registro imutável)
  is_closed BOOLEAN NOT NULL DEFAULT false,
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Observações
  notes TEXT,
  
  -- Controle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE carvao_monthly_consolidation IS 'Consolidação mensal das descargas - substitui planilha mensal';
COMMENT ON COLUMN carvao_monthly_consolidation.month IS 'Mês de referência no formato YYYY-MM';
COMMENT ON COLUMN carvao_monthly_consolidation.is_closed IS 'Quando TRUE, mês está fechado e não pode ser alterado';


-- -----------------------------------------------------------------------------
-- Tabela: carvao_audit_log
-- Log de auditoria para alterações em registros imutáveis
-- -----------------------------------------------------------------------------
CREATE TABLE carvao_audit_log (
  -- Identificação
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Registro alterado
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  
  -- Ação realizada
  action VARCHAR(50) NOT NULL,  -- UPDATE, DELETE
  
  -- Valores
  old_values JSONB,
  new_values JSONB,
  
  -- Justificativa
  reason TEXT NOT NULL,
  
  -- Controle
  changed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE carvao_audit_log IS 'Log de auditoria de alterações em registros confirmados/consolidados';
COMMENT ON COLUMN carvao_audit_log.reason IS 'Justificativa obrigatória para alteração de registro imutável';


-- =============================================================================
-- SEÇÃO 3: ÍNDICES PARA PERFORMANCE
-- =============================================================================

-- Índices em carvao_suppliers
CREATE INDEX idx_carvao_suppliers_compliance ON carvao_suppliers(compliance_status) WHERE is_active = true;
CREATE INDEX idx_carvao_suppliers_commercial ON carvao_suppliers(commercial_status) WHERE is_active = true;
CREATE INDEX idx_carvao_suppliers_buyer ON carvao_suppliers(buyer_responsible) WHERE is_active = true;

-- Índices em carvao_supplier_documents
CREATE INDEX idx_carvao_docs_supplier ON carvao_supplier_documents(supplier_id);
CREATE INDEX idx_carvao_docs_status ON carvao_supplier_documents(status);
CREATE INDEX idx_carvao_docs_expiry ON carvao_supplier_documents(expiry_date) WHERE expiry_date IS NOT NULL;

-- Índices em carvao_discharge_schedule
CREATE INDEX idx_carvao_schedule_date ON carvao_discharge_schedule(scheduled_date DESC);
CREATE INDEX idx_carvao_schedule_status ON carvao_discharge_schedule(status);
CREATE INDEX idx_carvao_schedule_supplier ON carvao_discharge_schedule(supplier_id);

-- Índices em carvao_discharges
CREATE INDEX idx_carvao_discharges_date ON carvao_discharges(discharge_date DESC);
CREATE INDEX idx_carvao_discharges_month ON carvao_discharges(consolidation_month) WHERE consolidation_month IS NOT NULL;
CREATE INDEX idx_carvao_discharges_confirmed ON carvao_discharges(is_confirmed);
CREATE INDEX idx_carvao_discharges_supplier ON carvao_discharges(supplier_id);

-- Índices em carvao_monthly_consolidation
CREATE INDEX idx_carvao_consolidation_month ON carvao_monthly_consolidation(month DESC);
CREATE INDEX idx_carvao_consolidation_closed ON carvao_monthly_consolidation(is_closed);

-- Índices em carvao_audit_log
CREATE INDEX idx_carvao_audit_table ON carvao_audit_log(table_name, record_id);
CREATE INDEX idx_carvao_audit_date ON carvao_audit_log(changed_at DESC);
CREATE INDEX idx_carvao_audit_user ON carvao_audit_log(changed_by);


-- =============================================================================
-- SEÇÃO 4: TRIGGERS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Trigger: Atualizar campo updated_at automaticamente
-- IMPORTANTE: Respeita imutabilidade de registros confirmados
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_carvao_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Para carvao_discharges: NÃO atualiza updated_at se registro confirmado
  -- Registros confirmados são IMUTÁVEIS (exceto por ações admin futuras)
  IF TG_TABLE_NAME = 'carvao_discharges' AND OLD.is_confirmed = true THEN
    NEW.updated_at = OLD.updated_at;  -- Mantém timestamp original
  ELSE
    NEW.updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_carvao_updated_at() IS 
  'Atualiza updated_at automaticamente, respeitando imutabilidade de registros confirmados';

-- Aplicar em todas as tabelas com updated_at
CREATE TRIGGER trigger_carvao_suppliers_updated_at
  BEFORE UPDATE ON carvao_suppliers
  FOR EACH ROW EXECUTE FUNCTION update_carvao_updated_at();

CREATE TRIGGER trigger_carvao_docs_updated_at
  BEFORE UPDATE ON carvao_supplier_documents
  FOR EACH ROW EXECUTE FUNCTION update_carvao_updated_at();

CREATE TRIGGER trigger_carvao_schedule_updated_at
  BEFORE UPDATE ON carvao_discharge_schedule
  FOR EACH ROW EXECUTE FUNCTION update_carvao_updated_at();

CREATE TRIGGER trigger_carvao_discharges_updated_at
  BEFORE UPDATE ON carvao_discharges
  FOR EACH ROW EXECUTE FUNCTION update_carvao_updated_at();

CREATE TRIGGER trigger_carvao_consolidation_updated_at
  BEFORE UPDATE ON carvao_monthly_consolidation
  FOR EACH ROW EXECUTE FUNCTION update_carvao_updated_at();


-- -----------------------------------------------------------------------------
-- Trigger: Calcular weight_tons automaticamente
-- Fórmula: (volume_mdc × density) ÷ 1000
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_carvao_weight_tons()
RETURNS TRIGGER AS $$
BEGIN
  -- Calcular peso somente se ambos os valores estiverem presentes
  IF NEW.volume_mdc IS NOT NULL AND NEW.density IS NOT NULL THEN
    NEW.weight_tons := ROUND((NEW.volume_mdc * NEW.density) / 1000, 3);
  ELSE
    NEW.weight_tons := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_weight_tons
  BEFORE INSERT OR UPDATE OF volume_mdc, density ON carvao_discharges
  FOR EACH ROW EXECUTE FUNCTION calculate_carvao_weight_tons();

COMMENT ON FUNCTION calculate_carvao_weight_tons() IS 
  'Calcula automaticamente o peso em toneladas: (volume_mdc × density) ÷ 1000';


-- -----------------------------------------------------------------------------
-- Trigger: Atualizar consolidation_month automaticamente
-- Extrai YYYY-MM da discharge_date
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_carvao_consolidation_month()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.discharge_date IS NOT NULL THEN
    NEW.consolidation_month := TO_CHAR(NEW.discharge_date, 'YYYY-MM');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_consolidation_month
  BEFORE INSERT OR UPDATE OF discharge_date ON carvao_discharges
  FOR EACH ROW EXECUTE FUNCTION set_carvao_consolidation_month();

COMMENT ON FUNCTION set_carvao_consolidation_month() IS 
  'Define automaticamente o mês de consolidação baseado na data de descarga';


-- =============================================================================
-- FIM DA MIGRATION
-- =============================================================================
