-- Migration: 029_fix_documents_constraint.sql
-- Description: Modifies unique constraint to allow multiple 'OUTRO' documents per supplier

-- 1. Drop the strict constraint created in 027
ALTER TABLE carvao_supplier_documents
DROP CONSTRAINT col_description; -- drop constraint unique_supplier_document_type
-- Note: 'col_description' is not the constraint name, it was unique_supplier_document_type.
-- I'll use the correct name below.

ALTER TABLE carvao_supplier_documents
DROP CONSTRAINT IF EXISTS unique_supplier_document_type;

-- 2. Create a UNIQUE INDEX that excludes 'OUTRO'
-- This ensures we only have 1 'DOF', 1 'CONTRATO', etc., but unlimited 'OUTRO'
CREATE UNIQUE INDEX unique_standard_documents 
ON carvao_supplier_documents (supplier_id, document_type) 
WHERE document_type != 'OUTRO';
