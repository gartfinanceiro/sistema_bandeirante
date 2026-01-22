-- Migration 004: Variable Pricing Support

-- 1. Make default_price nullable in suppliers table
ALTER TABLE suppliers ALTER COLUMN default_price DROP NOT NULL;
ALTER TABLE suppliers ALTER COLUMN default_price DROP DEFAULT;

-- Optional: Add comment or metadata if needed (not strictly requires)
COMMENT ON COLUMN suppliers.default_price IS 'Preço padrão (NULL para preço variável/negociado a cada carga)';
