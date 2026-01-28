-- =============================================================================
-- BANDEIRANTE | CARVÃO - Row Level Security Policies
-- Migration: 016_carvao_rls_policies.sql
-- Versão: 1.1.0 (Fine-tuned)
-- Data: 2026-01-28
-- =============================================================================
-- 
-- Este script implementa políticas de Row Level Security (RLS) para o módulo
-- Bandeirante | Carvão, controlando acesso baseado em papéis de usuário.
--
-- PAPÉIS DISPONÍVEIS (via user_metadata.role):
-- - comprador_carvao: Gestão de fornecedores e agendamento
-- - operacao_patio: Operação de descarga no pátio
-- - admin: Acesso total, incluindo registros imutáveis
--
-- IMPORTANTE: 
-- - Políticas bloqueiam edição de registros imutáveis (confirmados/consolidados)
-- - Apenas admin pode alterar/deletar registros críticos
--
-- AJUSTES APLICADOS (v1.1.0):
-- - WITH CHECK adicionado em todas as policies de UPDATE
-- - SECURITY DEFINER functions endurecidas com search_path
-- - Comentários de GRANT aprimorados para clareza
-- =============================================================================


-- =============================================================================
-- SEÇÃO 1: HABILITAR RLS EM TODAS AS TABELAS
-- =============================================================================

ALTER TABLE carvao_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE carvao_supplier_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE carvao_discharge_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE carvao_discharges ENABLE ROW LEVEL SECURITY;
ALTER TABLE carvao_monthly_consolidation ENABLE ROW LEVEL SECURITY;
ALTER TABLE carvao_audit_log ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- SEÇÃO 2: HELPER FUNCTIONS - Verificar papel do usuário
-- =============================================================================

-- Função auxiliar para verificar se o usuário tem um papel específico
-- AJUSTE: Adicionado SET search_path para segurança com SECURITY DEFINER
CREATE OR REPLACE FUNCTION carvao_has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.jwt() ->> 'user_metadata' ->> 'role' = required_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION carvao_has_role(TEXT) IS 
  'Verifica se o usuário autenticado possui o papel especificado';

-- Função auxiliar para verificar se usuário é admin
-- AJUSTE: Adicionado SET search_path para segurança com SECURITY DEFINER
CREATE OR REPLACE FUNCTION carvao_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN carvao_has_role('admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION carvao_is_admin() IS 
  'Verifica se o usuário autenticado é admin';


-- =============================================================================
-- SEÇÃO 3: POLICIES PARA carvao_suppliers
-- =============================================================================

-- SELECT: Qualquer usuário autenticado
CREATE POLICY "carvao_suppliers_select_authenticated"
  ON carvao_suppliers
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Comprador ou Admin
CREATE POLICY "carvao_suppliers_insert_comprador_admin"
  ON carvao_suppliers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    carvao_has_role('comprador_carvao') OR carvao_is_admin()
  );

-- UPDATE: Comprador ou Admin
-- AJUSTE: Adicionado WITH CHECK para garantir gravação dentro das regras
CREATE POLICY "carvao_suppliers_update_comprador_admin"
  ON carvao_suppliers
  FOR UPDATE
  TO authenticated
  USING (
    carvao_has_role('comprador_carvao') OR carvao_is_admin()
  )
  WITH CHECK (
    carvao_has_role('comprador_carvao') OR carvao_is_admin()
  );

-- DELETE: Apenas Admin
CREATE POLICY "carvao_suppliers_delete_admin_only"
  ON carvao_suppliers
  FOR DELETE
  TO authenticated
  USING (carvao_is_admin());

COMMENT ON POLICY "carvao_suppliers_select_authenticated" ON carvao_suppliers IS
  'Permite leitura de fornecedores para qualquer usuário autenticado';
COMMENT ON POLICY "carvao_suppliers_insert_comprador_admin" ON carvao_suppliers IS
  'Permite criação de fornecedores apenas para compradores e admins';
COMMENT ON POLICY "carvao_suppliers_update_comprador_admin" ON carvao_suppliers IS
  'Permite edição de fornecedores apenas para compradores e admins (USING + WITH CHECK)';
COMMENT ON POLICY "carvao_suppliers_delete_admin_only" ON carvao_suppliers IS
  'Permite deleção de fornecedores apenas para admins';


-- =============================================================================
-- SEÇÃO 4: POLICIES PARA carvao_supplier_documents
-- =============================================================================

-- SELECT: Qualquer usuário autenticado
CREATE POLICY "carvao_docs_select_authenticated"
  ON carvao_supplier_documents
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Comprador ou Admin
CREATE POLICY "carvao_docs_insert_comprador_admin"
  ON carvao_supplier_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    carvao_has_role('comprador_carvao') OR carvao_is_admin()
  );

-- UPDATE: Permitido apenas se documento NÃO está aprovado, OU se é admin
-- AJUSTE: Adicionado WITH CHECK para bloquear gravação de status aprovado
CREATE POLICY "carvao_docs_update_if_not_approved"
  ON carvao_supplier_documents
  FOR UPDATE
  TO authenticated
  USING (
    status != 'aprovado' OR carvao_is_admin()
  )
  WITH CHECK (
    status != 'aprovado' OR carvao_is_admin()
  );

-- DELETE: Apenas Admin
CREATE POLICY "carvao_docs_delete_admin_only"
  ON carvao_supplier_documents
  FOR DELETE
  TO authenticated
  USING (carvao_is_admin());

COMMENT ON POLICY "carvao_docs_select_authenticated" ON carvao_supplier_documents IS
  'Permite leitura de documentos para qualquer usuário autenticado';
COMMENT ON POLICY "carvao_docs_insert_comprador_admin" ON carvao_supplier_documents IS
  'Permite upload de documentos apenas para compradores e admins';
COMMENT ON POLICY "carvao_docs_update_if_not_approved" ON carvao_supplier_documents IS
  'Permite edição apenas de documentos não aprovados (USING + WITH CHECK protege imutabilidade)';
COMMENT ON POLICY "carvao_docs_delete_admin_only" ON carvao_supplier_documents IS
  'Permite deleção de documentos apenas para admins';


-- =============================================================================
-- SEÇÃO 5: POLICIES PARA carvao_discharge_schedule
-- =============================================================================

-- SELECT: Qualquer usuário autenticado
CREATE POLICY "carvao_schedule_select_authenticated"
  ON carvao_discharge_schedule
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Comprador ou Operação de Pátio
CREATE POLICY "carvao_schedule_insert_comprador_operacao"
  ON carvao_discharge_schedule
  FOR INSERT
  TO authenticated
  WITH CHECK (
    carvao_has_role('comprador_carvao') 
    OR carvao_has_role('operacao_patio')
    OR carvao_is_admin()
  );

-- UPDATE: Permitido apenas se status != 'descarregada', OU se é admin
-- AJUSTE: Adicionado WITH CHECK para bloquear gravação de status descarregada
CREATE POLICY "carvao_schedule_update_if_not_discharged"
  ON carvao_discharge_schedule
  FOR UPDATE
  TO authenticated
  USING (
    status != 'descarregada' OR carvao_is_admin()
  )
  WITH CHECK (
    status != 'descarregada' OR carvao_is_admin()
  );

-- DELETE: Apenas Admin
CREATE POLICY "carvao_schedule_delete_admin_only"
  ON carvao_discharge_schedule
  FOR DELETE
  TO authenticated
  USING (carvao_is_admin());

COMMENT ON POLICY "carvao_schedule_select_authenticated" ON carvao_discharge_schedule IS
  'Permite leitura da agenda para qualquer usuário autenticado';
COMMENT ON POLICY "carvao_schedule_insert_comprador_operacao" ON carvao_discharge_schedule IS
  'Permite agendamento para compradores, operação de pátio e admins';
COMMENT ON POLICY "carvao_schedule_update_if_not_discharged" ON carvao_discharge_schedule IS
  'Permite edição apenas de agendas não descarregadas (USING + WITH CHECK protege imutabilidade)';
COMMENT ON POLICY "carvao_schedule_delete_admin_only" ON carvao_discharge_schedule IS
  'Permite deleção de agendamentos apenas para admins';


-- =============================================================================
-- SEÇÃO 6: POLICIES PARA carvao_discharges (CRÍTICO - IMUTABILIDADE)
-- =============================================================================

-- SELECT: Qualquer usuário autenticado
CREATE POLICY "carvao_discharges_select_authenticated"
  ON carvao_discharges
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Operação de Pátio ou Admin
CREATE POLICY "carvao_discharges_insert_operacao_admin"
  ON carvao_discharges
  FOR INSERT
  TO authenticated
  WITH CHECK (
    carvao_has_role('operacao_patio') OR carvao_is_admin()
  );

-- UPDATE: Permitido SOMENTE se is_confirmed = false, OU se é admin
-- Esta é a regra CRÍTICA de imutabilidade
-- AJUSTE: Adicionado WITH CHECK para bloquear confirmação indevida
CREATE POLICY "carvao_discharges_update_if_not_confirmed"
  ON carvao_discharges
  FOR UPDATE
  TO authenticated
  USING (
    is_confirmed = false OR carvao_is_admin()
  )
  WITH CHECK (
    is_confirmed = false OR carvao_is_admin()
  );

-- DELETE: Apenas Admin
CREATE POLICY "carvao_discharges_delete_admin_only"
  ON carvao_discharges
  FOR DELETE
  TO authenticated
  USING (carvao_is_admin());

COMMENT ON POLICY "carvao_discharges_select_authenticated" ON carvao_discharges IS
  'Permite leitura de descargas para qualquer usuário autenticado';
COMMENT ON POLICY "carvao_discharges_insert_operacao_admin" ON carvao_discharges IS
  'Permite registro de descargas apenas para operação de pátio e admins';
COMMENT ON POLICY "carvao_discharges_update_if_not_confirmed" ON carvao_discharges IS
  'CRÍTICO: Permite edição apenas de descargas não confirmadas (USING + WITH CHECK = dupla proteção)';
COMMENT ON POLICY "carvao_discharges_delete_admin_only" ON carvao_discharges IS
  'Permite deleção de descargas apenas para admins';


-- =============================================================================
-- SEÇÃO 7: POLICIES PARA carvao_monthly_consolidation (IMUTÁVEL)
-- =============================================================================

-- SELECT: Qualquer usuário autenticado
CREATE POLICY "carvao_consolidation_select_authenticated"
  ON carvao_monthly_consolidation
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Apenas Admin
CREATE POLICY "carvao_consolidation_insert_admin_only"
  ON carvao_monthly_consolidation
  FOR INSERT
  TO authenticated
  WITH CHECK (carvao_is_admin());

-- UPDATE: Apenas Admin
-- AJUSTE: Adicionado WITH CHECK para garantir apenas admin grava
CREATE POLICY "carvao_consolidation_update_admin_only"
  ON carvao_monthly_consolidation
  FOR UPDATE
  TO authenticated
  USING (carvao_is_admin())
  WITH CHECK (carvao_is_admin());

-- DELETE: PROIBIDO (nenhuma policy de DELETE)
-- Sem policy = sem permissão para DELETE

COMMENT ON POLICY "carvao_consolidation_select_authenticated" ON carvao_monthly_consolidation IS
  'Permite leitura de consolidações para qualquer usuário autenticado';
COMMENT ON POLICY "carvao_consolidation_insert_admin_only" ON carvao_monthly_consolidation IS
  'Permite criação de consolidações apenas para admins';
COMMENT ON POLICY "carvao_consolidation_update_admin_only" ON carvao_monthly_consolidation IS
  'Permite edição de consolidações apenas para admins (USING + WITH CHECK)';


-- =============================================================================
-- SEÇÃO 8: POLICIES PARA carvao_audit_log (SOMENTE LEITURA ADMIN)
-- =============================================================================

-- SELECT: APENAS Admin
CREATE POLICY "carvao_audit_select_admin_only"
  ON carvao_audit_log
  FOR SELECT
  TO authenticated
  USING (carvao_is_admin());

-- INSERT: PROIBIDO para usuários manuais
-- Inserts devem vir APENAS de triggers
-- Sem policy WITH CHECK = sem permissão para INSERT manual

-- UPDATE/DELETE: PROIBIDO (nenhuma policy)
-- Logs de auditoria são imutáveis

COMMENT ON POLICY "carvao_audit_select_admin_only" ON carvao_audit_log IS
  'Permite leitura de logs de auditoria apenas para admins';


-- =============================================================================
-- SEÇÃO 9: GRANT DE PERMISSÕES BÁSICAS
-- =============================================================================

-- AJUSTE: Comentários aprimorados para deixar explícito o papel do RLS
-- 
-- GRANTs concedem permissões BASE para a role authenticated, mas o controle
-- REAL de acesso é feito pelas policies de RLS definidas acima.
-- 
-- Sem RLS habilitado, esses GRANTs dariam acesso irrestrito.
-- COM RLS habilitado, cada operação passa por validação de policy.

-- carvao_suppliers
GRANT SELECT ON carvao_suppliers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON carvao_suppliers TO authenticated;
-- Controle granular via policies: comprador_carvao/admin para INSERT/UPDATE, admin para DELETE

-- carvao_supplier_documents
GRANT SELECT ON carvao_supplier_documents TO authenticated;
GRANT INSERT, UPDATE, DELETE ON carvao_supplier_documents TO authenticated;
-- Controle granular via policies: status != 'aprovado' para UPDATE (exceto admin)

-- carvao_discharge_schedule
GRANT SELECT ON carvao_discharge_schedule TO authenticated;
GRANT INSERT, UPDATE, DELETE ON carvao_discharge_schedule TO authenticated;
-- Controle granular via policies: status != 'descarregada' para UPDATE (exceto admin)

-- carvao_discharges (CRÍTICO)
GRANT SELECT ON carvao_discharges TO authenticated;
GRANT INSERT, UPDATE, DELETE ON carvao_discharges TO authenticated;
-- Controle granular via policies: IMUTABILIDADE garantida via is_confirmed

-- carvao_monthly_consolidation
GRANT SELECT ON carvao_monthly_consolidation TO authenticated;
GRANT INSERT, UPDATE ON carvao_monthly_consolidation TO authenticated;
-- Nota: DELETE NÃO concedido intencionalmente (sem policy de DELETE = bloqueio total)
-- Controle granular via policies: apenas admin para INSERT/UPDATE

-- carvao_audit_log
GRANT SELECT ON carvao_audit_log TO authenticated;
-- Nota: INSERT, UPDATE, DELETE NÃO concedidos intencionalmente
-- Controle granular via policies: apenas admin para SELECT, triggers para INSERT


-- =============================================================================
-- SEÇÃO 10: VALIDAÇÃO E TESTES (COMENTADOS)
-- =============================================================================

-- Comandos para testar as policies (executar como diferentes usuários)
-- Descomente para validação manual após aplicar a migration

/*
-- Teste 1: Comprador tenta criar fornecedor (DEVE PERMITIR)
-- SET request.jwt.claims TO '{"user_metadata": {"role": "comprador_carvao"}}';
-- INSERT INTO carvao_suppliers (name) VALUES ('Fornecedor Teste');

-- Teste 2: Operação tenta criar fornecedor (DEVE NEGAR)
-- SET request.jwt.claims TO '{"user_metadata": {"role": "operacao_patio"}}';
-- INSERT INTO carvao_suppliers (name) VALUES ('Fornecedor Teste 2');

-- Teste 3: Operação tenta editar descarga confirmada (DEVE NEGAR)
-- SET request.jwt.claims TO '{"user_metadata": {"role": "operacao_patio"}}';
-- UPDATE carvao_discharges SET observations = 'Teste' WHERE is_confirmed = true;

-- Teste 4: Admin edita descarga confirmada (DEVE PERMITIR)
-- SET request.jwt.claims TO '{"user_metadata": {"role": "admin"}}';
-- UPDATE carvao_discharges SET observations = 'Ajuste admin' WHERE is_confirmed = true;

-- Teste 5: Usuário comum tenta ler audit log (DEVE NEGAR)
-- SET request.jwt.claims TO '{"user_metadata": {"role": "comprador_carvao"}}';
-- SELECT * FROM carvao_audit_log;

-- Teste 6: Admin lê audit log (DEVE PERMITIR)
-- SET request.jwt.claims TO '{"user_metadata": {"role": "admin"}}';
-- SELECT * FROM carvao_audit_log;

-- Teste 7: Operação tenta confirmar descarga (DEVE PERMITIR UPDATE mas is_confirmed permanece false)
-- SET request.jwt.claims TO '{"user_metadata": {"role": "operacao_patio"}}';
-- UPDATE carvao_discharges SET is_confirmed = true WHERE id = '...';
-- Resultado esperado: WITH CHECK bloqueia se tentar confirmar descarga já confirmada
*/


-- =============================================================================
-- FIM DA MIGRATION
-- =============================================================================
