"use client";

import { useState, useTransition, useEffect } from "react";
import { createProduction, updateProduction, getMaterialsForProduction, type ProductionRow, type MaterialForProduction } from "@/app/(authenticated)/producao/actions";

interface ProductionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    productionToEdit?: ProductionRow | null;
}

export function ProductionDialog({ isOpen, onClose, productionToEdit }: ProductionDialogProps) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [materials, setMaterials] = useState<MaterialForProduction[]>([]);
    const [consumptions, setConsumptions] = useState<Record<string, number>>({});
    const [tonsProduced, setTonsProduced] = useState<number>(0);

    // Reset error when dialog opens/closes/mode changes
    useEffect(() => {
        if (isOpen) {
            setError(null);
            // Load materials
            loadMaterials();
        }
    }, [isOpen, productionToEdit]);

    async function loadMaterials() {
        const mats = await getMaterialsForProduction();
        setMaterials(mats);

        // Initialize consumptions
        const initialConsumptions: Record<string, number> = {};
        mats.forEach(mat => {
            initialConsumptions[mat.id] = 0;
        });
        setConsumptions(initialConsumptions);
    }

    // Handle tons produced change → recalculate suggestions
    function handleTonsChange(value: number) {
        setTonsProduced(value);

        if (value > 0) {
            const newConsumptions: Record<string, number> = {};
            materials.forEach(mat => {
                newConsumptions[mat.id] = value * mat.consumptionRatio;
            });
            setConsumptions(newConsumptions);
        }
    }

    if (!isOpen) return null;

    const today = new Date().toISOString().split("T")[0];
    const isEditing = !!productionToEdit;

    async function handleSubmit(formData: FormData) {
        setError(null);

        startTransition(async () => {
            let result;

            if (isEditing && productionToEdit) {
                result = await updateProduction(productionToEdit.id, formData);
            } else {
                result = await createProduction(formData);
            }

            if (result.success) {
                onClose();
            } else {
                setError(result.error || "Erro ao salvar produção");
            }
        });
    }

    return (
        <>
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-black/60 z-50 animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Dialog */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                    className="w-full max-w-2xl bg-background border border-border rounded-lg shadow-xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background z-10">
                        <h2 className="text-lg font-semibold text-foreground">
                            {isEditing ? "Editar Produção" : "Lançar Produção"}
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Form */}
                    <form action={handleSubmit} className="p-6 space-y-6">
                        {/* Date */}
                        <div className="space-y-2">
                            <label htmlFor="date" className="text-sm font-medium text-foreground">
                                Data
                            </label>
                            <input
                                id="date"
                                name="date"
                                type="date"
                                required
                                defaultValue={productionToEdit?.date || today}
                                className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                            />
                        </div>

                        {/* Quantity */}
                        <div className="space-y-2">
                            <label htmlFor="tonsProduced" className="text-sm font-medium text-foreground">
                                Quantidade Produzida (toneladas)
                            </label>
                            <input
                                id="tonsProduced"
                                name="tonsProduced"
                                type="number"
                                step="0.1"
                                min="0"
                                required
                                placeholder="Ex: 150.5"
                                defaultValue={productionToEdit?.tonsProduced}
                                onChange={(e) => handleTonsChange(parseFloat(e.target.value) || 0)}
                                className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                            />
                        </div>

                        {/* Material Consumption Section */}
                        <div className="space-y-3 pt-2 border-t border-border">
                            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                                Consumo de Insumos
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                Valores pré-preenchidos com base na ficha técnica. Ajuste conforme o consumo real.
                            </p>

                            <div className="grid gap-4">
                                {materials.map((material) => (
                                    <div key={material.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-md">
                                        <div className="flex-1">
                                            <label htmlFor={`consumption_${material.id}`} className="text-sm font-medium text-foreground">
                                                {material.name}
                                            </label>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                Estoque: {material.currentStock.toFixed(2)} {material.unit}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                id={`consumption_${material.id}`}
                                                name={`consumption_${material.id}`}
                                                type="number"
                                                step="0.001"
                                                min="0"
                                                value={consumptions[material.id] || 0}
                                                onChange={(e) => setConsumptions({
                                                    ...consumptions,
                                                    [material.id]: parseFloat(e.target.value) || 0
                                                })}
                                                className="w-28 h-9 px-3 rounded-md border border-input bg-background text-foreground text-right focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                                            />
                                            <span className="text-sm text-muted-foreground min-w-[3rem]">{material.unit}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Technical Notes */}
                        <div className="space-y-2">
                            <label htmlFor="technicalNotes" className="text-sm font-medium text-foreground">
                                Observações Técnicas
                                <span className="text-muted-foreground ml-1">(opcional)</span>
                            </label>
                            <textarea
                                id="technicalNotes"
                                name="technicalNotes"
                                rows={3}
                                placeholder="Paradas, ocorrências, qualidade do gusa..."
                                defaultValue={productionToEdit?.technicalNotes || ""}
                                className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors resize-none"
                            />
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                                {error}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3 pt-2">
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
                                className="flex-1 h-10 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isPending ? "Salvando..." : (isEditing ? "Atualizar" : "Registrar")}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}
