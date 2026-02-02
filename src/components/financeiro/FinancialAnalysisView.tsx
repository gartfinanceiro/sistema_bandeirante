"use client";

import { useState, useEffect } from 'react';
import { getExpensesReport, getEntriesReport, type FinancialReport } from '@/app/(authenticated)/financeiro/actions';
import { ExpenseDonutChart } from './ExpenseDonutChart';
import { CategoryExpenseList } from './CategoryExpenseList';

interface FinancialAnalysisViewProps {
    month: number;
    year: number;
}

export function FinancialAnalysisView({ month, year }: FinancialAnalysisViewProps) {
    const [expensesReport, setExpensesReport] = useState<FinancialReport | null>(null);
    const [entriesReport, setEntriesReport] = useState<FinancialReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        async function fetchReport() {
            setIsLoading(true);
            try {
                const [expData, entData] = await Promise.all([
                    getExpensesReport(month, year),
                    getEntriesReport(month, year)
                ]);

                if (isMounted) {
                    setExpensesReport(expData);
                    setEntriesReport(entData);
                }
            } catch (error) {
                console.error("Error loading financial report:", error);
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }

        fetchReport();

        return () => { isMounted = false; };
    }, [month, year]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 min-h-[400px]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                <p className="mt-4 text-muted-foreground text-sm">Carregando análise...</p>
            </div>
        );
    }

    if (!expensesReport || !entriesReport) {
        return (
            <div className="flex flex-col items-center justify-center py-20 min-h-[400px] text-center">
                <div className="bg-muted p-4 rounded-full mb-4">
                    <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                </div>
                <h3 className="text-lg font-medium text-foreground">Sem dados para o período</h3>
                <p className="text-muted-foreground max-w-sm mt-1">
                    Não há registro de despesas para o mês de {month}/{year}. As despesas aparecerão aqui automaticamente.
                </p>
            </div>
        );
    }

    const handleGeneratePDF = async () => {
        try {
            setIsLoading(true);
            const response = await fetch(`/api/financeiro/report-pdf?month=${month}&year=${year}`);

            if (!response.ok) {
                throw new Error("Falha ao gerar o relatório");
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Relatorio_Financeiro_${month}_${year}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error(error);
            alert("Erro ao gerar o PDF. Tente novamente.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header / Actions */}
            <div className="flex justify-end">
                <button
                    onClick={handleGeneratePDF}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                >
                    {isLoading ? (
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

            {/* Charts Section: Macro & Micro Views */}
            {/* =================================================================================
                SEÇÃO: ANÁLISE DE ENTRADAS
            ================================================================================= */}
            <div className="pt-4 pb-8 border-b border-gray-100">
                <div className="flex items-center gap-2 mb-6">
                    <div className="p-2 bg-green-100 rounded-lg">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Análise de Entradas</h2>
                        <p className="text-sm text-gray-500">Detalhamento das receitas do período</p>
                    </div>
                </div>

                {entriesReport.totalValue === 0 ? (
                    <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                        <p className="text-gray-500">Nenhuma entrada registrada neste período.</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            <ExpenseDonutChart
                                title="Entradas por Grande Grupo"
                                categories={entriesReport.macroCategories}
                                totalValue={entriesReport.totalValue}
                            />
                            <ExpenseDonutChart
                                title="Detalhamento por Categoria"
                                categories={entriesReport.categories}
                                totalValue={entriesReport.totalValue}
                            />
                        </div>

                        <CategoryExpenseList categories={entriesReport.categories} />
                    </>
                )}
            </div>

            {/* =================================================================================
                SEÇÃO: ANÁLISE DE DESPESAS
            ================================================================================= */}
            <div className="pt-4">
                <div className="flex items-center gap-2 mb-6">
                    <div className="p-2 bg-red-100 rounded-lg">
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Análise de Despesas</h2>
                        <p className="text-sm text-gray-500">Detalhamento dos gastos do período</p>
                    </div>
                </div>

                {expensesReport.totalValue === 0 ? (
                    <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                        <p className="text-gray-500">Nenhuma despesa registrada neste período.</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            <ExpenseDonutChart
                                title="Despesas por Grande Grupo"
                                categories={expensesReport.macroCategories}
                                totalValue={expensesReport.totalValue}
                            />
                            <ExpenseDonutChart
                                title="Detalhamento por Categoria"
                                categories={expensesReport.categories}
                                totalValue={expensesReport.totalValue}
                            />
                        </div>

                        <CategoryExpenseList categories={expensesReport.categories} />
                    </>
                )}
            </div>
        </div>
    );
}
