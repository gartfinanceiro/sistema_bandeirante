"use client";

import { useState, useEffect, useTransition } from "react";
import {
    getAvailableTransactionsForLinking,
    linkBillToTransaction,
    type AvailableTransaction,
} from "@/app/(authenticated)/financeiro/recurring-bills-actions";

interface LinkTransactionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    billId: string;
    billName: string;
    billCategoryId: string | null;
    billSupplierId: string | null;
    month: number;
    year: number;
    onLinked: () => void;
    replaceMode?: boolean;
    currentTransactionId?: string | null;
}

export function LinkTransactionDialog({
    isOpen,
    onClose,
    billId,
    billName,
    billCategoryId,
    billSupplierId,
    month,
    year,
    onLinked,
    replaceMode = false,
    currentTransactionId = null,
}: LinkTransactionDialogProps) {
    const [transactions, setTransactions] = useState<AvailableTransaction[]>([]);
    const [allTransactions, setAllTransactions] = useState<AvailableTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [search, setSearch] = useState("");
    const [showAll, setShowAll] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!isOpen) return;
        setSearch("");
        setShowAll(false);
        setError("");
        setIsLoading(true);

        // Fetch filtered (by category/supplier) and all transactions in parallel
        Promise.all([
            getAvailableTransactionsForLinking(month, year, billCategoryId, billSupplierId, replaceMode ? billId : null),
            getAvailableTransactionsForLinking(month, year, null, null, replaceMode ? billId : null),
        ])
            .then(([filtered, all]) => {
                setTransactions(filtered);
                setAllTransactions(all);
            })
            .catch(() => {
                setTransactions([]);
                setAllTransactions([]);
            })
            .finally(() => setIsLoading(false));
    }, [isOpen, month, year, billCategoryId, billSupplierId]);

    if (!isOpen) return null;

    const displayList = showAll ? allTransactions : transactions;
    const filtered = search
        ? displayList.filter(
              (t) =>
                  t.description.toLowerCase().includes(search.toLowerCase()) ||
                  t.supplierName?.toLowerCase().includes(search.toLowerCase()) ||
                  t.categoryName?.toLowerCase().includes(search.toLowerCase())
          )
        : displayList;

    function handleLink(transactionId: string) {
        setError("");
        startTransition(async () => {
            try {
                const result = await linkBillToTransaction(billId, transactionId, month, year);
                if (result.success) {
                    onLinked();
                } else {
                    setError(result.error || "Erro ao vincular");
                }
            } catch {
                setError("Erro inesperado ao vincular");
            }
        });
    }

    function formatCurrency(value: number) {
        return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }

    function formatDate(dateStr: string) {
        const [, m, d] = dateStr.split("-");
        return `${d}/${m}`;
    }

    const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-background rounded-xl shadow-2xl animate-in fade-in duration-200 max-h-[85vh] flex flex-col">
                <div className="p-6 pb-3 space-y-3 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-foreground">
                                {replaceMode ? "Corrigir Vínculo" : "Vincular Pagamento"}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {billName} — {monthLabel}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {error && (
                        <div className="p-2 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por descricao, fornecedor ou categoria..."
                        className="w-full h-9 px-3 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                    />

                    {/* Toggle: show filtered vs all */}
                    {transactions.length !== allTransactions.length && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowAll(false)}
                                className={`text-xs px-2 py-1 rounded-md transition-colors ${
                                    !showAll
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted text-muted-foreground hover:bg-accent"
                                }`}
                            >
                                Sugeridas ({transactions.length})
                            </button>
                            <button
                                onClick={() => setShowAll(true)}
                                className={`text-xs px-2 py-1 rounded-md transition-colors ${
                                    showAll
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted text-muted-foreground hover:bg-accent"
                                }`}
                            >
                                Todas ({allTransactions.length})
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto px-6 pb-6">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            {search
                                ? "Nenhuma transacao encontrada com esse filtro."
                                : "Nenhuma transacao disponivel para vinculacao neste mes."}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filtered.map((tx) => (
                                <div
                                    key={tx.id}
                                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                                        tx.id === currentTransactionId
                                            ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/10"
                                            : tx.linkedToBillName
                                                ? "border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/10 opacity-75"
                                                : "border-border bg-card hover:bg-accent/50"
                                    }`}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-medium text-sm text-foreground truncate">
                                                {tx.description}
                                            </span>
                                            {tx.id === currentTransactionId && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex-shrink-0">
                                                    atual
                                                </span>
                                            )}
                                            {tx.linkedToBillName && tx.id !== currentTransactionId && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 flex-shrink-0">
                                                    vinculada
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                                            <span>{formatDate(tx.date)}</span>
                                            {tx.categoryName && (
                                                <>
                                                    <span>·</span>
                                                    <span>{tx.categoryName}</span>
                                                </>
                                            )}
                                            {tx.supplierName && (
                                                <>
                                                    <span>·</span>
                                                    <span>{tx.supplierName}</span>
                                                </>
                                            )}
                                        </div>
                                        {tx.linkedToBillName && tx.id !== currentTransactionId && (
                                            <p className="text-[10px] text-orange-600 dark:text-orange-400 mt-1">
                                                Ja vinculada a: {tx.linkedToBillName}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-sm font-medium text-foreground flex-shrink-0">
                                        {formatCurrency(tx.amount)}
                                    </div>
                                    <button
                                        onClick={() => handleLink(tx.id)}
                                        disabled={isPending}
                                        className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex-shrink-0"
                                    >
                                        {isPending ? "..." : "Vincular"}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
