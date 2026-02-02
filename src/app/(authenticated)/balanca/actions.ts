"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface PurchaseOrder {
    id: string;
    date: string;
    supplierId: string;
    supplierName: string;
    materialName: string;
    materialUnit: string;
    quantity: number;
    deliveredQuantity: number;
    deliveredQuantityFiscal: number | null;
    lastDeliveryDate: string | null;
    remainingQuantity: number;
    remainingQuantityFiscal: number | null;
    status: string; // Database status
    computedStatus: 'open' | 'completed'; // Logic status
}

export interface SupplierBalance {
    supplierId: string;
    supplierName: string;
    totalContratado: number;
    totalEntregueReal: number;
    totalEntregueFiscal: number;
    saldoReal: number;
    saldoFiscal: number;
    openOrdersCount: number;
    materials: string[];
    recentDeliveries: {
        date: string;
        plate: string;
        weightReal: number;
        weightFiscal: number | null;
    }[];
}

// Renamed to reflect it returns all orders (filtered client-side or via args if needed)
export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
    const supabase = await createClient();

    // 1. Get Transactions (Matéria Prima / Saída)
    const { data: transactions, error } = await supabase
        .from("transactions")
        .select(`
            id, date, amount, quantity, material_id, supplier_id, status,
            supplier:suppliers!supplier_id ( id, name ),
            material:materials!material_id ( name, unit )
        `)
        .eq("type", "saida")
        .not("material_id", "is", null)
        .not("quantity", "is", null)
        .gt("quantity", 0)
        .order("date", { ascending: false });

    if (error) {
        console.error("Error fetching purchase orders:", JSON.stringify(error, null, 2));
        return [];
    }

    if (!transactions || transactions.length === 0) return [];

    // 2. Get Delivery Sums
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transactionIds = (transactions as any[]).map(t => t.id);

    const { data: deliveries } = await (supabase
        .from("inbound_deliveries")
        .select("transaction_id, weight_measured, weight_fiscal")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .is("deleted_at", null)
        .in("transaction_id", transactionIds) as any);

    const deliveryMap = new Map<string, { real: number, fiscal: number, lastDate: string | null }>();
    if (deliveries) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        deliveries.forEach((d: any) => {
            const current = deliveryMap.get(d.transaction_id) || { real: 0, fiscal: 0, lastDate: null };
            const real = Number(d.weight_measured) || 0;
            const fiscal = Number(d.weight_fiscal) || 0;
            // Track max date
            let maxDate = d.date;
            if (current.lastDate && new Date(current.lastDate) > new Date(d.date)) {
                maxDate = current.lastDate;
            }

            deliveryMap.set(d.transaction_id, {
                real: current.real + real,
                fiscal: current.fiscal + fiscal,
                lastDate: maxDate
            });
        });
    }

    // 3. Map to PurchaseOrder
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orders: PurchaseOrder[] = transactions.map((t: any) => {
        const totalQty = Number(t.quantity) || 0;
        const sums = deliveryMap.get(t.id) || { real: 0, fiscal: 0, lastDate: null };

        const deliveredQty = sums.real;
        const deliveredQtyFiscal = sums.fiscal;
        const lastDeliveryDate = sums.lastDate;

        const remaining = Math.max(0, totalQty - deliveredQty);
        const remainingFiscal = Math.max(0, totalQty - deliveredQtyFiscal);

        // Status Logic: Completed if remaining is effectively zero (tolerance 0.1)
        const computedStatus = remaining <= 0.1 ? 'completed' : 'open';

        return {
            id: t.id,
            date: t.date,
            supplierId: t.supplier_id,
            supplierName: t.supplier?.name || "Sem fornecedor",
            materialName: t.material?.name || "Desconhecido",
            materialUnit: t.material?.unit || "unid",
            quantity: totalQty,
            deliveredQuantity: deliveredQty,
            deliveredQuantityFiscal: deliveredQtyFiscal,
            lastDeliveryDate: lastDeliveryDate,
            remainingQuantity: remaining,
            remainingQuantityFiscal: remainingFiscal,
            status: t.status,
            computedStatus
        };
    });

    // Return ALL orders, sorted by Open first, then Date
    return orders.sort((a, b) => {
        if (a.computedStatus === 'open' && b.computedStatus !== 'open') return -1;
        if (a.computedStatus !== 'open' && b.computedStatus === 'open') return 1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
}

// Deprecated alias for backward compatibility or refactoring steps
export async function getOpenPurchaseOrders(): Promise<PurchaseOrder[]> {
    return getPurchaseOrders();
}

export async function getSupplierBalances(): Promise<SupplierBalance[]> {
    const supabase = await createClient();
    const orders = await getOpenPurchaseOrders();
    const balanceMap = new Map<string, SupplierBalance>();
    const supplierOrderIds = new Map<string, string[]>();

    // 1. Aggregate Orders into Balances
    for (const order of orders) {
        if (!order.supplierId) continue;

        if (!balanceMap.has(order.supplierId)) {
            balanceMap.set(order.supplierId, {
                supplierId: order.supplierId,
                supplierName: order.supplierName,
                totalContratado: 0,
                totalEntregueReal: 0,
                totalEntregueFiscal: 0,
                saldoReal: 0,
                saldoFiscal: 0,
                openOrdersCount: 0,
                materials: [],
                recentDeliveries: []
            });
            supplierOrderIds.set(order.supplierId, []);
        }

        const entry = balanceMap.get(order.supplierId)!;
        entry.totalContratado += order.quantity;
        entry.totalEntregueReal += order.deliveredQuantity;
        entry.totalEntregueFiscal += (order.deliveredQuantityFiscal || 0);
        entry.saldoReal += order.remainingQuantity;
        entry.saldoFiscal += (order.remainingQuantityFiscal || 0);

        if (order.computedStatus === 'open') {
            entry.openOrdersCount += 1;
        }

        if (!entry.materials.includes(order.materialName)) {
            entry.materials.push(order.materialName);
        }

        supplierOrderIds.get(order.supplierId)?.push(order.id);
    }

    // 2. Fetch Recent Deliveries for each Balance
    const balances = Array.from(balanceMap.values());

    for (const balance of balances) {
        const orderIds = supplierOrderIds.get(balance.supplierId) || [];
        if (orderIds.length > 0) {
            const { data: recent } = await supabase
                .from("inbound_deliveries")
                .select("date, plate, weight_measured, weight_fiscal")
                .in("transaction_id", orderIds)
                .is("deleted_at", null)
                .order("date", { ascending: false })
                .limit(5);

            if (recent) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                balance.recentDeliveries = recent.map((d: any) => ({
                    date: d.date,
                    plate: d.plate,
                    weightReal: Number(d.weight_measured),
                    weightFiscal: d.weight_fiscal ? Number(d.weight_fiscal) : null
                }));
            }
        }
    }

    // Sort by Saldo Real Descending
    return balances.sort((a, b) => b.saldoReal - a.saldoReal);
}


export async function createInboundDelivery(formData: FormData): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    const transactionId = formData.get("transactionId") as string;
    const plate = formData.get("plate") as string;
    const weightStr = formData.get("weight") as string;
    const weightFiscalStr = formData.get("weightFiscal") as string;
    const driver = formData.get("driver") as string;
    const date = formData.get("date") as string || new Date().toISOString();

    if (!transactionId || !plate || !weightStr) {
        return { success: false, error: "Dados incompletos." };
    }

    const weight = isNaN(parseFloat(weightStr)) ? 0 : parseFloat(weightStr);
    // Treat empty string or invalid number as null for fiscal weight, unless explicit 0? 
    // Usually user leaves empty.
    const weightFiscal = weightFiscalStr && !isNaN(parseFloat(weightFiscalStr)) ? parseFloat(weightFiscalStr) : null;

    try {
        // 1. Get Transaction info
        const { data: tx, error: txError } = await (supabase
            .from("transactions")
            .select("material_id, materials(name)")
            .eq("id", transactionId)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .single() as any);

        if (txError || !tx) throw new Error("Transação original não encontrada.");

        const materialId = tx.material_id;

        // 2. Insert Inbound Delivery
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: deliveryError } = await (supabase.from("inbound_deliveries") as any).insert({
            transaction_id: transactionId,
            plate: plate,
            weight_measured: weight,
            weight_fiscal: weightFiscal,
            driver_name: driver,
            vehicle_type: "truck", // default
            date: new Date(date + "T12:00:00Z").toISOString()
        });

        if (deliveryError) throw new Error("Erro ao salvar pesagem: " + deliveryError.message);

        // 3. Update Inventory
        // A. Movement Log
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: moveError } = await (supabase.from("inventory_movements") as any).insert({
            material_id: materialId,
            quantity: weight,
            movement_type: "compra",
            reference_id: transactionId,
            date: new Date(date + "T12:00:00Z").toISOString(),
            notes: `Entrega Balança: Placa ${plate}`
        });

        if (moveError) throw new Error("Erro ao mover estoque: " + moveError.message);

        // B. Update Material Current Stock
        const { data: matCheck } = await supabase.from("materials").select("current_stock").eq("id", materialId).single();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const currentStock = Number((matCheck as any)?.current_stock) || 0;
        const newStock = currentStock + weight;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase.from("materials") as any)
            .update({ current_stock: newStock })
            .eq("id", materialId);

        if (updateError) throw new Error("Erro ao atualizar totalizador do material.");

        revalidatePath("/balanca");
        revalidatePath("/estoque");
        return { success: true };

    } catch (err) {
        console.error("Scale Entry Error:", err);
        return { success: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
    }
}

// =============================================================================
// Get Deliveries for a Transaction
// =============================================================================

export interface Delivery {
    id: string;
    date: string;
    plate: string;
    weight: number;
    weightFiscal: number | null;
    driverName: string | null;
}

export async function getDeliveriesForTransaction(transactionId: string): Promise<Delivery[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("inbound_deliveries")
        .select("id, date, plate, weight_measured, weight_fiscal, driver_name")
        .eq("transaction_id", transactionId)
        .is("deleted_at", null)
        .order("date", { ascending: false });

    if (error || !data) {
        console.error("Error fetching deliveries:", error);
        return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.map((d: any) => ({
        id: d.id,
        date: d.date,
        plate: d.plate,
        weight: Number(d.weight_measured),
        weightFiscal: d.weight_fiscal ? Number(d.weight_fiscal) : null,
        driverName: d.driver_name,
    }));
}

// =============================================================================
// Update Delivery
// =============================================================================

export async function updateDelivery(formData: FormData): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    const id = formData.get("id") as string;
    const plate = formData.get("plate") as string;
    const weightStr = formData.get("weight") as string;
    const weightFiscalStr = formData.get("weightFiscal") as string;
    const driver = formData.get("driver") as string;
    const date = formData.get("date") as string; // Normalized YYYY-MM-DD from form

    if (!id || !plate || !weightStr || !date) {
        return { success: false, error: "Dados incompletos." };
    }

    const newWeight = isNaN(parseFloat(weightStr)) ? 0 : parseFloat(weightStr);
    const newWeightFiscal = weightFiscalStr && !isNaN(parseFloat(weightFiscalStr)) ? parseFloat(weightFiscalStr) : null;

    try {
        // Get old delivery to calculate stock difference
        const { data: oldDelivery, error: fetchError } = await (supabase
            .from("inbound_deliveries")
            .select("weight_measured, transaction_id")
            .eq("id", id)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .single() as any);

        if (fetchError || !oldDelivery) {
            return { success: false, error: "Entrega não encontrada." };
        }

        const oldWeight = Number(oldDelivery.weight_measured);
        const weightDiff = newWeight - oldWeight;

        // Update delivery record
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase.from("inbound_deliveries") as any)
            .update({
                plate,
                weight_measured: newWeight,
                weight_fiscal: newWeightFiscal,
                driver_name: driver || null,
                date: new Date(date + "T12:00:00Z").toISOString(), // Persistence (Noon UTC to safely allow TZ shifts)
            })
            .eq("id", id);

        if (updateError) {
            return { success: false, error: "Erro ao atualizar: " + updateError.message };
        }

        // Adjust stock if weight changed
        if (Math.abs(weightDiff) > 0.001) {
            // Get material_id from transaction
            const { data: tx } = await (supabase
                .from("transactions")
                .select("material_id")
                .eq("id", oldDelivery.transaction_id)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .single() as any);

            if (tx?.material_id) {
                const { data: mat } = await supabase.from("materials").select("current_stock").eq("id", tx.material_id).single();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const currentStock = Number((mat as any)?.current_stock) || 0;

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase.from("materials") as any)
                    .update({ current_stock: currentStock + weightDiff })
                    .eq("id", tx.material_id);
            }
        }

        revalidatePath("/balanca");
        revalidatePath("/estoque");
        return { success: true };

    } catch (err) {
        console.error("Update Delivery Error:", err);
        return { success: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
    }
}

// =============================================================================
// Delete Delivery
// =============================================================================

export async function deleteDelivery(id: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    try {
        // Get delivery info before deleting
        const { data: delivery, error: fetchError } = await (supabase
            .from("inbound_deliveries")
            .select("weight_measured, transaction_id, plate")
            .eq("id", id)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .single() as any);

        if (fetchError || !delivery) {
            return { success: false, error: "Entrega não encontrada." };
        }

        const weight = Number(delivery.weight_measured);

        // Get material_id from transaction
        const { data: tx } = await (supabase
            .from("transactions")
            .select("material_id")
            .eq("id", delivery.transaction_id)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .single() as any);

        // Soft Delete
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: deleteError } = await (supabase.from("inbound_deliveries") as any)
            .update({
                deleted_at: new Date().toISOString(),
                status: 'cancelled',
                deleted_by: user?.id
            })
            .eq("id", id);

        if (deleteError) {
            return { success: false, error: "Erro ao excluir: " + deleteError.message };
        }

        // Subtract weight from stock and Log Reversal
        if (tx?.material_id) {
            // A. Log Movement Reversal
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from("inventory_movements") as any).insert({
                material_id: tx.material_id,
                quantity: -weight, // Negative to reverse
                movement_type: "ajuste",
                reference_id: delivery.transaction_id, // Link to order 
                date: new Date().toISOString(),
                notes: `Estorno de Entrega: Placa ${delivery.plate}`
            });

            // B. Update Stock
            const { data: mat } = await supabase.from("materials").select("current_stock").eq("id", tx.material_id).single();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const currentStock = Number((mat as any)?.current_stock) || 0;
            const newStock = Math.max(0, currentStock - weight);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from("materials") as any)
                .update({ current_stock: newStock })
                .eq("id", tx.material_id);
        }

        revalidatePath("/balanca");
        revalidatePath("/estoque");
        return { success: true };

    } catch (err) {
        console.error("Delete Delivery Error:", err);
        return { success: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
    }
}
