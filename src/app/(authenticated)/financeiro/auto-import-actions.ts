"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
    sheetTabForMonth,
    fetchSheetCSV,
    parseCSV,
    parseSpreadsheetData,
} from "@/lib/financeiro/sheet-parser";
import { fetchImportCategories, fetchBestCategoryRows } from "@/lib/financeiro/import-data";
import { categorizeTransactions } from "@/lib/financeiro/categorize";
import { merchantKey } from "@/lib/financeiro/merchant-key";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface AutoImportResult {
    month: number;
    year: number;
    parsed: number;
    imported: number;
    needsReview: number;
    skipped: number;
    errors: string[];
}

/** Data corrente no fuso America/São_Paulo. */
function nowInSaoPaulo(): { month: number; year: number } {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
    }).formatToParts(new Date());
    const year = Number(parts.find((p) => p.type === "year")?.value);
    const month = Number(parts.find((p) => p.type === "month")?.value);
    return { month, year };
}

function mapStatus(raw: string): string {
    const s = (raw || "").toLowerCase().trim();
    if (s.includes("pend")) return "pendente";
    if (s.includes("parc")) return "parcial";
    if (s.includes("cancel")) return "cancelado";
    return "pago";
}

/**
 * Importação automática do mês corrente (chamada pelo cron). Puramente financeira:
 * insere data/valor/tipo/categoria/status, SEM efeitos de estoque/adiantamento.
 * Confiantes entram prontos e ALIMENTAM o aprendizado; incertos entram marcados
 * needs_review (badge) sem aprender. Idempotente (dedup por data+tipo+valor+descrição).
 */
export async function autoImportCurrentMonth(): Promise<AutoImportResult> {
    const { month, year } = nowInSaoPaulo();
    const result: AutoImportResult = {
        month, year, parsed: 0, imported: 0, needsReview: 0, skipped: 0, errors: [],
    };

    const tab = sheetTabForMonth(month);
    if (!tab) {
        result.errors.push(`Sem aba de planilha para o mês ${month}`);
        return result;
    }

    let parsed;
    try {
        const csv = await fetchSheetCSV(tab);
        const data = parseCSV(csv);
        parsed = parseSpreadsheetData(data, month, year, []); // todos os dias do mês
    } catch (e) {
        result.errors.push(`Falha ao buscar/parsear planilha: ${e instanceof Error ? e.message : "erro"}`);
        return result;
    }
    result.parsed = parsed.length;
    if (parsed.length === 0) return result;

    const supabase = createAdminClient();
    const categories = await fetchImportCategories(supabase);
    const bestRows = await fetchBestCategoryRows(supabase);
    const matched = categorizeTransactions(parsed, categories, bestRows);

    for (const tx of matched) {
        try {
            const isHigh = tx.matchConfidence === "high";
            const needsReview = !isHigh; // medium/low/none -> revisar
            let categoryId = tx.suggestedCategoryId || "a_classificar";
            // Import puramente financeira: não lidamos com materiais virtuais aqui.
            if (categoryId.startsWith("material_")) categoryId = "raw_material_general";

            // Dedup idempotente
            const { data: existing } = await supabase
                .from("transactions")
                .select("id")
                .eq("date", tx.date)
                .eq("type", tx.type)
                .eq("amount", tx.amount)
                .ilike("description", tx.description)
                .limit(1);
            if (existing && existing.length > 0) {
                result.skipped++;
                continue;
            }

            const { error } = await (supabase.from("transactions") as any).insert({
                date: tx.date,
                amount: tx.amount,
                type: tx.type,
                description: tx.description,
                category_id: categoryId,
                status: mapStatus(tx.status),
                needs_review: needsReview,
                notes: "Importação automática (planilha)",
            });
            if (error) {
                result.errors.push(`"${tx.description}": ${error.message}`);
                result.skipped++;
                continue;
            }

            result.imported++;
            if (needsReview) result.needsReview++;

            // Aprende SÓ os confiantes (não polui o mapa com palpite não revisado)
            if (isHigh && tx.suggestedCategoryId) {
                const mk = merchantKey(tx.description);
                if (mk) {
                    try {
                        await (supabase.rpc as any)("increment_merchant_vote", {
                            p_merchant_key: mk,
                            p_category_slug: categoryId,
                        });
                    } catch {
                        // best-effort
                    }
                }
            }
        } catch (e) {
            result.errors.push(`"${tx.description}": ${e instanceof Error ? e.message : "erro"}`);
            result.skipped++;
        }
    }

    return result;
}
