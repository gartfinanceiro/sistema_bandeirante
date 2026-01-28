"use client";

import { useState, useEffect } from "react";
import { createSchedule, updateSchedule, getSuppliersForSelect } from "@/app/(carvao)/carvao/agenda/actions";
import type { DischargeSchedule } from "@/types/database";

interface ScheduleDialogProps {
    isOpen: boolean;
    onClose: () => void;
    initialData: DischargeSchedule | null;
    selectedDate: string;
}

export function ScheduleDialog({ isOpen, onClose, initialData, selectedDate }: ScheduleDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
    const [formData, setFormData] = useState({
        supplier_id: "",
        sequence_order: "",
        truck_plate: "",
        invoice_number: "",
        gca_number: "",
        estimated_volume_mdc: "",
        notes: "",
    });

    useEffect(() => {
        async function loadSuppliers() {
            const data = await getSuppliersForSelect();
            setSuppliers(data);
        }
        loadSuppliers();
    }, []);

    useEffect(() => {
        if (initialData) {
            setFormData({
                supplier_id: initialData.supplier_id || "",
                sequence_order: initialData.sequence_order.toString() || "",
                truck_plate: initialData.truck_plate || "",
                invoice_number: initialData.invoice_number || "",
                gca_number: initialData.gca_number || "",
                estimated_volume_mdc: initialData.estimated_volume_mdc.toString() || "",
                notes: initialData.notes || "",
            });
        } else {
            setFormData({
                supplier_id: "",
                sequence_order: "",
                truck_plate: "",
                invoice_number: "",
                gca_number: "",
                estimated_volume_mdc: "",
                notes: "",
            });
        }
    }, [initialData, isOpen]);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsSubmitting(true);

        const form = e.currentTarget;
        const data = new FormData(form);

        // Adicionar data selecionada
        data.append("scheduled_date", selectedDate);

        if (initialData) {
            data.append("id", initialData.id);
        }

        const result = initialData ? await updateSchedule(data) : await createSchedule(data);

        setIsSubmitting(false);

        if (result.success) {
            onClose();
        } else {
            alert(result.error || "Erro ao salvar agendamento");
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />

            {/* Dialog */}
            <div className="relative bg-background rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b">
                        <h2 className="text-xl font-semibold">
                            {initialData ? "Editar Agendamento" : "Novo Agendamento"}
                        </h2>
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
                        {/* Fornecedor */}
                        <div>
                            <label htmlFor="supplier_id" className="block text-sm font-medium mb-1">
                                Fornecedor <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="supplier_id"
                                name="supplier_id"
                                value={formData.supplier_id}
                                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                                required
                                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                <option value="">Selecione um fornecedor</option>
                                {suppliers.map((supplier) => (
                                    <option key={supplier.id} value={supplier.id}>
                                        {supplier.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Grid: Ordem e Placa */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="sequence_order" className="block text-sm font-medium mb-1">
                                    Ordem <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    id="sequence_order"
                                    name="sequence_order"
                                    value={formData.sequence_order}
                                    onChange={(e) => setFormData({ ...formData, sequence_order: e.target.value })}
                                    required
                                    min="1"
                                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                    placeholder="1"
                                />
                            </div>
                            <div>
                                <label htmlFor="truck_plate" className="block text-sm font-medium mb-1">
                                    Placa <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="truck_plate"
                                    name="truck_plate"
                                    value={formData.truck_plate}
                                    onChange={(e) => setFormData({ ...formData, truck_plate: e.target.value.toUpperCase() })}
                                    required
                                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                                    placeholder="ABC-1234"
                                />
                            </div>
                        </div>

                        {/* Grid: NF e GCA */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="invoice_number" className="block text-sm font-medium mb-1">
                                    Nota Fiscal (NF) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="invoice_number"
                                    name="invoice_number"
                                    value={formData.invoice_number}
                                    onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                                    required
                                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                    placeholder="NF-001/2026"
                                />
                            </div>
                            <div>
                                <label htmlFor="gca_number" className="block text-sm font-medium mb-1">
                                    GCA <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="gca_number"
                                    name="gca_number"
                                    value={formData.gca_number}
                                    onChange={(e) => setFormData({ ...formData, gca_number: e.target.value })}
                                    required
                                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                    placeholder="GCA-12345"
                                />
                            </div>
                        </div>

                        {/* Volume Estimado */}
                        <div>
                            <label htmlFor="estimated_volume_mdc" className="block text-sm font-medium mb-1">
                                Volume Estimado (MDC) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                id="estimated_volume_mdc"
                                name="estimated_volume_mdc"
                                value={formData.estimated_volume_mdc}
                                onChange={(e) => setFormData({ ...formData, estimated_volume_mdc: e.target.value })}
                                required
                                min="0"
                                step="0.01"
                                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                placeholder="25.5"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Volume em MDC (metros de carvão)
                            </p>
                        </div>

                        {/* Observações */}
                        <div>
                            <label htmlFor="notes" className="block text-sm font-medium mb-1">
                                Observações
                            </label>
                            <textarea
                                id="notes"
                                name="notes"
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                rows={3}
                                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                placeholder="Informações adicionais sobre este agendamento"
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 p-6 border-t">
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
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            {isSubmitting ? "Salvando..." : "Salvar"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
