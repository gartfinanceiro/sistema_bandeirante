"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DischargeSchedule } from "@/types/database";

// =============================================================================
// Get Schedule by Date
// =============================================================================

export async function getScheduleByDate(date: string): Promise<DischargeSchedule[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("carvao_discharge_schedule")
        .select(`
            *,
            supplier:supplier_id(name)
        `)
        .eq("scheduled_date", date)
        .order("sequence_order");

    if (error) {
        console.error("Error fetching schedule:", error);
        return [];
    }

    return data as DischargeSchedule[];
}

// =============================================================================
// Get All Suppliers (for select dropdown)
// =============================================================================

export async function getSuppliersForSelect(): Promise<{ id: string; name: string }[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("carvao_suppliers")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

    if (error) {
        console.error("Error fetching suppliers:", error);
        return [];
    }

    return data;
}

// =============================================================================
// Create Schedule
// =============================================================================

export async function createSchedule(formData: FormData): Promise<{
    success: boolean;
    error?: string;
}> {
    const supabase = await createClient();

    const supplier_id = formData.get("supplier_id") as string;
    const scheduled_date = formData.get("scheduled_date") as string;
    const sequence_order = parseInt(formData.get("sequence_order") as string, 10);
    const truck_plate = formData.get("truck_plate") as string;
    const invoice_number = formData.get("invoice_number") as string;
    const gca_number = formData.get("gca_number") as string;
    const estimated_volume_mdc = parseFloat(formData.get("estimated_volume_mdc") as string);
    const notes = formData.get("notes") as string;

    // Validação
    if (!supplier_id || !scheduled_date || !sequence_order || !truck_plate || !invoice_number || !gca_number) {
        return { success: false, error: "Campos obrigatórios estão faltando" };
    }

    if (isNaN(sequence_order) || sequence_order <= 0) {
        return { success: false, error: "Ordem deve ser um número positivo" };
    }

    if (isNaN(estimated_volume_mdc) || estimated_volume_mdc <= 0) {
        return { success: false, error: "Volume estimado deve ser um número positivo" };
    }

    const { error } = await (supabase.from("carvao_discharge_schedule") as any).insert({
        supplier_id,
        scheduled_date,
        sequence_order,
        truck_plate: truck_plate.toUpperCase(),
        invoice_number,
        gca_number,
        estimated_volume_mdc,
        notes: notes || null,
        status: "aguardando",
    } as any);

    if (error) {
        console.error("Error creating schedule:", error);
        if (error.code === "23505") {
            if (error.message.includes("unique_schedule_order")) {
                return { success: false, error: `Já existe uma descarga na ordem ${sequence_order} para esta data` };
            }
            if (error.message.includes("unique_schedule_invoice")) {
                return { success: false, error: `A nota fiscal ${invoice_number} já está agendada para esta data` };
            }
        }
        return { success: false, error: error.message };
    }

    revalidatePath("/carvao/agenda");
    return { success: true };
}

// =============================================================================
// Update Schedule
// =============================================================================

export async function updateSchedule(formData: FormData): Promise<{
    success: boolean;
    error?: string;
}> {
    const supabase = await createClient();

    const id = formData.get("id") as string;
    const supplier_id = formData.get("supplier_id") as string;
    const scheduled_date = formData.get("scheduled_date") as string;
    const sequence_order = parseInt(formData.get("sequence_order") as string, 10);
    const truck_plate = formData.get("truck_plate") as string;
    const invoice_number = formData.get("invoice_number") as string;
    const gca_number = formData.get("gca_number") as string;
    const estimated_volume_mdc = parseFloat(formData.get("estimated_volume_mdc") as string);
    const notes = formData.get("notes") as string;

    // Validação
    if (!id || !supplier_id || !scheduled_date || !sequence_order || !truck_plate || !invoice_number || !gca_number) {
        return { success: false, error: "Campos obrigatórios estão faltando" };
    }

    if (isNaN(sequence_order) || sequence_order <= 0) {
        return { success: false, error: "Ordem deve ser um número positivo" };
    }

    if (isNaN(estimated_volume_mdc) || estimated_volume_mdc <= 0) {
        return { success: false, error: "Volume estimado deve ser um número positivo" };
    }

    const { error } = await (supabase
        .from("carvao_discharge_schedule") as any)
        .update({
            supplier_id,
            scheduled_date,
            sequence_order,
            truck_plate: truck_plate.toUpperCase(),
            invoice_number,
            gca_number,
            estimated_volume_mdc,
            notes: notes || null,
        } as any)
        .eq("id", id);

    if (error) {
        console.error("Error updating schedule:", error);
        if (error.code === "23505") {
            if (error.message.includes("unique_schedule_order")) {
                return { success: false, error: `Já existe uma descarga na ordem ${sequence_order} para esta data` };
            }
            if (error.message.includes("unique_schedule_invoice")) {
                return { success: false, error: `A nota fiscal ${invoice_number} já está agendada para esta data` };
            }
        }
        return { success: false, error: error.message };
    }

    revalidatePath("/carvao/agenda");
    return { success: true };
}

// =============================================================================
// Generate WhatsApp Text
// =============================================================================

export async function generateWhatsAppText(date: string): Promise<string> {
    const schedule = await getScheduleByDate(date);

    if (schedule.length === 0) {
        return "Nenhuma descarga agendada para esta data.";
    }

    const lines = schedule.map((item) => `${item.sequence_order} - ${item.truck_plate}`);

    // Formatar data DD/MM/AAAA
    const [year, month, day] = date.split("-");
    const formattedDate = `${day}/${month}/${year}`;

    return `Boa noite, segue a programação de ${formattedDate}:\n${lines.join("\n")}`;
}
