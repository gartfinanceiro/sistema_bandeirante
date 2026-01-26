"use client";

import { type FiscalItem } from "@/app/(authenticated)/financeiro/fiscal-actions";

interface FiscalExtractTableProps {
    items: FiscalItem[];
}

export function FiscalExtractTable({ items }: FiscalExtractTableProps) {
    if (items.length === 0) {
        return (
            <div className="bg-background rounded-xl border border-border p-12 text-center">
                <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                </div>
                <h3 className="text-lg font-medium text-foreground">Sem lançamentos fiscais</h3>
                <p className="text-muted-foreground mt-1">
                    Não houve movimentação de crédito ou débito de ICMS neste período.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-background rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-muted/30">
                <h3 className="text-lg font-semibold text-foreground">Extrato Fisal Detalhado</h3>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                            <th className="px-6 py-3 text-left font-medium">Data</th>
                            <th className="px-6 py-3 text-left font-medium">Tipo</th>
                            <th className="px-6 py-3 text-left font-medium">Entidade</th>
                            <th className="px-6 py-3 text-right font-medium">Base de Cálculo</th>
                            <th className="px-6 py-3 text-right font-medium">Alíquota</th>
                            <th className="px-6 py-3 text-right font-medium">Valor ICMS</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {items.map((item) => (
                            <tr key={`${item.type}-${item.id}`} className="hover:bg-muted/20 transition-colors">
                                <td className="px-6 py-3 whitespace-nowrap text-muted-foreground">
                                    {new Date(item.date).toLocaleDateString("pt-BR")}
                                </td>
                                <td className="px-6 py-3">
                                    {item.type === "credito" ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                            Crédito
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                            Débito
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-3 text-foreground font-medium">
                                    {item.entityName}
                                    <div className="text-xs text-muted-foreground font-normal">
                                        {item.description} • <span className="capitalize">{item.status.replace("_", " ")}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-3 text-right text-muted-foreground">
                                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.baseValue)}
                                </td>
                                <td className="px-6 py-3 text-right text-muted-foreground">
                                    {item.aliquota.toFixed(2)}%
                                </td>
                                <td className={`px-6 py-3 text-right font-medium ${item.type === "credito" ? "text-emerald-600" : "text-rose-600"
                                    }`}>
                                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.icmsValue)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
