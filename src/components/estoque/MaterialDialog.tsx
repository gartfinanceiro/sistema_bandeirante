"use client";

import { useState, useEffect, useTransition } from "react";
import {
    createMaterial,
    updateMaterial,
    type Material
} from "@/app/(authenticated)/estoque/actions";

interface MaterialDialogProps {
    isOpen: boolean;
    onClose: () => void;
    materialToEdit?: Material | null;
}

export function MaterialDialog({ isOpen, onClose, materialToEdit }: MaterialDialogProps) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const [name, setName] = useState("");
    const [unit, setUnit] = useState("");

    useEffect(() => {
        if (isOpen) {
            if (materialToEdit) {
                setName(materialToEdit.name);
                setUnit(materialToEdit.unit);
            } else {
                setName("");
                setUnit("");
            }
            setError(null);
        }
    }, [isOpen, materialToEdit]);

    if (!isOpen) return null;

    const isEditMode = !!materialToEdit;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        const formData = new FormData();
        formData.set("name", name);
        formData.set("unit", unit);

        startTransition(async () => {
            const result = isEditMode
                ? await updateMaterial(materialToEdit.id, formData)
                : await createMaterial(formData);

            if (result.success) {
                onClose();
            } else {
                setError(result.error || "Erro ao salvar material");
            }
        });
    }

    return (
        <>
            <div
                className="fixed inset-0 bg-black/60 z-50 animate-in fade-in duration-200"
                onClick={onClose}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                    className="w-full max-w-sm bg-background border border-border rounded-xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
                        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            <span className="p-1.5 rounded-md bg-blue-500/10 text-blue-500">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                            </span>
                            {isEditMode ? "Editar Material" : "Novo Material"}
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
                                Nome do Material
                            </label>
                            <input
                                id="name"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ex: Sucata de Ferro"
                                className="w-full h-10 px-3 rounded-md border border-input bg-muted/50 focus:bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="unit" className="text-sm font-medium text-foreground">
                                Unidade de Medida
                            </label>
                            <input
                                id="unit"
                                required
                                value={unit}
                                onChange={(e) => setUnit(e.target.value)}
                                placeholder="Ex: ton, kg, m³"
                                className="w-full h-10 px-3 rounded-md border border-input bg-muted/50 focus:bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                            />
                            <p className="text-xs text-muted-foreground">
                                Usada para controle de estoque e compras.
                            </p>
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
                                {isPending ? "Salvando..." : isEditMode ? "Atualizar" : "Salvar"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}
