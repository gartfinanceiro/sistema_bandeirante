-- Migration 003: Dynamic Materials Refactor

-- 1. Ensure materials table has correct structure (in case it differs)
-- Assuming materials exists from initial schema
-- columns: id, name, unit, is_active, current_stock...

-- 2. Add material_id to suppliers
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES materials(id);

-- 3. Populate material_id based on legacy material_type
-- We rely on standard names. If these don't match, the update will skip, which is handled gracefully in UI (nullable).
UPDATE suppliers SET material_id = (SELECT id FROM materials WHERE name = 'Carvão Vegetal' LIMIT 1) WHERE material_type = 'carvao';
UPDATE suppliers SET material_id = (SELECT id FROM materials WHERE name = 'Minério de Ferro' LIMIT 1) WHERE material_type = 'minerio';
UPDATE suppliers SET material_id = (SELECT id FROM materials WHERE name = 'Fundentes' LIMIT 1) WHERE material_type = 'fundentes';

-- 4. Make legacy column nullable (we keep it for safety but stop using it)
ALTER TABLE suppliers ALTER COLUMN material_type DROP NOT NULL;
ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_material_type_check;

-- 5. Add is_active to materials if not exists (for soft delete)
ALTER TABLE materials ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
