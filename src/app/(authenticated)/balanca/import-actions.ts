"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// =============================================================================
// Types
// =============================================================================

export interface ParsedTicket {
    ticketNumber: string;
    date: string;        // ISO YYYY-MM-DD
    time: string;        // HH:MM:SS
    plate: string;
    driver: string;
    transporter: string;
    origin: string;      // Supplier name from report
    originCode: string;  // Code in brackets [XXXX]
    material: string;    // Material name from report
    materialCode: string;// Code in brackets [XX]
    weightKg: number;    // Net weight in kg
}

export interface MatchedTicket extends ParsedTicket {
    supplierId: string | null;
    supplierName: string | null;
    materialId: string | null;
    materialName: string | null;
    transactionId: string | null;
    transactionDate: string | null;
    transactionQuantity: number | null;
    transactionRemaining: number | null;
    matchStatus: 'matched' | 'partial' | 'unmatched';
    matchNote: string;
}

export interface ImportResult {
    total: number;
    imported: number;
    skipped: number;
    errors: string[];
}

// =============================================================================
// Match tickets with DB suppliers, materials, and open orders
// =============================================================================

export async function matchTicketsWithOrders(
    tickets: ParsedTicket[]
): Promise<MatchedTicket[]> {
    const supabase = await createClient();

    // 1. Fetch all active suppliers with their materials
    const { data: suppliers } = await supabase
        .from("suppliers")
        .select("id, name, material_id, materials(name)")
        .eq("is_active", true);

    // 2. Fetch all active materials
    const { data: materials } = await supabase
        .from("materials")
        .select("id, name, unit")
        .eq("is_active", true);

    // 3. Fetch open purchase orders (transactions with material_id, supplier_id, quantity > 0)
    const { data: openOrders } = await supabase
        .from("transactions")
        .select("id, date, amount, quantity, material_id, supplier_id")
        .eq("type", "saida")
        .not("material_id", "is", null)
        .not("quantity", "is", null)
        .gt("quantity", 0)
        .order("date", { ascending: true }); // FIFO

    // 4. Fetch existing deliveries to calculate remaining quantities
    const orderIds = (openOrders || []).map((o: any) => o.id);
    const { data: existingDeliveries } = orderIds.length > 0
        ? await (supabase
            .from("inbound_deliveries")
            .select("transaction_id, weight_measured")
            .is("deleted_at", null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .in("transaction_id", orderIds) as any)
        : { data: [] };

    // Build delivery sum map
    const deliverySumMap = new Map<string, number>();
    if (existingDeliveries) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const d of existingDeliveries as any[]) {
            const curr = deliverySumMap.get(d.transaction_id) || 0;
            deliverySumMap.set(d.transaction_id, curr + Number(d.weight_measured));
        }
    }

    // Build material name → id lookup (fuzzy)
    const materialMap = new Map<string, { id: string; name: string }>();
    if (materials) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const m of materials as any[]) {
            materialMap.set(m.name.toLowerCase(), { id: m.id, name: m.name });
        }
    }

    // Build supplier name → { id, material_id } lookup (fuzzy)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supplierList = (suppliers || []) as any[];

    // Helper: find material by report name
    function findMaterial(reportName: string): { id: string; name: string } | null {
        const clean = reportName.replace(/\s*-\s*\[\d+\]\s*$/, '').trim().toLowerCase();
        // Direct match
        for (const [key, val] of materialMap.entries()) {
            if (key === clean) return val;
        }
        // Fuzzy: check if report name contains DB material or vice-versa
        for (const [key, val] of materialMap.entries()) {
            if (clean.includes(key) || key.includes(clean)) return val;
        }
        // Keyword matching
        if (clean.includes('minerio') || clean.includes('minério') || clean.includes('ferro')) {
            for (const [key, val] of materialMap.entries()) {
                if (key.includes('minério') || key.includes('minerio') || key.includes('ferro')) return val;
            }
        }
        if (clean.includes('bauxita')) {
            for (const [key, val] of materialMap.entries()) {
                if (key.includes('bauxita')) return val;
            }
        }
        if (clean.includes('calcario') || clean.includes('calcário') || clean.includes('brita')) {
            for (const [key, val] of materialMap.entries()) {
                if (key.includes('calcário') || key.includes('calcario') || key.includes('fundente') || key.includes('cal')) return val;
            }
        }
        if (clean.includes('carvao') || clean.includes('carvão') || clean.includes('moinha')) {
            for (const [key, val] of materialMap.entries()) {
                if (key.includes('carvão') || key.includes('carvao')) return val;
            }
        }
        return null;
    }

    // Helper: find supplier by report origin name
    function findSupplier(reportOrigin: string, materialId: string | null): { id: string; name: string } | null {
        const clean = reportOrigin.replace(/\s*-\s*\[\d+\]\s*$/, '').trim().toLowerCase();
        // Try exact name match first
        for (const s of supplierList) {
            const sName = s.name.toLowerCase();
            if (sName === clean && (!materialId || s.material_id === materialId)) {
                return { id: s.id, name: s.name };
            }
        }
        // Fuzzy contains match
        for (const s of supplierList) {
            const sName = s.name.toLowerCase();
            if ((clean.includes(sName) || sName.includes(clean)) && (!materialId || s.material_id === materialId)) {
                return { id: s.id, name: s.name };
            }
        }
        // Partial keyword match (first significant word)
        const keywords = clean.split(/\s+/).filter(w => w.length > 3 && !['ltda', 'mining', 'mineracao', 'mineração', 'transportadora'].includes(w));
        for (const kw of keywords) {
            for (const s of supplierList) {
                const sName = s.name.toLowerCase();
                if (sName.includes(kw) && (!materialId || s.material_id === materialId)) {
                    return { id: s.id, name: s.name };
                }
            }
        }
        // NOTE: Intentionally NOT matching without material constraint
        // to avoid assigning deliveries to wrong supplier/material combinations
        return null;
    }

    // Helper: find open order for supplier+material (FIFO, with remaining capacity)
    // Track assigned weight per order across all tickets
    const assignedWeightMap = new Map<string, number>();

    function findOpenOrder(supplierId: string, materialId: string, weightKg: number): {
        transactionId: string;
        date: string;
        quantity: number;
        remaining: number;
    } | null {
        if (!openOrders) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const order of openOrders as any[]) {
            if (order.supplier_id === supplierId && order.material_id === materialId) {
                const delivered = deliverySumMap.get(order.id) || 0;
                const assigned = assignedWeightMap.get(order.id) || 0;
                const totalQty = Number(order.quantity);
                const remaining = totalQty - delivered - assigned;
                if (remaining > 0) {
                    // Assign this weight
                    assignedWeightMap.set(order.id, assigned + weightKg);
                    return {
                        transactionId: order.id,
                        date: order.date,
                        quantity: totalQty,
                        remaining: remaining,
                    };
                }
            }
        }
        return null;
    }

    // 5. Match each ticket
    const matched: MatchedTicket[] = tickets.map(ticket => {
        const mat = findMaterial(ticket.material);
        const sup = findSupplier(ticket.origin, mat?.id || null);
        const order = (sup && mat) ? findOpenOrder(sup.id, mat.id, ticket.weightKg) : null;

        let matchStatus: 'matched' | 'partial' | 'unmatched' = 'unmatched';
        let matchNote = '';

        if (mat && sup && order) {
            matchStatus = 'matched';
            matchNote = `Ordem ${new Date(order.date).toLocaleDateString('pt-BR')} — Saldo: ${order.remaining.toLocaleString('pt-BR')} kg`;
        } else if (mat && sup) {
            matchStatus = 'partial';
            matchNote = 'Fornecedor e material encontrados, mas sem ordem de compra em aberto';
        } else {
            const notes: string[] = [];
            if (!mat) notes.push(`Material "${ticket.material}" não encontrado`);
            if (!sup) notes.push(`Fornecedor "${ticket.origin}" não encontrado`);
            matchNote = notes.join('; ');
        }

        return {
            ...ticket,
            supplierId: sup?.id || null,
            supplierName: sup?.name || null,
            materialId: mat?.id || null,
            materialName: mat?.name || null,
            transactionId: order?.transactionId || null,
            transactionDate: order?.date || null,
            transactionQuantity: order?.quantity || null,
            transactionRemaining: order?.remaining || null,
            matchStatus,
            matchNote,
        };
    });

    return matched;
}

// =============================================================================
// Import confirmed tickets into the database
// =============================================================================

export async function importMatchedTickets(
    tickets: MatchedTicket[]
): Promise<ImportResult> {
    const supabase = await createClient();

    const result: ImportResult = {
        total: tickets.length,
        imported: 0,
        skipped: 0,
        errors: [],
    };

    for (const ticket of tickets) {
        if (!ticket.transactionId || ticket.matchStatus !== 'matched') {
            result.skipped++;
            continue;
        }

        try {
            // 1. Get material_id from transaction
            const { data: tx, error: txError } = await (supabase
                .from("transactions")
                .select("material_id")
                .eq("id", ticket.transactionId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .single() as any);

            if (txError || !tx) {
                result.errors.push(`Ticket ${ticket.ticketNumber}: Transação não encontrada`);
                result.skipped++;
                continue;
            }

            const materialId = tx.material_id;

            // 2. Check for duplicate (same transaction + plate + weight + approximate date)
            const ticketDate = new Date(ticket.date + "T12:00:00Z").toISOString();
            const dateStart = new Date(ticket.date + "T00:00:00Z").toISOString();
            const dateEnd = new Date(ticket.date + "T23:59:59Z").toISOString();
            const { data: existing } = await (supabase
                .from("inbound_deliveries")
                .select("id")
                .eq("transaction_id", ticket.transactionId)
                .eq("plate", ticket.plate)
                .eq("weight_measured", ticket.weightKg)
                .gte("date", dateStart)
                .lte("date", dateEnd)
                .is("deleted_at", null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .limit(1) as any);

            if (existing && existing.length > 0) {
                result.skipped++;
                result.errors.push(`Ticket ${ticket.ticketNumber}: Já importado (duplicado)`);
                continue;
            }

            // 3. Insert inbound delivery
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: deliveryError } = await (supabase.from("inbound_deliveries") as any).insert({
                transaction_id: ticket.transactionId,
                plate: ticket.plate,
                weight_measured: ticket.weightKg,
                weight_fiscal: null,
                driver_name: ticket.driver || null,
                date: ticketDate,
            });

            if (deliveryError) {
                result.errors.push(`Ticket ${ticket.ticketNumber}: ${deliveryError.message}`);
                result.skipped++;
                continue;
            }

            // 4. Create inventory movement
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from("inventory_movements") as any).insert({
                material_id: materialId,
                quantity: ticket.weightKg,
                movement_type: "compra",
                reference_id: ticket.transactionId,
                date: ticketDate,
                notes: `Importação Balança: Placa ${ticket.plate} — Ticket #${ticket.ticketNumber}`,
            });

            // 5. Update material stock
            const { data: matCheck } = await supabase
                .from("materials")
                .select("current_stock")
                .eq("id", materialId)
                .single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const currentStock = Number((matCheck as any)?.current_stock) || 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from("materials") as any)
                .update({ current_stock: currentStock + ticket.weightKg })
                .eq("id", materialId);

            result.imported++;
        } catch (err) {
            result.errors.push(`Ticket ${ticket.ticketNumber}: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
            result.skipped++;
        }
    }

    revalidatePath("/balanca");
    revalidatePath("/estoque");
    return result;
}
