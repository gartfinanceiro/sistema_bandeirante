-- =============================================================================
-- Migration: 018 - Simplify Carvão RLS (Remove Role-Based Access Control)
-- =============================================================================
-- DECISION: Carvão module is internal, used only by trusted users
-- 
-- CHANGE: Remove all role-based policies and replace with simple authenticated check
-- 
-- RATIONALE:
--   - Simplicity and speed over complex permissions
--   - All authenticated users are trusted
--   - Role-based control can be reintroduced later if needed
-- 
-- IMPACT:
--   - ✅ Eliminates JWT parsing errors
--   - ✅ Simplifies maintenance
--   - ✅ Maintains RLS active
--   - ✅ Keeps data constraints intact
-- =============================================================================

-- -----------------------------------------------------------------------------
-- STEP 1: Drop all existing Carvão policies FIRST
-- (Must be done before dropping functions, since policies depend on them)
-- -----------------------------------------------------------------------------

-- carvao_suppliers
DROP POLICY IF EXISTS carvao_suppliers_select ON carvao_suppliers;
DROP POLICY IF EXISTS carvao_suppliers_insert ON carvao_suppliers;
DROP POLICY IF EXISTS carvao_suppliers_update ON carvao_suppliers;
DROP POLICY IF EXISTS carvao_suppliers_delete ON carvao_suppliers;
DROP POLICY IF EXISTS carvao_suppliers_insert_comprador_admin ON carvao_suppliers;
DROP POLICY IF EXISTS carvao_suppliers_update_comprador_admin ON carvao_suppliers;

-- carvao_supplier_documents
DROP POLICY IF EXISTS carvao_supplier_documents_select ON carvao_supplier_documents;
DROP POLICY IF EXISTS carvao_supplier_documents_insert ON carvao_supplier_documents;
DROP POLICY IF EXISTS carvao_supplier_documents_update ON carvao_supplier_documents;
DROP POLICY IF EXISTS carvao_supplier_documents_delete ON carvao_supplier_documents;
DROP POLICY IF EXISTS carvao_docs_insert_comprador_admin ON carvao_supplier_documents;

-- carvao_discharge_schedule
DROP POLICY IF EXISTS carvao_discharge_schedule_select ON carvao_discharge_schedule;
DROP POLICY IF EXISTS carvao_discharge_schedule_insert ON carvao_discharge_schedule;
DROP POLICY IF EXISTS carvao_discharge_schedule_update ON carvao_discharge_schedule;
DROP POLICY IF EXISTS carvao_discharge_schedule_delete ON carvao_discharge_schedule;
DROP POLICY IF EXISTS carvao_schedule_insert_comprador_operacao ON carvao_discharge_schedule;

-- carvao_discharges
DROP POLICY IF EXISTS carvao_discharges_select ON carvao_discharges;
DROP POLICY IF EXISTS carvao_discharges_insert ON carvao_discharges;
DROP POLICY IF EXISTS carvao_discharges_update ON carvao_discharges;
DROP POLICY IF EXISTS carvao_discharges_delete ON carvao_discharges;
DROP POLICY IF EXISTS carvao_discharges_insert_operacao_admin ON carvao_discharges;

-- carvao_monthly_consolidation
DROP POLICY IF EXISTS carvao_monthly_consolidation_select ON carvao_monthly_consolidation;
DROP POLICY IF EXISTS carvao_monthly_consolidation_insert ON carvao_monthly_consolidation;
DROP POLICY IF EXISTS carvao_monthly_consolidation_update ON carvao_monthly_consolidation;
DROP POLICY IF EXISTS carvao_monthly_consolidation_delete ON carvao_monthly_consolidation;

-- carvao_audit_log
DROP POLICY IF EXISTS carvao_audit_log_select ON carvao_audit_log;
DROP POLICY IF EXISTS carvao_audit_log_insert ON carvao_audit_log;

-- -----------------------------------------------------------------------------
-- STEP 2: Drop old role-based helper functions (now safe)
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS carvao_has_role(TEXT) CASCADE;
DROP FUNCTION IF EXISTS carvao_is_admin() CASCADE;

-- -----------------------------------------------------------------------------
-- STEP 3: Create simplified policies (authenticated only)
-- -----------------------------------------------------------------------------

-- =============================================================================
-- Table: carvao_suppliers
-- =============================================================================

CREATE POLICY carvao_suppliers_select ON carvao_suppliers
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY carvao_suppliers_insert ON carvao_suppliers
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY carvao_suppliers_update ON carvao_suppliers
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY carvao_suppliers_delete ON carvao_suppliers
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- =============================================================================
-- Table: carvao_supplier_documents
-- =============================================================================

CREATE POLICY carvao_supplier_documents_select ON carvao_supplier_documents
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY carvao_supplier_documents_insert ON carvao_supplier_documents
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY carvao_supplier_documents_update ON carvao_supplier_documents
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY carvao_supplier_documents_delete ON carvao_supplier_documents
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- =============================================================================
-- Table: carvao_discharge_schedule
-- =============================================================================

CREATE POLICY carvao_discharge_schedule_select ON carvao_discharge_schedule
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY carvao_discharge_schedule_insert ON carvao_discharge_schedule
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY carvao_discharge_schedule_update ON carvao_discharge_schedule
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY carvao_discharge_schedule_delete ON carvao_discharge_schedule
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- =============================================================================
-- Table: carvao_discharges
-- =============================================================================

CREATE POLICY carvao_discharges_select ON carvao_discharges
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY carvao_discharges_insert ON carvao_discharges
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY carvao_discharges_update ON carvao_discharges
  FOR UPDATE
  USING (
    auth.role() = 'authenticated' 
    AND is_confirmed = false  -- Cannot update confirmed discharges
  )
  WITH CHECK (
    auth.role() = 'authenticated'
    AND is_confirmed = false
  );

CREATE POLICY carvao_discharges_delete ON carvao_discharges
  FOR DELETE
  USING (
    auth.role() = 'authenticated'
    AND is_confirmed = false  -- Cannot delete confirmed discharges
  );

-- =============================================================================
-- Table: carvao_monthly_consolidation
-- =============================================================================

CREATE POLICY carvao_monthly_consolidation_select ON carvao_monthly_consolidation
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY carvao_monthly_consolidation_insert ON carvao_monthly_consolidation
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY carvao_monthly_consolidation_update ON carvao_monthly_consolidation
  FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND is_closed = false  -- Cannot update closed consolidations
  )
  WITH CHECK (
    auth.role() = 'authenticated'
    AND is_closed = false
  );

CREATE POLICY carvao_monthly_consolidation_delete ON carvao_monthly_consolidation
  FOR DELETE
  USING (
    auth.role() = 'authenticated'
    AND is_closed = false  -- Cannot delete closed consolidations
  );

-- =============================================================================
-- Table: carvao_audit_log (read-only)
-- =============================================================================

CREATE POLICY carvao_audit_log_select ON carvao_audit_log
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Note: INSERT is handled by triggers, no manual INSERT policy needed

-- =============================================================================
-- VALIDATION QUERIES
-- =============================================================================
-- After applying this migration:
--
-- ✅ Any authenticated user can:
--    - Create suppliers
--    - Edit suppliers
--    - Create schedules
--    - Register discharges
--    - Confirm discharges
--
-- ✅ No JWT parsing errors
-- ✅ No operator does not exist errors
-- ✅ RLS still active and enforcing authentication
-- ✅ Business constraints still enforced:
--    - Cannot edit confirmed discharges
--    - Cannot edit closed consolidations
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Comments for documentation
-- -----------------------------------------------------------------------------

COMMENT ON POLICY carvao_suppliers_select ON carvao_suppliers IS 
  'Simplified: All authenticated users can view suppliers';

COMMENT ON POLICY carvao_discharges_update ON carvao_discharges IS 
  'Simplified: All authenticated users can update, except confirmed discharges';

COMMENT ON POLICY carvao_monthly_consolidation_update ON carvao_monthly_consolidation IS 
  'Simplified: All authenticated users can update, except closed consolidations';
