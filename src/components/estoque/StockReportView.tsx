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
            printWindow.onload = () => { setTimeout(() => { printWindow.print(); }, 300); };
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

    const { positions, movementSummary } = reportData;

    const formatNumber = (value: number) =>
        new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

    const minerioPosition = positions.find(
        (p) => p.supplierBreakdown && p.supplierBreakdown.length > 0
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
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

            {/* Posição de Estoque */}
            <div>
                <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                    <div className="p-1.5 bg-blue-100 rounded-md">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                    </div>
                    Posição de Estoque
                </h3>
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border bg-muted/50">
                                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Material</th>
                                <th className="text-center text-xs font-medium text-muted-foreground px-4 py-3">Unidade</th>
                                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Estoque Atual</th>
                                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Fornecedor</th>
                            </tr>
                        </thead>
                        <tbody>
                            {positions.sort((a, b) => b.currentStock - a.currentStock).map((p) => (
                                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                                    <td className="px-4 py-3 text-sm font-medium text-foreground">{p.name}</td>
                                    <td className="px-4 py-3 text-sm text-muted-foreground text-center">{p.unit}</td>
                                    <td className="px-4 py-3 text-sm text-right font-semibold text-foreground">{formatNumber(p.currentStock)}</td>
                                    <td className="px-4 py-3 text-sm text-muted-foreground">
                                        {p.supplierName ? (
                                            <span className="text-foreground">{p.supplierName}</span>
                                        ) : p.supplierBreakdown && p.supplierBreakdown.length > 0 ? (
                                            <span className="text-blue-500 font-medium text-xs">Ver detalhamento abaixo</span>
                                        ) : (
                                            <span className="italic">—</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Minério por Fornecedor */}
            {minerioPosition && minerioPosition.supplierBreakdown && minerioPosition.supplierBreakdown.length > 0 && (
                <div>
                    <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-100 rounded-md">
                            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        {minerioPosition.name} — Por Fornecedor
                    </h3>
                    <p className="text-xs text-muted-foreground mb-3">
                        Quantidade total entregue por fornecedor (acumulado histórico, peso real na balança).
                    </p>
                    <div className="bg-card border border-border rounded-lg overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border bg-muted/50">
                                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Fornecedor</th>
                                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Qtd. Entregue ({minerioPosition.unit})</th>
                                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">%</th>
                                </tr>
                            </thead>
                            <tbody>
                                {minerioPosition.supplierBreakdown.map((s) => {
                                    const total = minerioPosition.supplierBreakdown!.reduce((sum, x) => sum + x.quantity, 0);
                                    const pct = total > 0 ? (s.quantity / total) * 100 : 0;
                                    return (
                                        <tr key={s.supplierName} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-3 text-sm font-medium text-foreground">{s.supplierName}</td>
                                            <td className="px-4 py-3 text-sm text-right font-semibold text-foreground">{formatNumber(s.quantity)}</td>
                                            <td className="px-4 py-3 text-sm text-right text-muted-foreground">{formatNumber(pct)}%</td>
                                        </tr>
                                    );
                                })}
                                <tr className="bg-muted/30">
                                    <td className="px-4 py-3 text-sm font-bold text-foreground">Total</td>
                                    <td className="px-4 py-3 text-sm text-right font-bold text-foreground">
                                        {formatNumber(minerioPosition.supplierBreakdown.reduce((sum, x) => sum + x.quantity, 0))}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right font-bold text-muted-foreground">100%</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Resumo de Movimentações */}
            {movementSummary.length > 0 && (
                <div>
                    <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                        <div className="p-1.5 bg-green-100 rounded-md">
                            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                            </svg>
                        </div>
                        Movimentações — {reportData.period.label}
                    </h3>
                    <div className="bg-card border border-border rounded-lg overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border bg-muted/50">
                                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Material</th>
                                    <th className="text-center text-xs font-medium text-muted-foreground px-4 py-3">Unidade</th>
                                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Entradas</th>
                                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Saídas</th>
                                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Valor Entradas</th>
                                </tr>
                            </thead>
                            <tbody>
                                {movementSummary.map((m) => (
                                    <tr key={m.materialId} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3 text-sm font-medium text-foreground">{m.materialName}</td>
                                        <td className="px-4 py-3 text-sm text-muted-foreground text-center">{m.unit}</td>
                                        <td className="px-4 py-3 text-sm text-right font-medium text-green-500">{formatNumber(m.totalEntradas)} {m.unit}</td>
                                        <td className="px-4 py-3 text-sm text-right font-medium text-red-500">{formatNumber(m.totalSaidas)} {m.unit}</td>
                                        <td className="px-4 py-3 text-sm text-right text-foreground">{m.valorEntradas > 0 ? formatCurrency(m.valorEntradas) : "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
