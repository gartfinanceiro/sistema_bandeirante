"use server";

import { createClient } from "@/lib/supabase/server";

// =============================================================================
// Types
// =============================================================================

export interface SupplierBreakdown {
    supplierName: string;
    quantity: number; // in material unit (tonelada)
}

export interface StockPosition {
    id: string;
    name: string;
    unit: string;
    currentStock: number;
    minStockAlert: number | null;
    isLow: boolean;
    /** Primary supplier name (for non-minério materials) */
    supplierName: string | null;
    /** Per-supplier breakdown (only for Minério de Ferro) */
    supplierBreakdown: SupplierBreakdown[] | null;
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

export interface StockReportData {
    positions: StockPosition[];
    movementSummary: MovementSummary[];
    period: { startDate: string; endDate: string; label: string };
}

// =============================================================================
// Supplier names to merge (same source)
// =============================================================================

const SUPPLIER_MERGE_MAP: Record<string, string> = {
    "Mineração Corumbaense Reunida com Frete": "Mineração Corumbaense Reunida",
};

function normalizeSupplierName(name: string): string {
    return SUPPLIER_MERGE_MAP[name] || name;
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
    const [materialsRes, movementsRes, suppliersRes, deliveriesRes] = await Promise.all([
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
            .select("id, name, material_id, is_active")
            .eq("is_active", true)
            .order("name"),
        // Get inbound deliveries with supplier info for minério breakdown
        supabase
            .from("inbound_deliveries")
            .select("material_id, supplier_id, weight_measured, suppliers!supplier_id(name)")
            .is("deleted_at", null),
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deliveries = (deliveriesRes.data || []) as any[];

    // Build material lookup
    const matMap: Record<string, { name: string; unit: string }> = {};
    materials.forEach((m) => { matMap[m.id] = { name: m.name, unit: m.unit }; });

    // Build supplier lookup: material_id -> supplier name (for non-minério)
    const supplierByMaterial: Record<string, string> = {};
    for (const s of suppliers) {
        if (s.material_id && s.is_active) {
            // If multiple suppliers for same material, just pick the first one
            if (!supplierByMaterial[s.material_id]) {
                supplierByMaterial[s.material_id] = s.name;
            }
        }
    }

    // Build per-supplier breakdown for minério de ferro from inbound_deliveries
    // weight_measured is in KG, we need to convert to tonelada
    const minerioBreakdownMap: Record<string, number> = {};
    let minerioMaterialId: string | null = null;

    for (const mat of materials) {
        const lower = mat.name.toLowerCase();
        if (lower.includes("minério") || lower.includes("minerio")) {
            minerioMaterialId = mat.id;
            break;
        }
    }

    if (minerioMaterialId) {
        for (const d of deliveries) {
            if (d.material_id === minerioMaterialId && d.supplier_id) {
                const rawName = d.suppliers?.name || "Desconhecido";
                const name = normalizeSupplierName(rawName);
                const weightKg = Number(d.weight_measured) || 0;
                const weightTon = weightKg / 1000;
                minerioBreakdownMap[name] = (minerioBreakdownMap[name] || 0) + weightTon;
            }
        }
    }

    const minerioBreakdown: SupplierBreakdown[] = Object.entries(minerioBreakdownMap)
        .map(([supplierName, quantity]) => ({ supplierName, quantity }))
        .sort((a, b) => b.quantity - a.quantity);

    // 1. Stock Positions
    const positions: StockPosition[] = materials.map((m) => {
        const isMinerio = m.id === minerioMaterialId;
        const lower = m.name.toLowerCase();
        const isCarvao = lower.includes("carvão") || lower.includes("carvao");

        return {
            id: m.id,
            name: m.name,
            unit: m.unit,
            currentStock: Number(m.current_stock) || 0,
            minStockAlert: m.min_stock_alert ? Number(m.min_stock_alert) : null,
            isLow: m.min_stock_alert !== null && Number(m.current_stock) < Number(m.min_stock_alert),
            supplierName: isMinerio ? null : (isCarvao ? null : (supplierByMaterial[m.id] || null)),
            supplierBreakdown: isMinerio && minerioBreakdown.length > 0 ? minerioBreakdown : null,
        };
    });

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

    return {
        positions,
        movementSummary,
        period: {
            startDate,
            endDate,
            label: `${capitalizedMonth} ${year}`,
        },
    };
}
