"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { SummaryCards } from "@/components/financeiro/SummaryCards";
import { TransactionDialog } from "@/components/financeiro/TransactionDialog";
import { TransactionTable } from "@/components/financeiro/TransactionTable";
import { CategoryManagerDialog } from "@/components/financeiro/CategoryManagerDialog";
import {
    getCategories,
    getMonthSummary,
    getTransactions,
    deleteTransaction,
    type CategoryGroup,
    type MonthSummary,
    type PaginatedTransactions,
    type TransactionRow
} from "./actions";

export default function FinanceiroPage() {
    // Current month/year filter
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [page, setPage] = useState(1);

    // Data states
    const [summary, setSummary] = useState<MonthSummary>({
        totalEntries: 0,
        totalExits: 0,
        balance: 0,
    });
    const [transactions, setTransactions] = useState<PaginatedTransactions>({
        data: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
    });
    const [categories, setCategories] = useState<CategoryGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Dialog & Edit State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<TransactionRow | null>(null);
    const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);

    // Load data
    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [summaryData, txData, catData] = await Promise.all([
                getMonthSummary(month, year),
                getTransactions(month, year, page),
                getCategories(),
            ]);
            setSummary(summaryData);
            setTransactions(txData);
            setCategories(catData);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [month, year, page]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Handle month filter change
    function handleMonthChange(e: React.ChangeEvent<HTMLSelectElement>) {
        const [y, m] = e.target.value.split("-");
        setYear(parseInt(y));
        setMonth(parseInt(m));
        setPage(1);
    }

    // Actions
    function handleEdit(transaction: TransactionRow) {
        setEditingTransaction(transaction);
        setIsDialogOpen(true);
    }

    async function handleDelete(id: string) {
        if (!confirm("Tem certeza que deseja excluir esta transação?")) return;

        try {
            const result = await deleteTransaction(id);
            if (result.success) {
                loadData(); // Refresh list
            } else {
                alert("Erro ao excluir: " + result.error);
            }
        } catch (error) {
            console.error("Error deleting:", error);
            alert("Erro ao excluir transação");
        }
    }

    function handleDialogClose() {
        setIsDialogOpen(false);
        setEditingTransaction(null); // Clear edit state
        loadData(); // Refresh data 
    }

    function handleNewTransaction() {
        setEditingTransaction(null); // Ensure clean state
        setIsDialogOpen(true);
    }

    // Generate month options (last 12 months)
    const monthOptions = [];
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const value = `${d.getFullYear()}-${d.getMonth() + 1}`;
        const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
        monthOptions.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
                    <p className="text-muted-foreground">Gestão de fluxo de caixa</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsCategoryDialogOpen(true)}
                        className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md border border-border text-foreground font-medium hover:bg-accent transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        Categorias
                    </button>
                    <Link
                        href="/financeiro/fechamento"
                        className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md border border-border text-foreground font-medium hover:bg-accent transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Fechamento
                    </Link>
                    <button
                        onClick={handleNewTransaction}
                        className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground font-medium shadow hover:bg-primary/90 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Nova Transação
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <SummaryCards
                totalEntries={summary.totalEntries}
                totalExits={summary.totalExits}
                balance={summary.balance}
                isLoading={isLoading}
            />

            {/* Filter & Table Section */}
            <div className="space-y-4">
                {/* Month Filter */}
                <div className="flex items-center gap-4">
                    <label htmlFor="monthFilter" className="text-sm font-medium text-muted-foreground">
                        Período:
                    </label>
                    <select
                        id="monthFilter"
                        value={`${year}-${month}`}
                        onChange={handleMonthChange}
                        className="h-9 px-3 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                    >
                        {monthOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Transactions Table */}
                <TransactionTable
                    transactions={transactions.data}
                    page={page}
                    totalPages={transactions.totalPages}
                    onPageChange={setPage}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                />
            </div>

            {/* Transaction Dialog */}
            <TransactionDialog
                isOpen={isDialogOpen}
                onClose={handleDialogClose}
                categories={categories}
                initialData={editingTransaction}
            />

            {/* Category Manager Dialog */}
            <CategoryManagerDialog
                isOpen={isCategoryDialogOpen}
                onClose={() => {
                    setIsCategoryDialogOpen(false);
                    loadData(); // Refresh categories
                }}
            />
        </div>
    );
}
