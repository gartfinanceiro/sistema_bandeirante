-- Migration: 028_add_document_name.sql
-- Description: Adds document_name column for custom document support

ALTER TABLE carvao_supplier_documents
ADD COLUMN document_name TEXT;

COMMENT ON COLUMN carvao_supplier_documents.document_name IS 'Nome personalizado do documento (usado quando document_type = OUTRO)';
