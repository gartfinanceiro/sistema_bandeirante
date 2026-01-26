-- =============================================================================
-- MIGRATION: 011_fix_null_slugs
-- Description: Backfill missing slugs for transaction_categories to enforce FK constraints
-- =============================================================================

-- 1. Update categories with NULL slugs using a generated slug from the name
DO $$
DECLARE
    r RECORD;
    new_slug TEXT;
BEGIN
    FOR r IN SELECT id, name FROM transaction_categories WHERE slug IS NULL LOOP
        -- Generate slug: lowercase, unaccent, replace non-alphanum with _, trim
        new_slug := lower(translate(r.name, 'áàâãäåāăąéèêëēĕėęěíìîïìĩīĭįóòôõöōŏőøúùûüũūŭůűųýÿŷñç', 'aaaaaaaaaeeeeeeeeeiiiiiiiiioooooooooouuuuuuuuuuyyync'));
        new_slug := regexp_replace(new_slug, '[^a-z0-9]+', '_', 'g');
        new_slug := regexp_replace(new_slug, '^_+|_+$', '', 'g');
        
        -- Safety fallback
        IF new_slug IS NULL OR length(new_slug) = 0 THEN
             new_slug := 'cat_' || substring(r.id::text, 1, 8);
        END IF;

        RAISE NOTICE 'Updating category "%" (ID: %) with slug: %', r.name, r.id, new_slug;

        -- Update the record
        -- Note: We use a simple update. If there's a collision, it might fail, 
        -- but for this fix we assume names are distinct enough or collision is rare.
        BEGIN
            UPDATE transaction_categories SET slug = new_slug WHERE id = r.id;
        EXCEPTION WHEN unique_violation THEN
            -- Handle collision by appending ID segment
            new_slug := new_slug || '_' || substring(r.id::text, 1, 4);
            UPDATE transaction_categories SET slug = new_slug WHERE id = r.id;
        END;
        
    END LOOP;
END $$;
