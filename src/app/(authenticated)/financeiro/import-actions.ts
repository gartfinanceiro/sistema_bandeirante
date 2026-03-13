"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

// =============================================================================
// Get all available categories for the dropdown
// =============================================================================

export async function getImportCategories(): Promise<CategoryOption[]> {
    const supabase = await createClient();

    const { data: categories } = await supabase
        .from("transaction_categories")
        .select("id, name, slug, cost_center_id, category_type, material_id")
        .eq("is_active", true)
        .order("name");

    const { data: costCenters } = await supabase
        .from("cost_centers")
        .select("id, code, name")
        .eq("is_active", true);

    const { data: materials } = await supabase
        .from("materials")
        .select("id, name")
        .eq("is_active", true);

    const ccMap = new Map<string, { code: string; name: string }>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const cc of (costCenters || []) as any[]) {
        ccMap.set(cc.id, { code: cc.code, name: cc.name });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: CategoryOption[] = ((categories || []) as any[]).map((cat) => ({
        id: cat.slug || cat.id,
        name: cat.name,
        slug: cat.slug,
        costCenterCode: ccMap.get(cat.cost_center_id)?.code || "",
        costCenterName: ccMap.get(cat.cost_center_id)?.name || "",
        categoryType: cat.category_type || "despesa",
        materialId: cat.material_id,
    }));

    // Add materials as virtual categories (same as financeiro/actions.ts pattern)
    if (materials) {
        const existingNames = new Set(result.map(c => c.name.toLowerCase()));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const mat of materials as any[]) {
            if (!existingNames.has(mat.name.toLowerCase())) {
                result.push({
                    id: `material_${mat.id}`,
                    name: mat.name,
                    slug: `material_${mat.id}`,
                    costCenterCode: "OD",
                    costCenterName: "Operacional Direto",
                    categoryType: "despesa",
                    materialId: mat.id,
                });
            }
        }
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
}

// =============================================================================
// Category suggestion engine — keyword-based matching
// =============================================================================

interface KeywordRule {
    keywords: string[];
    excludeKeywords?: string[];
    categorySlug: string;
    confidence: "high" | "medium";
}

const KEYWORD_RULES: KeywordRule[] = [
    // ===== Matéria-Prima (OD) =====
    { keywords: ["carvão", "carvao", "moinha"], categorySlug: "raw_material_charcoal", confidence: "high" },
    { keywords: ["minério", "minerio", "ferro", "lhg", "msm mineração", "santo expedito"], excludeKeywords: ["sucata"], categorySlug: "raw_material_ore", confidence: "high" },
    { keywords: ["calcário", "calcario", "fundente", "brita", "cal "], categorySlug: "raw_material_flux", confidence: "high" },
    { keywords: ["bauxita"], categorySlug: "raw_material_flux", confidence: "high" },

    // ===== Operacional (OD/OI) =====
    { keywords: ["frete", "transporte", "carreto"], categorySlug: "freight", confidence: "high" },
    { keywords: ["diesel", "combustível", "combustivel", "gasolina", "posto", "etanol"], categorySlug: "fuel", confidence: "high" },
    { keywords: ["energia", "cemig", "eletricidade", "luz"], categorySlug: "electricity", confidence: "high" },
    { keywords: ["água", "agua", "copasa", "saneamento"], categorySlug: "water", confidence: "high" },
    { keywords: ["oxigênio", "oxigenio", "gás", "gas industrial"], categorySlug: "industrial_gas", confidence: "medium" },
    { keywords: ["refratário", "refratario", "tijolo", "argamassa"], categorySlug: "refractory", confidence: "medium" },
    { keywords: ["eletrodo", "pasta"], categorySlug: "electrode_paste", confidence: "medium" },
    { keywords: ["manutenção", "manutencao", "reparo", "conserto", "peça", "peca", "rolamento", "correia"], categorySlug: "maintenance", confidence: "medium" },
    { keywords: ["sucata"], categorySlug: "scrap_metal", confidence: "high" },

    // ===== RH =====
    { keywords: ["salário", "salario", "folha", "holerite", "adiantamento sal"], categorySlug: "salary", confidence: "high" },
    { keywords: ["inss", "fgts", "gfip"], categorySlug: "labor_charges", confidence: "high" },
    { keywords: ["vale transporte", "vt ", "vale-transporte"], categorySlug: "transport_allowance", confidence: "high" },
    { keywords: ["vale alimentação", "vale alimentacao", "vale-alimentação", "va ", "vale refeição", "vale refeicao"], categorySlug: "meal_allowance", confidence: "high" },
    { keywords: ["plano de saúde", "plano saude", "unimed", "amil"], categorySlug: "health_insurance", confidence: "high" },
    { keywords: ["rescisão", "rescisao", "aviso prévio", "verbas rescisórias"], categorySlug: "termination", confidence: "high" },
    { keywords: ["férias", "ferias"], categorySlug: "vacation_pay", confidence: "high" },
    { keywords: ["13", "décimo terceiro", "decimo terceiro", "13º"], categorySlug: "thirteenth_salary", confidence: "medium" },

    // ===== Administrativo =====
    { keywords: ["aluguel", "locação", "locacao"], categorySlug: "rent", confidence: "high" },
    { keywords: ["telefone", "celular", "internet", "telecom", "vivo", "claro", "tim", "oi "], categorySlug: "telecom", confidence: "high" },
    { keywords: ["contabilidade", "contador", "escritório contábil", "escritorio contabil"], categorySlug: "accounting", confidence: "high" },
    { keywords: ["advocacia", "advogado", "jurídico", "juridico", "honorários advocat"], categorySlug: "legal", confidence: "high" },
    { keywords: ["seguro", "seguradora", "apólice", "apolice"], excludeKeywords: ["saúde", "saude", "plano"], categorySlug: "insurance", confidence: "medium" },
    { keywords: ["material de escritório", "material escritorio", "papelaria", "toner", "impressora"], categorySlug: "office_supplies", confidence: "medium" },
    { keywords: ["alimentação", "alimentacao", "refeição", "refeicao", "marmitex", "restaurante"], excludeKeywords: ["vale"], categorySlug: "meals", confidence: "medium" },

    // ===== Financeiro/Tributário =====
    { keywords: ["imposto", "icms", "pis", "cofins", "ipi", "darf", "dare", "dae"], categorySlug: "taxes", confidence: "high" },
    { keywords: ["taxa", "anuidade", "alvará", "alvara", "licença", "licenca"], categorySlug: "fees_licenses", confidence: "medium" },
    { keywords: ["juros", "multa", "mora", "encargos financ"], categorySlug: "interest_penalties", confidence: "high" },
    { keywords: ["empréstimo", "emprestimo", "financiamento", "parcela financ"], categorySlug: "loan_payment", confidence: "high" },
    { keywords: ["tarifa bancária", "tarifa bancaria", "ted", "doc", "pix taxa", "iof"], categorySlug: "bank_fees", confidence: "medium" },

    // ===== Receita (Entradas) =====
    { keywords: ["venda gusa", "gusa", "ferro gusa", "venda ferro", "receita venda"], categorySlug: "pig_iron_sales", confidence: "high" },
    { keywords: ["venda sucata", "receita sucata"], categorySlug: "scrap_sales", confidence: "high" },
    { keywords: ["receita financeira", "rendimento", "aplicação", "aplicacao"], categorySlug: "financial_income", confidence: "medium" },
];

export async function matchTransactionsWithCategories(
    transactions: ParsedSheetTransaction[]
): Promise<MatchedSheetTransaction[]> {
    const categories = await getImportCategories();

    // Build slug → category lookup
    const slugMap = new Map<string, CategoryOption>();
    for (const cat of categories) {
        if (cat.slug) slugMap.set(cat.slug, cat);
    }

    return transactions.map(tx => {
        const descLower = tx.description.toLowerCase().trim();

        // Try keyword rules
        for (const rule of KEYWORD_RULES) {
            const matches = rule.keywords.some(kw => descLower.includes(kw.toLowerCase()));
            if (!matches) continue;

            // Check excludeKeywords
            if (rule.excludeKeywords && rule.excludeKeywords.some(ek => descLower.includes(ek.toLowerCase()))) {
                continue;
            }

            const cat = slugMap.get(rule.categorySlug);
            if (cat) {
                return {
                    ...tx,
                    suggestedCategoryId: cat.id,
                    suggestedCategoryName: cat.name,
                    matchConfidence: rule.confidence,
                    matchNote: `Auto: "${cat.name}" (${cat.costCenterName})`,
                };
            }
        }

        // Fallback: try fuzzy match against category names
        for (const cat of categories) {
            const catNameLower = cat.name.toLowerCase();
            if (descLower.includes(catNameLower) || catNameLower.includes(descLower)) {
                return {
                    ...tx,
                    suggestedCategoryId: cat.id,
                    suggestedCategoryName: cat.name,
                    matchConfidence: "low" as const,
                    matchNote: `Fuzzy: "${cat.name}"`,
                };
            }
        }

        // No match
        return {
            ...tx,
            suggestedCategoryId: null,
            suggestedCategoryName: null,
            matchConfidence: "none" as const,
            matchNote: "Categoria não identificada",
        };
    });
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

            // Map status
            let dbStatus = "pago";
            const statusLower = (tx.status || "").toLowerCase().trim();
            if (statusLower.includes("pend")) dbStatus = "pendente";
            else if (statusLower.includes("parc")) dbStatus = "parcial";
            else if (statusLower.includes("cancel")) dbStatus = "cancelado";

            // Check for duplicate (same date + description + amount + type)
            const { data: existing } = await (supabase
                .from("transactions")
                .select("id")
                .eq("date", tx.date)
                .eq("type", tx.type)
                .eq("amount", tx.amount)
                .ilike("description", tx.description)
                .is("ofx_transaction_id", null) // Only check manually entered / sheet-imported
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .limit(1) as any);

            if (existing && existing.length > 0) {
                result.skipped++;
                result.errors.push(`"${tx.description}" (${tx.date}): Já existe no sistema`);
                continue;
            }

            // Insert
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: insertError } = await (supabase.from("transactions") as any).insert({
                date: tx.date,
                amount: tx.amount,
                type: tx.type,
                description: tx.description,
                category_id: finalCategoryId || null,
                status: dbStatus,
                material_id: finalMaterialId,
                notes: "Importação Planilha Google Sheets",
            });

            if (insertError) {
                result.errors.push(`"${tx.description}": ${insertError.message}`);
                result.skipped++;
                continue;
            }

            result.imported++;
        } catch (err) {
            result.errors.push(`"${tx.description}": ${err instanceof Error ? err.message : "Erro desconhecido"}`);
            result.skipped++;
        }
    }

    revalidatePath("/financeiro");
    return result;
}
