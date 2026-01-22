"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TransactionType, PaymentStatus } from "@/types/database";

// =============================================================================
// Types
// =============================================================================

export interface CategoryGroup {
    id: string;
    code: string;
    name: string;
    categories: {
        id: string;
        name: string;
        slug: string | null;
        requiresWeight: boolean;
        materialId: string | null;
    }[];
}

export interface TransactionRow {
    id: string;
    date: string;
    amount: number;
    type: TransactionType;
    description: string | null;
    status: PaymentStatus | null;
    category: {
        id: string;
        name: string;
        slug: string;
        costCenter: {
            code: string;
            name: string;
        };
    } | null;
}

export interface MonthSummary {
    totalEntries: number;
    totalExits: number;
    balance: number;
}

export interface PaginatedTransactions {
    data: TransactionRow[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

// =============================================================================
// Get Categories (Grouped by Cost Center)
// =============================================================================

export async function getCategories(): Promise<CategoryGroup[]> {
    const supabase = await createClient();

    // DEBUG: Check Auth
    const { data: { user } } = await supabase.auth.getUser();
    console.log("[getCategories] User:", user?.id || "ANON/NO SESSION");

    const { data: costCenters, error: ccError } = await supabase
        .from("cost_centers")
        .select("id, code, name, display_order")
        .eq("is_active", true)
        .order("display_order");

    if (ccError || !costCenters) {
        console.error("Error fetching cost centers:", ccError);
        return [];
    }

    const { data: categories, error: catError } = await supabase
        .from("transaction_categories")
        .select("id, name, slug, cost_center_id, requires_weight, material_id, display_order")
        .eq("is_active", true)
        .order("display_order");

    if (catError || !categories) {
        console.error("Error fetching categories:", catError);
        return [];
    }

    // Group categories by cost center
    const grouped: CategoryGroup[] = (costCenters as { id: string; code: string; name: string; display_order: number }[]).map((cc) => ({
        id: cc.id,
        code: cc.code,
        name: cc.name,
        categories: (categories as { id: string; name: string; cost_center_id: string; requires_weight: boolean | null; material_id: string | null }[])
            .filter((cat) => cat.cost_center_id === cc.id)
            .map((cat) => ({
                id: cat.id,
                name: cat.name,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                slug: (cat as any).slug,
                requiresWeight: cat.requires_weight || false,
                materialId: cat.material_id,
            })),
    }));

    // Filter out empty groups
    return grouped.filter((g) => g.categories.length > 0);
}

// =============================================================================
// Get Month Summary
// =============================================================================

export async function getMonthSummary(
    month: number,
    year: number
): Promise<MonthSummary> {
    const supabase = await createClient();

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(year, month, 0).toISOString().split("T")[0]; // Last day of month

    const { data, error } = await supabase
        .from("transactions")
        .select("amount, type")
        .gte("date", startDate)
        .lte("date", endDate);

    if (error || !data) {
        console.error("Error fetching summary:", error);
        return { totalEntries: 0, totalExits: 0, balance: 0 };
    }

    const txData = data as { amount: number; type: string }[];

    const totalEntries = txData
        .filter((t) => t.type === "entrada")
        .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalExits = txData
        .filter((t) => t.type === "saida")
        .reduce((sum, t) => sum + Number(t.amount), 0);

    return {
        totalEntries,
        totalExits,
        balance: totalEntries - totalExits,
    };
}

// =============================================================================
// Get Transactions (Paginated)
// =============================================================================

export async function getTransactions(
    month: number,
    year: number,
    page: number = 1,
    pageSize: number = 10
): Promise<PaginatedTransactions> {
    const supabase = await createClient();

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(year, month, 0).toISOString().split("T")[0];

    const offset = (page - 1) * pageSize;

    // Get total count
    const { count } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .gte("date", startDate)
        .lte("date", endDate);

    // Get paginated data
    const { data, error } = await supabase
        .from("transactions")
        .select(`
      id,
      date,
      amount,
      type,
      description,
      status,
      category:transaction_categories(
        id,
        name,
        slug,
        costCenter:cost_centers(
          code,
          name
        )
      )
    `)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);

    if (error) {
        console.error("Error fetching transactions:", error);
        return {
            data: [],
            total: 0,
            page,
            pageSize,
            totalPages: 0,
        };
    }

    return {
        data: data as unknown as TransactionRow[],
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
    };
}

// =============================================================================
// Create Transaction
// =============================================================================

export async function createTransaction(formData: FormData): Promise<{
    success: boolean;
    error?: string;
}> {
    const supabase = await createClient();

    const type = formData.get("type") as TransactionType;
    const amount = parseFloat(formData.get("amount") as string);
    const date = formData.get("date") as string;
    const categoryId = formData.get("categoryId") as string;
    const status = formData.get("status") as PaymentStatus;
    const description = formData.get("description") as string;

    if (!type || !amount || !date) {
        return { success: false, error: "Campos obrigatórios não preenchidos" };
    }

    // Category is now stored as slug directly (TEXT)
    const finalCategoryId = categoryId;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("transactions") as any).insert({
        type,
        amount,
        date,
        category_id: finalCategoryId || null,
        status: status || "pago",
        description: description || null,
    });

    if (error) {
        console.error("Error creating transaction:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/financeiro");
    return { success: true };
}

// =============================================================================
// Update Transaction
// =============================================================================

export async function updateTransaction(formData: FormData): Promise<{
    success: boolean;
    error?: string;
}> {
    const supabase = await createClient();

    const id = formData.get("id") as string;
    const type = formData.get("type") as TransactionType;
    const amount = parseFloat(formData.get("amount") as string);
    const date = formData.get("date") as string;
    const categoryId = formData.get("categoryId") as string;
    const status = formData.get("status") as PaymentStatus;
    const description = formData.get("description") as string;

    if (!id || !type || !amount || !date) {
        return { success: false, error: "Campos obrigatórios não preenchidos" };
    }

    // Category is stored as slug directly (TEXT)
    const finalCategoryId = categoryId;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("transactions") as any)
        .update({
            type,
            amount,
            date,
            category_id: finalCategoryId || null,
            status: status || "pago",
            description: description || null,
        })
        .eq("id", id);

    if (error) {
        console.error("Error updating transaction:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/financeiro");
    return { success: true };
}

// =============================================================================
// Delete Transaction
// =============================================================================

export async function deleteTransaction(id: string): Promise<{
    success: boolean;
    error?: string;
}> {
    const supabase = await createClient();

    try {
        // 1. Get transaction details before deletion
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: tx, error: txError } = await (supabase
            .from("transactions")
            .select("material_id")
            .eq("id", id)
            .single() as any);

        if (txError) {
            return { success: false, error: "Transação não encontrada" };
        }

        // 2. If it has a material, reverse the stock
        if (tx?.material_id) {
            let totalToReverse = 0;

            // A. Check inbound_deliveries (Minério/Fundentes via Balança)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: deliveries } = await (supabase
                .from("inbound_deliveries")
                .select("weight_measured")
                .eq("transaction_id", id) as any);

            if (deliveries && deliveries.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                totalToReverse = deliveries.reduce((sum: number, d: any) => sum + Number(d.weight_measured), 0);
            }

            // B. If no deliveries, check inventory_movements (Carvão direct entry)
            if (totalToReverse === 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data: movements } = await (supabase
                    .from("inventory_movements")
                    .select("quantity")
                    .eq("reference_id", id)
                    .eq("movement_type", "compra") as any);

                if (movements && movements.length > 0) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    totalToReverse = movements.reduce((sum: number, m: any) => sum + Number(m.quantity), 0);
                }
            }

            // C. Subtract from material stock
            if (totalToReverse > 0) {
                const { data: mat } = await supabase
                    .from("materials")
                    .select("current_stock")
                    .eq("id", tx.material_id)
                    .single();

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const currentStock = Number((mat as any)?.current_stock) || 0;
                const newStock = Math.max(0, currentStock - totalToReverse);

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase.from("materials") as any)
                    .update({ current_stock: newStock })
                    .eq("id", tx.material_id);
            }

            // D. Delete inventory movements
            await supabase.from("inventory_movements").delete().eq("reference_id", id);
        }

        // 3. Delete the transaction (CASCADE will handle inbound_deliveries)
        const { error } = await supabase
            .from("transactions")
            .delete()
            .eq("id", id);

        if (error) {
            console.error("Error deleting transaction:", error);
            return { success: false, error: error.message };
        }

        revalidatePath("/financeiro");
        revalidatePath("/estoque");
        revalidatePath("/balanca");
        return { success: true };

    } catch (err) {
        console.error("Delete transaction error:", err);
        return { success: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
    }
}
