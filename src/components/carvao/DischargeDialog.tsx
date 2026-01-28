"use client";

import { useState, useEffect } from "react";
import { createDischarge } from "@/app/(carvao)/carvao/descargas/actions";
import type { DischargeSchedule } from "@/types/database";

interface DischargeDialogProps {
    isOpen: boolean;
    onClose: () => void;
    schedule: DischargeSchedule | null;
}

export function DischargeDialog({ isOpen, onClose, schedule }: DischargeDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        volume_mdc: "",
        density: "",
        observations: "",
    });

    useEffect(() => {
        if (schedule) {
            // Pré-preencher volume com valor estimado da agenda
            setFormData({
                volume_mdc: schedule.estimated_volume_mdc.toString(),
                density: "",
                observations: "",
            });
        } else {
            setFormData({
                volume_mdc: "",
                density: "",
                observations: "",
            });
        }
    }, [schedule, isOpen]);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsSubmitting(true);

        const form = e.currentTarget;
        const data = new FormData(form);

        // Adicionar dados da agenda
        if (schedule) {
            data.append("schedule_id", schedule.id);
            data.append("supplier_id", schedule.supplier_id);
            data.append("discharge_date", schedule.scheduled_date);
            data.append("truck_plate", schedule.truck_plate);
            data.append("invoice_number", schedule.invoice_number);
            data.append("gca_number", schedule.gca_number);
        }

        const result = await createDischarge(data);

        setIsSubmitting(false);

        if (result.success) {
            onClose();
        } else {
            alert(result.error || "Erro ao registrar descarga");
        }
    }

    if (!isOpen || !schedule) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />

            {/* Dialog */}
            <div className="relative bg-background rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b">
                        <div>
                            <h2 className="text-xl font-semibold">Registrar Descarga</h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                Informe os dados da descarga realizada
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 space-y-4">
                        {/* Informações Somente Leitura */}
                        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                            <h3 className="text-sm font-semibold text-foreground">Dados da Agenda</h3>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Data:</span>
                                    <span className="ml-2 font-medium">
                                        {new Date(schedule.scheduled_date).toLocaleDateString("pt-BR")}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Ordem:</span>
                                    <span className="ml-2 font-medium">{schedule.sequence_order}º</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Fornecedor:</span>
                                    <span className="ml-2 font-medium">{schedule.supplier?.name || "-"}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Placa:</span>
                                    <span className="ml-2 font-mono font-medium">{schedule.truck_plate}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">NF:</span>
                                    <span className="ml-2 font-medium">{schedule.invoice_number}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">GCA:</span>
                                    <span className="ml-2 font-medium">{schedule.gca_number}</span>
                                </div>
                            </div>
                        </div>

                        {/* Campos de Medição */}
                        <div>
                            <label htmlFor="volume_mdc" className="block text-sm font-medium mb-1">
                                Volume Descarregado (MDC) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                id="volume_mdc"
                                name="volume_mdc"
                                value={formData.volume_mdc}
                                onChange={(e) => setFormData({ ...formData, volume_mdc: e.target.value })}
                                required
                                min="0"
                                step="0.001"
                                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                placeholder="25.500"
                                autoFocus
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Volume real medido em MDC (metros de carvão)
                            </p>
                        </div>

                        <div>
                            <label htmlFor="density" className="block text-sm font-medium mb-1">
                                Densidade (kg/mdc) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                id="density"
                                name="density"
                                value={formData.density}
                                onChange={(e) => setFormData({ ...formData, density: e.target.value })}
                                required
                                min="0"
                                step="0.001"
                                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                placeholder="450.000"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Densidade da carga em kg/mdc (calculará peso automaticamente)
                            </p>
                        </div>

                        {/* Observações */}
                        <div>
                            <label htmlFor="observations" className="block text-sm font-medium mb-1">
                                Observações
                            </label>
                            <textarea
                                id="observations"
                                name="observations"
                                value={formData.observations}
                                onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                                rows={3}
                                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                placeholder="Informações adicionais sobre a descarga (opcional)"
                            />
                        </div>

                        {/* Aviso sobre cálculo automático */}
                        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                            <div className="flex gap-2">
                                <svg
                                    className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                                <div className="text-sm text-blue-900 dark:text-blue-100">
                                    <strong>Cálculo automático:</strong> O peso em toneladas será calculado
                                    automaticamente com a fórmula: (volume × densidade) ÷ 1000
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 p-6 border-t bg-muted/30">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border rounded-md hover:bg-muted transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
                        >
                            {isSubmitting ? "Registrando..." : "Registrar Descarga"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
