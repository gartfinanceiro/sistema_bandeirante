"use client";

import { useState, useEffect } from "react";
import { getSuppliers, deleteSupplier } from "./actions";
import { SupplierList } from "@/components/carvao/SupplierList";
import { SupplierDialog } from "@/components/carvao/SupplierDialog";
import type { Supplier } from "@/types/database";

export default function FornecedoresPage() {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

    async function loadSuppliers() {
        setIsLoading(true);
        const data = await getSuppliers();
        setSuppliers(data);
        setIsLoading(false);
    }

    useEffect(() => {
        loadSuppliers();
    }, []);

    function handleEdit(supplier: Supplier) {
        setEditingSupplier(supplier);
        setIsDialogOpen(true);
    }

    function handleDialogClose() {
        setIsDialogOpen(false);
        setEditingSupplier(null);
        loadSuppliers();
    }

    function handleNewSupplier() {
        setEditingSupplier(null);
        setIsDialogOpen(true);
    }

    async function handleDelete(supplier: Supplier) {
        if (!confirm(`Tem certeza que deseja excluir o fornecedor "${supplier.name}"?`)) {
            return;
        }

        setIsLoading(true);
        const result = await deleteSupplier(supplier.id);

        if (result.success) {
            await loadSuppliers();
        } else {
            alert("Erro ao excluir fornecedor: " + result.error);
            setIsLoading(false);
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Fornecedores de Carvão</h1>
                    <p className="text-muted-foreground">Gestão de fornecedores e negociação</p>
                </div>
                <button
                    onClick={handleNewSupplier}
                    className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground font-medium shadow hover:bg-primary/90 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Novo Fornecedor
                </button>
            </div>

            {/* Lista */}
            <SupplierList
                suppliers={suppliers}
                isLoading={isLoading}
                onEdit={handleEdit}
                onDelete={handleDelete}
            />

            {/* Dialog */}
            <SupplierDialog
                isOpen={isDialogOpen}
                onClose={handleDialogClose}
                initialData={editingSupplier}
            />
        </div>
    );
}
