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

export interface MonthImportSummary {
    month: number;
    year: number;
    parsed: number;
    imported: number;
    needsReview: number;
    skipped: number;
}

export interface AutoImportResult {
    processed: MonthImportSummary[];
    totals: { parsed: number; imported: number; needsReview: number; skipped: number };
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

function previousMonth(month: number, year: number): { month: number; year: number } {
    return month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };
}

function mapStatus(raw: string): string {
    const s = (raw || "").toLowerCase().trim();
    if (s.includes("pend")) return "pendente";
    if (s.includes("parc")) return "parcial";
    if (s.includes("cancel")) return "cancelado";
    return "pago";
}

/** Importa um mês específico (puramente financeiro, idempotente). */
async function importMonth(
    supabase: any,
    categories: any[],
    bestRows: any[],
    month: number,
    year: number,
    errors: string[]
): Promise<MonthImportSummary> {
    const summary: MonthImportSummary = { month, year, parsed: 0, imported: 0, needsReview: 0, skipped: 0 };

    const tab = sheetTabForMonth(month);
    if (!tab) {
        errors.push(`Sem aba de planilha para o mês ${month}`);
        return summary;
    }

    let parsed;
    try {
        const csv = await fetchSheetCSV(tab);
        parsed = parseSpreadsheetData(parseCSV(csv), month, year, []); // todos os dias
    } catch (e) {
        errors.push(`Mês ${month}/${year}: falha ao buscar/parsear planilha: ${e instanceof Error ? e.message : "erro"}`);
        return summary;
    }
    summary.parsed = parsed.length;
    if (parsed.length === 0) return summary;

    const matched = categorizeTransactions(parsed, categories, bestRows);

    for (const tx of matched) {
        try {
            const isHigh = tx.matchConfidence === "high";
            const needsReview = !isHigh;
            let categoryId = tx.suggestedCategoryId || "a_classificar";
            if (categoryId.startsWith("material_")) categoryId = "raw_material_general";

            const { data: existing } = await supabase
                .from("transactions")
                .select("id")
                .eq("date", tx.date)
                .eq("type", tx.type)
                .eq("amount", tx.amount)
                .ilike("description", tx.description)
                .limit(1);
            if (existing && existing.length > 0) {
                summary.skipped++;
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
                errors.push(`"${tx.description}" (${tx.date}): ${error.message}`);
                summary.skipped++;
                continue;
            }

            summary.imported++;
            if (needsReview) summary.needsReview++;

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
            errors.push(`"${tx.description}": ${e instanceof Error ? e.message : "erro"}`);
            summary.skipped++;
        }
    }

    return summary;
}

/**
 * Importação automática do MÊS ANTERIOR + MÊS CORRENTE (chamada pelo cron).
 * Processar o mês anterior cobre a virada de mês (lançamentos lançados com atraso)
 * e backfill recente. Puramente financeira; confiantes alimentam o aprendizado,
 * incertos entram marcados needs_review. Idempotente (dedup), seguro rodar todo dia.
 */
export async function autoImportRecentMonths(): Promise<AutoImportResult> {
    const cur = nowInSaoPaulo();
    const prev = previousMonth(cur.month, cur.year);

    const result: AutoImportResult = {
        processed: [],
        totals: { parsed: 0, imported: 0, needsReview: 0, skipped: 0 },
        errors: [],
    };

    const supabase = createAdminClient();
    const categories = await fetchImportCategories(supabase);
    const bestRows = await fetchBestCategoryRows(supabase);

    // Ordem cronológica: anterior, depois corrente
    for (const m of [prev, cur]) {
        const s = await importMonth(supabase, categories, bestRows, m.month, m.year, result.errors);
        result.processed.push(s);
        result.totals.parsed += s.parsed;
        result.totals.imported += s.imported;
        result.totals.needsReview += s.needsReview;
        result.totals.skipped += s.skipped;
    }

    return result;
}
