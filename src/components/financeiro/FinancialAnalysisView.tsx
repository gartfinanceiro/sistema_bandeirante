"use client";

import { useState, useEffect } from 'react';
import { getExpensesReport, type ExpenseReport } from '@/app/(authenticated)/financeiro/actions';
import { ExpenseDonutChart } from './ExpenseDonutChart';
import { CategoryExpenseList } from './CategoryExpenseList';

interface FinancialAnalysisViewProps {
    month: number;
    year: number;
}

export function FinancialAnalysisView({ month, year }: FinancialAnalysisViewProps) {
    const [report, setReport] = useState<ExpenseReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        async function fetchReport() {
            setIsLoading(true);
            try {
                const data = await getExpensesReport(month, year);
                if (isMounted) {
                    setReport(data);
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

    if (!report || report.categories.length === 0) {
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

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Charts Section: Macro & Micro Views */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Macro View: Cost Centers */}
                <ExpenseDonutChart
                    title="Despesas por Grande Grupo"
                    categories={report.macroCategories}
                    totalExpenses={report.totalExpenses}
                />

                {/* Micro View: Categories */}
                <ExpenseDonutChart
                    title="Detalhamento por Categoria"
                    categories={report.categories}
                    totalExpenses={report.totalExpenses}
                />
            </div>

            {/* Bottom Section: Accordion List */}
            <CategoryExpenseList
                categories={report.categories}
            />
        </div>
    );
}
