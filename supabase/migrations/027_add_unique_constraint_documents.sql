-- Adiciona constraint de unicidade para (supplier_id, document_type)
-- Isso é necessário para que o ON CONFLICT funcione corretamente no upsert de documentos

ALTER TABLE carvao_supplier_documents
ADD CONSTRAINT unique_supplier_document_type UNIQUE (supplier_id, document_type);
