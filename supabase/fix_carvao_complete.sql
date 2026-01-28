-- =============================================================================
-- SCRIPT DEFINITIVO: Corrigir Todas as Funções e Policies do Módulo Carvão
-- =============================================================================
-- Execute este script COMPLETO no SQL Editor do Supabase
-- Este script substitui TUDO de uma vez, garantindo consistência
-- =============================================================================

-- =============================================================================
-- PARTE 1: DELETAR TODAS AS POLICIES E FUNÇÕES ANTIGAS
-- =============================================================================

-- Drop all existing policies (ordem correta: policies antes de funções)
DROP POLICY IF EXISTS carvao_suppliers_select ON carvao_suppliers CASCADE;
DROP POLICY IF EXISTS carvao_suppliers_insert ON carvao_suppliers CASCADE;
DROP POLICY IF EXISTS carvao_suppliers_update ON carvao_suppliers CASCADE;
DROP POLICY IF EXISTS carvao_suppliers_delete ON carvao_suppliers CASCADE;
DROP POLICY IF EXISTS carvao_suppliers_insert_comprador_admin ON carvao_suppliers CASCADE;
DROP POLICY IF EXISTS carvao_suppliers_update_comprador_admin ON carvao_suppliers CASCADE;

DROP POLICY IF EXISTS carvao_supplier_documents_select ON carvao_supplier_documents CASCADE;
DROP POLICY IF EXISTS carvao_supplier_documents_insert ON carvao_supplier_documents CASCADE;
DROP POLICY IF EXISTS carvao_supplier_documents_update ON carvao_supplier_documents CASCADE;
DROP POLICY IF EXISTS carvao_supplier_documents_delete ON carvao_supplier_documents CASCADE;
DROP POLICY IF EXISTS carvao_docs_insert_comprador_admin ON carvao_supplier_documents CASCADE;

DROP POLICY IF EXISTS carvao_discharge_schedule_select ON carvao_discharge_schedule CASCADE;
DROP POLICY IF EXISTS carvao_discharge_schedule_insert ON carvao_discharge_schedule CASCADE;
DROP POLICY IF EXISTS carvao_discharge_schedule_update ON carvao_discharge_schedule CASCADE;
DROP POLICY IF EXISTS carvao_discharge_schedule_delete ON carvao_discharge_schedule CASCADE;
DROP POLICY IF EXISTS carvao_schedule_insert_comprador_operacao ON carvao_discharge_schedule CASCADE;

DROP POLICY IF EXISTS carvao_discharges_select ON carvao_discharges CASCADE;
DROP POLICY IF EXISTS carvao_discharges_insert ON carvao_discharges CASCADE;
DROP POLICY IF EXISTS carvao_discharges_update ON carvao_discharges CASCADE;
DROP POLICY IF EXISTS carvao_discharges_delete ON carvao_discharges CASCADE;
DROP POLICY IF EXISTS carvao_discharges_insert_operacao_admin ON carvao_discharges CASCADE;

DROP POLICY IF EXISTS carvao_monthly_consolidation_select ON carvao_monthly_consolidation CASCADE;
DROP POLICY IF EXISTS carvao_monthly_consolidation_insert ON carvao_monthly_consolidation CASCADE;
DROP POLICY IF EXISTS carvao_monthly_consolidation_update ON carvao_monthly_consolidation CASCADE;
DROP POLICY IF EXISTS carvao_monthly_consolidation_delete ON carvao_monthly_consolidation CASCADE;

DROP POLICY IF EXISTS carvao_audit_log_select ON carvao_audit_log CASCADE;
DROP POLICY IF EXISTS carvao_audit_log_insert ON carvao_audit_log CASCADE;

-- Drop old helper functions
DROP FUNCTION IF EXISTS carvao_has_role(TEXT) CASCADE;
DROP FUNCTION IF EXISTS carvao_is_admin() CASCADE;

-- =============================================================================
-- PARTE 2: RECRIAR A FUNÇÃO DE TRIGGER (CORRIGIDA)
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
  'Atualiza updated_at automaticamente, respeitando imutabilidade';

-- =============================================================================
-- PARTE 3: CRIAR POLICIES SIMPLIFICADAS (AUTHENTICATED ONLY)
-- =============================================================================

-- carvao_suppliers
CREATE POLICY carvao_suppliers_select ON carvao_suppliers 
  FOR SELECT USING (auth.role() = 'authenticated');
  
CREATE POLICY carvao_suppliers_insert ON carvao_suppliers 
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  
CREATE POLICY carvao_suppliers_update ON carvao_suppliers 
  FOR UPDATE USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');
  
CREATE POLICY carvao_suppliers_delete ON carvao_suppliers 
  FOR DELETE USING (auth.role() = 'authenticated');

-- carvao_supplier_documents
CREATE POLICY carvao_supplier_documents_select ON carvao_supplier_documents 
  FOR SELECT USING (auth.role() = 'authenticated');
  
CREATE POLICY carvao_supplier_documents_insert ON carvao_supplier_documents 
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  
CREATE POLICY carvao_supplier_documents_update ON carvao_supplier_documents 
  FOR UPDATE USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');
  
CREATE POLICY carvao_supplier_documents_delete ON carvao_supplier_documents 
  FOR DELETE USING (auth.role() = 'authenticated');

-- carvao_discharge_schedule
CREATE POLICY carvao_discharge_schedule_select ON carvao_discharge_schedule 
  FOR SELECT USING (auth.role() = 'authenticated');
  
CREATE POLICY carvao_discharge_schedule_insert ON carvao_discharge_schedule 
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  
CREATE POLICY carvao_discharge_schedule_update ON carvao_discharge_schedule 
  FOR UPDATE USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');
  
CREATE POLICY carvao_discharge_schedule_delete ON carvao_discharge_schedule 
  FOR DELETE USING (auth.role() = 'authenticated');

-- carvao_discharges (com imutabilidade)
CREATE POLICY carvao_discharges_select ON carvao_discharges 
  FOR SELECT USING (auth.role() = 'authenticated');
  
CREATE POLICY carvao_discharges_insert ON carvao_discharges 
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  
CREATE POLICY carvao_discharges_update ON carvao_discharges 
  FOR UPDATE 
  USING (auth.role() = 'authenticated' AND is_confirmed = false) 
  WITH CHECK (auth.role() = 'authenticated' AND is_confirmed = false);
  
CREATE POLICY carvao_discharges_delete ON carvao_discharges 
  FOR DELETE USING (auth.role() = 'authenticated' AND is_confirmed = false);

-- carvao_monthly_consolidation (com imutabilidade)
CREATE POLICY carvao_monthly_consolidation_select ON carvao_monthly_consolidation 
  FOR SELECT USING (auth.role() = 'authenticated');
  
CREATE POLICY carvao_monthly_consolidation_insert ON carvao_monthly_consolidation 
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  
CREATE POLICY carvao_monthly_consolidation_update ON carvao_monthly_consolidation 
  FOR UPDATE 
  USING (auth.role() = 'authenticated' AND is_closed = false) 
  WITH CHECK (auth.role() = 'authenticated' AND is_closed = false);
  
CREATE POLICY carvao_monthly_consolidation_delete ON carvao_monthly_consolidation 
  FOR DELETE USING (auth.role() = 'authenticated' AND is_closed = false);

-- carvao_audit_log (read-only)
CREATE POLICY carvao_audit_log_select ON carvao_audit_log 
  FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================================
-- ✅ CONCLUÍDO
-- =============================================================================
-- Teste agora:
-- 1. Criar fornecedor
-- 2. Editar fornecedor
-- 3. Registrar descarga
-- 
-- NÃO deve mais aparecer o erro: "record 'old' has no field 'is_confirmed'"
-- =============================================================================
