import type { StockReportData } from "@/app/(authenticated)/estoque/report-actions";

export function generateStockReportHtml(data: StockReportData): string {
    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

    const formatNumber = (value: number, decimals = 2) =>
        new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);

    const movementTypeLabel = (type: string) => {
        const map: Record<string, string> = {
            compra: "Compra",
            consumo_producao: "Consumo Produção",
            venda: "Venda",
            ajuste: "Ajuste",
            producao_entrada: "Produção (entrada)",
        };
        return map[type] || type;
    };

    const statusBadge = (pos: { currentStock: number; minStockAlert: number | null; isLow: boolean }) => {
        if (pos.currentStock === 0) return '<span style="color: #dc2626; font-weight: bold;">SEM ESTOQUE</span>';
        if (pos.isLow) return '<span style="color: #d97706; font-weight: bold;">BAIXO</span>';
        return '<span style="color: #16a34a; font-weight: bold;">ADEQUADO</span>';
    };

    // Stock Position Rows
    const positionRows = data.positions
        .sort((a, b) => b.currentStock - a.currentStock)
        .map(
            (p) => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-weight: 500; color: #374151;">${p.name}</td>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; color: #6b7280; text-align: center;">${p.unit}</td>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; color: #374151; text-align: right; font-weight: 600; font-size: 15px;">${formatNumber(p.currentStock)}</td>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; color: #6b7280; text-align: right;">${p.minStockAlert !== null ? formatNumber(p.minStockAlert) : "—"}</td>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; text-align: center;">${statusBadge(p)}</td>
            </tr>`
        )
        .join("");

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

    // Movement Detail Rows (max 50)
    const movDetailRows = data.movements
        .slice(0, 50)
        .map(
            (m) => `
            <tr>
                <td style="padding: 8px 10px; border-bottom: 1px solid #f3f4f6; color: #6b7280; font-size: 11px;">${new Date(m.date + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #f3f4f6; color: #374151; font-size: 11px;">${m.materialName}</td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #f3f4f6; font-size: 11px; text-align: center;">
                    <span style="padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 500; ${m.movementType === "compra" ? "background-color: #dcfce7; color: #166534;" : "background-color: #fef2f2; color: #991b1b;"}">${movementTypeLabel(m.movementType)}</span>
                </td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #f3f4f6; text-align: right; font-size: 11px; font-weight: 500; color: ${m.movementType === "compra" ? "#16a34a" : "#dc2626"};">${formatNumber(Math.abs(m.quantity))}</td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #f3f4f6; text-align: right; font-size: 11px; color: #6b7280;">${m.totalValue ? formatCurrency(m.totalValue) : "—"}</td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #f3f4f6; font-size: 10px; color: #9ca3af; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${m.notes || "—"}</td>
            </tr>`
        )
        .join("");

    // Supplier Rows
    const activeSuppliers = data.suppliers.filter((s) => s.isActive);
    const supplierRows = activeSuppliers
        .map(
            (s) => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-weight: 500; color: #374151;">${s.name}</td>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; color: #6b7280;">${s.materialName}</td>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; color: #374151; text-align: right;">${s.defaultPrice ? formatCurrency(s.defaultPrice) : '<span style="color: #9ca3af; font-style: italic;">Variável</span>'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; text-align: center;">${s.hasIcms ? `<span style="color: #16a34a;">Sim (${s.icmsRate}%)</span>` : '<span style="color: #9ca3af;">Não</span>'}</td>
            </tr>`
        )
        .join("");

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
            .alert-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
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
                <div class="card-value" style="color: #2563eb;">${data.movements.length}</div>
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
                </tr>
            </thead>
            <tbody>
                ${positionRows || '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #9ca3af;">Nenhum material cadastrado.</td></tr>'}
            </tbody>
        </table>

        <!-- 2. RESUMO DE MOVIMENTAÇÕES -->
        <h2 class="section-title">2. Resumo de Movimentações — ${data.period.label}</h2>
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

        <!-- PAGE BREAK -->
        <div class="page-break"></div>

        <!-- 3. DETALHAMENTO DE MOVIMENTAÇÕES -->
        <h2 class="section-title">3. Detalhamento de Movimentações</h2>
        ${
            data.movements.length === 0
                ? '<p style="color: #9ca3af; text-align: center; padding: 20px;">Nenhuma movimentação registrada no período.</p>'
                : `
        <table class="table">
            <thead>
                <tr>
                    <th class="th">Data</th>
                    <th class="th">Material</th>
                    <th class="th th-center">Tipo</th>
                    <th class="th th-right">Quantidade</th>
                    <th class="th th-right">Valor</th>
                    <th class="th">Observação</th>
                </tr>
            </thead>
            <tbody>
                ${movDetailRows}
            </tbody>
        </table>
        ${data.movements.length > 50 ? '<p class="note">Exibindo as 50 movimentações mais recentes. Total no período: ' + data.movements.length + " registros.</p>" : ""}`
        }

        <!-- 4. FORNECEDORES -->
        <h2 class="section-title">4. Fornecedores Ativos</h2>
        ${
            activeSuppliers.length === 0
                ? '<p style="color: #9ca3af; text-align: center; padding: 20px;">Nenhum fornecedor ativo cadastrado.</p>'
                : `
        <table class="table">
            <thead>
                <tr>
                    <th class="th">Fornecedor</th>
                    <th class="th">Material</th>
                    <th class="th th-right">Preço Padrão</th>
                    <th class="th th-center">ICMS</th>
                </tr>
            </thead>
            <tbody>
                ${supplierRows}
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
