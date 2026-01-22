"use client";

import { useState, useEffect, useTransition } from "react";
import {
    getCostCenters,
    getAllCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    type CostCenter,
    type Category,
} from "@/app/(authenticated)/financeiro/category-actions";

interface CategoryManagerDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CategoryManagerDialog({ isOpen, onClose }: CategoryManagerDialogProps) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Data
    const [categories, setCategories] = useState<Category[]>([]);
    const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Form state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [formName, setFormName] = useState("");
    const [formCostCenterId, setFormCostCenterId] = useState("");
    const [formType, setFormType] = useState("despesa");

    // Load data
    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen]);

    async function loadData() {
        setIsLoading(true);
        try {
            const [cats, ccs] = await Promise.all([
                getAllCategories(),
                getCostCenters(),
            ]);
            setCategories(cats);
            setCostCenters(ccs);
        } catch (err) {
            console.error("Error loading data:", err);
            setError("Erro ao carregar dados");
        } finally {
            setIsLoading(false);
        }
    }

    function openAddForm() {
        setEditingCategory(null);
        setFormName("");
        setFormCostCenterId(costCenters[0]?.id || "");
        setFormType("despesa");
        setIsFormOpen(true);
        setError(null);
        setSuccess(null);
    }

    function openEditForm(category: Category) {
        setEditingCategory(category);
        setFormName(category.name);
        setFormCostCenterId(category.costCenterId);
        setFormType(category.categoryType);
        setIsFormOpen(true);
        setError(null);
        setSuccess(null);
    }

    function closeForm() {
        setIsFormOpen(false);
        setEditingCategory(null);
        setFormName("");
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        const formData = new FormData();
        formData.set("name", formName);
        formData.set("costCenterId", formCostCenterId);
        formData.set("categoryType", formType);

        if (editingCategory) {
            formData.set("id", editingCategory.id);
        }

        startTransition(async () => {
            const result = editingCategory
                ? await updateCategory(formData)
                : await createCategory(formData);

            if (result.success) {
                setSuccess(editingCategory ? "Categoria atualizada!" : "Categoria criada!");
                closeForm();
                loadData();
            } else {
                setError(result.error || "Erro ao salvar");
            }
        });
    }

    async function handleDelete(category: Category) {
        if (category.isSystem) {
            setError("Categorias do sistema não podem ser excluídas");
            return;
        }

        if (!confirm(`Excluir a categoria "${category.name}"?`)) return;

        setError(null);
        setSuccess(null);

        startTransition(async () => {
            const result = await deleteCategory(category.id);
            if (result.success) {
                setSuccess("Categoria excluída!");
                loadData();
            } else {
                setError(result.error || "Erro ao excluir");
            }
        });
    }

    if (!isOpen) return null;

    // Group categories by cost center
    const groupedCategories = costCenters.map((cc) => ({
        ...cc,
        categories: categories.filter((cat) => cat.costCenterId === cc.id),
    })).filter((g) => g.categories.length > 0);

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
                            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            Gerenciar Categorias
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {/* Messages */}
                        {error && (
                            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {error}
                            </div>
                        )}
                        {success && (
                            <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
                                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                {success}
                            </div>
                        )}

                        {/* Add Form */}
                        {isFormOpen && (
                            <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-4">
                                <h3 className="font-medium text-foreground">
                                    {editingCategory ? "Editar Categoria" : "Nova Categoria"}
                                </h3>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-muted-foreground">Nome</label>
                                            <input
                                                type="text"
                                                value={formName}
                                                onChange={(e) => setFormName(e.target.value)}
                                                required
                                                placeholder="Nome da categoria"
                                                className="w-full h-9 px-3 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-muted-foreground">Centro de Custo</label>
                                            <select
                                                value={formCostCenterId}
                                                onChange={(e) => setFormCostCenterId(e.target.value)}
                                                required
                                                className="w-full h-9 px-3 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                            >
                                                {costCenters.map((cc) => (
                                                    <option key={cc.id} value={cc.id}>
                                                        {cc.code} - {cc.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-muted-foreground">Tipo</label>
                                        <div className="flex gap-4">
                                            {["despesa", "receita", "ambos"].map((t) => (
                                                <label key={t} className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="categoryType"
                                                        value={t}
                                                        checked={formType === t}
                                                        onChange={(e) => setFormType(e.target.value)}
                                                        className="accent-primary"
                                                    />
                                                    <span className="text-sm capitalize">{t}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <button
                                            type="button"
                                            onClick={closeForm}
                                            className="px-4 py-2 text-sm rounded-md border border-border hover:bg-accent transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isPending}
                                            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                        >
                                            {isPending ? "Salvando..." : "Salvar"}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* Category List */}
                        {isLoading ? (
                            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                        ) : (
                            <div className="space-y-4">
                                {groupedCategories.map((group) => (
                                    <div key={group.id} className="space-y-2">
                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                            {group.code} - {group.name}
                                        </h4>
                                        <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                                            {group.categories.map((cat) => (
                                                <div
                                                    key={cat.id}
                                                    className="flex items-center justify-between px-4 py-3 bg-background hover:bg-muted/30 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {cat.isSystem && (
                                                            <span className="text-amber-500" title="Categoria do sistema">
                                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                                                </svg>
                                                            </span>
                                                        )}
                                                        <span className="text-sm font-medium text-foreground">{cat.name}</span>
                                                        {cat.slug && (
                                                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                                                {cat.slug}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => openEditForm(cat)}
                                                            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                                            title="Editar"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(cat)}
                                                            disabled={cat.isSystem || isPending}
                                                            className={`p-1.5 rounded transition-colors ${cat.isSystem
                                                                    ? "text-muted-foreground/30 cursor-not-allowed"
                                                                    : "text-muted-foreground hover:text-red-500 hover:bg-red-50"
                                                                }`}
                                                            title={cat.isSystem ? "Categoria do sistema" : "Excluir"}
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/30">
                        <span className="text-sm text-muted-foreground">
                            {categories.length} categoria(s) • {categories.filter(c => c.isSystem).length} protegida(s)
                        </span>
                        {!isFormOpen && (
                            <button
                                onClick={openAddForm}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Nova Categoria
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
