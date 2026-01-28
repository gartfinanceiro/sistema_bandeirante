-- =============================================================================
-- Migration: 020 - Add Operational Fields to Discharge Records
-- =============================================================================
-- Módulo: Bandeirante | Carvão
-- Data: 2026-01-28
-- 
-- OBJETIVO:
-- Expandir carvao_discharges para armazenar TODOS os dados operacionais
-- e comerciais da planilha mensal, transformando a confirmação de descarga
-- no registro definitivo e completo da carga.
--
-- IMPORTANTE:
-- - Esses campos são declarativos (não geram transações financeiras)
-- - Todos os campos são opcionais (nullable)
-- - Tornam-se imutáveis após is_confirmed = true (garantido por RLS)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- GRUPO 1: Qualidade e Medições
-- -----------------------------------------------------------------------------

ALTER TABLE carvao_discharges
  ADD COLUMN impurity_percent DECIMAL(5,2),
  ADD COLUMN humidity_percent DECIMAL(5,2),
  ADD COLUMN discount_mdc DECIMAL(10,3),
  ADD COLUMN discount_kg DECIMAL(10,3);

COMMENT ON COLUMN carvao_discharges.impurity_percent IS 
  'Percentual de impureza detectado na carga (0-100%)';
  
COMMENT ON COLUMN carvao_discharges.humidity_percent IS 
  'Percentual de umidade detectado na carga (0-100%)';
  
COMMENT ON COLUMN carvao_discharges.discount_mdc IS 
  'Desconto aplicado em metros de carvão (MDC)';
  
COMMENT ON COLUMN carvao_discharges.discount_kg IS 
  'Desconto aplicado em quilogramas (kg)';

-- -----------------------------------------------------------------------------
-- GRUPO 2: Classificação
-- -----------------------------------------------------------------------------

ALTER TABLE carvao_discharges
  ADD COLUMN cargo_type VARCHAR(20);

COMMENT ON COLUMN carvao_discharges.cargo_type IS 
  'Tipo de carga: juridico (pessoa jurídica) ou fisico (pessoa física)';

-- Constraint para garantir valores válidos
ALTER TABLE carvao_discharges
  ADD CONSTRAINT carvao_discharges_cargo_type_check
  CHECK (cargo_type IN ('juridico', 'fisico'));

-- -----------------------------------------------------------------------------
-- GRUPO 3: Valores de Referência (informativos)
-- -----------------------------------------------------------------------------

ALTER TABLE carvao_discharges
  ADD COLUMN price_per_ton DECIMAL(10,2),
  ADD COLUMN gross_value DECIMAL(15,2),
  ADD COLUMN funrural_value DECIMAL(15,2),
  ADD COLUMN net_value DECIMAL(15,2),
  ADD COLUMN payment_date DATE;

COMMENT ON COLUMN carvao_discharges.price_per_ton IS 
  'Preço por tonelada (R$/ton) - INFORMATIVO, não gera pagamento';
  
COMMENT ON COLUMN carvao_discharges.gross_value IS 
  'Valor bruto da carga (R$) - INFORMATIVO, não gera pagamento';
  
COMMENT ON COLUMN carvao_discharges.funrural_value IS 
  'Valor do Funrural (R$) - INFORMATIVO, não gera pagamento';
  
COMMENT ON COLUMN carvao_discharges.net_value IS 
  'Valor líquido da carga (R$) - INFORMATIVO, não gera pagamento';
  
COMMENT ON COLUMN carvao_discharges.payment_date IS 
  'Data informativa de pagamento - NÃO cria transação no financeiro';

-- -----------------------------------------------------------------------------
-- GRUPO 4: Identificação Adicional
-- -----------------------------------------------------------------------------

ALTER TABLE carvao_discharges
  ADD COLUMN meter_operator VARCHAR(100),
  ADD COLUMN agent_name VARCHAR(200);

COMMENT ON COLUMN carvao_discharges.meter_operator IS 
  'Nome do metreiro responsável pela medição';
  
COMMENT ON COLUMN carvao_discharges.agent_name IS 
  'Nome do procurador ou representante do fornecedor';

-- -----------------------------------------------------------------------------
-- Índices para Performance (opcional, mas recomendado)
-- -----------------------------------------------------------------------------

-- Índice para facilitar queries por tipo de carga
CREATE INDEX idx_carvao_discharges_cargo_type 
  ON carvao_discharges(cargo_type) 
  WHERE cargo_type IS NOT NULL;

-- Índice para facilitar queries por data de pagamento
CREATE INDEX idx_carvao_discharges_payment_date 
  ON carvao_discharges(payment_date) 
  WHERE payment_date IS NOT NULL;

-- =============================================================================
-- VALIDAÇÃO
-- =============================================================================
-- Verificar que todos os campos foram adicionados:
--
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'carvao_discharges'
--   AND column_name IN (
--     'impurity_percent', 'humidity_percent', 'discount_mdc', 'discount_kg',
--     'cargo_type', 'price_per_ton', 'gross_value', 'funrural_value',
--     'net_value', 'payment_date', 'meter_operator', 'agent_name'
--   )
-- ORDER BY column_name;
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Documentação Final
-- -----------------------------------------------------------------------------

COMMENT ON TABLE carvao_discharges IS 
  'Registro completo de descargas de carvão com dados operacionais, comerciais e documentais. 
  Substitui planilhas manuais após a confirmação (is_confirmed = true).
  IMPORTANTE: Campos de valor são informativos e NÃO geram transações financeiras.';
