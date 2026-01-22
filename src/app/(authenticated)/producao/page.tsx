"use client";

import { useState, useEffect, useCallback } from "react";
import { ProductionSummaryCards } from "@/components/producao/ProductionSummaryCards";
import { ProductionDialog } from "@/components/producao/ProductionDialog";
import { ProductionTable } from "@/components/producao/ProductionTable";
import {
    getProductionSummary,
    getProductions,
    deleteProduction,
    type ProductionSummary,
    type PaginatedProductions,
    type ProductionRow,
} from "./actions";

export default function ProducaoPage() {
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // State to hold the production item being edited
    const [editingProduction, setEditingProduction] = useState<ProductionRow | null>(null);

    // Data states
    const [summary, setSummary] = useState<ProductionSummary>({
        todayProduction: 0,
        coalStock: 0,
        coalUnit: "m3",
        estimatedAutonomy: 0,
        isLowStock: false,
        avgDailyProduction: 0,
    });
    const [productions, setProductions] = useState<PaginatedProductions>({
        data: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
    });

    // Load data
    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [summaryData, prodData] = await Promise.all([
                getProductionSummary(),
                getProductions(page),
            ]);
            setSummary(summaryData);
            setProductions(prodData);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [page]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleEdit = (production: ProductionRow) => {
        setEditingProduction(production);
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm("Tem certeza que deseja excluir? O estoque de carvão será devolvido.")) {
            await deleteProduction(id);
            loadData();
        }
    };

    const handleDialogClose = () => {
        setIsDialogOpen(false);
        setEditingProduction(null); // Reset editing state
        loadData();
    };

    const handleNewProduction = () => {
        setEditingProduction(null);
        setIsDialogOpen(true);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Produção</h1>
                    <p className="text-muted-foreground">
                        Controle de produção e consumo de insumos
                    </p>
                </div>
                <button
                    onClick={handleNewProduction}
                    className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground font-medium shadow hover:bg-primary/90 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Lançar Produção
                </button>
            </div>

            {/* Summary Cards */}
            <ProductionSummaryCards
                todayProduction={summary.todayProduction}
                coalStock={summary.coalStock}
                coalUnit={summary.coalUnit}
                estimatedAutonomy={summary.estimatedAutonomy}
                isLowStock={summary.isLowStock}
                isLoading={isLoading}
            />

            {/* History Section */}
            <div className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground">
                    Histórico de Produção
                </h2>
                <ProductionTable
                    productions={productions.data}
                    page={page}
                    totalPages={productions.totalPages}
                    onPageChange={setPage}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                />
            </div>

            {/* Production Dialog */}
            <ProductionDialog
                isOpen={isDialogOpen}
                onClose={handleDialogClose}
                productionToEdit={editingProduction}
            />
        </div>
    );
}
