"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import {
    getClosingData,
    closeCashDay,
    getClosingHistory,
    type ClosingData,
    type ClosingHistoryRow,
} from "./actions";

function formatCurrency(value: number): string {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(value);
}

function formatDate(dateString: string): string {
    return new Date(dateString + "T00:00:00").toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
    });
}

export default function FechamentoPage() {
    const [isPending, startTransition] = useTransition();
    const [isLoading, setIsLoading] = useState(true);
    const [closingData, setClosingData] = useState<ClosingData | null>(null);
    const [history, setHistory] = useState<ClosingHistoryRow[]>([]);

    // Form state
    const [realBalance, setRealBalance] = useState<string>("");
    const [justification, setJustification] = useState("");
    const [initialBalance, setInitialBalance] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [data, historyData] = await Promise.all([
                getClosingData(),
                getClosingHistory(10),
            ]);
            setClosingData(data);
            setHistory(historyData);

            // Pre-fill real balance if calculated = 0 (for testing)
            if (data.calculatedBalance > 0) {
                setRealBalance(data.calculatedBalance.toFixed(2));
            }
        } catch (err) {
            console.error("Error loading data:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Calculate difference
    const realBalanceNum = parseFloat(realBalance) || 0;
    const openingBalanceNum = closingData?.isFirstDay
        ? (parseFloat(initialBalance) || 0)
        : (closingData?.openingBalance || 0);
    const calculatedBalanceNum = openingBalanceNum + (closingData?.totalEntries || 0) - (closingData?.totalExits || 0);
    const difference = realBalanceNum - calculatedBalanceNum;
    const hasDifference = Math.abs(difference) > 0.01;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (hasDifference && !justification.trim()) {
            setError("Justificativa obrigatória quando há diferença");
            return;
        }

        const formData = new FormData();
        formData.set("date", closingData?.date || "");
        formData.set("openingBalance", openingBalanceNum.toString());
        formData.set("totalEntries", (closingData?.totalEntries || 0).toString());
        formData.set("totalExits", (closingData?.totalExits || 0).toString());
        formData.set("calculatedBalance", calculatedBalanceNum.toString());
        formData.set("realBalance", realBalanceNum.toString());
        formData.set("justification", justification);
        formData.set("isFirstDay", closingData?.isFirstDay ? "true" : "false");

        startTransition(async () => {
            const result = await closeCashDay(formData);
            if (result.success) {
                setSuccess(true);
                loadData();
            } else {
                setError(result.error || "Erro ao fechar caixa");
            }
        });
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="animate-spin w-8 h-8 mx-auto border-2 border-primary border-t-transparent rounded-full" />
                    <p className="text-muted-foreground mt-4">Carregando...</p>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="max-w-2xl mx-auto py-12">
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-8 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                        <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-green-400 mb-2">
                        Caixa Fechado com Sucesso!
                    </h2>
                    <p className="text-muted-foreground mb-6">
                        O fechamento de {formatDate(closingData?.date || "")} foi registrado.
                    </p>
                    <div className="flex gap-4 justify-center">
                        <Link
                            href="/financeiro"
                            className="px-4 py-2 rounded-md border border-border text-foreground hover:bg-accent transition-colors"
                        >
                            Voltar ao Financeiro
                        </Link>
                        <button
                            onClick={() => {
                                setSuccess(false);
                                setRealBalance("");
                                setJustification("");
                                loadData();
                            }}
                            className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                            Novo Fechamento
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <Link
                        href="/financeiro"
                        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Voltar
                    </Link>
                    <h1 className="text-2xl font-bold text-foreground">Fechamento de Caixa</h1>
                    <p className="text-muted-foreground mt-1">
                        {formatDate(closingData?.date || "")}
                    </p>
                </div>
            </div>

            {/* Main Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Opening Balance */}
                <div className="bg-card border border-border rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-foreground">Saldo Inicial</h3>
                        {!closingData?.isFirstDay && (
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                Fechamento anterior: {closingData?.previousClosingDate}
                            </span>
                        )}
                    </div>

                    {closingData?.isFirstDay ? (
                        <div className="space-y-2">
                            <p className="text-sm text-yellow-400 mb-4">
                                ⚠ Primeiro uso do sistema. Digite o saldo inicial:
                            </p>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={initialBalance}
                                    onChange={(e) => setInitialBalance(e.target.value)}
                                    className="w-full h-14 pl-12 pr-4 text-2xl font-bold rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                    placeholder="0,00"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="h-14 px-4 flex items-center justify-between bg-muted/50 rounded-lg border border-border">
                            <span className="text-muted-foreground">Saldo bloqueado (dia anterior)</span>
                            <span className="text-2xl font-bold text-foreground">
                                {formatCurrency(closingData?.openingBalance || 0)}
                            </span>
                        </div>
                    )}
                </div>

                {/* Day Summary */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6">
                        <p className="text-sm text-green-400 mb-2">Entradas do Dia</p>
                        <p className="text-3xl font-bold text-green-400">
                            + {formatCurrency(closingData?.totalEntries || 0)}
                        </p>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6">
                        <p className="text-sm text-red-400 mb-2">Saídas do Dia</p>
                        <p className="text-3xl font-bold text-red-400">
                            - {formatCurrency(closingData?.totalExits || 0)}
                        </p>
                    </div>
                </div>

                {/* Calculated Balance */}
                <div className="bg-card border border-border rounded-lg p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">Saldo Calculado</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Inicial + Entradas - Saídas
                            </p>
                        </div>
                        <p className="text-3xl font-bold text-primary">
                            {formatCurrency(calculatedBalanceNum)}
                        </p>
                    </div>
                </div>

                {/* Real Balance Input */}
                <div className="bg-card border-2 border-primary/50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">
                        Conferência Física
                    </h3>
                    <div className="space-y-2">
                        <label className="text-sm text-muted-foreground">
                            Digite o saldo real em conta/cofre:
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">R$</span>
                            <input
                                type="number"
                                step="0.01"
                                value={realBalance}
                                onChange={(e) => setRealBalance(e.target.value)}
                                required
                                className="w-full h-16 pl-14 pr-4 text-3xl font-bold rounded-lg border-2 border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                                placeholder="0,00"
                            />
                        </div>
                    </div>
                </div>

                {/* Difference Display */}
                {realBalance && (
                    <div
                        className={`rounded-lg p-6 transition-all ${!hasDifference
                                ? "bg-green-500/10 border-2 border-green-500/50"
                                : "bg-red-500/10 border-2 border-red-500/50"
                            }`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {!hasDifference ? (
                                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                        <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                                        <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    </div>
                                )}
                                <div>
                                    <p className={`font-semibold ${!hasDifference ? "text-green-400" : "text-red-400"}`}>
                                        {!hasDifference ? "Caixa Batendo!" : "Diferença Detectada"}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Diferença: {formatCurrency(difference)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {hasDifference && (
                            <div className="mt-4 space-y-2">
                                <label className="text-sm font-medium text-red-400">
                                    Justificativa obrigatória:
                                </label>
                                <textarea
                                    value={justification}
                                    onChange={(e) => setJustification(e.target.value)}
                                    required={hasDifference}
                                    rows={3}
                                    placeholder="Explique a diferença encontrada..."
                                    className="w-full px-3 py-2 rounded-md border border-red-500/30 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none"
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
                        {error}
                    </div>
                )}

                {/* Submit */}
                <button
                    type="submit"
                    disabled={isPending || !realBalance}
                    className="w-full h-14 rounded-lg bg-primary text-primary-foreground text-lg font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {isPending ? "Fechando Caixa..." : "Fechar Caixa do Dia"}
                </button>
            </form>

            {/* History */}
            {history.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">Últimos Fechamentos</h3>
                    <div className="bg-card border border-border rounded-lg overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border bg-muted/50">
                                    <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">Data</th>
                                    <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3">Saldo Real</th>
                                    <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">Diferença</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((row) => (
                                    <tr key={row.id} className="border-b border-border last:border-0">
                                        <td className="px-4 py-3 text-sm text-foreground">
                                            {new Date(row.date + "T00:00:00").toLocaleDateString("pt-BR")}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-medium text-primary">
                                            {formatCurrency(row.realClosing)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right hidden sm:table-cell">
                                            <span
                                                className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${Math.abs(row.difference) < 0.01
                                                        ? "bg-green-500/20 text-green-400"
                                                        : "bg-red-500/20 text-red-400"
                                                    }`}
                                            >
                                                {formatCurrency(row.difference)}
                                            </span>
                                        </td>
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
