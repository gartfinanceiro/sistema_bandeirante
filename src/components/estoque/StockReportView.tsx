"use client";

import { useState, useEffect } from "react";
import { getStockReportData, type StockReportData } from "@/app/(authenticated)/estoque/report-actions";
import { generateStockReportHtml } from "./pdf/generateStockReportHtml";

export function StockReportView() {
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [reportData, setReportData] = useState<StockReportData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    // Generate month options (last 12 months)
    const monthOptions: { value: string; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const value = `${d.getFullYear()}-${d.getMonth() + 1}`;
        const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
        monthOptions.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }

    useEffect(() => {
        let isMounted = true;

        async function fetchReport() {
            setIsLoading(true);
            try {
                const data = await getStockReportData(month, year);
                if (isMounted) setReportData(data);
            } catch (error) {
                console.error("Error loading stock report:", error);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        }

        fetchReport();
        return () => { isMounted = false; };
    }, [month, year]);

    const handleGeneratePDF = async () => {
        if (!reportData) return;
        try {
            setIsGeneratingPdf(true);

            const htmlContent = generateStockReportHtml(reportData);

            const printWindow = window.open("", "_blank");
            if (!printWindow) {
                alert("Permita pop-ups para gerar o PDF.");
                return;
            }

            printWindow.document.write(htmlContent);
            printWindow.document.close();

            printWindow.onload = () => {
                setTimeout(() => { printWindow.print(); }, 300);
            };
            setTimeout(() => { printWindow.print(); }, 1000);
        } catch (error) {
            console.error(error);
            alert("Erro ao gerar o PDF. Tente novamente.");
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 min-h-[400px]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                <p className="mt-4 text-muted-foreground text-sm">Carregando relatório...</p>
            </div>
        );
    }

    if (!reportData) {
        return (
            <div className="flex flex-col items-center justify-center py-20 min-h-[400px] text-center">
                <h3 className="text-lg font-medium text-foreground">Erro ao carregar dados</h3>
                <p className="text-muted-foreground max-w-sm mt-1">Tente novamente em alguns instantes.</p>
            </div>
        );
    }

    const { positions, movementSummary, movements, suppliers } = reportData;
    const activeSuppliers = suppliers.filter((s) => s.isActive);
    const alerts = positions.filter((p) => p.isLow || p.currentStock === 0);

    const formatNumber = (value: number) =>
        new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

    const movementTypeLabel = (type: string) => {
        const map: Record<string, string> = {
            compra: "Compra",
            consumo_producao: "Consumo",
            venda: "Venda",
            ajuste: "Ajuste",
            producao_entrada: "Produção",
        };
        return map[type] || type;
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header / Actions */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">Relatório de Estoque</h2>
                        <p className="text-sm text-muted-foreground">{reportData.period.label}</p>
                    </div>
                    <select
                        value={`${year}-${month}`}
                        onChange={(e) => {
                            const [y, m] = e.target.value.split("-");
                            setYear(parseInt(y));
                            setMonth(parseInt(m));
                        }}
                        className="h-9 px-3 rounded-md border border-border bg-background text-foreground text-sm"
                    >
                        {monthOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
                <button
                    onClick={handleGeneratePDF}
                    disabled={isGeneratingPdf}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                >
                    {isGeneratingPdf ? (
                        <>
                            <div className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full" />
                            Gerando PDF...
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Gerar PDF
                        </>
                    )}
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-card border border-border rounded-lg p-5">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Materiais Ativos</p>
                    <p className="text-2xl font-bold text-primary mt-1">{positions.length}</p>
                </div>
                <div className={`bg-card border rounded-lg p-5 ${alerts.length > 0 ? "border-amber-500/50 bg-amber-500/5" : "border-border"}`}>
                    <p className="text-xs font-medium text-muted-foreground uppercase">Alertas de Estoque</p>
                    <p className={`text-2xl font-bold mt-1 ${alerts.length > 0 ? "text-amber-500" : "text-primary"}`}>{alerts.length}</p>
                    {alerts.length > 0 && (
                        <p className="text-xs text-amber-600 mt-1">{alerts.map((a) => a.name).join(", ")}</p>
                    )}
                </div>
                <div className="bg-card border border-border rounded-lg p-5">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Movimentações no Período</p>
                    <p className="text-2xl font-bold text-primary mt-1">{movements.length}</p>
                </div>
            </div>

            {/* Posição de Estoque */}
            <div>
                <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                    <div className="p-1.5 bg-blue-100 rounded-md">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                    </div>
                    Posição Atual
                </h3>
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border bg-muted/50">
                                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Material</th>
                                <th className="text-center text-xs font-medium text-muted-foreground px-4 py-3">Unidade</th>
                                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Estoque Atual</th>
                                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Nível Mínimo</th>
                                <th className="text-center text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {positions.sort((a, b) => b.currentStock - a.currentStock).map((p) => (
                                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                                    <td className="px-4 py-3 text-sm font-medium text-foreground">{p.name}</td>
                                    <td className="px-4 py-3 text-sm text-muted-foreground text-center">{p.unit}</td>
                                    <td className="px-4 py-3 text-sm text-right font-semibold text-foreground">{formatNumber(p.currentStock)}</td>
                                    <td className="px-4 py-3 text-sm text-right text-muted-foreground">{p.minStockAlert !== null ? formatNumber(p.minStockAlert) : "—"}</td>
                                    <td className="px-4 py-3 text-center">
                                        {p.currentStock === 0 ? (
                                            <span className="px-2 py-1 rounded text-xs font-medium bg-red-500/20 text-red-500">Sem Estoque</span>
                                        ) : p.isLow ? (
                                            <span className="px-2 py-1 rounded text-xs font-medium bg-amber-500/20 text-amber-500">Baixo</span>
                                        ) : (
                                            <span className="px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-500">Adequado</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Resumo de Movimentações */}
            <div>
                <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                    <div className="p-1.5 bg-green-100 rounded-md">
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                        </svg>
                    </div>
                    Movimentações — {reportData.period.label}
                </h3>
                {movementSummary.length === 0 ? (
                    <div className="bg-card border border-border rounded-lg p-8 text-center">
                        <p className="text-muted-foreground">Nenhuma movimentação no período</p>
                    </div>
                ) : (
                    <div className="bg-card border border-border rounded-lg overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border bg-muted/50">
                                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Material</th>
                                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Entradas</th>
                                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Saídas</th>
                                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Valor Entradas</th>
                                    <th className="text-center text-xs font-medium text-muted-foreground px-4 py-3">Nº Mov.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {movementSummary.map((m) => (
                                    <tr key={m.materialId} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3 text-sm font-medium text-foreground">{m.materialName}</td>
                                        <td className="px-4 py-3 text-sm text-right font-medium text-green-500">{formatNumber(m.totalEntradas)} {m.unit}</td>
                                        <td className="px-4 py-3 text-sm text-right font-medium text-red-500">{formatNumber(m.totalSaidas)} {m.unit}</td>
                                        <td className="px-4 py-3 text-sm text-right text-foreground">{m.valorEntradas > 0 ? formatCurrency(m.valorEntradas) : "—"}</td>
                                        <td className="px-4 py-3 text-sm text-center text-muted-foreground">{m.movementCount}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Últimas Movimentações */}
            {movements.length > 0 && (
                <div>
                    <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                        <div className="p-1.5 bg-purple-100 rounded-md">
                            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                        </div>
                        Últimas Movimentações
                    </h3>
                    <div className="bg-card border border-border rounded-lg overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border bg-muted/50">
                                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Data</th>
                                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Material</th>
                                    <th className="text-center text-xs font-medium text-muted-foreground px-4 py-3">Tipo</th>
                                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Quantidade</th>
                                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Valor</th>
                                </tr>
                            </thead>
                            <tbody>
                                {movements.slice(0, 20).map((m) => (
                                    <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{new Date(m.date + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                                        <td className="px-4 py-2.5 text-xs text-foreground">{m.materialName}</td>
                                        <td className="px-4 py-2.5 text-center">
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${m.movementType === "compra" ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"}`}>
                                                {movementTypeLabel(m.movementType)}
                                            </span>
                                        </td>
                                        <td className={`px-4 py-2.5 text-xs text-right font-medium ${m.movementType === "compra" ? "text-green-500" : "text-red-500"}`}>
                                            {formatNumber(Math.abs(m.quantity))}
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-right text-muted-foreground">
                                            {m.totalValue ? formatCurrency(m.totalValue) : "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {movements.length > 20 && (
                            <div className="px-4 py-2 text-xs text-muted-foreground text-center border-t border-border bg-muted/30">
                                Exibindo 20 de {movements.length} movimentações. O PDF contém o relatório completo.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Fornecedores */}
            <div>
                <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                    <div className="p-1.5 bg-orange-100 rounded-md">
                        <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                    Fornecedores Ativos ({activeSuppliers.length})
                </h3>
                {activeSuppliers.length === 0 ? (
                    <div className="bg-card border border-border rounded-lg p-8 text-center">
                        <p className="text-muted-foreground">Nenhum fornecedor ativo</p>
                    </div>
                ) : (
                    <div className="bg-card border border-border rounded-lg overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border bg-muted/50">
                                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Fornecedor</th>
                                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Material</th>
                                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Preço Padrão</th>
                                    <th className="text-center text-xs font-medium text-muted-foreground px-4 py-3">ICMS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activeSuppliers.map((s) => (
                                    <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3 text-sm font-medium text-foreground">{s.name}</td>
                                        <td className="px-4 py-3 text-sm text-muted-foreground">{s.materialName}</td>
                                        <td className="px-4 py-3 text-sm text-right text-foreground">{s.defaultPrice ? formatCurrency(s.defaultPrice) : <span className="text-muted-foreground italic">Variável</span>}</td>
                                        <td className="px-4 py-3 text-sm text-center">{s.hasIcms ? <span className="text-green-500">Sim ({s.icmsRate}%)</span> : <span className="text-muted-foreground">Não</span>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
