"use client";

import { useState, useTransition, useEffect } from "react";
import { createExpedition, updateExpedition, type ActiveContract, type ExpeditionRow } from "@/app/(authenticated)/vendas/actions";

interface ExpeditionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    contracts: ActiveContract[];
    expeditionToEdit?: ExpeditionRow | null;
}

export function ExpeditionDialog({ isOpen, onClose, contracts, expeditionToEdit }: ExpeditionDialogProps) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    // Reset error when open/mode changes
    useEffect(() => {
        if (isOpen) setError(null);
    }, [isOpen, expeditionToEdit]);

    if (!isOpen) return null;

    const isEditing = !!expeditionToEdit;

    // Parse date/time for defaults
    // If editing, departureDate is ISO string e.g. "2023-10-27T10:30:00+00..."
    // We need to split into YYYY-MM-DD and HH:MM
    let defaultDate = "";
    let defaultTime = "";

    if (isEditing && expeditionToEdit?.departureDate) {
        const d = new Date(expeditionToEdit.departureDate);
        defaultDate = d.toISOString().split("T")[0];
        defaultTime = d.toTimeString().slice(0, 5);
    } else {
        const now = new Date();
        defaultDate = now.toISOString().split("T")[0];
        defaultTime = now.toTimeString().slice(0, 5);
    }

    async function handleSubmit(formData: FormData) {
        setError(null);
        startTransition(async () => {
            let result;
            if (isEditing && expeditionToEdit) {
                result = await updateExpedition(expeditionToEdit.id, formData);
            } else {
                result = await createExpedition(formData);
            }

            if (result.success) {
                onClose();
            } else {
                setError(result.error || "Erro ao registrar expedição");
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
                            {isEditing ? "Editar Expedição" : "Nova Expedição"}
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
                        {/* Contract Select - Disabled if Editing (simplification) */}
                        {!isEditing && (
                            <div className="space-y-2">
                                <label htmlFor="contractId" className="text-sm font-medium text-foreground">
                                    Contrato Vinculado *
                                </label>
                                {contracts.length === 0 ? (
                                    <div className="p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
                                        Nenhum contrato ativo disponível. Crie um contrato primeiro.
                                    </div>
                                ) : (
                                    <select
                                        id="contractId"
                                        name="contractId"
                                        required
                                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                                    >
                                        <option value="">Selecione um contrato...</option>
                                        {contracts.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.contractNumber || "S/N"} - {c.customerName} ({c.remainingQuantity.toFixed(0)}t restantes)
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        )}

                        {isEditing && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">
                                    Contrato Vinculado
                                </label>
                                <div className="text-sm text-foreground p-2 bg-muted rounded">
                                    {expeditionToEdit?.contractNumber || "S/N"} - {expeditionToEdit?.customerName}
                                </div>
                            </div>
                        )}

                        {/* Truck Plate */}
                        <div className="space-y-2">
                            <label htmlFor="truckPlate" className="text-sm font-medium text-foreground">
                                Placa do Caminhão *
                            </label>
                            <input
                                id="truckPlate"
                                name="truckPlate"
                                type="text"
                                required
                                placeholder="ABC-1234"
                                defaultValue={expeditionToEdit?.truckPlate}
                                className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors uppercase"
                            />
                        </div>

                        {/* Weight Origin */}
                        <div className="space-y-2">
                            <label htmlFor="weightOrigin" className="text-sm font-medium text-foreground">
                                Peso de Saída (Usina) *
                            </label>
                            <div className="relative">
                                <input
                                    id="weightOrigin"
                                    name="weightOrigin"
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    required
                                    placeholder="25.500"
                                    defaultValue={expeditionToEdit?.weightOrigin}
                                    className="w-full h-10 px-3 pr-10 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                    t
                                </span>
                            </div>
                        </div>

                        {/* Date and Time */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label htmlFor="departureDate" className="text-sm font-medium text-foreground">
                                    Data Saída *
                                </label>
                                <input
                                    id="departureDate"
                                    name="departureDate"
                                    type="date"
                                    required
                                    defaultValue={defaultDate}
                                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                                />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="departureTime" className="text-sm font-medium text-foreground">
                                    Hora Saída
                                </label>
                                <input
                                    id="departureTime"
                                    name="departureTime"
                                    type="time"
                                    defaultValue={defaultTime}
                                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                                />
                            </div>
                        </div>

                        {!isEditing && (
                            <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm">
                                <p className="font-medium">Status: Em Trânsito</p>
                                <p className="text-xs mt-1 text-blue-400/80">
                                    Preencha o peso de chegada posteriormente para calcular a quebra.
                                </p>
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
                                disabled={isPending || (!isEditing && contracts.length === 0)}
                                className="flex-1 h-10 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                            >
                                {isPending ? "Salvando..." : (isEditing ? "Salvar Alterações" : "Registrar Saída")}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}
