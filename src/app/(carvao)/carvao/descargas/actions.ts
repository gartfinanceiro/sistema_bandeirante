"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DischargeSchedule } from "@/types/database";

// =============================================================================
// Get Schedules Ready for Discharge
// =============================================================================

export async function getSchedulesForDischarge(date: string): Promise<DischargeSchedule[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("carvao_discharge_schedule")
        .select(`
            *,
            supplier:supplier_id(name)
        `)
        .eq("scheduled_date", date)
        .in("status", ["aguardando", "confirmada"])
        .order("sequence_order");

    if (error) {
        console.error("Error fetching schedules for discharge:", error);
        return [];
    }

    return data as DischargeSchedule[];
}

// =============================================================================
// Create Discharge (with Transaction)
// =============================================================================

export async function createDischarge(formData: FormData): Promise<{
    success: boolean;
    error?: string;
}> {
    const supabase = await createClient();

    // Extrair dados do FormData
    const schedule_id = formData.get("schedule_id") as string;
    const supplier_id = formData.get("supplier_id") as string;
    const discharge_date = formData.get("discharge_date") as string;
    const truck_plate = formData.get("truck_plate") as string;
    const invoice_number = formData.get("invoice_number") as string;
    const gca_number = formData.get("gca_number") as string;
    const volume_mdc = parseFloat(formData.get("volume_mdc") as string);
    const density = parseFloat(formData.get("density") as string);
    const observations = formData.get("observations") as string;

    // Validação
    if (!schedule_id || !supplier_id || !discharge_date || !truck_plate || !invoice_number || !gca_number) {
        return { success: false, error: "Campos obrigatórios estão faltando" };
    }

    if (isNaN(volume_mdc) || volume_mdc <= 0) {
        return { success: false, error: "Volume deve ser um número positivo" };
    }

    if (isNaN(density) || density <= 0) {
        return { success: false, error: "Densidade deve ser um número positivo" };
    }

    try {
        // Passo 1: Criar registro de descarga
        const { data: discharge, error: dischargeError } = await (supabase
            .from("carvao_discharges") as any)
            .insert({
                schedule_id,
                supplier_id,
                discharge_date,
                truck_plate: truck_plate.toUpperCase(),
                invoice_number,
                gca_number,
                volume_mdc,
                density,
                observations: observations || null,
                is_confirmed: false,
            })
            .select()
            .single();

        if (dischargeError) {
            console.error("Error creating discharge:", dischargeError);
            if (dischargeError.code === "23505") {
                return {
                    success: false,
                    error: "Esta carga (NF + GCA) já foi registrada anteriormente",
                };
            }
            return { success: false, error: dischargeError.message };
        }

        // Passo 2: Atualizar agenda para status "descarregada"
        const { error: scheduleError } = await (supabase
            .from("carvao_discharge_schedule") as any)
            .update({ status: "descarregada" })
            .eq("id", schedule_id);

        if (scheduleError) {
            console.error("Error updating schedule status:", scheduleError);

            // Rollback: deletar descarga criada
            await (supabase.from("carvao_discharges") as any).delete().eq("id", discharge.id);

            return {
                success: false,
                error: "Erro ao atualizar status da agenda. Operação cancelada.",
            };
        }

        revalidatePath("/carvao/descargas");
        revalidatePath("/carvao/agenda");
        return { success: true };
    } catch (error) {
        console.error("Unexpected error in createDischarge:", error);
        return {
            success: false,
            error: "Erro inesperado ao registrar descarga. Tente novamente.",
        };
    }
}
