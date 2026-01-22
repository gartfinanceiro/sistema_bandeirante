"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// =============================================================================
// Types
// =============================================================================

export interface CostCenter {
    id: string;
    code: string;
    name: string;
}

export interface Category {
    id: string;
    name: string;
    slug: string | null;
    costCenterId: string;
    costCenterCode: string;
    costCenterName: string;
    isSystem: boolean;
    categoryType: string;
    requiresWeight: boolean;
    materialId: string | null;
}

// =============================================================================
// Get Cost Centers (for dropdown in category form)
// =============================================================================

export async function getCostCenters(): Promise<CostCenter[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("cost_centers")
        .select("id, code, name")
        .eq("is_active", true)
        .order("display_order");

    if (error) {
        console.error("Error fetching cost centers:", error);
        return [];
    }

    return data as CostCenter[];
}

// =============================================================================
// Get All Categories (for management UI)
// =============================================================================

export async function getAllCategories(): Promise<Category[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("transaction_categories")
        .select(`
            id,
            name,
            slug,
            cost_center_id,
            is_system,
            category_type,
            requires_weight,
            material_id,
            display_order,
            cost_centers (
                code,
                name
            )
        `)
        .eq("is_active", true)
        .order("display_order");

    if (error) {
        console.error("Error fetching categories:", error);
        return [];
    }

    // Transform to flat structure
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((data as any[]) || []).map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        costCenterId: cat.cost_center_id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        costCenterCode: (cat.cost_centers as any)?.code || "",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        costCenterName: (cat.cost_centers as any)?.name || "",
        isSystem: cat.is_system || false,
        categoryType: cat.category_type || "despesa",
        requiresWeight: cat.requires_weight || false,
        materialId: cat.material_id,
    }));
}

// =============================================================================
// Create Category
// =============================================================================

export async function createCategory(formData: FormData): Promise<{
    success: boolean;
    error?: string;
}> {
    const supabase = await createClient();

    const name = formData.get("name") as string;
    const costCenterId = formData.get("costCenterId") as string;
    const categoryType = formData.get("categoryType") as string || "despesa";

    if (!name || !costCenterId) {
        return { success: false, error: "Nome e Centro de Custo são obrigatórios" };
    }

    // Generate slug from name (lowercase, underscores, no accents)
    const slug = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^a-z0-9]+/g, "_")     // Replace non-alphanumeric with underscore
        .replace(/^_+|_+$/g, "");        // Trim underscores

    // Get max display_order for this cost center
    const { data: maxOrder } = await supabase
        .from("transaction_categories")
        .select("display_order")
        .eq("cost_center_id", costCenterId)
        .order("display_order", { ascending: false })
        .limit(1)
        .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const displayOrder = ((maxOrder as any)?.display_order || 0) + 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("transaction_categories") as any)
        .insert({
            name,
            slug,
            cost_center_id: costCenterId,
            category_type: categoryType,
            is_system: false,
            is_active: true,
            display_order: displayOrder,
        });

    if (error) {
        console.error("Error creating category:", error);
        // Handle unique constraint violation
        if (error.code === "23505") {
            return { success: false, error: "Categoria com este nome já existe neste centro de custo" };
        }
        return { success: false, error: error.message };
    }

    revalidatePath("/financeiro");
    return { success: true };
}

// =============================================================================
// Update Category
// =============================================================================

export async function updateCategory(formData: FormData): Promise<{
    success: boolean;
    error?: string;
}> {
    const supabase = await createClient();

    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const costCenterId = formData.get("costCenterId") as string;
    const categoryType = formData.get("categoryType") as string;

    if (!id || !name || !costCenterId) {
        return { success: false, error: "Campos obrigatórios não preenchidos" };
    }

    // Check if it's a system category
    const { data: existing } = await supabase
        .from("transaction_categories")
        .select("is_system, slug")
        .eq("id", id)
        .single();

    // For system categories, preserve the slug (critical for stock logic)
    const updateData: Record<string, unknown> = {
        name,
        cost_center_id: costCenterId,
        category_type: categoryType,
    };

    // Only update slug for non-system categories
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(existing as any)?.is_system) {
        updateData.slug = name
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("transaction_categories") as any)
        .update(updateData)
        .eq("id", id);

    if (error) {
        console.error("Error updating category:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/financeiro");
    return { success: true };
}

// =============================================================================
// Delete Category
// =============================================================================

export async function deleteCategory(id: string): Promise<{
    success: boolean;
    error?: string;
}> {
    const supabase = await createClient();

    const { data: category, error: checkError } = await supabase
        .from("transaction_categories")
        .select("is_system, name, slug")
        .eq("id", id)
        .single();

    if (checkError) {
        return { success: false, error: "Categoria não encontrada" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((category as any)?.is_system) {
        return {
            success: false,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            error: `"${(category as any).name}" é uma categoria do sistema e não pode ser excluída`
        };
    }

    const { count } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .eq("category_id", (category as any)?.slug); // Note: category_id stores slug now

    if (count && count > 0) {
        return {
            success: false,
            error: `Esta categoria está sendo usada por ${count} transação(ões) e não pode ser excluída`
        };
    }

    // Soft delete (mark as inactive)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("transaction_categories") as any)
        .update({ is_active: false })
        .eq("id", id);

    if (error) {
        console.error("Error deleting category:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/financeiro");
    return { success: true };
}
