import type { StockReportData } from "@/app/(authenticated)/estoque/report-actions";

export function generateStockReportHtml(data: StockReportData): string {
    const formatNumber = (value: number, decimals = 2) =>
        new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

    // Stock Position Rows
    const positionRows = data.positions
        .sort((a, b) => b.currentStock - a.currentStock)
        .map((p) => {
            let supplierCell = '<span style="color:#9ca3af;font-style:italic;">—</span>';
            if (p.supplierName) {
                supplierCell = p.supplierName;
            } else if (p.supplierBreakdown && p.supplierBreakdown.length > 0) {
                supplierCell = '<span style="color:#2563eb;">Ver detalhamento abaixo</span>';
            }
            return `<tr>
                <td class="td">${p.name}</td>
                <td class="td tc">${p.unit}</td>
                <td class="td tr" style="font-weight:600;font-size:13px;">${formatNumber(p.currentStock)}</td>
                <td class="td">${supplierCell}</td>
            </tr>`;
        })
        .join("");

    // Minério supplier breakdown
    const minerioPosition = data.positions.find(
        (p) => p.supplierBreakdown && p.supplierBreakdown.length > 0
    );

    const minerioHtml = minerioPosition
        ? (() => {
              const breakdown = minerioPosition.supplierBreakdown!;
              const total = breakdown.reduce((s, x) => s + x.quantity, 0);
              const rows = breakdown
                  .map((s) => {
                      const pct = total > 0 ? (s.quantity / total) * 100 : 0;
                      return `<tr>
                        <td class="td">${s.supplierName}</td>
                        <td class="td tr" style="font-weight:600;">${formatNumber(s.quantity)}</td>
                        <td class="td tr">${formatNumber(pct, 1)}%</td>
                    </tr>`;
                  })
                  .join("");
              return `
            <h2 class="section">${minerioPosition.name} — Por Fornecedor</h2>
            <table class="tbl">
                <thead><tr>
                    <th class="th">Fornecedor</th>
                    <th class="th tr">Qtd. Entregue (${minerioPosition.unit})</th>
                    <th class="th tr">%</th>
                </tr></thead>
                <tbody>
                    ${rows}
                    <tr style="background:#f1f5f9;">
                        <td class="td" style="font-weight:700;">Total</td>
                        <td class="td tr" style="font-weight:700;">${formatNumber(total)}</td>
                        <td class="td tr" style="font-weight:700;">100%</td>
                    </tr>
                </tbody>
            </table>
            <p class="note">Quantidades acumuladas históricas de entregas na balança (peso real).</p>`;
          })()
        : "";

    // Movement Summary
    const movRows = data.movementSummary
        .map(
            (m) => `<tr>
            <td class="td">${m.materialName}</td>
            <td class="td tc">${m.unit}</td>
            <td class="td tr" style="color:#16a34a;font-weight:500;">${formatNumber(m.totalEntradas)}</td>
            <td class="td tr" style="color:#dc2626;font-weight:500;">${formatNumber(m.totalSaidas)}</td>
            <td class="td tr">${m.valorEntradas > 0 ? formatCurrency(m.valorEntradas) : "—"}</td>
        </tr>`
        )
        .join("");

    const generatedAt = new Date().toLocaleString("pt-BR");

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Relatório de Estoque - ${data.period.label}</title>
<style>
    @media print {
        body { padding: 0; }
        @page { size: A4; margin: 12mm 10mm; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica','Arial',sans-serif; padding: 30px; color: #1f2937; font-size: 11px; max-width: 210mm; margin: 0 auto; }
    .header { border-bottom: 2.5px solid #1e3a5f; padding-bottom: 10px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
    .title { font-size: 18px; font-weight: bold; color: #1e3a5f; }
    .subtitle { font-size: 11px; color: #6b7280; margin-top: 1px; }
    .section { font-size: 13px; font-weight: bold; margin: 16px 0 8px; color: #1e3a5f; border-bottom: 1.5px solid #e5e7eb; padding-bottom: 4px; }
    .tbl { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    .th { text-align: left; padding: 6px 8px; border-bottom: 2px solid #1e3a5f; color: #fff; font-weight: 600; font-size: 10px; text-transform: uppercase; background: #1e3a5f; }
    .td { padding: 5px 8px; border-bottom: 1px solid #f3f4f6; color: #374151; font-size: 11px; }
    .tr { text-align: right; }
    .tc { text-align: center; }
    .note { font-size: 9px; color: #9ca3af; font-style: italic; margin-top: 2px; margin-bottom: 8px; }
    .footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 9px; color: #9ca3af; }
</style>
</head>
<body>
    <div class="header">
        <div>
            <div class="title">Relatório de Estoque</div>
            <div class="subtitle">Siderúrgica Bandeirante</div>
        </div>
        <div style="text-align:right;">
            <div style="font-weight:bold;font-size:14px;color:#1e3a5f;">${data.period.label}</div>
            <div style="font-size:9px;color:#9ca3af;">Gerado em: ${generatedAt}</div>
        </div>
    </div>

    <h2 class="section">Posição de Estoque</h2>
    <table class="tbl">
        <thead><tr>
            <th class="th">Material</th>
            <th class="th tc">Unidade</th>
            <th class="th tr">Estoque Atual</th>
            <th class="th">Fornecedor</th>
        </tr></thead>
        <tbody>
            ${positionRows || '<tr><td colspan="4" class="td tc" style="color:#9ca3af;">Nenhum material cadastrado.</td></tr>'}
        </tbody>
    </table>

    ${minerioHtml}

    ${data.movementSummary.length > 0 ? `
    <h2 class="section">Movimentações — ${data.period.label}</h2>
    <table class="tbl">
        <thead><tr>
            <th class="th">Material</th>
            <th class="th tc">Unidade</th>
            <th class="th tr">Entradas</th>
            <th class="th tr">Saídas</th>
            <th class="th tr">Valor Entradas</th>
        </tr></thead>
        <tbody>${movRows}</tbody>
    </table>` : ''}

    <div class="footer">Sistema Bandeirante — Gusa Intelligence</div>
</body>
</html>`;
}
