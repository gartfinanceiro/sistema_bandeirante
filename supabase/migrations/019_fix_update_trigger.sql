-- =============================================================================
-- Migration: 019 - Fix update_carvao_updated_at Trigger
-- =============================================================================
-- ISSUE: Trigger function tries to access is_confirmed on ALL tables
-- ERROR: "record 'old' has no field 'is_confirmed'" on carvao_suppliers
-- 
-- SOLUTION: Check table name before accessing table-specific fields
-- =============================================================================

CREATE OR REPLACE FUNCTION update_carvao_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Para carvao_discharges: NÃO atualiza updated_at se registro confirmado
  -- Registros confirmados são IMUTÁVEIS (as RLS policies impedem o UPDATE)
  IF TG_TABLE_NAME = 'carvao_discharges' AND OLD.is_confirmed = true THEN
    NEW.updated_at = OLD.updated_at;  -- Mantém timestamp original
  -- Para carvao_monthly_consolidation: NÃO atualiza updated_at se fechado
  ELSIF TG_TABLE_NAME = 'carvao_monthly_consolidation' AND OLD.is_closed = true THEN
    NEW.updated_at = OLD.updated_at;  -- Mantém timestamp original
  ELSE
    -- Para todas as outras tabelas ou registros não confirmados
    NEW.updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_carvao_updated_at() IS 
  'Atualiza updated_at automaticamente, respeitando imutabilidade de registros confirmados/fechados';

