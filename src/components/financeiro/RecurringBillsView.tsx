"use client";

import { useState, useEffect, useCallback } from "react";
import {
    getMonthlyBillsStatus,
    type MonthlyBillStatus,
} from "@/app/(authenticated)/financeiro/recurring-bills-actions";
import { getSuppliers } from "@/app/(authenticated)/estoque/actions";
import type { CategoryGroup } from "@/app/(authenticated)/financeiro/actions";
import { RecurringBillDialog } from "./RecurringBillDialog";

interface RecurringBillsViewProps {
    initialMonth: number;
    initialYear: number;
    categories: CategoryGroup[];
}

export function RecurringBillsView({
    initialMonth,
    initialYear,
    categories,
}: RecurringBillsViewProps) {
    const [month, setMonth] = useState(initialMonth);
    const [year, setYear] = useState(initialYear);
    const [bills, setBills] = useState<MonthlyBillStatus[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingBill, setEditingBill] = useState<MonthlyBillStatus | null>(null);
    const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);

    const loadBills = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getMonthlyBillsStatus(month, year);
            setBills(data);
        } catch (error) {
            console.error("Error loading bills:", error);
        } finally {
            setIsLoading(false);
        }
    }, [month, year]);

    useEffect(() => {
        loadBills();
    }, [loadBills]);

    useEffect(() => {
        getSuppliers(true)
            .then((s) => setSuppliers(s.map((sup) => ({ id: sup.id, name: sup.name }))))
            .catch(() => {});
    }, []);

    // Navegação de mês
    function handlePrevMonth() {
        if (month === 1) {
            setMonth(12);
            setYear(year - 1);
        } else {
            setMonth(month - 1);
        }
    }

    function handleNextMonth() {
        if (month === 12) {
            setMonth(1);
            setYear(year + 1);
        } else {
            setMonth(month + 1);
        }
    }

    const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
    });

    // Resumo
    const paidCount = bills.filter((b) => b.status === "paid").length;
    const overdueCount = bills.filter((b) => b.status === "overdue").length;
    const totalExpected = bills.reduce((sum, b) => sum + (b.expectedAmount || 0), 0);
    const totalPaid = bills
        .filter((b) => b.status === "paid")
        .reduce((sum, b) => sum + (b.paidAmount || 0), 0);

    function formatCurrency(value: number) {
        return value.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
        });
    }

    function formatDate(dateStr: string) {
        const [y, m, d] = dateStr.split("-");
        return `${d}/${m}`;
    }

    function handleManageBills() {
        setEditingBill(null);
        setIsDialogOpen(true);
    }

    function handleEditBill(bill: MonthlyBillStatus) {
        setEditingBill(bill);
        setIsDialogOpen(true);
    }

    return (
        <div className="space-y-4 animate-in fade-in duration-200">
            {/* Seletor de mês + Resumo */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={handlePrevMonth}
                        className="h-8 w-8 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <span className="text-lg font-semibold text-foreground capitalize min-w-[180px] text-center">
                        {monthLabel}
                    </span>
                    <button
                        onClick={handleNextMonth}
                        className="h-8 w-8 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>

                <button
                    onClick={handleManageBills}
                    className="inline-flex items-center gap-2 h-9 px-4 rounded-md border border-border text-foreground font-medium text-sm hover:bg-accent transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Nova Conta Fixa
                </button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-border bg-card p-3">
                    <p className="text-xs text-muted-foreground">Pagas</p>
                    <p className="text-xl font-bold text-green-600">
                        {paidCount} <span className="text-sm font-normal text-muted-foreground">de {bills.length}</span>
                    </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                    <p className="text-xs text-muted-foreground">Vencidas</p>
                    <p className={`text-xl font-bold ${overdueCount > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                        {overdueCount}
                    </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                    <p className="text-xs text-muted-foreground">Previsto</p>
                    <p className="text-xl font-bold text-foreground">
                        {formatCurrency(totalExpected)}
                    </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                    <p className="text-xs text-muted-foreground">Pago</p>
                    <p className="text-xl font-bold text-green-600">
                        {formatCurrency(totalPaid)}
                    </p>
                </div>
            </div>

            {/* Lista de contas */}
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
            ) : bills.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p>Nenhuma conta fixa cadastrada.</p>
                    <button
                        onClick={handleManageBills}
                        className="mt-3 text-primary hover:underline text-sm"
                    >
                        Cadastrar primeira conta fixa
                    </button>
                </div>
            ) : (
                <div className="space-y-2">
                    {bills.map((bill) => (
                        <div
                            key={bill.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer hover:bg-accent/50 ${
                                bill.status === "paid"
                                    ? "border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/10"
                                    : bill.status === "overdue"
                                    ? "border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/10"
                                    : "border-border bg-card"
                            }`}
                            onClick={() => handleEditBill(bill)}
                        >
                            {/* Status icon */}
                            <div className="flex-shrink-0">
                                {bill.status === "paid" ? (
                                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                ) : bill.status === "overdue" ? (
                                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                ) : (
                                    <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-foreground truncate">
                                        {bill.name}
                                    </span>
                                    {bill.categoryName && (
                                        <span className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                                            {bill.categoryName}
                                        </span>
                                    )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    {bill.status === "paid" ? (
                                        <span className="text-green-600">
                                            {formatCurrency(bill.paidAmount!)} — Pago em {formatDate(bill.paidDate!)}
                                        </span>
                                    ) : bill.status === "overdue" ? (
                                        <span className="text-red-600 font-medium">
                                            Vencido (dia {bill.dueDay})
                                        </span>
                                    ) : (
                                        <span>Vence dia {bill.dueDay}</span>
                                    )}
                                </div>
                            </div>

                            {/* Valor esperado */}
                            <div className="text-right flex-shrink-0">
                                <div className="text-sm font-medium text-foreground">
                                    {bill.expectedAmount
                                        ? formatCurrency(bill.expectedAmount)
                                        : "Variável"}
                                </div>
                                {bill.isFixedAmount && (
                                    <div className="text-xs text-muted-foreground">Valor fixo</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Dialog */}
            <RecurringBillDialog
                isOpen={isDialogOpen}
                onClose={() => {
                    setIsDialogOpen(false);
                    setEditingBill(null);
                }}
                bill={editingBill}
                categories={categories}
                suppliers={suppliers}
                onSave={() => {
                    setIsDialogOpen(false);
                    setEditingBill(null);
                    loadBills();
                }}
            />
        </div>
    );
}
