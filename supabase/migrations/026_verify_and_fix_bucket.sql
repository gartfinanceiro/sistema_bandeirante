-- 1. Tenta criar o bucket se não existir
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'carvao-documents', 
    'carvao-documents', 
    false,
    10485760, -- 10MB limit
    ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png'];

-- 2. Recria as políticas para garantir acesso
DROP POLICY IF EXISTS "Authenticated users can upload carvao documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read carvao documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete carvao documents" ON storage.objects;

CREATE POLICY "Authenticated users can upload carvao documents"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'carvao-documents' AND auth.role() = 'authenticated' );

CREATE POLICY "Authenticated users can read carvao documents"
ON storage.objects FOR SELECT
USING ( bucket_id = 'carvao-documents' AND auth.role() = 'authenticated' );

CREATE POLICY "Authenticated users can delete carvao documents"
ON storage.objects FOR DELETE
USING ( bucket_id = 'carvao-documents' AND auth.role() = 'authenticated' );

-- 3. Confirmação (Se rodar isso no SQL Editor, deve aparecer o bucket abaixo)
SELECT * FROM storage.buckets WHERE id = 'carvao-documents';
