import type { StockReportData } from "@/app/(authenticated)/estoque/report-actions";

export function generateStockReportHtml(data: StockReportData): string {
    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

    const formatNumber = (value: number, decimals = 2) =>
        new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);

    const statusBadge = (pos: { currentStock: number; minStockAlert: number | null; isLow: boolean }) => {
        if (pos.currentStock === 0) return '<span style="color: #dc2626; font-weight: bold;">SEM ESTOQUE</span>';
        if (pos.isLow) return '<span style="color: #d97706; font-weight: bold;">BAIXO</span>';
        return '<span style="color: #16a34a; font-weight: bold;">ADEQUADO</span>';
    };

    // Stock Position Rows — with supplier info inline
    const positionRows = data.positions
        .sort((a, b) => b.currentStock - a.currentStock)
        .map((p) => {
            // Supplier column content
            let supplierCell = '<span style="color: #9ca3af; font-style: italic;">—</span>';
            if (p.supplierName) {
                supplierCell = `<span style="color: #374151;">${p.supplierName}</span>`;
            } else if (p.supplierBreakdown && p.supplierBreakdown.length > 0) {
                // For minério: show "Vários" with a note that detail is below
                supplierCell = '<span style="color: #2563eb; font-weight: 500;">Detalhado abaixo</span>';
            }

            return `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-weight: 500; color: #374151;">${p.name}</td>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; color: #6b7280; text-align: center;">${p.unit}</td>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; color: #374151; text-align: right; font-weight: 600; font-size: 15px;">${formatNumber(p.currentStock)}</td>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; color: #6b7280; text-align: right;">${p.minStockAlert !== null ? formatNumber(p.minStockAlert) : "—"}</td>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; text-align: center;">${statusBadge(p)}</td>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; text-align: left;">${supplierCell}</td>
            </tr>`;
        })
        .join("");

    // Minério supplier breakdown section
    const minerioPosition = data.positions.find(
        (p) => p.supplierBreakdown && p.supplierBreakdown.length > 0
    );

    const minerioBreakdownHtml = minerioPosition
        ? `
        <h2 class="section-title">2. Detalhamento — ${minerioPosition.name} por Fornecedor</h2>
        <p style="color: #6b7280; font-size: 12px; margin-bottom: 12px;">
            Quantidade total entregue por cada fornecedor (acumulado histórico de entregas na balança).
        </p>
        <table class="table">
            <thead>
                <tr>
                    <th class="th">Fornecedor</th>
                    <th class="th th-right">Quantidade Entregue (${minerioPosition.unit})</th>
                    <th class="th th-right">% do Total</th>
                </tr>
            </thead>
            <tbody>
                ${minerioPosition.supplierBreakdown!
                    .map((s) => {
                        const total = minerioPosition.supplierBreakdown!.reduce((sum, x) => sum + x.quantity, 0);
                        const pct = total > 0 ? (s.quantity / total) * 100 : 0;
                        return `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-weight: 500; color: #374151;">${s.supplierName}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; color: #374151; text-align: right; font-weight: 600;">${formatNumber(s.quantity)}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; color: #6b7280; text-align: right;">${formatNumber(pct, 1)}%</td>
                    </tr>`;
                    })
                    .join("")}
                <tr style="background-color: #f9fafb;">
                    <td style="padding: 10px; font-weight: bold; color: #1e3a5f;">Total</td>
                    <td style="padding: 10px; font-weight: bold; color: #1e3a5f; text-align: right;">${formatNumber(minerioPosition.supplierBreakdown!.reduce((sum, x) => sum + x.quantity, 0))}</td>
                    <td style="padding: 10px; font-weight: bold; color: #1e3a5f; text-align: right;">100%</td>
                </tr>
            </tbody>
        </table>
        <p class="note">Nota: As quantidades refletem o total entregue na balança (peso real). O estoque atual pode diferir devido a consumo na produção.</p>
        `
        : "";

    // Movement Summary Rows
    const movSummaryRows = data.movementSummary
        .map(
            (m) => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-weight: 500; color: #374151;">${m.materialName}</td>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; color: #6b7280; text-align: center;">${m.unit}</td>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; color: #16a34a; text-align: right; font-weight: 500;">${formatNumber(m.totalEntradas)}</td>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; color: #dc2626; text-align: right; font-weight: 500;">${formatNumber(m.totalSaidas)}</td>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; color: #374151; text-align: right;">${m.valorEntradas > 0 ? formatCurrency(m.valorEntradas) : "—"}</td>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; color: #6b7280; text-align: center;">${m.movementCount}</td>
            </tr>`
        )
        .join("");

    // Section numbering adjusts based on whether minério breakdown exists
    const movSectionNum = minerioPosition ? 3 : 2;

    const generatedAt = new Date().toLocaleString("pt-BR");

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Relatório de Estoque - ${data.period.label}</title>
        <style>
            @media print {
                body { padding: 15px; }
                @page { size: A4; margin: 12mm; }
                .page-break { page-break-before: always; }
            }
            body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px; color: #1f2937; max-width: 210mm; margin: 0 auto; font-size: 13px; }
            .header { border-bottom: 3px solid #1e3a5f; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
            .title { font-size: 22px; font-weight: bold; color: #1e3a5f; margin: 0; }
            .subtitle { font-size: 13px; color: #6b7280; margin-top: 2px; }
            .section-title { font-size: 16px; font-weight: bold; margin-top: 28px; margin-bottom: 12px; color: #1e3a5f; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; }
            .table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            .th { text-align: left; padding: 10px; border-bottom: 2px solid #1e3a5f; color: #ffffff; font-weight: 600; font-size: 11px; text-transform: uppercase; background-color: #1e3a5f; }
            .th-right { text-align: right; }
            .th-center { text-align: center; }
            .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
            .card { padding: 14px; border-radius: 8px; border: 1px solid #e5e7eb; }
            .card-label { font-size: 11px; font-weight: 500; color: #6b7280; margin-bottom: 4px; text-transform: uppercase; }
            .card-value { font-size: 20px; font-weight: bold; color: #1e3a5f; }
            .note { font-size: 10px; color: #9ca3af; font-style: italic; margin-top: 4px; }
            .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 10px; color: #9ca3af; }
        </style>
    </head>
    <body>
        <div class="header">
            <div>
                <h1 class="title">Relatório de Estoque</h1>
                <p class="subtitle">Siderúrgica Bandeirante — Sistema Bandeirante</p>
            </div>
            <div style="text-align: right;">
                <div style="font-weight: bold; font-size: 16px; color: #1e3a5f;">${data.period.label}</div>
                <div style="font-size: 10px; color: #9ca3af;">Gerado em: ${generatedAt}</div>
            </div>
        </div>

        <!-- KPI Cards -->
        <div class="summary-grid">
            <div class="card" style="background-color: #f0fdf4; border-color: #bbf7d0;">
                <div class="card-label" style="color: #166534;">Materiais Ativos</div>
                <div class="card-value" style="color: #16a34a;">${data.positions.length}</div>
            </div>
            <div class="card" style="background-color: #fef3c7; border-color: #fde68a;">
                <div class="card-label" style="color: #92400e;">Alertas de Estoque</div>
                <div class="card-value" style="color: #d97706;">${data.positions.filter((p) => p.isLow || p.currentStock === 0).length}</div>
            </div>
            <div class="card" style="background-color: #eff6ff; border-color: #bfdbfe;">
                <div class="card-label" style="color: #1e40af;">Movimentações no Período</div>
                <div class="card-value" style="color: #2563eb;">${data.movementSummary.reduce((sum, m) => sum + m.movementCount, 0)}</div>
            </div>
        </div>

        <!-- 1. POSIÇÃO ATUAL -->
        <h2 class="section-title">1. Posição de Estoque Atual</h2>
        <table class="table">
            <thead>
                <tr>
                    <th class="th">Material</th>
                    <th class="th th-center">Unidade</th>
                    <th class="th th-right">Estoque Atual</th>
                    <th class="th th-right">Nível Mínimo</th>
                    <th class="th th-center">Status</th>
                    <th class="th">Fornecedor</th>
                </tr>
            </thead>
            <tbody>
                ${positionRows || '<tr><td colspan="6" style="padding: 20px; text-align: center; color: #9ca3af;">Nenhum material cadastrado.</td></tr>'}
            </tbody>
        </table>

        <!-- 2. DETALHAMENTO MINÉRIO POR FORNECEDOR (conditional) -->
        ${minerioBreakdownHtml}

        <!-- RESUMO DE MOVIMENTAÇÕES -->
        <h2 class="section-title">${movSectionNum}. Resumo de Movimentações — ${data.period.label}</h2>
        ${
            data.movementSummary.length === 0
                ? '<p style="color: #9ca3af; text-align: center; padding: 20px;">Nenhuma movimentação registrada no período.</p>'
                : `
        <table class="table">
            <thead>
                <tr>
                    <th class="th">Material</th>
                    <th class="th th-center">Unidade</th>
                    <th class="th th-right">Entradas</th>
                    <th class="th th-right">Saídas</th>
                    <th class="th th-right">Valor Entradas</th>
                    <th class="th th-center">Nº Mov.</th>
                </tr>
            </thead>
            <tbody>
                ${movSummaryRows}
            </tbody>
        </table>`
        }

        <div class="footer">
            Relatório gerado automaticamente pelo Sistema Bandeirante — Gusa Intelligence
        </div>
    </body>
    </html>
    `;
}
