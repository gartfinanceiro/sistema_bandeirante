import type { ParsedSheetTransaction } from "@/app/(authenticated)/financeiro/import-actions";

// =============================================================================
// Parser da planilha financeira (Google Sheets). Compartilhado entre o dialog
// (client) e o cron de importação automática (server) — paridade total.
// =============================================================================

export const SHEET_ID = "1J1KVgILegd9RDQLcMB-68I14bYpn1UqwUiFPlBxmuW0";

export const MONTH_TABS: { label: string; sheet: string; month: number }[] = [
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

/** Nome da aba (tab) da planilha para um mês 1-12. */
export function sheetTabForMonth(month: number): string | null {
    return MONTH_TABS.find((m) => m.month === month)?.sheet ?? null;
}

// Month names in Portuguese for date parsing
const MONTH_NAMES: Record<string, number> = {
    janeiro: 1, fevereiro: 2, março: 3, marco: 3, abril: 4,
    maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9,
    outubro: 10, novembro: 11, dezembro: 12,
};

export async function fetchSheetCSV(sheetName: string): Promise<string> {
    // Google Visualization API CSV export para planilhas públicas
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

export function parseCSV(csvText: string): string[][] {
    const lines = csvText.split("\n");
    return lines.map((line) => parseCSVLine(line));
}

function toTitleCase(text: string): string {
    return text
        .toLowerCase()
        .replace(/(^|\s|-)\S/g, (char) => char.toUpperCase());
}

function parseMonetaryValue(raw: string): number {
    if (!raw) return 0;

    let cleaned = raw.trim();
    cleaned = cleaned.replace(/R\$\s*/g, "");

    const isNegative = (cleaned.startsWith("(") && cleaned.endsWith(")")) || cleaned.startsWith("-");
    cleaned = cleaned.replace(/[()]/g, "");

    // Brazilian format: 1.234,56 → 1234.56
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    cleaned = cleaned.replace(/[^\d.\-]/g, "");

    const value = parseFloat(cleaned);
    if (isNaN(value)) return 0;

    return isNegative ? -Math.abs(value) : value;
}

/**
 * Parse da estrutura horizontal da planilha.
 *
 * Dias dispostos horizontalmente; cada bloco de dia tem ~9 colunas:
 * - Cols 0-2: seção principal (descrição, valor, situação)
 * - Cols 3-5: seção "Outros"
 * - Cols 6-8: seção "Carvão do dia"
 * Linhas: 0 cabeçalho de data, 1 SALDO ANTERIOR, 2-23 transações, 24-26 subtotais/saldo.
 */
export function parseSpreadsheetData(
    data: string[][],
    monthNum: number,
    year: number,
    selectedDays: number[]
): ParsedSheetTransaction[] {
    if (data.length === 0) return [];

    const transactions: ParsedSheetTransaction[] = [];

    // Step 1: achar blocos de dia pelos cabeçalhos de data na 1ª linha ("01 de Março")
    const dayBlocks: { startCol: number; day: number }[] = [];
    const firstRow = data[0] || [];

    for (let col = 0; col < firstRow.length; col++) {
        const cell = (firstRow[col] || "").replace(/^"|"$/g, "").trim();
        const dateMatch = cell.match(/^(\d{1,2})\s+de\s+(\w+)/i);
        if (dateMatch) {
            const dayNum = parseInt(dateMatch[1], 10);
            const monthName = dateMatch[2].toLowerCase().replace("ç", "c").replace("ã", "a");
            const parsedMonth = MONTH_NAMES[monthName.replace("c", "ç").replace("a", "ã")] ||
                MONTH_NAMES[monthName];
            if (parsedMonth === monthNum || !parsedMonth) {
                dayBlocks.push({ startCol: col, day: dayNum });
            }
        }
    }

    if (dayBlocks.length === 0) return [];

    // Step 2: para cada dia selecionado, extrair transações das 3 seções
    for (const block of dayBlocks) {
        if (selectedDays.length > 0 && !selectedDays.includes(block.day)) continue;

        const isoDate = `${year}-${String(monthNum).padStart(2, "0")}-${String(block.day).padStart(2, "0")}`;

        const sections: { name: "principal" | "outros" | "carvao"; colOffset: number }[] = [
            { name: "principal", colOffset: 0 },
            { name: "outros", colOffset: 3 },
            { name: "carvao", colOffset: 6 },
        ];

        for (const section of sections) {
            const descCol = block.startCol + section.colOffset;
            const valCol = descCol + 1;
            const statusCol = descCol + 2;

            for (let row = 2; row < Math.min(data.length, 28); row++) {
                const rowData = data[row] || [];

                const rawDesc = (rowData[descCol] || "").replace(/^"|"$/g, "").trim();
                const rawVal = (rowData[valCol] || "").replace(/^"|"$/g, "").trim();
                const rawStatus = (rowData[statusCol] || "").replace(/^"|"$/g, "").trim();

                // Rótulos de resumo (subtotais/saldos) que NÃO são transações.
                // Compara sem acento e exato para não pegar fornecedores legítimos.
                const descKey = rawDesc.toUpperCase().trim().normalize("NFD").replace(/[̀-ͯ]/g, "");
                const SUMMARY_LABELS = [
                    "TOTAL", "TOTAL GERAL", "SUBTOTAL",
                    "CARVAO", "OUTROS",
                    "SALDO", "SALDO FINAL", "SALDO ANTERIOR", "SALDO DO DIA", "SALDO INICIAL",
                ];
                if (
                    !rawDesc ||
                    SUMMARY_LABELS.includes(descKey) ||
                    (descKey.includes("CARVAO") && (descKey.includes("TOTAL") || descKey.includes("SUBTOTAL"))) ||
                    (descKey.includes("OUTROS") && (descKey.includes("TOTAL") || descKey.includes("SUBTOTAL")))
                ) {
                    continue;
                }

                let amount = parseMonetaryValue(rawVal);
                if (amount === 0) continue;

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
