"use client";

import { useState, useEffect, useCallback } from "react";
import {
    getSuppliers,
    getMaterials,
    deleteSupplier,
    type Supplier,
    type Material,
} from "@/app/(authenticated)/estoque/actions";
import { SupplierDialog } from "@/components/estoque/SupplierDialog";

interface SupplierManagerDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SupplierManagerDialog({ isOpen, onClose }: SupplierManagerDialogProps) {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");

    // Sub-dialog for create/edit
    const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [sups, mats] = await Promise.all([
                getSuppliers(true),
                getMaterials(true),
            ]);
            setSuppliers(sups);
            setMaterials(mats);
        } catch (err) {
            console.error("Error loading suppliers:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            loadData();
            setSearch("");
        }
    }, [isOpen, loadData]);

    if (!isOpen) return null;

    const filtered = search
        ? suppliers.filter(s =>
            s.name.toLowerCase().includes(search.toLowerCase()) ||
            (s.materialName && s.materialName.toLowerCase().includes(search.toLowerCase()))
        )
        : suppliers;

    function handleEdit(supplier: Supplier) {
        setEditingSupplier(supplier);
        setIsSupplierDialogOpen(true);
    }

    function handleNew() {
        setEditingSupplier(null);
        setIsSupplierDialogOpen(true);
    }

    async function handleArchive(supplier: Supplier) {
        if (!confirm(`Arquivar fornecedor "${supplier.name}"?`)) return;
        const result = await deleteSupplier(supplier.id);
        if (result.success) {
            loadData();
        } else {
            alert("Erro: " + result.error);
        }
    }

    function handleSupplierDialogClose() {
        setIsSupplierDialogOpen(false);
        setEditingSupplier(null);
        loadData();
    }

    return (
        <>
            <div
                className="fixed inset-0 bg-black/60 z-50 animate-in fade-in duration-200"
                onClick={onClose}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                <div
                    className="w-full max-w-2xl bg-background border border-border rounded-xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[85vh]"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
                        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                            <span className="p-1.5 rounded-md bg-primary/10 text-primary">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </span>
                            Fornecedores
                        </h2>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleNew}
                                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Novo
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="px-6 py-3 border-b border-border">
                        <div className="relative">
                            <svg className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Buscar fornecedor..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-9 w-full pl-9 pr-4 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                            />
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                                Carregando...
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm gap-2">
                                <svg className="w-10 h-10 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                                </svg>
                                {search ? "Nenhum fornecedor encontrado" : "Nenhum fornecedor cadastrado"}
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {filtered.map((supplier) => (
                                    <div
                                        key={supplier.id}
                                        className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium text-foreground text-sm truncate">
                                                {supplier.name}
                                            </p>
                                            <div className="flex items-center gap-3 mt-0.5">
                                                <span className="text-xs text-muted-foreground">
                                                    {supplier.materialName || "—"}
                                                </span>
                                                {supplier.defaultPrice ? (
                                                    <span className="text-xs text-muted-foreground">
                                                        R$ {supplier.defaultPrice.toFixed(2)}/un
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic">
                                                        Preço variável
                                                    </span>
                                                )}
                                                {supplier.hasIcms && (
                                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                                        ICMS {supplier.icmsRate}%
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 ml-3">
                                            <button
                                                onClick={() => handleEdit(supplier)}
                                                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                                title="Editar"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleArchive(supplier)}
                                                className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                                                title="Arquivar"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
                        {filtered.length} fornecedor{filtered.length !== 1 ? "es" : ""} ativo{filtered.length !== 1 ? "s" : ""}
                    </div>
                </div>
            </div>

            {/* Reuse existing SupplierDialog for create/edit */}
            <SupplierDialog
                isOpen={isSupplierDialogOpen}
                onClose={handleSupplierDialogClose}
                supplierToEdit={editingSupplier}
                materials={materials}
            />
        </>
    );
}
