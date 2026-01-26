"use client";

import { useState } from 'react';
import { type ReportCategory } from '@/app/(authenticated)/financeiro/actions';

interface CategoryExpenseListProps {
    categories: ReportCategory[];
}

export function CategoryExpenseList({ categories }: CategoryExpenseListProps) {
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

    const toggleExpand = (id: string) => {
        setExpandedCategory(curr => curr === id ? null : id);
    };

    return (
        <div className="bg-background rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-muted/30">
                <h3 className="text-lg font-semibold text-foreground">Detalhamento por Categoria</h3>
            </div>

            <div className="divide-y divide-border">
                {categories.map((cat) => {
                    const isExpanded = expandedCategory === cat.id;
                    const barWidth = `${Math.max(cat.percentage, 1)}%`; // Min width for visibility

                    return (
                        <div key={cat.id} className="group transition-colors hover:bg-muted/10">
                            {/* Header / Summary Row */}
                            <button
                                onClick={() => toggleExpand(cat.id)}
                                className="w-full flex items-center justify-between px-6 py-4 text-left focus:outline-none"
                            >
                                <div className="flex-1 min-w-0 pr-4">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-medium text-foreground truncate">{cat.name}</span>
                                        <span className="text-sm font-semibold text-foreground">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cat.total)}
                                        </span>
                                    </div>

                                    {/* Progress Bar & Percentage */}
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary/80 rounded-full"
                                                style={{ width: barWidth }}
                                            />
                                        </div>
                                        <span className="text-xs text-muted-foreground w-12 text-right">
                                            {cat.percentage.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                                <div className="ml-2 text-muted-foreground group-hover:text-foreground">
                                    <svg
                                        className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </button>

                            {/* Expanded Content (Transactions List) */}
                            {isExpanded && (
                                <div className="px-6 pb-4 animate-in slide-in-from-top-2 duration-200">
                                    <div className="bg-muted/30 rounded-lg border border-border overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/50 text-muted-foreground">
                                                <tr>
                                                    <th className="px-4 py-2 text-left font-medium">Data</th>
                                                    <th className="px-4 py-2 text-left font-medium">Descrição</th>
                                                    <th className="px-4 py-2 text-right font-medium">Valor</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/50">
                                                {cat.transactions.map((tx) => (
                                                    <tr key={tx.id} className="hover:bg-muted/20">
                                                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                                                            {new Date(tx.date).toLocaleDateString('pt-BR')}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-foreground">
                                                            {tx.description}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right font-medium text-foreground whitespace-nowrap">
                                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(tx.amount)}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {cat.transactions.length === 0 && (
                                                    <tr>
                                                        <td colSpan={3} className="px-4 py-4 text-center text-muted-foreground">
                                                            Nenhuma transação encontrada.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {categories.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                        Nenhuma despesa registrada neste período.
                    </div>
                )}
            </div>
        </div>
    );
}
