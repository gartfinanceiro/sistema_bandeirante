-- =============================================================================
-- MIGRATION: 032_revenue_categories (Part 1)
-- Description: Adds 'receita' value to cost_center_type enum
-- Date: 2026-02-26
-- NOTE: Must be committed before Part 2 (033) can use the new enum value
-- =============================================================================

ALTER TYPE cost_center_type ADD VALUE IF NOT EXISTS 'receita';
