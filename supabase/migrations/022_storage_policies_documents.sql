-- =============================================================================
-- Migration: 022 - Configuração do bucket e políticas de Storage
-- Descrição: Setup para upload de documentos de fornecedores
-- Data: 2026-01-28
-- =============================================================================

-- Nota: O bucket deve ser criado manualmente via Supabase Dashboard:
-- Nome: carvao-documents
-- Tipo: Privado
-- Allowed MIME types: application/pdf, image/jpeg, image/png
-- Max file size: 10485760 (10MB)

-- =============================================================================
-- Storage Policies para bucket 'carvao-documents'
-- =============================================================================

-- Política: Upload de documentos (INSERT)
CREATE POLICY "Upload carvao documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'carvao-documents'
  );

-- Política: Visualização de documentos (SELECT)
CREATE POLICY "View carvao documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'carvao-documents'
  );

-- Política: Atualização de documentos (UPDATE)
CREATE POLICY "Update carvao documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'carvao-documents'
  );

-- Política: Deleção de documentos (DELETE)
CREATE POLICY "Delete carvao documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'carvao-documents'
  );

-- =============================================================================
-- Tabela de documentos de fornecedores (se ainda não existir)
-- =============================================================================

-- Esta tabela rastreia documentos individuais anexados
CREATE TABLE IF NOT EXISTS carvao_supplier_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES carvao_suppliers(id) ON DELETE CASCADE,
  
  -- Tipo e status do documento
  document_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  
  -- Arquivo anexado
  file_path TEXT,
  file_name TEXT,
  file_size_bytes INTEGER,
  uploaded_at TIMESTAMPTZ,
  uploaded_by UUID REFERENCES auth.users(id),
  
  -- Validade e revisão
  expiry_date DATE,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  
  -- Observações
  notes TEXT,
  
  -- Controle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraint: Um tipo de documento por fornecedor
  UNIQUE (supplier_id, document_type)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_supplier_docs_supplier ON carvao_supplier_documents(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_docs_type ON carvao_supplier_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_supplier_docs_expiry ON carvao_supplier_documents(expiry_date) WHERE expiry_date IS NOT NULL;

-- RLS
ALTER TABLE carvao_supplier_documents ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
DROP POLICY IF EXISTS carvao_supplier_docs_select ON carvao_supplier_documents;
CREATE POLICY carvao_supplier_docs_select 
  ON carvao_supplier_documents
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS carvao_supplier_docs_insert ON carvao_supplier_documents;
CREATE POLICY carvao_supplier_docs_insert 
  ON carvao_supplier_documents
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS carvao_supplier_docs_update ON carvao_supplier_documents;
CREATE POLICY carvao_supplier_docs_update 
  ON carvao_supplier_documents
  FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Trigger
DROP TRIGGER IF EXISTS set_updated_at ON carvao_supplier_documents;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON carvao_supplier_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON carvao_supplier_documents TO authenticated;

-- Comments
COMMENT ON TABLE carvao_supplier_documents IS 
  'Documentos individuais de fornecedores com upload de arquivos';

COMMENT ON COLUMN carvao_supplier_documents.document_type IS 
  'Tipo: DOF, DCF, Contrato, Contrato Assinado, Arrendamento, Intermediador / Transportador';

COMMENT ON COLUMN carvao_supplier_documents.file_path IS 
  'Caminho no Storage: {supplier_id}/{document_type}/{timestamp}_{filename}';
