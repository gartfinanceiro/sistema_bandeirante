-- Create the 'carvao-documents' bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('carvao-documents', 'carvao-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: Authenticated users can upload files
CREATE POLICY "Authenticated users can upload carvao documents"
ON storage.objects
FOR INSERT
WITH CHECK (
    bucket_id = 'carvao-documents'
    AND auth.role() = 'authenticated'
);

-- Policy: Authenticated users can read files
CREATE POLICY "Authenticated users can read carvao documents"
ON storage.objects
FOR SELECT
USING (
    bucket_id = 'carvao-documents'
    AND auth.role() = 'authenticated'
);

-- Policy: Authenticated users can delete files
CREATE POLICY "Authenticated users can delete carvao documents"
ON storage.objects
FOR DELETE
USING (
    bucket_id = 'carvao-documents'
    AND auth.role() = 'authenticated'
);
