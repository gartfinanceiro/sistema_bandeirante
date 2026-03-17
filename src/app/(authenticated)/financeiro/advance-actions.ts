"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CarvaoAdvance } from "@/types/database";

// =============================================================================
// Types
// =============================================================================

export interface AdvanceListItem {
    id: string;
    status: CarvaoAdvance["status"];
    advance_amount: number;
    advance_date: string;
    supplier_name: string | null;
    carvao_supplier_name: string | null;
    discharge_id: string | null;
    discharge_date: string | null;
    discharge_weight_tons: number | null;
    discharge_volume_mdc: number | null;
    total_calculated_value: number | null;
    price_per_ton_used: number | null;
    complement_amount: number | null;
    complement_date: string | null;
    advance_transaction_description: string | null;
    notes: string | null;
    pending_balance: number | null; // total_calculated_value - advance_amount (if discharged)
}

export interface CarvaoSupplierOption {
    id: string;
    name: string;
}

// =============================================================================
// Get advances list (for financeiro view)
// =============================================================================

export async function getAdvances(filters?: {
    status?: string;
    supplierId?: string;
}): Promise<AdvanceListItem[]> {
    try {
        const supabase = await createClient();

        let query = (supabase.from("carvao_advances") as any)
            .select(`
                id,
                status,
                advance_amount,
                advance_date,
                discharge_id,
                discharge_date,
                total_calculated_value,
                price_per_ton_used,
                complement_amount,
                complement_date,
                notes,
                supplier:supplier_id(name),
                carvao_supplier:carvao_supplier_id(name),
                advance_transaction:advance_transaction_id(description),
                discharge:discharge_id(weight_tons, volume_mdc)
            `)
            .order("advance_date", { ascending: false });

        if (filters?.status) {
            query = query.eq("status", filters.status);
        }
        if (filters?.supplierId) {
            query = query.eq("supplier_id", filters.supplierId);
        }

        const { data, error } = await query;

        if (error) {
            console.error("Error fetching advances:", error);
            return [];
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (data || []).map((a: any) => ({
            id: a.id,
            status: a.status,
            advance_amount: Number(a.advance_amount),
            advance_date: a.advance_date,
            supplier_name: a.supplier?.name || null,
            carvao_supplier_name: a.carvao_supplier?.name || null,
            discharge_id: a.discharge_id,
            discharge_date: a.discharge_date,
            discharge_weight_tons: a.discharge?.weight_tons ? Number(a.discharge.weight_tons) : null,
            discharge_volume_mdc: a.discharge?.volume_mdc ? Number(a.discharge.volume_mdc) : null,
            total_calculated_value: a.total_calculated_value ? Number(a.total_calculated_value) : null,
            price_per_ton_used: a.price_per_ton_used ? Number(a.price_per_ton_used) : null,
            complement_amount: a.complement_amount ? Number(a.complement_amount) : null,
            complement_date: a.complement_date,
            advance_transaction_description: a.advance_transaction?.description || null,
            notes: a.notes,
            pending_balance: a.total_calculated_value
                ? Number(a.total_calculated_value) - Number(a.advance_amount)
                : null,
        }));
    } catch (err) {
        console.error("Error in getAdvances:", err);
        return [];
    }
}

// =============================================================================
// Get pending advances for a supplier (used in discharge confirmation)
// =============================================================================

export async function getPendingAdvancesForSupplier(
    carvaoSupplierId: string
): Promise<AdvanceListItem[]> {
    const supabase = await createClient();

    const { data, error } = await (supabase.from("carvao_advances") as any)
        .select(`
            id,
            status,
            advance_amount,
            advance_date,
            notes,
            supplier:supplier_id(name),
            advance_transaction:advance_transaction_id(description)
        `)
        .eq("carvao_supplier_id", carvaoSupplierId)
        .eq("status", "adiantamento_pago")
        .order("advance_date", { ascending: true });

    if (error) {
        console.error("Error fetching pending advances:", error);
        return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || []).map((a: any) => ({
        id: a.id,
        status: a.status,
        advance_amount: Number(a.advance_amount),
        advance_date: a.advance_date,
        supplier_name: a.supplier?.name || null,
        carvao_supplier_name: null,
        discharge_id: null,
        discharge_date: null,
        discharge_weight_tons: null,
        discharge_volume_mdc: null,
        total_calculated_value: null,
        price_per_ton_used: null,
        complement_amount: null,
        complement_date: null,
        advance_transaction_description: a.advance_transaction?.description || null,
        notes: a.notes,
        pending_balance: null,
    }));
}

// =============================================================================
// Get carvao suppliers (for advance form dropdown)
// =============================================================================

export async function getCarvaoSuppliersForAdvance(): Promise<CarvaoSupplierOption[]> {
    try {
        const supabase = await createClient();

        const { data } = await supabase
            .from("carvao_suppliers")
            .select("id, name")
            .eq("is_active", true)
            .order("name");

        if (!data) return [];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (data as any[]).map(s => ({ id: s.id, name: s.name }));
    } catch (err) {
        console.error("Error in getCarvaoSuppliersForAdvance:", err);
        return [];
    }
}

// =============================================================================
// Create advance payment
// Called after a charcoal transaction is created (from import or manual)
// =============================================================================

export async function createAdvancePayment(params: {
    advanceTransactionId: string;
    advanceAmount: number;
    advanceDate: string;
    supplierId?: string | null;
    carvaoSupplierId?: string | null;
    notes?: string | null;
}): Promise<{ success: boolean; advanceId?: string; error?: string }> {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Usuário não autenticado" };

    const { data, error } = await (supabase.from("carvao_advances") as any)
        .insert({
            advance_transaction_id: params.advanceTransactionId,
            advance_amount: params.advanceAmount,
            advance_date: params.advanceDate,
            supplier_id: params.supplierId || null,
            carvao_supplier_id: params.carvaoSupplierId || null,
            status: "adiantamento_pago",
            notes: params.notes || null,
            created_by: user.id,
        })
        .select("id")
        .single();

    if (error) {
        console.error("Error creating advance:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/financeiro");
    return { success: true, advanceId: data.id };
}

// =============================================================================
// Link discharge to advance (called from discharge confirmation)
// =============================================================================

export async function linkDischargeToAdvance(params: {
    advanceId: string;
    dischargeId: string;
    pricePerTon: number;
}): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    // 1. Get discharge data to calculate total value
    const { data: discharge, error: dischargeError } = await supabase
        .from("carvao_discharges")
        .select("weight_tons, discharge_date, volume_mdc, density")
        .eq("id", params.dischargeId)
        .single();

    if (dischargeError || !discharge) {
        return { success: false, error: "Descarga não encontrada" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const weightTons = Number((discharge as any).weight_tons);
    const totalValue = weightTons * params.pricePerTon;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dischargeDate = (discharge as any).discharge_date;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const volumeMdc = Number((discharge as any).volume_mdc) || 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const density = Number((discharge as any).density) || 0;

    // 2. Get advance data (for advance_amount and advance_transaction_id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: advance, error: advError } = await (supabase.from("carvao_advances") as any)
        .select("id, status, advance_amount, advance_transaction_id")
        .eq("id", params.advanceId)
        .single();

    if (advError || !advance) {
        return { success: false, error: "Adiantamento não encontrado" };
    }

    if (advance.status !== "adiantamento_pago") {
        return { success: false, error: "Adiantamento já foi processado" };
    }

    // 3. Update advance with discharge link
    const { error } = await (supabase.from("carvao_advances") as any)
        .update({
            discharge_id: params.dischargeId,
            discharge_date: dischargeDate,
            total_calculated_value: totalValue,
            price_per_ton_used: params.pricePerTon,
            status: "descarregado",
        })
        .eq("id", params.advanceId)
        .eq("status", "adiantamento_pago"); // Safety: only update if still pending

    if (error) {
        console.error("Error linking discharge to advance:", error);
        return { success: false, error: error.message };
    }

    // 4. Update charcoal stock — the cargo is physically in the yard now
    // Usar volume_mdc como quantidade — unidade do material carvão é m³ (MDC)
    if (volumeMdc > 0) {
        try {
            // Find charcoal material
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: material } = await (supabase
                .from("materials")
                .select("id, current_stock")
                .or("name.ilike.%carvão%,name.ilike.%carvao%")
                .limit(1)
                .single() as any);

            if (material) {
                const currentStock = Number(material.current_stock) || 0;
                const newStock = currentStock + volumeMdc;

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase.from("materials") as any)
                    .update({ current_stock: newStock })
                    .eq("id", material.id);

                // Create inventory movement with discharge as reference
                const unitPrice = volumeMdc > 0 ? Number(advance.advance_amount) / volumeMdc : 0;

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase.from("inventory_movements") as any).insert({
                    material_id: material.id,
                    date: dischargeDate,
                    quantity: volumeMdc,
                    unit_price: unitPrice,
                    total_value: Number(advance.advance_amount),
                    movement_type: "compra",
                    reference_id: advance.advance_transaction_id || params.dischargeId,
                    notes: `Descarga carvão (adiantamento) - ${volumeMdc.toFixed(1)} MDC (${weightTons.toFixed(2)} t)`,
                });
            }
        } catch (err) {
            console.error("Stock update error during discharge link:", err);
            // Don't fail the whole operation - advance link was already saved
        }
    }

    revalidatePath("/financeiro");
    revalidatePath("/estoque");
    revalidatePath("/carvao/confirmacoes");
    return { success: true };
}

// =============================================================================
// Create complement payment (finalizes the advance cycle)
// =============================================================================

export async function createComplementPayment(params: {
    advanceId: string;
    complementTransactionId: string;
    complementAmount: number;
    complementDate: string;
}): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    // 1. Get advance with discharge info to check if stock was already updated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: advance, error: advError } = await (supabase.from("carvao_advances") as any)
        .select("id, status, advance_amount, discharge_id, advance_transaction_id")
        .eq("id", params.advanceId)
        .single();

    if (advError || !advance) {
        return { success: false, error: "Adiantamento não encontrado" };
    }

    if (advance.status !== "descarregado") {
        return { success: false, error: "Adiantamento não está no status 'descarregado'" };
    }

    // 2. Update advance → finalizado
    const { error } = await (supabase.from("carvao_advances") as any)
        .update({
            complement_transaction_id: params.complementTransactionId,
            complement_amount: params.complementAmount,
            complement_date: params.complementDate,
            status: "finalizado",
        })
        .eq("id", params.advanceId)
        .eq("status", "descarregado"); // Safety: only finalize if discharged

    if (error) {
        console.error("Error creating complement:", error);
        return { success: false, error: error.message };
    }

    // 3. Check if inventory_movement was already created for this advance
    //    (by linkDischargeToAdvance or by a previous fix)
    //    If not, create it now using discharge data
    if (advance.discharge_id) {
        try {
            // Check for existing movement linked to this advance's transaction
            const refId = advance.advance_transaction_id || advance.discharge_id;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: existingMov } = await (supabase
                .from("inventory_movements")
                .select("id")
                .eq("reference_id", refId)
                .limit(1) as any);

            if (!existingMov || existingMov.length === 0) {
                // No movement exists — get discharge data and create one
                const { data: discharge } = await supabase
                    .from("carvao_discharges")
                    .select("weight_tons, discharge_date, volume_mdc, density")
                    .eq("id", advance.discharge_id)
                    .single();

                if (discharge) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const weightTons = Number((discharge as any).weight_tons);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const volumeMdc = Number((discharge as any).volume_mdc) || 0;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const dischargeDate = (discharge as any).discharge_date;

                    // Usar volume_mdc como quantidade — unidade do carvão é m³ (MDC)
                    if (volumeMdc > 0) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const { data: material } = await (supabase
                            .from("materials")
                            .select("id, current_stock")
                            .or("name.ilike.%carvão%,name.ilike.%carvao%")
                            .limit(1)
                            .single() as any);

                        if (material) {
                            const currentStock = Number(material.current_stock) || 0;
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            await (supabase.from("materials") as any)
                                .update({ current_stock: currentStock + volumeMdc })
                                .eq("id", material.id);

                            const totalPaid = Number(advance.advance_amount) + params.complementAmount;
                            const unitPrice = volumeMdc > 0 ? totalPaid / volumeMdc : 0;

                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            await (supabase.from("inventory_movements") as any).insert({
                                material_id: material.id,
                                date: dischargeDate,
                                quantity: volumeMdc,
                                unit_price: unitPrice,
                                total_value: totalPaid,
                                movement_type: "compra",
                                reference_id: refId,
                                notes: `Complemento carvão (finalização) - ${volumeMdc.toFixed(1)} MDC (${weightTons.toFixed(2)} t)`,
                            });
                        }
                    }
                }
            }
        } catch (err) {
            console.error("Stock update error during complement finalization:", err);
        }
    }

    revalidatePath("/financeiro");
    revalidatePath("/estoque");
    return { success: true };
}

// =============================================================================
// Get advances pending complement (descarregado status)
// Used in the complement payment dialog
// =============================================================================

export async function getAdvancesPendingComplement(): Promise<AdvanceListItem[]> {
    return getAdvances({ status: "descarregado" });
}

// =============================================================================
// Get all pending advances (adiantamento_pago) for complement payment
// Used in TransactionDialog when user wants to pay complement + enter volume
// =============================================================================

export async function getPendingAdvancesAll(): Promise<AdvanceListItem[]> {
    return getAdvances({ status: "adiantamento_pago" });
}

// =============================================================================
// Finalize advance with complement: pay complement + enter volume + update stock
// Goes from adiantamento_pago → finalizado in one step
// =============================================================================

export async function finalizeAdvanceWithComplement(params: {
    advanceId: string;
    complementTransactionId: string;
    complementAmount: number;
    complementDate: string;
    volumeMdc: number;
    density: number;
    pricePerTon: number;
}): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    // 1. Get the advance to verify status and get supplier info
    const { data: advance, error: advError } = await (supabase.from("carvao_advances") as any)
        .select("id, status, advance_amount, advance_transaction_id, carvao_supplier_id, supplier_id")
        .eq("id", params.advanceId)
        .single();

    if (advError || !advance) {
        return { success: false, error: "Adiantamento não encontrado" };
    }

    if (advance.status !== "adiantamento_pago") {
        return { success: false, error: "Adiantamento já foi processado" };
    }

    // 2. Calculate weight and total value
    const weightTons = params.volumeMdc * params.density;
    const totalCalculatedValue = weightTons * params.pricePerTon;

    // 3. Update advance record → finalizado
    const { error: updateError } = await (supabase.from("carvao_advances") as any)
        .update({
            complement_transaction_id: params.complementTransactionId,
            complement_amount: params.complementAmount,
            complement_date: params.complementDate,
            total_calculated_value: totalCalculatedValue,
            price_per_ton_used: params.pricePerTon,
            status: "finalizado",
        })
        .eq("id", params.advanceId)
        .eq("status", "adiantamento_pago");

    if (updateError) {
        console.error("Error finalizing advance:", updateError);
        return { success: false, error: updateError.message };
    }

    // 4. Update charcoal stock (only if no movement was already created by linkDischargeToAdvance)
    try {
        // Find charcoal material
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: material } = await (supabase
            .from("materials")
            .select("id, current_stock")
            .or("name.ilike.%carvão%,name.ilike.%carvao%")
            .limit(1)
            .single() as any);

        if (material) {
            // Check if inventory_movement already exists for this advance
            // (may have been created by linkDischargeToAdvance)
            const advanceTxId = advance.advance_transaction_id || params.complementTransactionId;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: existingMov } = await (supabase
                .from("inventory_movements")
                .select("id")
                .eq("material_id", material.id)
                .eq("reference_id", advanceTxId)
                .limit(1) as any);

            // Skip if movement already exists (avoid duplication)
            if (existingMov && existingMov.length > 0) {
                // Movement already created by linkDischargeToAdvance — skip
            } else {
                // Usar volume_mdc como quantidade — unidade do carvão é m³ (MDC)
                const currentStock = Number(material.current_stock) || 0;
                const newStock = currentStock + params.volumeMdc;

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase.from("materials") as any)
                    .update({ current_stock: newStock })
                    .eq("id", material.id);

                // Create inventory movement
                const totalValue = Number(advance.advance_amount) + params.complementAmount;
                const unitPrice = params.volumeMdc > 0 ? totalValue / params.volumeMdc : 0;

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase.from("inventory_movements") as any).insert({
                    material_id: material.id,
                    date: params.complementDate,
                    quantity: params.volumeMdc,
                    unit_price: unitPrice,
                    total_value: totalValue,
                    movement_type: "compra",
                    reference_id: params.complementTransactionId,
                    notes: `Complemento de adiantamento - ${params.volumeMdc.toFixed(1)} MDC (${weightTons.toFixed(2)} t)`,
                });
            }
        }
    } catch (err) {
        console.error("Stock update error during advance finalization:", err);
        // Don't fail the whole operation - advance was already finalized
    }

    revalidatePath("/financeiro");
    revalidatePath("/estoque");
    return { success: true };
}
