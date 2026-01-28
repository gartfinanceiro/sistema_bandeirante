-- =============================================================================
-- Migration: 016 - Fix Carvão RLS JWT Cast Error
-- =============================================================================
-- Issue: auth.jwt() returns TEXT, not JSONB
-- Error: "operator does not exist: text ->> unknown"
-- 
-- Solution: Explicitly cast auth.jwt() to JSONB before accessing properties
-- 
-- Security Impact: NONE - purely technical fix, maintains all security rules
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Fix: carvao_has_role function
-- -----------------------------------------------------------------------------
-- Corrects JWT cast to prevent operator error
-- Maintains exact same security logic

CREATE OR REPLACE FUNCTION carvao_has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.jwt()::jsonb -> 'user_metadata' ->> 'role') = required_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION carvao_has_role IS 'Verifica se usuário tem papel específico (com JWT cast correto)';

-- -----------------------------------------------------------------------------
-- Fix: carvao_is_admin function
-- -----------------------------------------------------------------------------
-- Corrects JWT cast to prevent operator error
-- Maintains exact same security logic

CREATE OR REPLACE FUNCTION carvao_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.jwt()::jsonb -> 'user_metadata' ->> 'role') = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION carvao_is_admin IS 'Verifica se usuário é admin (com JWT cast correto)';

-- =============================================================================
-- Validation
-- =============================================================================
-- SELECT carvao_has_role('admin');         -- Should work without error
-- SELECT carvao_is_admin();                -- Should work without error
-- 
-- Expected behavior after fix:
--   ✅ No "operator does not exist" errors
--   ✅ All RLS policies continue working normally
--   ✅ User permissions remain exactly the same
-- =============================================================================
