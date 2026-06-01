import type { CategoryOption } from "@/app/(authenticated)/financeiro/import-actions";
import type { BestCategoryRow } from "@/lib/financeiro/categorize";

// =============================================================================
// Fetches de dados de importação que recebem o client por parâmetro, para
// funcionar tanto com sessão (dialog) quanto com service role (cron). Sem "use
// server": são helpers chamados server-side.
// =============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Categorias ativas (+ materiais como categorias virtuais), para sugestão/seleção. */
export async function fetchImportCategories(supabase: any): Promise<CategoryOption[]> {
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
    for (const cc of (costCenters || []) as any[]) {
        ccMap.set(cc.id, { code: cc.code, name: cc.name });
    }

    const result: CategoryOption[] = ((categories || []) as any[]).map((cat) => ({
        id: cat.slug || cat.id,
        name: cat.name,
        slug: cat.slug,
        costCenterCode: ccMap.get(cat.cost_center_id)?.code || "",
        costCenterName: ccMap.get(cat.cost_center_id)?.name || "",
        categoryType: cat.category_type || "despesa",
        materialId: cat.material_id,
    }));

    if (materials) {
        const existingNames = new Set(result.map((c) => c.name.toLowerCase()));
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

/** Mapa aprendido fornecedor->categoria (view merchant_best_category). */
export async function fetchBestCategoryRows(supabase: any): Promise<BestCategoryRow[]> {
    const { data } = await supabase
        .from("merchant_best_category")
        .select("merchant_key, best_category_slug, best_votes, total_votes, confidence, is_ambiguous");
    return (data || []) as BestCategoryRow[];
}
