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
    material?: {
        name: string;
    } | null;
}

export interface MonthSummary {
    totalEntries: number;
    totalExits: number;
    balance: number;
}

export interface ReportCategory {
    id: string;
    name: string;
    slug: string | null;
    total: number;
    percentage: number;
    transactions: {
        id: string;
        date: string;
        description: string;
        amount: number;
        supplierName?: string;
    }[];
}

export interface ExpenseReport {
    categories: ReportCategory[];
    macroCategories: ReportCategory[];
    totalExpenses: number;
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

    // Fetch Active Materials
    const { data: materials, error: matError } = await supabase
        .from("materials")
        .select("id, name, unit")
        .eq("is_active", true)
        .order("name");

    if (matError) {
        console.error("Error fetching materials for categories:", matError);
    }

    // Group categories by cost center
    const grouped: CategoryGroup[] = (costCenters as { id: string; code: string; name: string; display_order: number }[]).map((cc) => {
        let ccCategories = (categories as { id: string; name: string; cost_center_id: string; requires_weight: boolean | null; material_id: string | null }[])
            .filter((cat) => cat.cost_center_id === cc.id)
            .map((cat) => ({
                id: cat.id,
                name: cat.name,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                slug: (cat as any).slug,
                requiresWeight: cat.requires_weight || false,
                materialId: cat.material_id,
            }));

        // Inject Materials into "OD" (Operacional Direto) group
        // Looking for code "OD" or similar name if code changes
        if (cc.code === "OD" && materials) {
            const materialCategories = materials.map((mat: any) => ({
                id: `mat_${mat.id}`, // Prefix to avoid collision
                name: mat.name,
                slug: `material_${mat.id}`, // Custom slug format
                requiresWeight: true, // Materials usually require weight
                materialId: mat.id,
            }));

            // Create a Set of existing category names for O(1) lookup
            const existingNames = new Set(ccCategories.map(c => c.name.toLowerCase()));

            // Filter out materials that already exist as static categories
            const newMaterialCategories = materialCategories.filter((mat: any) =>
                !existingNames.has(mat.name.toLowerCase())
            );

            // Append unique materials
            ccCategories = [...ccCategories, ...newMaterialCategories];

            // Sort combined list by name
            ccCategories.sort((a, b) => a.name.localeCompare(b.name));
        }

        return {
            id: cc.id,
            code: cc.code,
            name: cc.name,
            categories: ccCategories,
        };
    });

    // Filter out empty groups
    return grouped.filter((g) => g.categories.length > 0);
}

// =============================================================================
// Get Month Summary
// =============================================================================

// =============================================================================
// Get Month Summary
// =============================================================================

export async function getMonthSummary(
    month: number,
    year: number,
    search?: string
): Promise<MonthSummary> {
    const supabase = await createClient();

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(year, month, 0).toISOString().split("T")[0]; // Last day of month

    let query = supabase
        .from("transactions")
        .select("amount, type")
        .gte("date", startDate)
        .lte("date", endDate);

    // Apply search filter if present
    // NOTE: Currently searching only by description.
    // Structure allows robust extension to search by category name or other fields in the future.
    if (search && search.trim() !== "") {
        query = query.ilike("description", `%${search.trim()}%`);
    }

    const { data, error } = await query;

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
// Get Expenses Report (Donut & Drill-down)
// =============================================================================

export async function getExpensesReport(
    month: number,
    year: number
): Promise<ExpenseReport> {
    const supabase = await createClient();

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(year, month, 0).toISOString().split("T")[0];

    // Get all expense transactions for the period
    const { data: transactions, error } = await supabase
        .from("transactions")
        .select(`
            id,
            date,
            amount,
            description,
            category:transaction_categories (
                id,
                name,
                slug,
                costCenter:cost_centers (
                    name
                )
            )
        `)
        .eq("type", "saida")
        .gte("date", startDate)
        .lte("date", endDate);

    if (error || !transactions) {
        console.error("Error fetching expenses report:", error);
        return { categories: [], macroCategories: [], totalExpenses: 0 };
    }

    // Aggregate by category AND macro-category
    const categoryMap = new Map<string, ReportCategory>();
    const macroMap = new Map<string, ReportCategory>();
    let totalExpenses = 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const tx of (transactions as any[])) {
        const amount = Number(tx.amount);
        totalExpenses += amount;

        // 1. Category Aggregation
        const catName = tx.category?.name || "Sem Categoria";
        const catId = tx.category?.id || "uncategorized";
        const catSlug = tx.category?.slug || null;

        if (!categoryMap.has(catId)) {
            categoryMap.set(catId, {
                id: catId,
                name: catName,
                slug: catSlug,
                total: 0,
                percentage: 0,
                transactions: [],
            });
        }

        const catEntry = categoryMap.get(catId)!;
        catEntry.total += amount;
        catEntry.transactions.push({
            id: tx.id,
            date: tx.date,
            description: tx.description || "Sem descrição",
            amount: amount,
        });

        // 2. Macro Aggregation (Cost Center)
        const macroName = tx.category?.costCenter?.name || "Outros";
        // Use name as ID for macro since we group by name
        const macroId = macroName;

        if (!macroMap.has(macroId)) {
            macroMap.set(macroId, {
                id: macroId,
                name: macroName,
                slug: null,
                total: 0,
                percentage: 0,
                transactions: [], // Not needed for macro chart but keeps type consistent
            });
        }
        const macroEntry = macroMap.get(macroId)!;
        macroEntry.total += amount;
    }

    // Helper to process maps into sorted arrays
    const processMap = (map: Map<string, ReportCategory>) => {
        const array = Array.from(map.values()).map(item => ({
            ...item,
            percentage: totalExpenses > 0 ? (item.total / totalExpenses) * 100 : 0
        }));
        // Sort by Total Descending
        return array.sort((a, b) => b.total - a.total);
    };

    const categories = processMap(categoryMap);
    const macroCategories = processMap(macroMap);

    // Sort transactions within category by date desc
    categories.forEach(cat => {
        cat.transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });

    return {
        categories,
        macroCategories,
        totalExpenses
    };
}

// =============================================================================
// Get Transactions (Paginated)
// =============================================================================

export async function getTransactions(
    month: number,
    year: number,
    page: number = 1,
    pageSize: number = 10,
    search?: string
): Promise<PaginatedTransactions> {
    const supabase = await createClient();

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(year, month, 0).toISOString().split("T")[0];

    const offset = (page - 1) * pageSize;

    // Base query reusable for count and data
    // We construct it differently because .select(count) usually wants to be standalone or part of main query
    // But since we are adding dynamic filters, it's safer to build the query chain.

    // NOTE: Currently searching only by description.
    // Structure allows robust extension to search by category name or other fields in the future.
    let query = supabase
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
        `, { count: "exact" })
        .gte("date", startDate)
        .lte("date", endDate);

    if (search && search.trim() !== "") {
        query = query.ilike("description", `%${search.trim()}%`);
    }

    const { data, error, count } = await query
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
    const hasIcmsCredit = formData.get("hasIcmsCredit") === "true";
    const icmsRate = parseFloat(formData.get("icmsRate") as string) || 0;

    if (!type || !amount || !date) {
        return { success: false, error: "Campos obrigatórios não preenchidos" };
    }

    // Handle Virtual Material Categories (dynamic from Inventory)
    let finalCategoryId = categoryId;
    let finalMaterialId = null;

    if (categoryId && categoryId.startsWith("material_")) {
        // It's a virtual category! "material_<uuid>"
        const extractedId = categoryId.replace("material_", "");
        finalMaterialId = extractedId;

        // Try to classify into a real category based on material name
        // default to 'raw_material_general'
        finalCategoryId = 'raw_material_general';

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: mat } = await (supabase
                .from("materials")
                .select("name")
                .eq("id", extractedId)
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("transactions") as any).insert({
        type,
        amount,
        date,
        category_id: finalCategoryId || null,
        status: status || "pago",
        description: description || null,
        material_id: finalMaterialId,
        has_icms_credit: hasIcmsCredit,
        icms_rate: hasIcmsCredit ? icmsRate : 0,
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
    const hasIcmsCredit = formData.get("hasIcmsCredit") === "true";
    const icmsRate = parseFloat(formData.get("icmsRate") as string) || 0;

    if (!id || !type || !amount || !date) {
        return { success: false, error: "Campos obrigatórios não preenchidos" };
    }

    // Handle Virtual Material Categories
    let finalCategoryId = categoryId;
    let finalMaterialId = null;

    if (categoryId && categoryId.startsWith("material_")) {
        const extractedId = categoryId.replace("material_", "");
        finalMaterialId = extractedId;
        finalCategoryId = 'raw_material_general';

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: mat } = await (supabase
                .from("materials")
                .select("name")
                .eq("id", extractedId)
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

    // Prepare update object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
        type,
        amount,
        date,
        category_id: finalCategoryId || null,
        status: status || "pago",
        description: description || null,
        has_icms_credit: hasIcmsCredit,
        icms_rate: hasIcmsCredit ? icmsRate : 0,
    };

    // Only update material_id if it was explicitly a material category selection
    // otherwise we might preserve existing or set to null? 
    // If user changed category to non-material, we should probably set material_id to null.
    // Ideally we'd set it to finalMaterialId (which is null if not material category).
    // But existing logic in other places might set material_id separately?
    // Let's assume if selecting a category, we overwrite material_id.
    updateData.material_id = finalMaterialId;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("transactions") as any)
        .update(updateData)
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
        const { data: tx, error: txError } = await (supabase
            .from("transactions")
            .select("material_id")
            .eq("id", id)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .single() as any);

        if (txError) {
            return { success: false, error: "Transação não encontrada" };
        }

        // 2. If it has a material, reverse the stock
        if (tx?.material_id) {
            let totalToReverse = 0;

            // A. Check inbound_deliveries (Minério/Fundentes via Balança)
            const { data: deliveries } = await (supabase
                .from("inbound_deliveries")
                .select("weight_measured")
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .eq("transaction_id", id) as any);

            if (deliveries && deliveries.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                totalToReverse = deliveries.reduce((sum: number, d: any) => sum + Number(d.weight_measured), 0);
            }

            // B. If no deliveries, check inventory_movements (Carvão direct entry)
            if (totalToReverse === 0) {
                const { data: movements } = await (supabase
                    .from("inventory_movements")
                    .select("quantity")
                    .eq("reference_id", id)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
