"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { merchantKey } from "@/lib/financeiro/merchant-key";
import { fetchImportCategories, fetchBestCategoryRows } from "@/lib/financeiro/import-data";
import { categorizeTransactions } from "@/lib/financeiro/categorize";

// =============================================================================
// Types
// =============================================================================

export interface ParsedSheetTransaction {
    day: number;         // Day of month (1-31)
    date: string;        // ISO YYYY-MM-DD
    description: string;
    amount: number;      // Always positive
    type: "entrada" | "saida"; // Derived from sign in spreadsheet
    status: string;      // "Pago", "Pendente", etc.
    section: "principal" | "outros" | "carvao"; // Which section of the day
}

export interface CategoryOption {
    id: string;
    name: string;
    slug: string | null;
    costCenterCode: string;
    costCenterName: string;
    categoryType: string;
    materialId: string | null;
}

export interface MatchedSheetTransaction extends ParsedSheetTransaction {
    suggestedCategoryId: string | null;
    suggestedCategoryName: string | null;
    matchConfidence: "high" | "medium" | "low" | "none";
    matchNote: string;
}

export interface SheetImportResult {
    total: number;
    imported: number;
    skipped: number;
    errors: string[];
}

export interface SupplierOption {
    id: string;
    name: string;
    materialId: string;
    defaultPrice: number | null;
    hasIcms: boolean;
    icmsRate: number;
}

// Slugs that identify raw material categories
const RAW_MATERIAL_SLUGS = new Set([
    "raw_material_charcoal",
    "raw_material_ore",
    "raw_material_flux",
    "raw_material_general",
]);

// =============================================================================
// Get all available categories for the dropdown
// =============================================================================

export async function getImportCategories(): Promise<CategoryOption[]> {
    const supabase = await createClient();
    return fetchImportCategories(supabase);
}

// =============================================================================
// Get all active suppliers for the import dropdown
// =============================================================================

export async function getImportSuppliers(): Promise<SupplierOption[]> {
    const supabase = await createClient();

    const { data } = await supabase
        .from("suppliers")
        .select("id, name, material_id, default_price, has_icms, icms_rate")
        .eq("is_active", true)
        .order("name");

    if (!data) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any[]).map((s) => ({
        id: s.id,
        name: s.name,
        materialId: s.material_id,
        defaultPrice: s.default_price !== null ? Number(s.default_price) : null,
        hasIcms: s.has_icms || false,
        icmsRate: Number(s.icms_rate) || 0,
    }));
}

// =============================================================================
// Get carvao suppliers for advance payment dropdown
// =============================================================================

export interface CarvaoSupplierOption {
    id: string;
    name: string;
}

export async function getImportCarvaoSuppliers(): Promise<CarvaoSupplierOption[]> {
    const supabase = await createClient();

    const { data } = await supabase
        .from("carvao_suppliers")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

    if (!data) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any[]).map((s) => ({ id: s.id, name: s.name }));
}

// =============================================================================
// Motor de sugestão — mapa aprendido + keyword fallback.
// A lógica pura vive em "@/lib/financeiro/categorize" (reusada pelo cron).
// =============================================================================

export async function matchTransactionsWithCategories(
    transactions: ParsedSheetTransaction[]
): Promise<MatchedSheetTransaction[]> {
    const supabase = await createClient();
    const categories = await fetchImportCategories(supabase);
    const bestRows = await fetchBestCategoryRows(supabase);
    return categorizeTransactions(transactions, categories, bestRows);
}

// =============================================================================
// Import confirmed transactions into the database
// =============================================================================

interface TransactionToImport {
    date: string;
    description: string;
    amount: number;
    type: "entrada" | "saida";
    status: string;
    categoryId: string | null; // slug or category ID
    // Raw material purchase fields (optional)
    supplierId?: string | null;
    quantity?: number | null;
    hasIcmsCredit?: boolean;
    icmsRate?: number | null;
    // Charcoal advance payment fields
    isAdvance?: boolean;
    carvaoSupplierId?: string | null;
}

export async function importSheetTransactions(
    transactions: TransactionToImport[]
): Promise<SheetImportResult> {
    const supabase = await createClient();

    const result: SheetImportResult = {
        total: transactions.length,
        imported: 0,
        skipped: 0,
        errors: [],
    };

    for (const tx of transactions) {
        try {
            // Resolve category ID (may be a slug or a virtual material category)
            let finalCategoryId = tx.categoryId;
            let finalMaterialId: string | null = null;

            if (tx.categoryId && tx.categoryId.startsWith("material_")) {
                const extractedId = tx.categoryId.replace("material_", "");
                finalMaterialId = extractedId;
                finalCategoryId = "raw_material_general";

                // Try to classify by material name
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
                } catch {
                    // Keep default
                }
            }

            // FALLBACK: If material_id still null but category is a raw material slug,
            // resolve material_id from the transaction_categories table
            if (!finalMaterialId && finalCategoryId && RAW_MATERIAL_SLUGS.has(finalCategoryId)) {
                try {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const { data: catData } = await (supabase
                        .from("transaction_categories")
                        .select("material_id")
                        .eq("slug", finalCategoryId)
                        .not("material_id", "is", null)
                        .limit(1)
                        .single() as any);

                    if (catData?.material_id) {
                        finalMaterialId = catData.material_id;
                        console.log(`[importSheet] Resolved material_id from category slug "${finalCategoryId}":`, finalMaterialId);
                    }
                } catch {
                    console.warn(`[importSheet] Could not resolve material_id from category slug "${finalCategoryId}"`);
                }
            }

            // Map status
            let dbStatus = "pago";
            const statusLower = (tx.status || "").toLowerCase().trim();
            if (statusLower.includes("pend")) dbStatus = "pendente";
            else if (statusLower.includes("parc")) dbStatus = "parcial";
            else if (statusLower.includes("cancel")) dbStatus = "cancelado";

            // Determine transaction classification early (needed by duplicate check)
            const isCharcoal = finalCategoryId === "raw_material_charcoal";
            const isRawMaterial = RAW_MATERIAL_SLUGS.has(finalCategoryId || "") || !!finalMaterialId;
            const isAdvance = tx.isAdvance && isCharcoal;

            // Check for duplicate
            // For raw materials with supplier: require same date + type + amount + description + supplier_id
            // For other transactions: same date + type + amount + description
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let dupQuery = (supabase
                .from("transactions")
                .select("id")
                .eq("date", tx.date)
                .eq("type", tx.type)
                .eq("amount", tx.amount)
                .ilike("description", tx.description)
                .is("ofx_transaction_id", null) as any);

            // For raw materials with a supplier, also match supplier_id to avoid
            // blocking a legitimate purchase from a different supplier on the same day
            if (isRawMaterial && tx.supplierId) {
                dupQuery = dupQuery.eq("supplier_id", tx.supplierId);
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: existing } = await (dupQuery.limit(1) as any);

            if (existing && existing.length > 0) {
                result.skipped++;
                result.errors.push(`"${tx.description}" (${tx.date}): Já existe no sistema`);
                continue;
            }

            // For raw materials: set quantity appropriately
            // Charcoal advance: quantity=null (volume unknown until discharge)
            // Charcoal (non-advance): quantity=value (will update stock immediately)
            // Ore/Flux: quantity=value (will appear in Balança as purchase order)
            const transactionQuantity = isRawMaterial && tx.quantity && !isAdvance
                ? tx.quantity
                : null;

            // Insert
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: insertedTx, error: insertError } = await (supabase.from("transactions") as any).insert({
                date: tx.date,
                amount: tx.amount,
                type: tx.type,
                description: tx.description,
                category_id: finalCategoryId || null,
                status: dbStatus,
                material_id: finalMaterialId,
                supplier_id: tx.supplierId || null,
                quantity: transactionQuantity,
                has_icms_credit: tx.hasIcmsCredit || false,
                icms_rate: tx.hasIcmsCredit ? (tx.icmsRate || null) : null,
                notes: isAdvance
                    ? "Adiantamento Carvão (Importação Planilha)"
                    : "Importação Planilha Google Sheets",
            }).select("id").single();

            if (insertError) {
                result.errors.push(`"${tx.description}": ${insertError.message}`);
                result.skipped++;
                continue;
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const insertedId = (insertedTx as any)?.id;

            // For Charcoal Advance: create advance record (NO stock movement)
            // Atomic: if advance creation fails, rollback the transaction
            if (isAdvance && insertedId) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data: { user } } = await supabase.auth.getUser() as any;

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { error: advError } = await (supabase.from("carvao_advances") as any).insert({
                    advance_transaction_id: insertedId,
                    advance_amount: tx.amount,
                    advance_date: tx.date,
                    supplier_id: tx.supplierId || null,
                    carvao_supplier_id: tx.carvaoSupplierId || null,
                    status: "adiantamento_pago",
                    notes: `Adiantamento importado da planilha: ${tx.description}`,
                    created_by: user?.id || null,
                });

                if (advError) {
                    console.error("Advance creation error, rolling back transaction:", advError);
                    // Rollback: delete the orphan transaction
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (supabase.from("transactions") as any)
                        .delete()
                        .eq("id", insertedId);
                    result.errors.push(
                        `"${tx.description}": Erro ao registrar adiantamento de carvão (transação revertida). ` +
                        `Erro: ${advError.message}`
                    );
                    result.skipped++;
                    continue;
                }
            }
            // For Charcoal (non-advance): immediately update stock
            else if (isCharcoal && !isAdvance && finalMaterialId && tx.quantity && tx.quantity > 0) {
                try {
                    const { data: materialData } = await supabase
                        .from("materials")
                        .select("current_stock")
                        .eq("id", finalMaterialId)
                        .single();

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const currentStock = Number((materialData as any)?.current_stock) || 0;

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (supabase.from("materials") as any)
                        .update({ current_stock: currentStock + tx.quantity })
                        .eq("id", finalMaterialId);

                    const unitPrice = tx.quantity > 0 ? tx.amount / tx.quantity : 0;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (supabase.from("inventory_movements") as any).insert({
                        material_id: finalMaterialId,
                        date: tx.date,
                        quantity: tx.quantity,
                        unit_price: unitPrice,
                        total_value: tx.amount,
                        movement_type: "compra",
                        reference_id: insertedId || null,
                        notes: `Compra Carvão (Importação Planilha)${tx.supplierId ? ` - Fornecedor` : ""}`,
                    });
                } catch (stockErr) {
                    result.errors.push(`"${tx.description}": Transação criada, mas erro ao atualizar estoque de carvão`);
                    console.error("Charcoal stock error:", stockErr);
                }
            }

            // Aprendizado: reforça o voto fornecedor -> categoria escolhida (nunca quebra a importação)
            if (finalCategoryId && tx.description) {
                const mKey = merchantKey(tx.description);
                if (mKey) {
                    try {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        await (supabase.rpc as any)("increment_merchant_vote", {
                            p_merchant_key: mKey,
                            p_category_slug: finalCategoryId,
                        });
                    } catch {
                        // aprendizado é best-effort
                    }
                }
            }

            result.imported++;
        } catch (err) {
            result.errors.push(`"${tx.description}": ${err instanceof Error ? err.message : "Erro desconhecido"}`);
            result.skipped++;
        }
    }

    revalidatePath("/financeiro");
    revalidatePath("/estoque");
    revalidatePath("/balanca");
    return result;
}
