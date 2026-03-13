"use client";

import { useState, useCallback, useEffect } from "react";
import {
    X,
    CheckCircle,
    AlertTriangle,
    XCircle,
    FileSpreadsheet,
    Loader2,
    Download,
    ChevronDown,
    ChevronUp,
    Search,
} from "lucide-react";
import type {
    ParsedSheetTransaction,
    MatchedSheetTransaction,
    CategoryOption,
    SheetImportResult,
    SupplierOption,
} from "@/app/(authenticated)/financeiro/import-actions";
import {
    matchTransactionsWithCategories,
    getImportCategories,
    getImportSuppliers,
    importSheetTransactions,
} from "@/app/(authenticated)/financeiro/import-actions";

// =============================================================================
// Constants
// =============================================================================

const SHEET_ID = "1J1KVgILegd9RDQLcMB-68I14bYpn1UqwUiFPlBxmuW0";

const RAW_MATERIAL_SLUGS = new Set([
    "raw_material_charcoal",
    "raw_material_ore",
    "raw_material_flux",
    "raw_material_general",
]);

function isRawMaterialCategory(categoryId: string | null, categories: CategoryOption[]): {
    isMaterial: boolean;
    isCharcoal: boolean;
    materialId: string | null;
} {
    if (!categoryId) return { isMaterial: false, isCharcoal: false, materialId: null };

    if (categoryId.startsWith("material_")) {
        return { isMaterial: true, isCharcoal: false, materialId: categoryId.replace("material_", "") };
    }

    if (RAW_MATERIAL_SLUGS.has(categoryId)) {
        const cat = categories.find(c => c.id === categoryId || c.slug === categoryId);
        const isCharcoal = categoryId === "raw_material_charcoal";
        return { isMaterial: true, isCharcoal, materialId: cat?.materialId || null };
    }

    const cat = categories.find(c => c.id === categoryId || c.slug === categoryId);
    if (cat?.materialId) {
        return { isMaterial: true, isCharcoal: false, materialId: cat.materialId };
    }

    return { isMaterial: false, isCharcoal: false, materialId: null };
}

const MONTH_TABS: { label: string; sheet: string; month: number }[] = [
    { label: "Janeiro", sheet: "JANEIRO", month: 1 },
    { label: "Fevereiro", sheet: "FEVEREIRO", month: 2 },
    { label: "Março", sheet: "MARÇO", month: 3 },
    { label: "Abril", sheet: "ABRIL", month: 4 },
    { label: "Maio", sheet: "MAIO", month: 5 },
    { label: "Junho", sheet: "JUNHO", month: 6 },
    { label: "Julho", sheet: "JULHO", month: 7 },
    { label: "Agosto", sheet: "AGOSTO", month: 8 },
    { label: "Setembro", sheet: "SETEMBRO", month: 9 },
    { label: "Outubro", sheet: "OUTUBRO", month: 10 },
    { label: "Novembro", sheet: "NOVEMBRO", month: 11 },
    { label: "Dezembro", sheet: "DEZEMBRO", month: 12 },
];

// =============================================================================
// Google Sheets CSV Fetcher + Parser (client-side)
// =============================================================================

async function fetchSheetCSV(sheetName: string): Promise<string> {
    // Use the Google Visualization API CSV export for public sheets
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Erro ao buscar planilha: ${response.status} ${response.statusText}`);
    }
    return response.text();
}

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === "," && !inQuotes) {
            result.push(current.trim());
            current = "";
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

function parseCSV(csvText: string): string[][] {
    const lines = csvText.split("\n");
    return lines.map(line => parseCSVLine(line));
}

// Month names in Portuguese for date parsing
const MONTH_NAMES: Record<string, number> = {
    janeiro: 1, fevereiro: 2, março: 3, marco: 3, abril: 4,
    maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9,
    outubro: 10, novembro: 11, dezembro: 12,
};

/**
 * Parse the horizontal spreadsheet structure.
 *
 * Structure: Days are arranged horizontally. Each day block has ~9 columns:
 * - Cols 0-2: Main section (description, valor, situação)
 * - Cols 3-5: Outros section (description, valor, situação)
 * - Cols 6-8: Carvão do dia section (description, valor, situação)
 *
 * Row layout within each day block (~27 rows):
 * - Row 0: Date header ("02 de Março")
 * - Row 1: SALDO ANTERIOR
 * - Rows 2-23: Transaction rows
 * - Row 24: CARVÃO subtotal
 * - Row 25: OUTROS subtotal
 * - Row 26: SALDO FINAL
 *
 * Days are separated by a gap column.
 */
function parseSpreadsheetData(
    data: string[][],
    monthNum: number,
    year: number,
    selectedDays: number[]
): ParsedSheetTransaction[] {
    if (data.length === 0) return [];

    const transactions: ParsedSheetTransaction[] = [];

    // Step 1: Find day blocks by scanning the first row for date headers
    // Date headers look like: "01 de Março", "02 de Março", etc.
    const dayBlocks: { startCol: number; day: number }[] = [];
    const firstRow = data[0] || [];

    for (let col = 0; col < firstRow.length; col++) {
        const cell = (firstRow[col] || "").replace(/^"|"$/g, "").trim();
        // Match patterns like "01 de Março" or "1 de março" or "01 de Marco"
        const dateMatch = cell.match(/^(\d{1,2})\s+de\s+(\w+)/i);
        if (dateMatch) {
            const dayNum = parseInt(dateMatch[1], 10);
            const monthName = dateMatch[2].toLowerCase().replace("ç", "c").replace("ã", "a");
            // Verify this matches the expected month
            const parsedMonth = MONTH_NAMES[monthName.replace("c", "ç").replace("a", "ã")] ||
                MONTH_NAMES[monthName];
            if (parsedMonth === monthNum || !parsedMonth) {
                dayBlocks.push({ startCol: col, day: dayNum });
            }
        }
    }

    if (dayBlocks.length === 0) {
        // Fallback: try detecting by column pattern
        // Some sheets might use different header format
        return [];
    }

    // Step 2: For each selected day, extract transactions from all 3 sections
    for (const block of dayBlocks) {
        if (selectedDays.length > 0 && !selectedDays.includes(block.day)) continue;

        const isoDate = `${year}-${String(monthNum).padStart(2, "0")}-${String(block.day).padStart(2, "0")}`;

        // Extract from 3 sections
        const sections: { name: "principal" | "outros" | "carvao"; colOffset: number }[] = [
            { name: "principal", colOffset: 0 },
            { name: "outros", colOffset: 3 },
            { name: "carvao", colOffset: 6 },
        ];

        for (const section of sections) {
            const descCol = block.startCol + section.colOffset;
            const valCol = descCol + 1;
            const statusCol = descCol + 2;

            // Transaction rows start at row 2 (0-indexed) and go until we hit
            // CARVÃO subtotal, OUTROS subtotal, or SALDO FINAL
            for (let row = 2; row < Math.min(data.length, 28); row++) {
                const rowData = data[row] || [];

                const rawDesc = (rowData[descCol] || "").replace(/^"|"$/g, "").trim();
                const rawVal = (rowData[valCol] || "").replace(/^"|"$/g, "").trim();
                const rawStatus = (rowData[statusCol] || "").replace(/^"|"$/g, "").trim();

                // Skip system rows
                const descUpper = rawDesc.toUpperCase();
                if (
                    !rawDesc ||
                    descUpper.includes("SALDO ANTERIOR") ||
                    descUpper.includes("SALDO FINAL") ||
                    descUpper.includes("CARVÃO") && (descUpper.includes("TOTAL") || descUpper.includes("SUBTOTAL")) ||
                    descUpper.includes("OUTROS") && (descUpper.includes("TOTAL") || descUpper.includes("SUBTOTAL")) ||
                    descUpper === "CARVÃO" ||
                    descUpper === "OUTROS"
                ) {
                    continue;
                }

                // Parse value — handle R$ format, parentheses for negative, comma decimal
                let amount = parseMonetaryValue(rawVal);
                if (amount === 0) continue; // Skip empty/zero rows

                // Determine type: negative = saida, positive = entrada
                const type: "entrada" | "saida" = amount < 0 ? "saida" : "entrada";
                amount = Math.abs(amount);

                transactions.push({
                    day: block.day,
                    date: isoDate,
                    description: toTitleCase(rawDesc),
                    amount,
                    type,
                    status: rawStatus || "Pago",
                    section: section.name,
                });
            }
        }
    }

    return transactions;
}

function toTitleCase(text: string): string {
    return text
        .toLowerCase()
        .replace(/(^|\s|-)\S/g, (char) => char.toUpperCase());
}

function parseMonetaryValue(raw: string): number {
    if (!raw) return 0;

    let cleaned = raw.trim();

    // Remove R$ prefix
    cleaned = cleaned.replace(/R\$\s*/g, "");

    // Handle parentheses for negative: (1.234,56) → -1234.56
    const isNegative = cleaned.startsWith("(") && cleaned.endsWith(")") || cleaned.startsWith("-");
    cleaned = cleaned.replace(/[()]/g, "");

    // Remove thousand separators (dots) and convert decimal comma to dot
    // Brazilian format: 1.234,56 → 1234.56
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");

    // Remove any remaining non-numeric chars except dot and minus
    cleaned = cleaned.replace(/[^\d.\-]/g, "");

    const value = parseFloat(cleaned);
    if (isNaN(value)) return 0;

    return isNegative ? -Math.abs(value) : value;
}

// =============================================================================
// Component
// =============================================================================

interface ImportFinanceiroDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onImportComplete: () => void;
}

type Step = "config" | "fetching" | "review" | "importing" | "done";

// Per-transaction purchase data for raw materials
interface PurchaseData {
    supplierId: string;
    quantity: string;
    hasIcmsCredit: boolean;
    icmsRate: string;
}

export function ImportFinanceiroDialog({
    isOpen,
    onClose,
    onImportComplete,
}: ImportFinanceiroDialogProps) {
    const currentMonth = new Date().getMonth(); // 0-indexed
    const currentYear = new Date().getFullYear();

    // Step state
    const [step, setStep] = useState<Step>("config");

    // Config step
    const [selectedMonthIdx, setSelectedMonthIdx] = useState(currentMonth);
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [dayRangeStart, setDayRangeStart] = useState(1);
    const [dayRangeEnd, setDayRangeEnd] = useState(new Date().getDate());

    // Data
    const [matchedTransactions, setMatchedTransactions] = useState<MatchedSheetTransaction[]>([]);
    const [categories, setCategories] = useState<CategoryOption[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [categoryOverrides, setCategoryOverrides] = useState<Map<number, string>>(new Map());
    const [descriptionOverrides, setDescriptionOverrides] = useState<Map<number, string>>(new Map());
    const [importResult, setImportResult] = useState<SheetImportResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Suppliers + per-transaction purchase data
    const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
    const [purchaseOverrides, setPurchaseOverrides] = useState<Map<number, PurchaseData>>(new Map());
    const [expandedPurchaseRows, setExpandedPurchaseRows] = useState<Set<number>>(new Set());

    // Review filters
    const [filterType, setFilterType] = useState<"all" | "entrada" | "saida">("all");
    const [filterConfidence, setFilterConfidence] = useState<"all" | "none" | "low">("all");
    const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());
    const [searchFilter, setSearchFilter] = useState("");

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            setStep("config");
            setMatchedTransactions([]);
            setCategories([]);
            setSelectedIds(new Set());
            setCategoryOverrides(new Map());
            setDescriptionOverrides(new Map());
            setImportResult(null);
            setError(null);
            setSuppliers([]);
            setPurchaseOverrides(new Map());
            setExpandedPurchaseRows(new Set());
            setFilterType("all");
            setFilterConfidence("all");
            setExpandedDays(new Set());
            setSearchFilter("");
        }
    }, [isOpen]);

    // Fetch & Parse
    const handleFetch = useCallback(async () => {
        setStep("fetching");
        setError(null);

        try {
            const tab = MONTH_TABS[selectedMonthIdx];
            if (!tab) throw new Error("Mês inválido");

            // 1. Fetch CSV
            const csvText = await fetchSheetCSV(tab.sheet);
            const data = parseCSV(csvText);

            if (data.length === 0) {
                throw new Error("Planilha vazia ou formato não reconhecido");
            }

            // 2. Build day range
            const days: number[] = [];
            for (let d = dayRangeStart; d <= dayRangeEnd; d++) {
                days.push(d);
            }

            // 3. Parse transactions
            const parsed = parseSpreadsheetData(data, tab.month, selectedYear, days);

            if (parsed.length === 0) {
                throw new Error(
                    `Nenhuma transação encontrada para os dias ${dayRangeStart}-${dayRangeEnd} de ${tab.label}. ` +
                    "Verifique se o período está correto e se a planilha contém dados."
                );
            }

            // 4. Match categories + load suppliers (server actions)
            const [matched, cats, sups] = await Promise.all([
                matchTransactionsWithCategories(parsed),
                getImportCategories(),
                getImportSuppliers(),
            ]);

            setMatchedTransactions(matched);
            setCategories(cats);
            setSuppliers(sups);

            // Auto-expand purchase rows for raw material matches
            const autoExpandPurchase = new Set<number>();
            matched.forEach((tx, idx) => {
                const catId = tx.suggestedCategoryId;
                const info = isRawMaterialCategory(catId, cats);
                if (info.isMaterial && tx.type === "saida") {
                    autoExpandPurchase.add(idx);
                }
            });
            setExpandedPurchaseRows(autoExpandPurchase);

            // Select all matched by default
            const defaultSelected = new Set<number>();
            matched.forEach((tx, idx) => {
                if (tx.suggestedCategoryId) {
                    defaultSelected.add(idx);
                }
            });
            setSelectedIds(defaultSelected);

            // Expand all days by default
            const allDays = new Set(matched.map(tx => tx.day));
            setExpandedDays(allDays);

            setStep("review");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erro ao buscar planilha");
            setStep("config");
        }
    }, [selectedMonthIdx, selectedYear, dayRangeStart, dayRangeEnd]);

    // Import
    const handleImport = useCallback(async () => {
        setStep("importing");
        setError(null);

        try {
            const toImport = matchedTransactions
                .map((tx, idx) => ({ tx, idx }))
                .filter(({ idx }) => selectedIds.has(idx))
                .map(({ tx, idx }) => {
                    const catId = categoryOverrides.get(idx) || tx.suggestedCategoryId;
                    const purchase = purchaseOverrides.get(idx);
                    return {
                        date: tx.date,
                        description: descriptionOverrides.get(idx) || tx.description,
                        amount: tx.amount,
                        type: tx.type,
                        status: tx.status,
                        categoryId: catId,
                        supplierId: purchase?.supplierId || null,
                        quantity: purchase?.quantity ? parseFloat(purchase.quantity) : null,
                        hasIcmsCredit: purchase?.hasIcmsCredit || false,
                        icmsRate: purchase?.hasIcmsCredit && purchase?.icmsRate ? parseFloat(purchase.icmsRate) : null,
                    };
                });

            if (toImport.length === 0) {
                setError("Nenhuma transação selecionada para importar");
                setStep("review");
                return;
            }

            const result = await importSheetTransactions(toImport);
            setImportResult(result);
            setStep("done");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erro ao importar");
            setStep("review");
        }
    }, [matchedTransactions, selectedIds, categoryOverrides]);

    // Helpers
    const toggleSelect = (idx: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    const selectAll = () => {
        const all = new Set<number>();
        matchedTransactions.forEach((_, idx) => all.add(idx));
        setSelectedIds(all);
    };

    const selectNone = () => setSelectedIds(new Set());

    const toggleDay = (day: number) => {
        setExpandedDays(prev => {
            const next = new Set(prev);
            if (next.has(day)) next.delete(day);
            else next.add(day);
            return next;
        });
    };

    const handleCategoryChange = (idx: number, newCatId: string) => {
        setCategoryOverrides(prev => {
            const next = new Map(prev);
            next.set(idx, newCatId);
            return next;
        });
        // Auto-select when category is assigned
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.add(idx);
            return next;
        });
        // Auto-expand/collapse purchase row based on category
        const tx = matchedTransactions[idx];
        const info = isRawMaterialCategory(newCatId, categories);
        if (info.isMaterial && tx?.type === "saida") {
            setExpandedPurchaseRows(prev => { const next = new Set(prev); next.add(idx); return next; });
        } else {
            setExpandedPurchaseRows(prev => { const next = new Set(prev); next.delete(idx); return next; });
            // Clear purchase data if category is no longer raw material
            setPurchaseOverrides(prev => { const next = new Map(prev); next.delete(idx); return next; });
        }
    };

    const updatePurchaseData = (idx: number, field: keyof PurchaseData, value: string | boolean) => {
        setPurchaseOverrides(prev => {
            const next = new Map(prev);
            const current = next.get(idx) || { supplierId: "", quantity: "", hasIcmsCredit: false, icmsRate: "" };
            next.set(idx, { ...current, [field]: value });
            return next;
        });
    };

    // Auto-fill ICMS from supplier defaults
    const handleSupplierChange = (idx: number, supplierId: string) => {
        updatePurchaseData(idx, "supplierId", supplierId);
        const supplier = suppliers.find(s => s.id === supplierId);
        if (supplier) {
            updatePurchaseData(idx, "hasIcmsCredit", supplier.hasIcms);
            if (supplier.hasIcms && supplier.icmsRate > 0) {
                updatePurchaseData(idx, "icmsRate", supplier.icmsRate.toString());
            }
            // Auto-calculate quantity if supplier has default price
            const tx = matchedTransactions[idx];
            if (supplier.defaultPrice && supplier.defaultPrice > 0 && tx) {
                const qty = tx.amount / supplier.defaultPrice;
                updatePurchaseData(idx, "quantity", qty.toFixed(2));
            }
        }
    };

    // Filter transactions for review
    const filteredTransactions = matchedTransactions
        .map((tx, idx) => ({ tx, idx }))
        .filter(({ tx, idx }) => {
            if (filterType !== "all" && tx.type !== filterType) return false;
            if (filterConfidence === "none" && tx.matchConfidence !== "none") return false;
            if (filterConfidence === "low" && tx.matchConfidence !== "low" && tx.matchConfidence !== "none") return false;
            const desc = descriptionOverrides.get(idx) || tx.description;
            if (searchFilter && !desc.toLowerCase().includes(searchFilter.toLowerCase())) return false;
            return true;
        });

    // Group by day
    const dayGroups = new Map<number, { tx: MatchedSheetTransaction; idx: number }[]>();
    for (const item of filteredTransactions) {
        const day = item.tx.day;
        if (!dayGroups.has(day)) dayGroups.set(day, []);
        dayGroups.get(day)!.push(item);
    }
    const sortedDays = Array.from(dayGroups.keys()).sort((a, b) => a - b);

    // Summary stats
    const totalSelected = selectedIds.size;
    const totalEntrada = matchedTransactions
        .filter((_, idx) => selectedIds.has(idx))
        .filter(tx => tx.type === "entrada")
        .reduce((sum, tx) => sum + tx.amount, 0);
    const totalSaida = matchedTransactions
        .filter((_, idx) => selectedIds.has(idx))
        .filter(tx => tx.type === "saida")
        .reduce((sum, tx) => sum + tx.amount, 0);
    const withoutCategory = matchedTransactions
        .filter((_, idx) => selectedIds.has(idx))
        .filter((tx, idx) => !categoryOverrides.get(idx) && !tx.suggestedCategoryId)
        .length;

    // Count raw material transactions missing supplier
    const rawMaterialWithoutSupplier = matchedTransactions
        .filter((_, idx) => selectedIds.has(idx))
        .filter((tx, idx) => {
            const catId = categoryOverrides.get(idx) || tx.suggestedCategoryId;
            const info = isRawMaterialCategory(catId, categories);
            if (!info.isMaterial || tx.type !== "saida") return false;
            const purchase = purchaseOverrides.get(idx);
            return !purchase?.supplierId;
        }).length;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <FileSpreadsheet className="w-6 h-6 text-primary" />
                        <div>
                            <h2 className="text-lg font-semibold text-foreground">
                                Importar da Planilha
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                Google Sheets → Sistema Bandeirante
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4">
                    {/* ==================== STEP: CONFIG ==================== */}
                    {step === "config" && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                <p className="text-sm text-blue-800 dark:text-blue-300">
                                    Selecione o mês e o período de dias que deseja importar da planilha
                                    &quot;Financeiro 2026&quot;. As transações serão analisadas e você poderá
                                    revisar e ajustar as categorias antes da importação.
                                </p>
                            </div>

                            {/* Month selector */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Mês da Planilha
                                </label>
                                <div className="flex gap-3">
                                    <select
                                        value={selectedMonthIdx}
                                        onChange={(e) => setSelectedMonthIdx(parseInt(e.target.value))}
                                        className="h-10 px-3 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                    >
                                        {MONTH_TABS.map((tab, idx) => (
                                            <option key={idx} value={idx}>{tab.label}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                        className="h-10 px-3 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                    >
                                        <option value={2025}>2025</option>
                                        <option value={2026}>2026</option>
                                    </select>
                                </div>
                            </div>

                            {/* Day range */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Período (dias)
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        min={1}
                                        max={31}
                                        value={dayRangeStart}
                                        onChange={(e) => setDayRangeStart(Math.max(1, Math.min(31, parseInt(e.target.value) || 1)))}
                                        className="h-10 w-20 px-3 rounded-md border border-input bg-background text-foreground text-sm text-center focus:outline-none focus:ring-2 focus:ring-ring"
                                    />
                                    <span className="text-muted-foreground">até</span>
                                    <input
                                        type="number"
                                        min={1}
                                        max={31}
                                        value={dayRangeEnd}
                                        onChange={(e) => setDayRangeEnd(Math.max(1, Math.min(31, parseInt(e.target.value) || 1)))}
                                        className="h-10 w-20 px-3 rounded-md border border-input bg-background text-foreground text-sm text-center focus:outline-none focus:ring-2 focus:ring-ring"
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ==================== STEP: FETCHING ==================== */}
                    {step === "fetching" && (
                        <div className="flex flex-col items-center justify-center py-16">
                            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                            <p className="text-lg font-medium text-foreground">Buscando planilha...</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Lendo dados do Google Sheets e analisando categorias
                            </p>
                        </div>
                    )}

                    {/* ==================== STEP: REVIEW ==================== */}
                    {step === "review" && (
                        <div className="space-y-4">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="bg-background border border-border rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-foreground">{matchedTransactions.length}</p>
                                    <p className="text-xs text-muted-foreground">Total encontradas</p>
                                </div>
                                <div className="bg-background border border-border rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-primary">{totalSelected}</p>
                                    <p className="text-xs text-muted-foreground">Selecionadas</p>
                                </div>
                                <div className="bg-background border border-border rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-green-600">
                                        {totalEntrada.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                    </p>
                                    <p className="text-xs text-muted-foreground">Entradas</p>
                                </div>
                                <div className="bg-background border border-border rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-red-600">
                                        {totalSaida.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                    </p>
                                    <p className="text-xs text-muted-foreground">Saídas</p>
                                </div>
                            </div>

                            {withoutCategory > 0 && (
                                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                                    <p className="text-sm text-amber-700 dark:text-amber-400">
                                        <AlertTriangle className="w-4 h-4 inline mr-1" />
                                        {withoutCategory} transação(ões) selecionada(s) sem categoria. Atribua uma categoria ou desmarque antes de importar.
                                    </p>
                                </div>
                            )}

                            {rawMaterialWithoutSupplier > 0 && (
                                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                                    <p className="text-sm text-blue-700 dark:text-blue-400">
                                        <AlertTriangle className="w-4 h-4 inline mr-1" />
                                        {rawMaterialWithoutSupplier} compra(s) de matéria-prima sem fornecedor. Preencha os dados para vincular à Balança e ao Estoque.
                                    </p>
                                </div>
                            )}

                            {/* Filters */}
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <button onClick={selectAll} className="text-xs text-primary hover:underline">Selecionar tudo</button>
                                    <span className="text-muted-foreground">|</span>
                                    <button onClick={selectNone} className="text-xs text-primary hover:underline">Limpar seleção</button>
                                </div>
                                <div className="flex-1" />
                                <div className="relative">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                    <input
                                        type="text"
                                        placeholder="Buscar..."
                                        value={searchFilter}
                                        onChange={(e) => setSearchFilter(e.target.value)}
                                        className="h-8 pl-7 pr-3 w-48 rounded-md border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                                    />
                                </div>
                                <select
                                    value={filterType}
                                    onChange={(e) => setFilterType(e.target.value as "all" | "entrada" | "saida")}
                                    className="h-8 px-2 rounded-md border border-input bg-background text-foreground text-xs"
                                >
                                    <option value="all">Todos os tipos</option>
                                    <option value="entrada">Entradas</option>
                                    <option value="saida">Saídas</option>
                                </select>
                                <select
                                    value={filterConfidence}
                                    onChange={(e) => setFilterConfidence(e.target.value as "all" | "none" | "low")}
                                    className="h-8 px-2 rounded-md border border-input bg-background text-foreground text-xs"
                                >
                                    <option value="all">Todas categorias</option>
                                    <option value="none">Sem categoria</option>
                                    <option value="low">Baixa confiança</option>
                                </select>
                            </div>

                            {/* Transaction list grouped by day */}
                            <div className="space-y-2">
                                {sortedDays.map(day => {
                                    const items = dayGroups.get(day) || [];
                                    const isExpanded = expandedDays.has(day);
                                    const daySelected = items.filter(({ idx }) => selectedIds.has(idx)).length;
                                    const tab = MONTH_TABS[selectedMonthIdx];

                                    return (
                                        <div key={day} className="border border-border rounded-lg overflow-hidden">
                                            {/* Day header */}
                                            <button
                                                onClick={() => toggleDay(day)}
                                                className="w-full flex items-center justify-between p-3 bg-accent/50 hover:bg-accent transition-colors text-left"
                                            >
                                                <div className="flex items-center gap-2">
                                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                    <span className="font-medium text-sm">
                                                        {String(day).padStart(2, "0")} de {tab?.label || ""}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        ({items.length} transações, {daySelected} selecionadas)
                                                    </span>
                                                </div>
                                            </button>

                                            {/* Day transactions */}
                                            {isExpanded && (
                                                <div className="divide-y divide-border">
                                                    {items.map(({ tx, idx }) => {
                                                        const isSelected = selectedIds.has(idx);
                                                        const currentCatId = categoryOverrides.get(idx) || tx.suggestedCategoryId || "";
                                                        const confidence = tx.matchConfidence;
                                                        const materialInfo = isRawMaterialCategory(currentCatId, categories);
                                                        const isPurchaseRow = materialInfo.isMaterial && tx.type === "saida";
                                                        const isExpPurchase = expandedPurchaseRows.has(idx);
                                                        const purchase = purchaseOverrides.get(idx);

                                                        // Filter suppliers by material
                                                        const filteredSuppliers = materialInfo.materialId
                                                            ? suppliers.filter(s => s.materialId === materialInfo.materialId)
                                                            : suppliers;

                                                        return (
                                                            <div key={idx}>
                                                                <div className={`flex items-center gap-3 p-3 text-sm transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-accent/30"}`}>
                                                                    {/* Checkbox */}
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isSelected}
                                                                        onChange={() => toggleSelect(idx)}
                                                                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                                    />

                                                                    {/* Type badge */}
                                                                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${tx.type === "entrada"
                                                                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                                                        }`}>
                                                                        {tx.type === "entrada" ? "E" : "S"}
                                                                    </span>

                                                                    {/* Description (editable) */}
                                                                    <div className="flex-1 min-w-0">
                                                                        <input
                                                                            type="text"
                                                                            value={descriptionOverrides.get(idx) ?? tx.description}
                                                                            onChange={(e) => setDescriptionOverrides(prev => {
                                                                                const next = new Map(prev);
                                                                                next.set(idx, e.target.value);
                                                                                return next;
                                                                            })}
                                                                            className="w-full bg-transparent text-foreground text-sm border-b border-transparent hover:border-border focus:border-primary focus:outline-none truncate py-0.5 transition-colors"
                                                                        />
                                                                        <div className="flex items-center gap-2 mt-0.5">
                                                                            <span className="text-xs text-muted-foreground">
                                                                                {tx.section === "carvao" ? "Carvão" : tx.section === "outros" ? "Outros" : "Principal"}
                                                                            </span>
                                                                            {tx.status && (
                                                                                <span className="text-xs text-muted-foreground">• {tx.status}</span>
                                                                            )}
                                                                            {isPurchaseRow && (
                                                                                <span className="text-xs font-medium text-purple-600 dark:text-purple-400">• Matéria-Prima</span>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* Amount */}
                                                                    <span className={`font-mono text-sm font-medium whitespace-nowrap ${tx.type === "entrada" ? "text-green-600" : "text-red-600"
                                                                        }`}>
                                                                        {tx.type === "saida" ? "-" : "+"}
                                                                        {tx.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                                                    </span>

                                                                    {/* Category dropdown */}
                                                                    <div className="w-52 flex-shrink-0">
                                                                        <div className="relative">
                                                                            <select
                                                                                value={currentCatId}
                                                                                onChange={(e) => handleCategoryChange(idx, e.target.value)}
                                                                                className={`w-full h-8 px-2 pr-7 rounded-md border text-xs truncate focus:outline-none focus:ring-2 focus:ring-ring ${confidence === "high"
                                                                                    ? "border-green-300 bg-green-50 dark:bg-green-950/20 dark:border-green-800"
                                                                                    : confidence === "medium"
                                                                                        ? "border-blue-300 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800"
                                                                                        : confidence === "low"
                                                                                            ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800"
                                                                                            : "border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800"
                                                                                    }`}
                                                                            >
                                                                                <option value="">— Selecionar categoria —</option>
                                                                                {categories.map((cat) => (
                                                                                    <option key={cat.id} value={cat.id}>
                                                                                        [{cat.costCenterCode}] {cat.name}
                                                                                    </option>
                                                                                ))}
                                                                            </select>
                                                                            {/* Confidence indicator */}
                                                                            <div className="absolute right-8 top-1/2 -translate-y-1/2">
                                                                                {confidence === "high" && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                                                                                {confidence === "medium" && <CheckCircle className="w-3.5 h-3.5 text-blue-500" />}
                                                                                {confidence === "low" && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                                                                                {confidence === "none" && <XCircle className="w-3.5 h-3.5 text-red-500" />}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Expand/collapse purchase details */}
                                                                    {isPurchaseRow && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setExpandedPurchaseRows(prev => {
                                                                                const next = new Set(prev);
                                                                                if (next.has(idx)) next.delete(idx); else next.add(idx);
                                                                                return next;
                                                                            })}
                                                                            className="p-1 rounded hover:bg-accent transition-colors text-purple-500"
                                                                            title="Dados de compra"
                                                                        >
                                                                            {isExpPurchase ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                                        </button>
                                                                    )}
                                                                </div>

                                                                {/* Purchase details sub-row */}
                                                                {isPurchaseRow && isExpPurchase && (
                                                                    <div className="px-3 pb-3 pt-1 ml-8 mr-3 mb-1 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-md space-y-2">
                                                                        <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
                                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                                                            {materialInfo.isCharcoal ? "Compra Carvão (estoque imediato)" : "Compra Matéria-Prima (Balança)"}
                                                                        </p>
                                                                        <div className="grid grid-cols-2 gap-2">
                                                                            {/* Supplier */}
                                                                            <div>
                                                                                <label className="text-xs text-purple-700 dark:text-purple-400 font-medium">Fornecedor</label>
                                                                                <select
                                                                                    value={purchase?.supplierId || ""}
                                                                                    onChange={(e) => handleSupplierChange(idx, e.target.value)}
                                                                                    className="w-full h-7 px-2 rounded border border-purple-200 dark:border-purple-700 bg-white dark:bg-background text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                                                                                >
                                                                                    <option value="">Selecione...</option>
                                                                                    {filteredSuppliers.map(s => (
                                                                                        <option key={s.id} value={s.id}>
                                                                                            {s.name} {s.defaultPrice ? `(R$ ${s.defaultPrice.toFixed(2)}/t)` : "(Variável)"}
                                                                                        </option>
                                                                                    ))}
                                                                                </select>
                                                                            </div>
                                                                            {/* Quantity */}
                                                                            <div>
                                                                                <label className="text-xs text-purple-700 dark:text-purple-400 font-medium">Quantidade (t)</label>
                                                                                <input
                                                                                    type="number"
                                                                                    step="0.01"
                                                                                    min="0"
                                                                                    value={purchase?.quantity || ""}
                                                                                    onChange={(e) => updatePurchaseData(idx, "quantity", e.target.value)}
                                                                                    placeholder="Ex: 30.00"
                                                                                    className="w-full h-7 px-2 rounded border border-purple-200 dark:border-purple-700 bg-white dark:bg-background text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        {/* ICMS */}
                                                                        <div className="flex items-center gap-3">
                                                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={purchase?.hasIcmsCredit || false}
                                                                                    onChange={(e) => updatePurchaseData(idx, "hasIcmsCredit", e.target.checked)}
                                                                                    className="w-3.5 h-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                                                                />
                                                                                <span className="text-xs text-purple-700 dark:text-purple-400 font-medium">ICMS</span>
                                                                            </label>
                                                                            {purchase?.hasIcmsCredit && (
                                                                                <input
                                                                                    type="number"
                                                                                    step="0.01"
                                                                                    min="0"
                                                                                    value={purchase?.icmsRate || ""}
                                                                                    onChange={(e) => updatePurchaseData(idx, "icmsRate", e.target.value)}
                                                                                    placeholder="Alíquota %"
                                                                                    className="h-7 w-24 px-2 rounded border border-purple-200 dark:border-purple-700 bg-white dark:bg-background text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                                                                                />
                                                                            )}
                                                                        </div>
                                                                        {/* Info note */}
                                                                        <p className="text-[10px] text-purple-500 dark:text-purple-500">
                                                                            {materialInfo.isCharcoal
                                                                                ? "Carvão: estoque atualizado imediatamente ao importar."
                                                                                : "Minério/Fundentes: aparecerá como pedido na Balança. Estoque atualizado na descarga."}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {filteredTransactions.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground">
                                    <p>Nenhuma transação encontrada com os filtros atuais.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ==================== STEP: IMPORTING ==================== */}
                    {step === "importing" && (
                        <div className="flex flex-col items-center justify-center py-16">
                            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                            <p className="text-lg font-medium text-foreground">Importando transações...</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                {totalSelected} transações sendo processadas
                            </p>
                        </div>
                    )}

                    {/* ==================== STEP: DONE ==================== */}
                    {step === "done" && importResult && (
                        <div className="space-y-6 py-8">
                            <div className="text-center">
                                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold text-foreground">Importação Concluída</h3>
                            </div>

                            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                                <div className="text-center">
                                    <p className="text-3xl font-bold text-green-600">{importResult.imported}</p>
                                    <p className="text-xs text-muted-foreground">Importadas</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-3xl font-bold text-amber-600">{importResult.skipped}</p>
                                    <p className="text-xs text-muted-foreground">Puladas</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-3xl font-bold text-foreground">{importResult.total}</p>
                                    <p className="text-xs text-muted-foreground">Total</p>
                                </div>
                            </div>

                            {importResult.errors.length > 0 && (
                                <div className="max-w-lg mx-auto bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">Detalhes:</p>
                                    <ul className="space-y-1 max-h-40 overflow-y-auto">
                                        {importResult.errors.map((err, i) => (
                                            <li key={i} className="text-xs text-amber-600 dark:text-amber-500">{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t border-border bg-accent/30">
                    {/* Left: step indicator */}
                    <div className="text-xs text-muted-foreground">
                        {step === "config" && "Passo 1/3 — Configuração"}
                        {step === "fetching" && "Passo 1/3 — Buscando..."}
                        {step === "review" && "Passo 2/3 — Revisão"}
                        {step === "importing" && "Passo 3/3 — Importando..."}
                        {step === "done" && "Concluído"}
                    </div>

                    {/* Right: actions */}
                    <div className="flex gap-2">
                        {step === "config" && (
                            <>
                                <button
                                    onClick={onClose}
                                    className="h-9 px-4 rounded-md border border-border text-foreground font-medium text-sm hover:bg-accent transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleFetch}
                                    className="h-9 px-4 rounded-md bg-primary text-primary-foreground font-medium text-sm shadow hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    Buscar Planilha
                                </button>
                            </>
                        )}

                        {step === "review" && (
                            <>
                                <button
                                    onClick={() => setStep("config")}
                                    className="h-9 px-4 rounded-md border border-border text-foreground font-medium text-sm hover:bg-accent transition-colors"
                                >
                                    Voltar
                                </button>
                                <button
                                    onClick={handleImport}
                                    disabled={totalSelected === 0}
                                    className="h-9 px-4 rounded-md bg-primary text-primary-foreground font-medium text-sm shadow hover:bg-primary/90 transition-colors inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    Importar {totalSelected} Transações
                                </button>
                            </>
                        )}

                        {step === "done" && (
                            <button
                                onClick={() => {
                                    onImportComplete();
                                    onClose();
                                }}
                                className="h-9 px-4 rounded-md bg-primary text-primary-foreground font-medium text-sm shadow hover:bg-primary/90 transition-colors"
                            >
                                Fechar
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
