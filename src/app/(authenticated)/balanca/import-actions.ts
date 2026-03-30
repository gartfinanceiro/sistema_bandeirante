"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// =============================================================================
// Last import info (shown on upload step to prevent duplicates)
// =============================================================================

export interface LastImportInfo {
    lastDeliveryDate: string | null;
    totalDeliveries: number;
}

export async function getLastImportInfo(): Promise<LastImportInfo> {
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase
        .from("inbound_deliveries")
        .select("date")
        .is("deleted_at", null)
        .order("date", { ascending: false })
        .limit(1) as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (supabase
        .from("inbound_deliveries")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null) as any);

    return {
        lastDeliveryDate: data?.[0]?.date || null,
        totalDeliveries: count || 0,
    };
}

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
        // Minério de Ferro — match específico antes do genérico
        if (clean.includes('minerio de ferro') || clean.includes('minério de ferro')) {
            for (const [key, val] of materialMap.entries()) {
                if (key.includes('minério de ferro') || key.includes('minerio de ferro')) return val;
            }
        }
        if (clean.includes('minerio') || clean.includes('minério')) {
            for (const [key, val] of materialMap.entries()) {
                if (key.includes('minério') || key.includes('minerio')) return val;
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
        if (clean.includes('coque')) {
            for (const [key, val] of materialMap.entries()) {
                if (key.includes('coque')) return val;
            }
        }
        if (clean.includes('carvao') || clean.includes('carvão') || clean.includes('moinha')) {
            for (const [key, val] of materialMap.entries()) {
                if (key.includes('carvão') || key.includes('carvao')) return val;
            }
        }
        // Xisto grafitoso → fundente
        if (clean.includes('xisto')) {
            for (const [key, val] of materialMap.entries()) {
                if (key.includes('fundente') || key.includes('calcário') || key.includes('calcario')) return val;
            }
        }
        // Lingoteira → mapear para Minério de Ferro (entrega de matéria prima)
        if (clean.includes('lingoteira')) {
            for (const [key, val] of materialMap.entries()) {
                if (key.includes('minério de ferro') || key.includes('minerio de ferro')) return val;
            }
        }
        return null;
    }

    // Helper: find ALL matching suppliers by report origin name
    // Retorna todos os fornecedores que casam com o nome (ex: "Corumbá com frete" e "Corumbá sem frete")
    // para que o matching principal possa tentar cada um em busca de uma ordem aberta.
    function findAllSuppliers(reportOrigin: string): { id: string; name: string }[] {
        const clean = reportOrigin.replace(/\s*-\s*\[\d+\]\s*$/, '').trim().toLowerCase();
        const found = new Map<string, { id: string; name: string }>();

        // Exact name match
        for (const s of supplierList) {
            if (s.name.toLowerCase() === clean) {
                found.set(s.id, { id: s.id, name: s.name });
            }
        }
        // Fuzzy contains match
        for (const s of supplierList) {
            const sName = s.name.toLowerCase();
            if ((clean.includes(sName) || sName.includes(clean)) && !found.has(s.id)) {
                found.set(s.id, { id: s.id, name: s.name });
            }
        }
        // Partial keyword match
        const keywords = clean.split(/\s+/).filter(w => w.length > 3 && !['ltda', 'mining', 'mineracao', 'mineração', 'transportadora'].includes(w));
        for (const kw of keywords) {
            for (const s of supplierList) {
                const sName = s.name.toLowerCase();
                if (sName.includes(kw) && !found.has(s.id)) {
                    found.set(s.id, { id: s.id, name: s.name });
                }
            }
        }
        return Array.from(found.values());
    }

    // Helper: build consolidated groups (supplier+material) for matching
    // NOTA: transaction.quantity está em TONELADAS, weight_measured/weightKg em KG
    interface OrderGroup {
        groupKey: string;
        supplierId: string;
        materialId: string;
        transactions: { id: string; date: string; totalQtyKg: number; deliveredKg: number }[];
        totalQtyKg: number;
        totalDeliveredKg: number;
    }

    const groupMap = new Map<string, OrderGroup>();
    if (openOrders) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const order of openOrders as any[]) {
            const groupKey = `${order.supplier_id}_${order.material_id}`;
            if (!groupMap.has(groupKey)) {
                groupMap.set(groupKey, {
                    groupKey,
                    supplierId: order.supplier_id,
                    materialId: order.material_id,
                    transactions: [],
                    totalQtyKg: 0,
                    totalDeliveredKg: 0,
                });
            }
            const group = groupMap.get(groupKey)!;
            const totalQtyKg = Number(order.quantity) * 1000;
            const deliveredKg = deliverySumMap.get(order.id) || 0;
            group.transactions.push({ id: order.id, date: order.date, totalQtyKg, deliveredKg });
            group.totalQtyKg += totalQtyKg;
            group.totalDeliveredKg += deliveredKg;
        }
    }

    // Track assigned weight per order across all tickets (for FIFO within a batch)
    const assignedWeightMap = new Map<string, number>();

    function findOpenOrder(supplierId: string, materialId: string, weightKg: number): {
        transactionId: string;
        date: string;
        quantity: number;      // group total in kg
        remaining: number;     // group remaining in kg
    } | null {
        const groupKey = `${supplierId}_${materialId}`;
        const group = groupMap.get(groupKey);
        if (!group) return null;

        // Calculate group remaining (total assigned across all transactions)
        const totalAssigned = group.transactions.reduce((sum, t) => sum + (assignedWeightMap.get(t.id) || 0), 0);
        const groupRemaining = group.totalQtyKg - group.totalDeliveredKg - totalAssigned;

        if (groupRemaining <= 0) return null;

        // FIFO: find first transaction with individual capacity
        // Transactions are already ordered by date ASC from the query
        let bestTxId: string | null = null;
        let bestTxDate: string | null = null;

        for (const t of group.transactions) {
            const assigned = assignedWeightMap.get(t.id) || 0;
            const txRemaining = t.totalQtyKg - t.deliveredKg - assigned;
            if (txRemaining > 100) { // 100kg tolerance (~0.1 ton)
                bestTxId = t.id;
                bestTxDate = t.date;
                break;
            }
        }

        // Overflow: all individual transactions full, but group has saldo
        // Use the most recent transaction (last in list)
        if (!bestTxId) {
            const lastTx = group.transactions[group.transactions.length - 1];
            bestTxId = lastTx.id;
            bestTxDate = lastTx.date;
        }

        // Assign weight to the chosen transaction
        const prevAssigned = assignedWeightMap.get(bestTxId) || 0;
        assignedWeightMap.set(bestTxId, prevAssigned + weightKg);

        return {
            transactionId: bestTxId,
            date: bestTxDate!,
            quantity: group.totalQtyKg,
            remaining: groupRemaining,
        };
    }

    // 5. Match each ticket
    // Busca todos os fornecedores compatíveis e tenta cada um até encontrar ordem aberta.
    // Isso resolve casos como "Corumbá com frete" e "Corumbá sem frete" que aparecem
    // iguais no relatório da balança mas são fornecedores distintos no sistema.
    const matched: MatchedTicket[] = tickets.map(ticket => {
        const mat = findMaterial(ticket.material);
        const suppliers = findAllSuppliers(ticket.origin);

        // Tentar cada fornecedor em busca de uma ordem aberta
        let bestSup: { id: string; name: string } | null = null;
        let bestOrder: { transactionId: string; date: string; quantity: number; remaining: number } | null = null;

        if (mat && suppliers.length > 0) {
            for (const sup of suppliers) {
                const order = findOpenOrder(sup.id, mat.id, ticket.weightKg);
                if (order) {
                    bestSup = sup;
                    bestOrder = order;
                    break; // Encontrou ordem, parar
                }
            }
            // Se nenhum fornecedor tem ordem aberta, usar o primeiro encontrado (para status "partial")
            if (!bestSup) {
                bestSup = suppliers[0];
            }
        }

        let matchStatus: 'matched' | 'partial' | 'unmatched' = 'unmatched';
        let matchNote = '';

        if (mat && bestSup && bestOrder) {
            matchStatus = 'matched';
            const remainingTons = (bestOrder.remaining / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
            matchNote = `Saldo grupo: ${remainingTons} t`;
        } else if (mat && bestSup) {
            matchStatus = 'partial';
            matchNote = 'Fornecedor e material encontrados, mas sem ordem de compra em aberto';
        } else {
            const notes: string[] = [];
            if (!mat) notes.push(`Material "${ticket.material}" não encontrado`);
            if (suppliers.length === 0) notes.push(`Fornecedor "${ticket.origin}" não encontrado`);
            matchNote = notes.join('; ');
        }

        return {
            ...ticket,
            supplierId: bestSup?.id || null,
            supplierName: bestSup?.name || null,
            materialId: mat?.id || null,
            materialName: mat?.name || null,
            transactionId: bestOrder?.transactionId || null,
            transactionDate: bestOrder?.date || null,
            transactionQuantity: bestOrder?.quantity || null,
            transactionRemaining: bestOrder?.remaining || null,
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
        // Skip unmatched tickets (no supplier or material identified)
        if (ticket.matchStatus === 'unmatched') {
            result.skipped++;
            continue;
        }

        const isLinked = ticket.matchStatus === 'matched' && !!ticket.transactionId;
        const isPartial = ticket.matchStatus === 'partial' && !!ticket.materialId && !!ticket.supplierId;

        if (!isLinked && !isPartial) {
            result.skipped++;
            continue;
        }

        try {
            // 1. Resolve material info
            let materialId: string;
            let materialUnit = 'tonelada';

            if (isLinked) {
                // Linked: get material from transaction
                const { data: tx, error: txError } = await (supabase
                    .from("transactions")
                    .select("material_id, materials(unit)")
                    .eq("id", ticket.transactionId!)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .single() as any);

                if (txError || !tx) {
                    result.errors.push(`Ticket ${ticket.ticketNumber}: Transação não encontrada`);
                    result.skipped++;
                    continue;
                }
                materialId = tx.material_id;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                materialUnit = (tx as any).materials?.unit || 'tonelada';
            } else {
                // Partial: get material unit directly
                materialId = ticket.materialId!;
                const { data: matInfo } = await supabase
                    .from("materials")
                    .select("unit")
                    .eq("id", materialId)
                    .single();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                materialUnit = (matInfo as any)?.unit || 'tonelada';
            }

            const quantityInUnit = materialUnit === 'tonelada' ? ticket.weightKg / 1000 : ticket.weightKg;

            // 2. Check for duplicate
            const ticketDate = new Date(ticket.date + "T12:00:00Z").toISOString();
            const dateStart = new Date(ticket.date + "T00:00:00Z").toISOString();
            const dateEnd = new Date(ticket.date + "T23:59:59Z").toISOString();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let dupQuery = (supabase
                .from("inbound_deliveries")
                .select("id")
                .eq("plate", ticket.plate)
                .eq("weight_measured", ticket.weightKg)
                .gte("date", dateStart)
                .lte("date", dateEnd)
                .is("deleted_at", null) as any);

            if (isLinked) {
                dupQuery = dupQuery.eq("transaction_id", ticket.transactionId);
            } else {
                dupQuery = dupQuery.is("transaction_id", null)
                    .eq("material_id", materialId)
                    .eq("supplier_id", ticket.supplierId);
            }

            const { data: existing } = await dupQuery.limit(1);

            if (existing && existing.length > 0) {
                result.skipped++;
                result.errors.push(`Ticket ${ticket.ticketNumber}: Já importado (duplicado)`);
                continue;
            }

            // 3. Insert inbound delivery
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: deliveryError } = await (supabase.from("inbound_deliveries") as any).insert({
                transaction_id: ticket.transactionId || null,
                material_id: materialId,
                supplier_id: ticket.supplierId || null,
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
                quantity: quantityInUnit,
                movement_type: "compra",
                reference_id: ticket.transactionId || null,
                date: ticketDate,
                notes: isLinked
                    ? `Importação Balança: Placa ${ticket.plate} — Ticket #${ticket.ticketNumber} (${ticket.weightKg} kg)`
                    : `Importação Balança (sem ordem): Placa ${ticket.plate} — Ticket #${ticket.ticketNumber} (${ticket.weightKg} kg)`,
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
                .update({ current_stock: currentStock + quantityInUnit })
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
