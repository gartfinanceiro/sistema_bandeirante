import { MonthSummary, FinancialReport } from "@/app/(authenticated)/financeiro/actions";

interface FinancialReportHtmlProps {
    month: number;
    year: number;
    summary: MonthSummary;
    expensesReport: FinancialReport;
    entriesReport: FinancialReport;
    generatedAt: string;
}

export function generateFinancialReportHtml({
    month,
    year,
    summary,
    expensesReport,
    entriesReport,
    generatedAt,
}: FinancialReportHtmlProps): string {
    const monthName = new Date(year, month - 1).toLocaleDateString('pt-BR', { month: 'long' });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    const formatPercent = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'percent',
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
        }).format(value / 100);
    };

    // Helper to generate rows
    const generateRows = (categories: { name: string; total: number; percentage: number }[]) => {
        if (categories.length === 0) {
            return `
                <tr>
                    <td colspan="3" style="padding: 20px; text-align: center; border-bottom: 1px solid #f3f4f6; color: #374151;">
                        Nenhum registro encontrado.
                    </td>
                </tr>
            `;
        }
        return categories.map(cat => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; color: #374151;">${cat.name}</td>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; color: #374151; text-align: right;">${formatCurrency(cat.total)}</td>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; color: #374151; text-align: right;">${formatPercent(cat.percentage)}</td>
            </tr>
        `).join('');
    };

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px; color: #1f2937; max-width: 210mm; margin: 0 auto; }
            .header { border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
            .title { font-size: 24px; font-weight: bold; color: #111827; margin: 0; }
            .subtitle { font-size: 14px; color: #6b7280; margin-top: 4px; }
            .summary-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 40px; }
            .card { padding: 16px; border-radius: 8px; background-color: #f9fafb; border: 1px solid #e5e7eb; }
            .card-label { font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 4px; }
            .card-value { font-size: 20px; font-weight: bold; }
            .table { width: 100%; border-collapse: collapse; fontSize: 12px; margin-bottom: 20px; }
            .th { text-align: left; padding: 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-weight: 600; font-size: 11px; text-transform: uppercase; }
            .section-title { font-size: 18px; font-weight: bold; margin-top: 30px; margin-bottom: 15px; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
            .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 10px; color: #9ca3af; }
        </style>
    </head>
    <body>
        <div class="header">
            <div>
                <h1 class="title">Relatório Financeiro</h1>
                <p class="subtitle">Sistema Bandeirante</p>
            </div>
            <div style="text-align: right;">
                <div style="font-weight: bold; font-size: 16px;">${capitalizedMonth} ${year}</div>
                <div style="font-size: 10px; color: #9ca3af;">Gerado em: ${generatedAt}</div>
            </div>
        </div>

        <div class="summary-grid">
            <div class="card" style="background-color: #f0fdf4; border-color: #bbf7d0;">
                <div class="card-label" style="color: #166534;">Entradas</div>
                <div class="card-value" style="color: #16a34a;">${formatCurrency(summary.totalEntries)}</div>
            </div>
            <div class="card" style="background-color: #fef2f2; border-color: #fecaca;">
                <div class="card-label" style="color: #991b1b;">Saídas</div>
                <div class="card-value" style="color: #dc2626;">${formatCurrency(summary.totalExits)}</div>
            </div>
            <div class="card">
                <div class="card-label">Saldo</div>
                <div class="card-value" style="color: ${summary.balance >= 0 ? '#16a34a' : '#dc2626'};">
                    ${formatCurrency(summary.balance)}
                </div>
            </div>
        </div>

        <!-- ENTRADAS -->
        <h2 class="section-title" style="margin-top: 20px; color: #166534; border-bottom-color: #bbf7d0;">Entradas por Grande Grupo</h2>
        <table class="table">
            <thead>
                <tr>
                    <th class="th">Grupo</th>
                    <th class="th" style="text-align: right;">Valor</th>
                    <th class="th" style="text-align: right;">%</th>
                </tr>
            </thead>
            <tbody>
                ${generateRows(entriesReport.macroCategories)}
            </tbody>
        </table>

        <h2 class="section-title" style="color: #166534; border-bottom-color: #bbf7d0;">Detalhamento de Entradas (Categoria)</h2>
        <table class="table">
            <thead>
                <tr>
                    <th class="th">Categoria</th>
                    <th class="th" style="text-align: right;">Valor</th>
                    <th class="th" style="text-align: right;">%</th>
                </tr>
            </thead>
            <tbody>
                ${generateRows(entriesReport.categories)}
            </tbody>
        </table>

        <!-- DESPESAS -->
        <h2 class="section-title" style="margin-top: 40px; color: #991b1b; border-bottom-color: #fecaca;">Despesas por Grande Grupo</h2>
        <table class="table">
            <thead>
                <tr>
                    <th class="th">Grupo</th>
                    <th class="th" style="text-align: right;">Valor</th>
                    <th class="th" style="text-align: right;">%</th>
                </tr>
            </thead>
            <tbody>
                ${generateRows(expensesReport.macroCategories)}
            </tbody>
        </table>

        <h2 class="section-title" style="color: #991b1b; border-bottom-color: #fecaca;">Detalhamento de Despesas (Categoria)</h2>
        <table class="table">
            <thead>
                <tr>
                    <th class="th">Categoria</th>
                    <th class="th" style="text-align: right;">Valor</th>
                    <th class="th" style="text-align: right;">%</th>
                </tr>
            </thead>
            <tbody>
                ${generateRows(expensesReport.categories)}
            </tbody>
        </table>

        <div class="footer">
            Relatório gerado automaticamente pelo Sistema Bandeirante
        </div>
    </body>
    </html>
    `;
}
