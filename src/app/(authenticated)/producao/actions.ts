"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// =============================================================================
// Constants
// =============================================================================

// Consumption ratios (technical specs)
const CONSUMPTION_RATIOS = {
    'carvão': 0.85,    // m³ per ton of gusa
    'minério': 1.6,     // tons per ton of gusa
    'fundente': 0.15,   // tons per ton of gusa
};

const ALERT_DAYS_THRESHOLD = 3; // Alert when autonomy < 3 days

// =============================================================================
// Types
// =============================================================================

export interface MaterialConsumption {
    materialId: string;
    materialName: string;
    quantity: number;
    unit: string;
}

export interface MaterialForProduction {
    id: string;
    name: string;
    unit: string;
    currentStock: number;
    consumptionRatio: number;
}

export interface ProductionSummary {
    todayProduction: number;
    coalStock: number;
    coalUnit: string;
    estimatedAutonomy: number; // days
    isLowStock: boolean;
    avgDailyProduction: number;
}

export interface ProductionRow {
    id: string;
    date: string;
    tonsProduced: number;
    technicalNotes: string | null;
    createdAt: string;
}

export interface PaginatedProductions {
    data: ProductionRow[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

// =============================================================================
// Get Production Summary
// =============================================================================

export async function getProductionSummary(): Promise<ProductionSummary> {
    const supabase = await createClient();
    const today = new Date().toISOString().split("T")[0];

    // Get today's production
    const { data: todayData } = await supabase
        .from("production")
        .select("tons_produced")
        .eq("date", today);

    const todayProduction = (todayData as { tons_produced: number }[] | null)
        ?.reduce((sum, p) => sum + Number(p.tons_produced), 0) || 0;

    // Get coal stock (Carvão Vegetal)
    const { data: coalData } = await supabase
        .from("materials")
        .select("current_stock, unit")
        .ilike("name", "%carvão%")
        .limit(1)
        .single();

    const coalStock = Number((coalData as { current_stock: number } | null)?.current_stock) || 0;
    const coalUnit = (coalData as { unit: string } | null)?.unit || "m3";

    // Calculate average daily production (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: avgData } = await supabase
        .from("production")
        .select("tons_produced")
        .gte("date", thirtyDaysAgo.toISOString().split("T")[0]);

    const totalProduction = (avgData as { tons_produced: number }[] | null)
        ?.reduce((sum, p) => sum + Number(p.tons_produced), 0) || 0;

    const daysWithData = (avgData as unknown[] | null)?.length || 1;
    const avgDailyProduction = totalProduction / Math.max(daysWithData, 1);

    // Calculate estimated autonomy
    // Autonomy = Coal Stock / (Avg Daily Production * Consumption Index)
    const dailyCoalConsumption = avgDailyProduction * CONSUMPTION_RATIOS['carvão'];
    const estimatedAutonomy = dailyCoalConsumption > 0
        ? Math.floor(coalStock / dailyCoalConsumption)
        : 0;

    return {
        todayProduction,
        coalStock,
        coalUnit,
        estimatedAutonomy,
        isLowStock: estimatedAutonomy < ALERT_DAYS_THRESHOLD,
        avgDailyProduction,
    };
}

// =============================================================================
// Get Productions (Paginated)
// =============================================================================

export async function getProductions(
    page: number = 1,
    pageSize: number = 10
): Promise<PaginatedProductions> {
    const supabase = await createClient();
    const offset = (page - 1) * pageSize;

    // Get total count
    const { count } = await supabase
        .from("production")
        .select("*", { count: "exact", head: true });

    // Get paginated data
    const { data, error } = await supabase
        .from("production")
        .select("id, date, tons_produced, technical_notes, created_at")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);

    if (error || !data) {
        console.error("Error fetching productions:", error);
        return {
            data: [],
            total: 0,
            page,
            pageSize,
            totalPages: 0,
        };
    }

    const productions = (data as { id: string; date: string; tons_produced: number; technical_notes: string | null; created_at: string }[]).map((p) => ({
        id: p.id,
        date: p.date,
        tonsProduced: p.tons_produced,
        technicalNotes: p.technical_notes,
        createdAt: p.created_at,
    }));

    return {
        data: productions,
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
    };
}

// =============================================================================
// Get Materials for Production Form
// =============================================================================

export async function getMaterialsForProduction(): Promise<MaterialForProduction[]> {
    const supabase = await createClient();

    // Fetch all relevant materials
    const { data } = await supabase
        .from("materials")
        .select("id, name, unit, current_stock")
        .in("name", ["Carvão Vegetal", "Minério de Ferro", "Fundentes"])
        .eq("is_active", true);

    if (!data) return [];

    return (data as { id: string; name: string; unit: string; current_stock: number }[]).map((material) => {
        // Determine consumption ratio based on material name
        let consumptionRatio = 0;
        const nameLower = material.name.toLowerCase();

        if (nameLower.includes("carvão")) {
            consumptionRatio = CONSUMPTION_RATIOS['carvão'];
        } else if (nameLower.includes("minério")) {
            consumptionRatio = CONSUMPTION_RATIOS['minério'];
        } else if (nameLower.includes("fundente")) {
            consumptionRatio = CONSUMPTION_RATIOS['fundente'];
        }

        return {
            id: material.id,
            name: material.name,
            unit: material.unit,
            currentStock: Number(material.current_stock),
            consumptionRatio,
        };
    });
}

// =============================================================================
// Create Production (with multi-material consumption)
// =============================================================================

export async function createProduction(formData: FormData): Promise<{
    success: boolean;
    error?: string;
}> {
    const supabase = await createClient();

    const date = formData.get("date") as string;
    const tonsProduced = parseFloat(formData.get("tonsProduced") as string);
    const technicalNotes = formData.get("technicalNotes") as string;

    if (!date || !tonsProduced || tonsProduced <= 0) {
        return { success: false, error: "Campos obrigatórios não preenchidos" };
    }

    // Parse material consumptions from formData
    // Format: consumption_{materialId} = quantity
    const consumptions: MaterialConsumption[] = [];

    for (const [key, value] of formData.entries()) {
        if (key.startsWith("consumption_") && value) {
            const materialId = key.replace("consumption_", "");
            const quantity = parseFloat(value as string);

            if (quantity > 0) {
                // Fetch material details
                const { data: material } = await supabase
                    .from("materials")
                    .select("name, unit, current_stock")
                    .eq("id", materialId)
                    .single();

                if (material) {
                    const mat = material as { name: string; unit: string; current_stock: number };

                    // Check stock availability
                    if (Number(mat.current_stock) < quantity) {
                        return {
                            success: false,
                            error: `Estoque insuficiente de ${mat.name}. Necessário: ${quantity.toFixed(2)} ${mat.unit}, Disponível: ${Number(mat.current_stock).toFixed(2)} ${mat.unit}`
                        };
                    }

                    consumptions.push({
                        materialId,
                        materialName: mat.name,
                        quantity,
                        unit: mat.unit,
                    });
                }
            }
        }
    }

    // 1. Insert production record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: productionData, error: prodError } = await (supabase.from("production") as any).insert({
        date,
        tons_produced: tonsProduced,
        technical_notes: technicalNotes || null,
    }).select("id").single();

    if (prodError) {
        console.error("Error creating production:", prodError);
        return { success: false, error: prodError.message };
    }

    const productionId = (productionData as { id: string }).id;

    // 2. Process each material consumption
    for (const consumption of consumptions) {
        // Fetch current stock
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: currentMaterial } = await (supabase.from("materials") as any)
            .select("current_stock")
            .eq("id", consumption.materialId)
            .single();

        const currentStock = Number((currentMaterial as { current_stock: number } | null)?.current_stock || 0);

        // Update stock
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: stockError } = await (supabase.from("materials") as any)
            .update({
                current_stock: currentStock - consumption.quantity
            })
            .eq("id", consumption.materialId);

        if (stockError) {
            console.error("Error updating stock:", stockError);
            return { success: false, error: `Erro ao atualizar estoque de ${consumption.materialName}: ` + stockError.message };
        }

        // Register inventory movement
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("inventory_movements") as any).insert({
            material_id: consumption.materialId,
            date,
            quantity: -consumption.quantity, // Negative = consumption
            movement_type: "consumo_producao",
            reference_id: productionId,
            notes: `Consumo real: ${tonsProduced}t gusa → ${consumption.quantity.toFixed(3)} ${consumption.unit} de ${consumption.materialName}`,
        });
    }

    revalidatePath("/producao");
    return { success: true };
}

// =============================================================================
// Delete Production (with stock reversion)
// =============================================================================

export async function deleteProduction(id: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    // 1. Get the production record solely to verify existence
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: production, error: fetchError } = await (supabase.from("production") as any)
        .select("*")
        .eq("id", id)
        .single();

    if (fetchError || !production) {
        return { success: false, error: "Produção não encontrada" };
    }

    // 2. Find ALL associated inventory movements (consumptions)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: movements } = await (supabase.from("inventory_movements") as any)
        .select("id, quantity, material_id")
        .eq("reference_id", id)
        .eq("movement_type", "consumo_producao");

    if (movements && movements.length > 0) {
        // 3. Revert stock for each material
        for (const movement of movements as { id: string; quantity: number; material_id: string }[]) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: material } = await (supabase.from("materials") as any)
                .select("current_stock")
                .eq("id", movement.material_id)
                .single();

            if (material) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase.from("materials") as any)
                    .update({
                        current_stock: Number((material as { current_stock: number }).current_stock) - Number(movement.quantity)
                    })
                    .eq("id", movement.material_id);
            }

            // 4. Delete inventory movement
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from("inventory_movements") as any).delete().eq("id", movement.id);
        }
    }

    // 5. Delete production record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase.from("production") as any).delete().eq("id", id);

    if (deleteError) {
        return { success: false, error: deleteError.message };
    }

    revalidatePath("/producao");
    return { success: true };
}

// =============================================================================
// Update Production (with stock adjustment)
// =============================================================================

export async function updateProduction(id: string, formData: FormData): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    const date = formData.get("date") as string;
    const tonsProduced = parseFloat(formData.get("tonsProduced") as string);
    const technicalNotes = formData.get("technicalNotes") as string;

    if (!date || !tonsProduced || tonsProduced <= 0) {
        return { success: false, error: "Campos obrigatórios não preenchidos" };
    }

    // 1. Revert ALL Old Consumptions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: oldMovements } = await (supabase.from("inventory_movements") as any)
        .select("id, quantity, material_id")
        .eq("reference_id", id)
        .eq("movement_type", "consumo_producao");

    if (oldMovements && oldMovements.length > 0) {
        for (const movement of oldMovements as { id: string; quantity: number; material_id: string }[]) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: mat } = await (supabase.from("materials") as any)
                .select("current_stock")
                .eq("id", movement.material_id)
                .single();

            if (mat) {
                // Revert stock (quantity is negative, so subtract it to add back)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase.from("materials") as any)
                    .update({ current_stock: Number((mat as { current_stock: number }).current_stock) - Number(movement.quantity) })
                    .eq("id", movement.material_id);

                // Delete old movement
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase.from("inventory_movements") as any).delete().eq("id", movement.id);
            }
        }
    }

    // 2. Parse New Consumptions from FormData
    const consumptions: MaterialConsumption[] = [];

    for (const [key, value] of formData.entries()) {
        if (key.startsWith("consumption_") && value) {
            const materialId = key.replace("consumption_", "");
            const quantity = parseFloat(value as string);

            if (quantity > 0) {
                // Fetch material details
                const { data: material } = await supabase
                    .from("materials")
                    .select("name, unit, current_stock")
                    .eq("id", materialId)
                    .single();

                if (material) {
                    const mat = material as { name: string; unit: string; current_stock: number };

                    // Check stock availability (after reversion)
                    if (Number(mat.current_stock) < quantity) {
                        return {
                            success: false,
                            error: `Estoque insuficiente de ${mat.name}. Necessário: ${quantity.toFixed(2)} ${mat.unit}, Disponível: ${Number(mat.current_stock).toFixed(2)} ${mat.unit}`
                        };
                    }

                    consumptions.push({
                        materialId,
                        materialName: mat.name,
                        quantity,
                        unit: mat.unit,
                    });
                }
            }
        }
    }

    // 3. Apply New Consumptions
    for (const consumption of consumptions) {
        // Fetch current stock
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: currentMaterial } = await (supabase.from("materials") as any)
            .select("current_stock")
            .eq("id", consumption.materialId)
            .single();

        const currentStock = Number((currentMaterial as { current_stock: number } | null)?.current_stock || 0);

        // Update stock
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: stockError } = await (supabase.from("materials") as any)
            .update({
                current_stock: currentStock - consumption.quantity
            })
            .eq("id", consumption.materialId);

        if (stockError) {
            console.error("Error updating stock:", stockError);
            return { success: false, error: `Erro ao atualizar estoque de ${consumption.materialName}: ` + stockError.message };
        }

        // Create inventory movement
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("inventory_movements") as any).insert({
            material_id: consumption.materialId,
            date,
            quantity: -consumption.quantity,
            movement_type: "consumo_producao",
            reference_id: id,
            notes: `Consumo real (Editado): ${tonsProduced}t gusa → ${consumption.quantity.toFixed(3)} ${consumption.unit} de ${consumption.materialName}`,
        });
    }

    // 4. Update Production Record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase.from("production") as any)
        .update({
            date,
            tons_produced: tonsProduced,
            technical_notes: technicalNotes || null
        })
        .eq("id", id);

    if (updateError) {
        return { success: false, error: updateError.message };
    }

    revalidatePath("/producao");
    return { success: true };
}
