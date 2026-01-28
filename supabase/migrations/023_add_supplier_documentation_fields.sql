-- =============================================================================
-- Migration: 023 - Adicionar campos de documentação da planilha
-- Descrição: Adiciona todos os 22 campos da planilha Excel ao carvao_suppliers
-- Data: 2026-01-28
-- Objetivo: Sistema deve substituir completamente a planilha Excel
-- =============================================================================

-- Adicionar campos de documentação em carvao_suppliers
ALTER TABLE carvao_suppliers

-- Dados da Propriedade
ADD COLUMN property_name TEXT,
ADD COLUMN city TEXT,
ADD COLUMN state CHAR(2),
ADD COLUMN owner_name TEXT,
ADD COLUMN owner_cpf TEXT,

-- Documentos Ambientais (números/referências dos documentos)
ADD COLUMN dcf_number TEXT,
ADD COLUMN car_number TEXT,
ADD COLUMN dae_forestal_number TEXT,
ADD COLUMN dae_payment_date DATE,
ADD COLUMN dae_volume_area TEXT,
ADD COLUMN dstc TEXT,
ADD COLUMN authorized_area TEXT,
ADD COLUMN species TEXT,

-- Contrato
ADD COLUMN contract_exists BOOLEAN DEFAULT false,
ADD COLUMN contract_signed BOOLEAN DEFAULT false,
ADD COLUMN contract_volume NUMERIC(12,2),
ADD COLUMN contract_value NUMERIC(14,2),

-- Arrendamento / Intermediação
ADD COLUMN is_leased BOOLEAN DEFAULT false,
ADD COLUMN intermediary_name TEXT,

-- Observações Gerais
ADD COLUMN documentation_notes TEXT;

-- Comentários
COMMENT ON COLUMN carvao_suppliers.property_name IS 'Nome da propriedade/fazenda';
COMMENT ON COLUMN carvao_suppliers.city IS 'Município da propriedade';
COMMENT ON COLUMN carvao_suppliers.state IS 'UF da propriedade (2 caracteres)';
COMMENT ON COLUMN carvao_suppliers.owner_name IS 'Nome do proprietário da terra';
COMMENT ON COLUMN carvao_suppliers.owner_cpf IS 'CPF do proprietário';

COMMENT ON COLUMN carvao_suppliers.dcf_number IS 'Número do DCF (Documento de Controle Florestal)';
COMMENT ON COLUMN carvao_suppliers.car_number IS 'Número do CAR (Cadastro Ambiental Rural)';
COMMENT ON COLUMN carvao_suppliers.dae_forestal_number IS 'Número do DAE Taxa Florestal';
COMMENT ON COLUMN carvao_suppliers.dae_payment_date IS 'Data de pagamento do DAE';
COMMENT ON COLUMN carvao_suppliers.dae_volume_area IS 'Volume DAE / Área Total';
COMMENT ON COLUMN carvao_suppliers.dstc IS 'DSTC (Declaração de Substituição da Taxa de Controle)';
COMMENT ON COLUMN carvao_suppliers.authorized_area IS 'Área autorizada para exploração';
COMMENT ON COLUMN carvao_suppliers.species IS 'Espécie de madeira';

COMMENT ON COLUMN carvao_suppliers.contract_exists IS 'Indica se existe contrato';
COMMENT ON COLUMN carvao_suppliers.contract_signed IS 'Indica se o contrato está assinado';
COMMENT ON COLUMN carvao_suppliers.contract_volume IS 'Volume do contrato';
COMMENT ON COLUMN carvao_suppliers.contract_value IS 'Valor total do contrato';

COMMENT ON COLUMN carvao_suppliers.is_leased IS 'Indica se há arrendamento';
COMMENT ON COLUMN carvao_suppliers.intermediary_name IS 'Nome do intermediador ou transportador';

COMMENT ON COLUMN carvao_suppliers.documentation_notes IS 'Observações gerais sobre documentação';
