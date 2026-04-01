"use server";

import { createClient } from "@/lib/supabase/server";

// =============================================================================
// Types
// =============================================================================

export interface StockPosition {
    id: string;
    name: string;
    unit: string;
    currentStock: number;
    minStockAlert: number | null;
    isLow: boolean;
}

export interface MovementSummary {
    materialId: string;
    materialName: string;
    unit: string;
    totalEntradas: number;
    totalSaidas: number;
    valorEntradas: number;
    movementCount: number;
}

export interface MovementDetail {
    id: string;
    date: string;
    quantity: number;
    unitPrice: number | null;
    totalValue: number | null;
    movementType: string;
    notes: string | null;
    materialName: string;
}

export interface SupplierInfo {
    id: string;
    name: string;
    materialName: string;
    defaultPrice: number | null;
    hasIcms: boolean;
    icmsRate: number;
    isActive: boolean;
}

export interface StockReportData {
    positions: StockPosition[];
    movementSummary: MovementSummary[];
    movements: MovementDetail[];
    suppliers: SupplierInfo[];
    period: { startDate: string; endDate: string; label: string };
}

// =============================================================================
// Get Stock Report Data
// =============================================================================

export async function getStockReportData(
    month: number,
    year: number
): Promise<StockReportData> {
    const supabase = await createClient();

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(year, month, 0).toISOString().split("T")[0];

    const monthName = new Date(year, month - 1).toLocaleDateString("pt-BR", { month: "long" });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    // Fetch all data in parallel
    const [materialsRes, movementsRes, suppliersRes] = await Promise.all([
        supabase
            .from("materials")
            .select("id, name, unit, current_stock, min_stock_alert, is_active")
            .eq("is_active", true)
            .order("name"),
        supabase
            .from("inventory_movements")
            .select("id, material_id, date, quantity, unit_price, total_value, movement_type, notes")
            .gte("date", startDate)
            .lte("date", endDate)
            .order("date", { ascending: false }),
        supabase
            .from("suppliers")
            .select("id, name, material_id, default_price, has_icms, icms_rate, is_active, materials(name)")
            .order("name"),
    ]);

    const materials = (materialsRes.data || []) as {
        id: string; name: string; unit: string;
        current_stock: number; min_stock_alert: number | null; is_active: boolean;
    }[];

    const movements = (movementsRes.data || []) as {
        id: string; material_id: string; date: string; quantity: number;
        unit_price: number | null; total_value: number | null;
        movement_type: string; notes: string | null;
    }[];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const suppliers = (suppliersRes.data || []) as any[];

    // Build material lookup
    const matMap: Record<string, { name: string; unit: string }> = {};
    materials.forEach((m) => { matMap[m.id] = { name: m.name, unit: m.unit }; });

    // 1. Stock Positions
    const positions: StockPosition[] = materials.map((m) => ({
        id: m.id,
        name: m.name,
        unit: m.unit,
        currentStock: Number(m.current_stock) || 0,
        minStockAlert: m.min_stock_alert ? Number(m.min_stock_alert) : null,
        isLow: m.min_stock_alert !== null && Number(m.current_stock) < Number(m.min_stock_alert),
    }));

    // 2. Movement Summary by Material
    const summaryMap: Record<string, MovementSummary> = {};
    for (const mov of movements) {
        const mid = mov.material_id;
        if (!summaryMap[mid]) {
            summaryMap[mid] = {
                materialId: mid,
                materialName: matMap[mid]?.name || "Desconhecido",
                unit: matMap[mid]?.unit || "?",
                totalEntradas: 0,
                totalSaidas: 0,
                valorEntradas: 0,
                movementCount: 0,
            };
        }
        const qty = Number(mov.quantity) || 0;
        const val = Number(mov.total_value) || 0;
        summaryMap[mid].movementCount++;

        if (mov.movement_type === "compra" || mov.movement_type === "producao_entrada" || mov.movement_type === "ajuste") {
            summaryMap[mid].totalEntradas += qty;
            summaryMap[mid].valorEntradas += val;
        } else {
            summaryMap[mid].totalSaidas += Math.abs(qty);
        }
    }
    const movementSummary = Object.values(summaryMap).sort((a, b) => b.totalEntradas - a.totalEntradas);

    // 3. Movement Details
    const movementDetails: MovementDetail[] = movements.map((mov) => ({
        id: mov.id,
        date: mov.date,
        quantity: Number(mov.quantity) || 0,
        unitPrice: mov.unit_price !== null ? Number(mov.unit_price) : null,
        totalValue: mov.total_value !== null ? Number(mov.total_value) : null,
        movementType: mov.movement_type,
        notes: mov.notes,
        materialName: matMap[mov.material_id]?.name || "Desconhecido",
    }));

    // 4. Suppliers
    const supplierList: SupplierInfo[] = suppliers.map((s) => ({
        id: s.id,
        name: s.name,
        materialName: s.materials?.name || "Desconhecido",
        defaultPrice: s.default_price !== null ? Number(s.default_price) : null,
        hasIcms: s.has_icms,
        icmsRate: Number(s.icms_rate) || 0,
        isActive: s.is_active,
    }));

    return {
        positions,
        movementSummary,
        movements: movementDetails,
        suppliers: supplierList,
        period: {
            startDate,
            endDate,
            label: `${capitalizedMonth} ${year}`,
        },
    };
}
