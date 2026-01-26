"use client";

import { ArrowDownIcon, ArrowUpIcon, ScaleIcon } from "lucide-react";

interface FiscalKPICardsProps {
    credits: number;
    debits: number;
    balance: number;
    status: "credor" | "devedor";
}

export function FiscalKPICards({ credits, debits, balance, status }: FiscalKPICardsProps) {
    const formatCurrency = (val: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Credits Card (Green) */}
            <div className="bg-background rounded-xl border border-border p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <ArrowUpIcon className="w-24 h-24 text-emerald-500" />
                </div>
                <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Créditos Gerados</h3>
                    <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-2xl font-bold text-emerald-600">
                            {formatCurrency(credits)}
                        </span>
                        <span className="text-xs font-medium text-emerald-600 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                            Entradas
                        </span>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                    ICMS sobre compras de insumos
                </p>
            </div>

            {/* Debits Card (Red) */}
            <div className="bg-background rounded-xl border border-border p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <ArrowDownIcon className="w-24 h-24 text-rose-500" />
                </div>
                <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Débitos Gerados</h3>
                    <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-2xl font-bold text-rose-600">
                            {formatCurrency(debits)}
                        </span>
                        <span className="text-xs font-medium text-rose-600 bg-rose-100 dark:bg-rose-950 px-2 py-0.5 rounded-full">
                            Saídas
                        </span>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                    ICMS sobre vendas de gusa
                </p>
            </div>

            {/* Balance Card (Dynamic) */}
            <div className={`rounded-xl border p-6 shadow-sm flex flex-col justify-between relative overflow-hidden ${status === "credor"
                    ? "bg-slate-900 border-slate-800 text-white"
                    : "bg-white border-rose-200 text-foreground"
                }`}>
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <ScaleIcon className={`w-24 h-24 ${status === "credor" ? "text-white" : "text-rose-500"}`} />
                </div>
                <div>
                    <h3 className={`text-sm font-medium ${status === "credor" ? "text-slate-400" : "text-muted-foreground"}`}>
                        Saldo de ICMS
                    </h3>
                    <div className="flex items-baseline gap-2 mt-2">
                        <span className={`text-2xl font-bold ${status === "credor" ? "text-emerald-400" : "text-rose-600"}`}>
                            {formatCurrency(Math.abs(balance))}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status === "credor"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-rose-100 text-rose-600"
                            }`}>
                            {status === "credor" ? "Saldo Credor" : "Saldo Devedor"}
                        </span>
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${status === "credor" ? "bg-emerald-500" : "bg-rose-500"}`} />
                    <p className={`text-xs ${status === "credor" ? "text-slate-300" : "text-muted-foreground"}`}>
                        {status === "credor"
                            ? "A Compensar nos próximos meses"
                            : "A Pagar (Vencimento dia 20)"}
                    </p>
                </div>
            </div>
        </div>
    );
}
