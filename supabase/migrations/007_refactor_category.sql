-- Migration: Refactor transactions.category_id to TEXT (Slug)
-- Description: Changes the category_id column type to store the slug directly instead of UUID.
--              This aligns the database with the frontend static configuration strategy.

-- 1. Drop existing FK constraint (constraint name usually follows table_column_fkey)
ALTER TABLE transactions 
DROP CONSTRAINT IF EXISTS transactions_category_id_fkey;

-- 2. Alter column type
-- Note: We are not migrating data because the table is likely empty or using test data.
-- If needed, we would need a USING clause to look up slugs from IDs.
ALTER TABLE transactions 
ALTER COLUMN category_id TYPE VARCHAR(100);

-- 3. Add new FK constraint to transaction_categories.slug
-- Ensure slug column in categories is unique (it should be from 006)
ALTER TABLE transactions 
ADD CONSTRAINT fk_transactions_category_slug
FOREIGN KEY (category_id) 
REFERENCES transaction_categories(slug) 
ON DELETE SET NULL
ON UPDATE CASCADE;

-- 4. Comment update
COMMENT ON COLUMN transactions.category_id IS 'Slug da categoria (FK para transaction_categories.slug)';
