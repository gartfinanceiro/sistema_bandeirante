"use client";

import { useState, useTransition, useEffect } from "react";
import { createContract, updateContract, type ContractRow } from "@/app/(authenticated)/vendas/actions";

interface ContractDialogProps {
    isOpen: boolean;
    onClose: () => void;
    contractToEdit?: ContractRow | null;
}

export function ContractDialog({ isOpen, onClose, contractToEdit }: ContractDialogProps) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    // Reset error when open/mode changes
    useEffect(() => {
        if (isOpen) setError(null);
    }, [isOpen, contractToEdit]);

    if (!isOpen) return null;

    const isEditing = !!contractToEdit;
    const today = new Date().toISOString().split("T")[0];
    const threeMonthsLater = new Date();
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
    const defaultEndDate = threeMonthsLater.toISOString().split("T")[0];

    async function handleSubmit(formData: FormData) {
        setError(null);
        startTransition(async () => {
            let result;
            if (isEditing && contractToEdit) {
                result = await updateContract(contractToEdit.id, formData);
            } else {
                result = await createContract(formData);
            }

            if (result.success) {
                onClose();
            } else {
                setError(result.error || "Erro ao salvar contrato");
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
                    className="w-full max-w-md bg-background border border-border rounded-lg shadow-xl animate-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                        <h2 className="text-lg font-semibold text-foreground">
                            {isEditing ? "Editar Contrato" : "Novo Contrato"}
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

                    <form action={handleSubmit} className="p-6 space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="customerName" className="text-sm font-medium text-foreground">
                                Cliente
                            </label>
                            <input
                                id="customerName"
                                name="customerName"
                                type="text"
                                required
                                placeholder="Nome do cliente"
                                defaultValue={contractToEdit?.customerName}
                                className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label htmlFor="contractedQuantity" className="text-sm font-medium text-foreground">
                                    Volume (t)
                                </label>
                                <input
                                    id="contractedQuantity"
                                    name="contractedQuantity"
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    required
                                    placeholder="5000"
                                    defaultValue={contractToEdit?.contractedQuantity}
                                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                                />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="pricePerTon" className="text-sm font-medium text-foreground">
                                    Preço (R$/t)
                                </label>
                                <input
                                    id="pricePerTon"
                                    name="pricePerTon"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    required
                                    placeholder="2000"
                                    defaultValue={contractToEdit?.pricePerTon}
                                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label htmlFor="startDate" className="text-sm font-medium text-foreground">
                                    Início
                                </label>
                                <input
                                    id="startDate"
                                    name="startDate"
                                    type="date"
                                    required
                                    defaultValue={contractToEdit?.startDate || today}
                                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                                />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="endDate" className="text-sm font-medium text-foreground">
                                    Término
                                </label>
                                <input
                                    id="endDate"
                                    name="endDate"
                                    type="date"
                                    required
                                    defaultValue={contractToEdit?.endDate || defaultEndDate}
                                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                                />
                            </div>
                        </div>

                        {/* Status (Only on Edit) */}
                        {isEditing && (
                            <div className="space-y-2">
                                <label htmlFor="status" className="text-sm font-medium text-foreground">
                                    Status
                                </label>
                                <select
                                    id="status"
                                    name="status"
                                    defaultValue={contractToEdit?.status}
                                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                                >
                                    <option value="ativo">Ativo</option>
                                    <option value="pausado">Pausado</option>
                                    <option value="encerrado">Encerrado</option>
                                </select>
                            </div>
                        )}

                        {error && (
                            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                                {error}
                            </div>
                        )}

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
                                className="flex-1 h-10 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                            >
                                {isPending ? "Salvando..." : (isEditing ? "Salvar Alterações" : "Criar Contrato")}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}
