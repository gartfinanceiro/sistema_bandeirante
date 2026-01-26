"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { type VisualMaterialType } from "./utils";

// =============================================================================
// Types
// =============================================================================

export interface Material {
    id: string;
    name: string;
    unit: string;
    currentStock: number;
    minStockAlert: number | null;
    isActive: boolean;
}

export interface Supplier {
    id: string;
    name: string;
    materialId: string;
    materialName: string; // Joined from materials
    defaultPrice: number | null;
    hasIcms: boolean;
    icmsRate: number;
    isActive: boolean;
}



// =============================================================================
// Materials CRUD
// =============================================================================

export async function getMaterials(activeOnly: boolean = true): Promise<Material[]> {
    const supabase = await createClient();

    let query = supabase
        .from("materials")
        .select("id, name, unit, current_stock, min_stock_alert, is_active")
        .order("name");

    if (activeOnly) {
        query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error || !data) {
        console.error("Error fetching materials:", error);
        return [];
    }

    return (data as unknown[]).map((m: unknown) => {
        const mat = m as {
            id: string;
            name: string;
            unit: string;
            current_stock: number;
            min_stock_alert: number | null;
            is_active: boolean;
        };
        return {
            id: mat.id,
            name: mat.name,
            unit: mat.unit,
            currentStock: Number(mat.current_stock) || 0,
            minStockAlert: mat.min_stock_alert ? Number(mat.min_stock_alert) : null,
            isActive: mat.is_active ?? true,
        };
    });
}

export async function createMaterial(formData: FormData): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const name = formData.get("name") as string;
    const unit = formData.get("unit") as string;

    if (!name || !unit) return { success: false, error: "Nome e unidade obrigatórios" };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("materials") as any).insert({
        name,
        unit,
        current_stock: 0,
        is_active: true
    });

    if (error) return { success: false, error: error.message };
    revalidatePath("/estoque");
    return { success: true };
}

export async function updateMaterial(id: string, formData: FormData): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const name = formData.get("name") as string;
    const unit = formData.get("unit") as string;

    if (!name || !unit) return { success: false, error: "Nome e unidade obrigatórios" };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("materials") as any)
        .update({ name, unit })
        .eq("id", id);

    if (error) return { success: false, error: error.message };
    revalidatePath("/estoque");
    return { success: true };
}

export async function deleteMaterial(id: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    // Check if used in suppliers
    const { count: supplierCount } = await supabase
        .from("suppliers")
        .select("id", { count: "exact", head: true })
        .eq("material_id", id)
        .eq("is_active", true);

    if (supplierCount && supplierCount > 0) {
        return { success: false, error: "Não é possível excluir: existem fornecedores ativos usando este material." };
    }

    // Soft select/delete logic - actually table has is_active now based on my migration plan
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("materials") as any)
        .update({ is_active: false })
        .eq("id", id);

    if (error) return { success: false, error: error.message };
    revalidatePath("/estoque");
    return { success: true };
}

// =============================================================================
// Suppliers CRUD
// =============================================================================

export async function getSuppliers(activeOnly: boolean = false): Promise<Supplier[]> {
    const supabase = await createClient();

    let query = supabase
        .from("suppliers")
        .select(`
      id, name, default_price, has_icms, icms_rate, is_active, material_id,
      materials ( name )
    `)
        .order("name");

    if (activeOnly) {
        query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error || !data) {
        console.error("Error fetching suppliers:", error);
        return [];
    }

    return (data as unknown[]).map((s: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supplier = s as any;
        return {
            id: supplier.id,
            name: supplier.name,
            materialId: supplier.material_id,
            materialName: supplier.materials?.name || "Desconhecido",
            // Convert to null if 0 or null (assuming 0 is not valid price for active supplier usually, but let's be strict if db has null)
            // But db migration dropped default.
            defaultPrice: (supplier.default_price !== null && supplier.default_price !== undefined) ? Number(supplier.default_price) : null,
            hasIcms: supplier.has_icms,
            icmsRate: Number(supplier.icms_rate) || 0,
            isActive: supplier.is_active,
        };
    });
}

export async function createSupplier(formData: FormData): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    const name = formData.get("name") as string;
    const materialId = formData.get("materialId") as string;
    const defaultPriceStr = formData.get("defaultPrice") as string;
    const hasIcms = formData.get("hasIcms") === "true";
    const icmsRateStr = formData.get("icmsRate") as string;

    if (!name || !materialId) {
        return { success: false, error: "Campos obrigatórios: Nome e Material" };
    }

    // Handle empty string as null
    const defaultPrice = defaultPriceStr && defaultPriceStr.trim() !== "" ? parseFloat(defaultPriceStr) : null;
    const icmsRate = hasIcms && icmsRateStr && icmsRateStr.trim() !== "" ? parseFloat(icmsRateStr) : 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("suppliers") as any).insert({
        name,
        material_id: materialId,
        default_price: defaultPrice,
        has_icms: hasIcms,
        icms_rate: icmsRate,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/estoque");
    return { success: true };
}

export async function updateSupplier(supplierId: string, formData: FormData): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    const name = formData.get("name") as string;
    const materialId = formData.get("materialId") as string;
    const defaultPriceStr = formData.get("defaultPrice") as string;
    const hasIcms = formData.get("hasIcms") === "true";
    const icmsRateStr = formData.get("icmsRate") as string;

    if (!name || !materialId) {
        return { success: false, error: "Campos obrigatórios: Nome e Material" };
    }

    const defaultPrice = defaultPriceStr && defaultPriceStr.trim() !== "" ? parseFloat(defaultPriceStr) : null;
    const icmsRate = hasIcms && icmsRateStr && icmsRateStr.trim() !== "" ? parseFloat(icmsRateStr) : 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("suppliers") as any)
        .update({
            name,
            material_id: materialId,
            default_price: defaultPrice,
            has_icms: hasIcms,
            icms_rate: icmsRate,
            updated_at: new Date().toISOString(),
        })
        .eq("id", supplierId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/estoque");
    revalidatePath("/financeiro");
    return { success: true };
}

export async function deleteSupplier(supplierId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("suppliers") as any)
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", supplierId);

    if (error) return { success: false, error: error.message };
    revalidatePath("/estoque");
    return { success: true };
}

// =============================================================================
// Transactions / Stock Entry
// =============================================================================

export async function createPurchaseTransaction(formData: FormData): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    const amount = parseFloat(formData.get("amount") as string);
    const date = formData.get("date") as string;
    const categoryId = formData.get("categoryId") as string; // This is the slug
    const supplierId = formData.get("supplierId") as string;
    const quantity = parseFloat(formData.get("quantity") as string);
    const description = formData.get("description") as string;
    const materialId = formData.get("materialId") as string;

    if (!amount || !date) return { success: false, error: "Campos obrigatórios" };

    // Handle Virtual Material Categories
    let finalCategoryId = categoryId;
    let finalMaterialId = materialId;

    if (categoryId && categoryId.startsWith("material_")) {
        const extractedId = categoryId.replace("material_", "");
        finalMaterialId = extractedId;
        finalCategoryId = 'raw_material_general';

        try {
            const { data: mat } = await (supabase
                .from("materials")
                .select("name")
                .eq("id", extractedId)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .single() as any);

            if (mat) {
                const lower = mat.name.toLowerCase();
                if (lower.includes("carvão") || lower.includes("carvao")) finalCategoryId = "raw_material_charcoal";
                else if (lower.includes("minério") || lower.includes("minerio") || lower.includes("ferro")) finalCategoryId = "raw_material_ore";
                else if (lower.includes("fundente") || lower.includes("cal")) finalCategoryId = "raw_material_flux";
            }
        } catch (err) {
            console.warn("Error classifying material category, using default:", err);
        }
    }

    // Check if this is a Carvão purchase (uses slug)
    const isCharcoal = finalCategoryId === 'raw_material_charcoal';

    // For Carvão: don't set quantity in transaction (won't appear in Balança)
    // For Minério/Fundentes: set quantity (will appear in Balança)
    const transactionQuantity = isCharcoal ? null : (quantity || null);

    // 1. Create Transaction
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: txData, error: txError } = await (supabase.from("transactions") as any)
        .insert({
            type: "saida",
            amount,
            date,
            category_id: finalCategoryId || null,
            status: "pago",
            description: description || `Compra de matéria-prima`,
            material_id: finalMaterialId || null,
            supplier_id: supplierId || null,
            quantity: transactionQuantity, // null for Carvão = won't appear in Balança
        })
        .select("id")
        .single();

    if (txError) return { success: false, error: txError.message };

    // 2. For Carvão: Immediately update stock (no Balança step needed)
    if (isCharcoal && materialId && quantity > 0) {
        try {
            // A. Get current stock
            const { data: materialData } = await supabase
                .from("materials")
                .select("current_stock")
                .eq("id", materialId)
                .single();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const currentStock = Number((materialData as any)?.current_stock) || 0;

            // B. Update material stock
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: stockError } = await (supabase.from("materials") as any)
                .update({ current_stock: currentStock + quantity })
                .eq("id", materialId);

            if (stockError) {
                console.error("Stock update error:", stockError);
                return { success: false, error: "Transação salva, mas erro ao atualizar estoque: " + stockError.message };
            }

            // C. Create inventory movement record
            const unitPrice = quantity > 0 ? amount / quantity : 0;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from("inventory_movements") as any).insert({
                material_id: materialId,
                date,
                quantity,
                unit_price: unitPrice,
                total_value: amount,
                movement_type: "compra",
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                reference_id: (txData as any).id,
                notes: `Compra Carvão${supplierId ? ` - Fornecedor ID: ${supplierId}` : ""}`,
            });

        } catch (err) {
            console.error("Charcoal stock update error:", err);
            return { success: false, error: "Transação salva, mas erro ao atualizar estoque." };
        }
    }

    // For Minério/Fundentes: Stock will be updated at Balança confirmation

    revalidatePath("/financeiro");
    revalidatePath("/estoque");
    revalidatePath("/balanca");
    return { success: true };
}

// Helper to get material by type (LEGACY / Pattern Matching support)
export async function getMaterialByType(visualType: VisualMaterialType): Promise<{ id: string; name: string; unit: string } | null> {
    const supabase = await createClient();
    const patterns: Record<string, string[]> = {
        carvao: ["%carvão%", "%carvao%"],
        minerio: ["%minério%", "%minerio%", "%ferro%"],
        fundentes: ["%fundente%", "%cal%"],
    };
    const list = patterns[visualType] || [];

    for (const pattern of list) {
        const { data } = await supabase.from("materials").select("id, name, unit").ilike("name", pattern).limit(1).single();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (data) return data as any;
    }
    return null;
}
