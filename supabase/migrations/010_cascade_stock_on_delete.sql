-- =============================================================================
-- MIGRATION: 010_cascade_stock_on_delete
-- Description: Adds trigger to reverse stock when transactions are deleted
-- Date: 2026-01-22
-- =============================================================================

-- 1. Create trigger function to reverse stock on transaction delete
CREATE OR REPLACE FUNCTION reverse_stock_on_transaction_delete()
RETURNS TRIGGER AS $$
DECLARE
    total_delivered DECIMAL(15, 3);
    total_from_movements DECIMAL(15, 3);
BEGIN
    -- Only process if this transaction had a material linked
    IF OLD.material_id IS NOT NULL THEN
        -- First, check inbound_deliveries (Minério/Fundentes via Balança)
        SELECT COALESCE(SUM(weight_measured), 0) INTO total_delivered
        FROM inbound_deliveries
        WHERE transaction_id = OLD.id;
        
        -- If no deliveries via Balança, check inventory_movements (Carvão direct entry)
        IF total_delivered = 0 THEN
            SELECT COALESCE(SUM(quantity), 0) INTO total_from_movements
            FROM inventory_movements
            WHERE reference_id = OLD.id AND movement_type = 'compra';
            
            total_delivered := total_from_movements;
        END IF;
        
        -- Subtract from material stock
        IF total_delivered > 0 THEN
            UPDATE materials
            SET current_stock = GREATEST(0, current_stock - total_delivered)
            WHERE id = OLD.material_id;
        END IF;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 2. Create trigger (BEFORE DELETE to capture data before CASCADE removes inbound_deliveries)
DROP TRIGGER IF EXISTS trigger_reverse_stock_on_delete ON transactions;
CREATE TRIGGER trigger_reverse_stock_on_delete
    BEFORE DELETE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION reverse_stock_on_transaction_delete();

COMMENT ON FUNCTION reverse_stock_on_transaction_delete() IS 
    'Reverts material stock when a purchase transaction is deleted';

-- 3. Also cascade delete inventory_movements when transaction is deleted
-- (inventory_movements uses reference_id, not a direct FK, so manual cleanup)
CREATE OR REPLACE FUNCTION cleanup_inventory_movements_on_delete()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM inventory_movements WHERE reference_id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cleanup_movements_on_delete ON transactions;
CREATE TRIGGER trigger_cleanup_movements_on_delete
    BEFORE DELETE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION cleanup_inventory_movements_on_delete();

COMMENT ON FUNCTION cleanup_inventory_movements_on_delete() IS 
    'Removes inventory movements linked to a deleted transaction';
