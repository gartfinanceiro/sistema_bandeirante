"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface PurchaseOrder {
    id: string;
    date: string;
    supplierId: string; // Added for correct aggregation
    supplierName: string;
    materialName: string;
    materialUnit: string;
    totalQuantity: number;
    deliveredQuantity: number;
    remainingQuantity: number;
    status: string;
}

export interface SupplierBalance {
    supplierId: string;
    supplierName: string;
    totalQuantity: number;
    deliveredQuantity: number;
    remainingQuantity: number;
    openOrdersCount: number;
    materials: string[];
}

export async function getOpenPurchaseOrders(): Promise<PurchaseOrder[]> {
    const supabase = await createClient();

    // 1. Get Transactions (Matéria Prima / Saída) that are not fully delivered
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
        .select("transaction_id, weight_measured")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .in("transaction_id", transactionIds) as any);

    const deliveryMap = new Map<string, number>();
    if (deliveries) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        deliveries.forEach((d: any) => {
            const current = deliveryMap.get(d.transaction_id) || 0;
            deliveryMap.set(d.transaction_id, current + Number(d.weight_measured));
        });
    }

    // 3. Map to PurchaseOrder
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orders: PurchaseOrder[] = transactions.map((t: any) => {
        const totalQty = Number(t.quantity) || 0;
        const deliveredQty = deliveryMap.get(t.id) || 0;
        const remaining = Math.max(0, totalQty - deliveredQty);

        return {
            id: t.id,
            date: t.date,
            supplierId: t.supplier_id, // Map ID
            supplierName: t.supplier?.name || "Sem fornecedor",
            materialName: t.material?.name || "Desconhecido",
            materialUnit: t.material?.unit || "unid",
            totalQuantity: totalQty,
            deliveredQuantity: deliveredQty,
            remainingQuantity: remaining,
            status: t.status
        };
    });

    // Only return orders with remaining quantity > 0
    return orders.filter(o => o.remainingQuantity > 0.1);
}

export async function getSupplierBalances(): Promise<SupplierBalance[]> {
    const orders = await getOpenPurchaseOrders();
    const balanceMap = new Map<string, SupplierBalance>();

    for (const order of orders) {
        if (!order.supplierId) continue;

        if (!balanceMap.has(order.supplierId)) {
            balanceMap.set(order.supplierId, {
                supplierId: order.supplierId,
                supplierName: order.supplierName,
                totalQuantity: 0,
                deliveredQuantity: 0,
                remainingQuantity: 0,
                openOrdersCount: 0,
                materials: []
            });
        }

        const entry = balanceMap.get(order.supplierId)!;
        entry.totalQuantity += order.totalQuantity;
        entry.deliveredQuantity += order.deliveredQuantity;
        entry.remainingQuantity += order.remainingQuantity;
        entry.openOrdersCount += 1;

        if (!entry.materials.includes(order.materialName)) {
            entry.materials.push(order.materialName);
        }
    }

    // Convert map to array and sort by remaining quantity (descending)
    return Array.from(balanceMap.values()).sort((a, b) => b.remainingQuantity - a.remainingQuantity);
}


export async function createInboundDelivery(formData: FormData): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    const transactionId = formData.get("transactionId") as string;
    const plate = formData.get("plate") as string;
    const weightStr = formData.get("weight") as string;
    const driver = formData.get("driver") as string;
    const date = formData.get("date") as string || new Date().toISOString();

    if (!transactionId || !plate || !weightStr) {
        return { success: false, error: "Dados incompletos." };
    }

    const weight = parseFloat(weightStr);

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
            driver_name: driver,
            date: date
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
            date: date,
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
    driverName: string | null;
}

export async function getDeliveriesForTransaction(transactionId: string): Promise<Delivery[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("inbound_deliveries")
        .select("id, date, plate, weight_measured, driver_name")
        .eq("transaction_id", transactionId)
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
    const driver = formData.get("driver") as string;

    if (!id || !plate || !weightStr) {
        return { success: false, error: "Dados incompletos." };
    }

    const newWeight = parseFloat(weightStr);

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
                driver_name: driver || null,
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

    try {
        // Get delivery info before deleting
        const { data: delivery, error: fetchError } = await (supabase
            .from("inbound_deliveries")
            .select("weight_measured, transaction_id")
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

        // Delete delivery
        const { error: deleteError } = await supabase
            .from("inbound_deliveries")
            .delete()
            .eq("id", id);

        if (deleteError) {
            return { success: false, error: "Erro ao excluir: " + deleteError.message };
        }

        // Subtract weight from stock
        if (tx?.material_id) {
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
