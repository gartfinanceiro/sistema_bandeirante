"use client";

import { useState, useEffect, useTransition } from "react";
import {
    createSupplier,
    updateSupplier,
    type Supplier,
    type Material
} from "@/app/(authenticated)/estoque/actions";

interface SupplierDialogProps {
    isOpen: boolean;
    onClose: () => void;
    supplierToEdit?: Supplier | null;
    materials: Material[];
}

export function SupplierDialog({ isOpen, onClose, supplierToEdit, materials }: SupplierDialogProps) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    // Form state for controlled inputs
    const [name, setName] = useState("");
    const [materialId, setMaterialId] = useState("");
    const [defaultPrice, setDefaultPrice] = useState("");
    const [hasIcms, setHasIcms] = useState(false);

    // Reset form when dialog opens/closes or when supplier changes
    useEffect(() => {
        if (isOpen) {
            if (supplierToEdit) {
                setName(supplierToEdit.name);
                setMaterialId(supplierToEdit.materialId || "");
                setDefaultPrice(supplierToEdit.defaultPrice?.toString() || "");
                setHasIcms(supplierToEdit.hasIcms);
            } else {
                setName("");
                setMaterialId("");
                setDefaultPrice("");
                setHasIcms(false);
            }
            setError(null);
        }
    }, [isOpen, supplierToEdit]);

    if (!isOpen) return null;

    const isEditMode = !!supplierToEdit;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        const formData = new FormData();
        formData.set("name", name);
        formData.set("materialId", materialId);
        formData.set("defaultPrice", defaultPrice);
        formData.set("hasIcms", hasIcms ? "true" : "false");

        startTransition(async () => {
            const result = isEditMode
                ? await updateSupplier(supplierToEdit.id, formData)
                : await createSupplier(formData);

            if (result.success) {
                onClose();
            } else {
                setError(result.error || "Erro ao salvar fornecedor");
            }
        });
    }

    return (
        <>
            <div
                className="fixed inset-0 bg-black/60 z-50 animate-in fade-in duration-200"
                onClick={onClose}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                <div
                    className="w-full max-w-lg bg-background border border-border rounded-xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
                        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                            <span className="p-1.5 rounded-md bg-primary/10 text-primary">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                            </span>
                            {isEditMode ? "Editar Fornecedor" : "Novo Fornecedor"}
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

                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        <div className="space-y-2">
                            <label htmlFor="name" className="text-sm font-medium text-foreground">
                                Nome / Razão Social
                            </label>
                            <input
                                id="name"
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ex: Carvoaria São José"
                                className="w-full h-10 px-3 rounded-md border border-input bg-muted/50 focus:bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="materialId" className="text-sm font-medium text-foreground">
                                Tipo de Material
                            </label>
                            <div className="relative">
                                <select
                                    id="materialId"
                                    required
                                    value={materialId}
                                    onChange={(e) => setMaterialId(e.target.value)}
                                    className="w-full h-10 px-3 rounded-md border border-input bg-muted/50 focus:bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all appearance-none"
                                >
                                    <option value="">Selecione...</option>
                                    {materials.map((mat) => (
                                        <option key={mat.id} value={mat.id}>
                                            {mat.name} ({mat.unit})
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-2.5 pointer-events-none text-muted-foreground">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="defaultPrice" className="text-sm font-medium text-foreground">
                                Preço Padrão (R$/unidade)
                            </label>
                            <input
                                id="defaultPrice"
                                type="number"
                                step="0.01"
                                min="0"
                                value={defaultPrice}
                                onChange={(e) => setDefaultPrice(e.target.value)}
                                placeholder="180.00"
                                className="w-full h-10 px-3 rounded-md border border-input bg-muted/50 focus:bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                            />
                            <p className="text-xs text-muted-foreground">
                                Deixe em branco para preço variável (ex: Carvão).
                            </p>
                        </div>

                        <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                            <input
                                id="hasIcms"
                                type="checkbox"
                                checked={hasIcms}
                                onChange={(e) => setHasIcms(e.target.checked)}
                                className="h-4 w-4 rounded border-input bg-background text-primary focus:ring-primary"
                            />
                            <label htmlFor="hasIcms" className="text-sm font-medium text-foreground cursor-pointer">
                                Gera crédito de ICMS
                            </label>
                        </div>

                        {error && (
                            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {error}
                            </div>
                        )}

                        <div className="flex gap-3 pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 h-10 rounded-md border border-border text-foreground font-medium hover:bg-accent transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isPending}
                                className="flex-1 h-10 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
                            >
                                {isPending ? "Salvando..." : isEditMode ? "Atualizar" : "Cadastrar"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}
