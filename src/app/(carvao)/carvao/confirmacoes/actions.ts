"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Discharge } from "@/types/database";

// =============================================================================
// Get Pending Discharges (is_confirmed = false)
// =============================================================================

export async function getPendingDischarges(): Promise<Discharge[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("carvao_discharges")
        .select(`
            *,
            supplier:supplier_id(name)
        `)
        .eq("is_confirmed", false)
        .order("discharge_date", { ascending: true });

    if (error) {
        console.error("Error fetching pending discharges:", error);
        return [];
    }

    return data as Discharge[];
}

// =============================================================================
// Confirm Discharge (Admin Only) - Now accepts FormData with operational fields
// =============================================================================

export async function confirmDischarge(formData: FormData): Promise<{
    success: boolean;
    error?: string;
}> {
    const supabase = await createClient();

    // Extract form data
    const dischargeId = formData.get("id") as string;
    const confirmationNotes = formData.get("confirmation_notes") as string;

    // Operational fields - Grupo 1: Qualidade e Medições
    const impurity_percent = formData.get("impurity_percent") as string;
    const humidity_percent = formData.get("humidity_percent") as string;
    const discount_mdc = formData.get("discount_mdc") as string;
    const discount_kg = formData.get("discount_kg") as string;

    // Operational fields - Grupo 2: Classificação
    const cargo_type = formData.get("cargo_type") as string;

    // Operational fields - Grupo 3: Valores de Referência
    const price_per_ton = formData.get("price_per_ton") as string;
    const gross_value = formData.get("gross_value") as string;
    const funrural_value = formData.get("funrural_value") as string;
    const net_value = formData.get("net_value") as string;
    const payment_date = formData.get("payment_date") as string;

    // Operational fields - Grupo 4: Identificação
    const meter_operator = formData.get("meter_operator") as string;
    const agent_name = formData.get("agent_name") as string;

    // Validação
    if (!dischargeId) {
        return { success: false, error: "ID da descarga é obrigatório" };
    }

    // Obter ID do usuário atual
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "Usuário não autenticado" };
    }

    // Construir objeto de atualização
    const updateData: any = {
        is_confirmed: true,
        confirmed_at: new Date().toISOString(),
        confirmed_by: user.id,

        // Operational fields (convert to proper types, null if empty)
        impurity_percent: impurity_percent ? parseFloat(impurity_percent) : null,
        humidity_percent: humidity_percent ? parseFloat(humidity_percent) : null,
        discount_mdc: discount_mdc ? parseFloat(discount_mdc) : null,
        discount_kg: discount_kg ? parseFloat(discount_kg) : null,
        cargo_type: cargo_type || null,
        price_per_ton: price_per_ton ? parseFloat(price_per_ton) : null,
        gross_value: gross_value ? parseFloat(gross_value) : null,
        funrural_value: funrural_value ? parseFloat(funrural_value) : null,
        net_value: net_value ? parseFloat(net_value) : null,
        payment_date: payment_date || null,
        meter_operator: meter_operator || null,
        agent_name: agent_name || null,
    };

    // Adicionar observações de confirmação se fornecidas
    if (confirmationNotes) {
        // Append to existing observations
        const { data: discharge } = await supabase
            .from("carvao_discharges")
            .select("observations")
            .eq("id", dischargeId)
            .single();

        if (discharge) {
            const existingObs = (discharge as any).observations || "";
            const separator = existingObs ? "\n\n---\n" : "";
            updateData.observations = `${existingObs}${separator}[CONFIRMAÇÃO] ${confirmationNotes}`;
        }
    }

    // Buscar dados da descarga antes de confirmar (para o inventory_movement)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: dischargeData } = await (supabase
        .from("carvao_discharges")
        .select("weight_tons, volume_mdc, density, discharge_date, supplier_id")
        .eq("id", dischargeId)
        .single() as any);

    const { error } = await (supabase
        .from("carvao_discharges") as any)
        .update(updateData)
        .eq("id", dischargeId)
        .eq("is_confirmed", false); // Extra safety: only update if not already confirmed

    if (error) {
        console.error("Error confirming discharge:", error);

        // Check if it's a permission error (RLS)
        if (error.code === "42501" || error.message?.includes("permission")) {
            return {
                success: false,
                error: "Você não tem permissão para confirmar descargas.",
            };
        }

        return { success: false, error: error.message };
    }

    // =========================================================================
    // Atualizar estoque de carvão: criar inventory_movement na confirmação
    // =========================================================================
    if (dischargeData) {
        const weightTons = Number(dischargeData.weight_tons) || 0;
        const volumeMdc = Number(dischargeData.volume_mdc) || 0;
        const densityVal = Number(dischargeData.density) || 0;
        const dischargeDate = dischargeData.discharge_date;
        const pricePerTonVal = price_per_ton ? parseFloat(price_per_ton) : 0;
        const netVal = net_value ? parseFloat(net_value) : 0;

        // Usar volume_mdc como quantidade — unidade do material carvão é m³ (MDC)
        if (volumeMdc > 0) {
            try {
                // Verificar se já existe inventory_movement para esta descarga
                // (pode ter sido criado por linkDischargeToAdvance ou importação)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data: existingMov } = await (supabase
                    .from("inventory_movements")
                    .select("id")
                    .eq("reference_id", dischargeId)
                    .limit(1) as any);

                if (!existingMov || existingMov.length === 0) {
                    // Buscar material carvão
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

                        const totalValue = netVal || (weightTons * pricePerTonVal);
                        const unitPrice = volumeMdc > 0 ? totalValue / volumeMdc : 0;

                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        await (supabase.from("inventory_movements") as any).insert({
                            material_id: material.id,
                            date: dischargeDate,
                            quantity: volumeMdc,
                            unit_price: unitPrice,
                            total_value: totalValue,
                            movement_type: "compra",
                            reference_id: dischargeId,
                            notes: `Descarga carvão confirmada - ${volumeMdc.toFixed(1)} MDC (${weightTons.toFixed(2)} t)`,
                        });
                    }
                }
            } catch (stockErr) {
                console.error("Erro ao atualizar estoque na confirmação:", stockErr);
                // Não falhar a confirmação — o estoque pode ser recalculado depois
            }
        }
    }

    revalidatePath("/carvao/confirmacoes");
    revalidatePath("/carvao/descargas");
    revalidatePath("/estoque");
    return { success: true };
}

