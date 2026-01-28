-- =============================================================================
-- SCRIPT DE CORREÇÃO: JWT Cast Error em RLS Helper Functions
-- =============================================================================
-- Execute este script diretamente no SQL Editor do Supabase
-- 
-- IMPORTANTE: Este script NÃO altera nenhuma regra de segurança
--            Apenas corrige um bug técnico de cast de tipos
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Fix: carvao_has_role function
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION carvao_has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.jwt()::jsonb -> 'user_metadata' ->> 'role') = required_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION carvao_has_role IS 'Verifica se usuário tem papel específico (com JWT cast correto)';

-- -----------------------------------------------------------------------------
-- 2. Fix: carvao_is_admin function
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION carvao_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.jwt()::jsonb -> 'user_metadata' ->> 'role') = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION carvao_is_admin IS 'Verifica se usuário é admin (com JWT cast correto)';

-- =============================================================================
-- ✅ VALIDAÇÃO
-- =============================================================================
-- Após executar este script, teste:
--
-- 1. SELECT carvao_has_role('admin');     -- Não deve dar erro
-- 2. SELECT carvao_is_admin();            -- Não deve dar erro
-- 3. Tentar criar fornecedor              -- Não deve dar "operator does not exist"
-- =============================================================================
