"use client";

import { useState } from "react";
import { confirmDischarge } from "@/app/(carvao)/carvao/confirmacoes/actions";
import type { Discharge } from "@/types/database";

interface ConfirmDischargeDialogProps {
    isOpen: boolean;
    onClose: () => void;
    discharge: Discharge | null;
}

export function ConfirmDischargeDialog({ isOpen, onClose, discharge }: ConfirmDischargeDialogProps) {
    const [isConfirming, setIsConfirming] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!discharge) return;

        setIsConfirming(true);

        const formData = new FormData(e.currentTarget);
        formData.append("id", discharge.id);

        const result = await confirmDischarge(formData);

        setIsConfirming(false);

        if (result.success) {
            onClose();
        } else {
            alert(result.error || "Erro ao confirmar descarga");
        }
    }

    if (!isOpen || !discharge) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />

            {/* Dialog */}
            <div className="relative bg-background rounded-lg shadow-lg w-full max-w-5xl max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-background z-10">
                        <div>
                            <h2 className="text-xl font-semibold">Confirmar Descarga</h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                Preencha os dados operacionais e confirme
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
                    <div className="p-6 space-y-6">
                        {/* 🔒 Dados da Descarga (readonly) */}
                        <div>
                            <h3 className="text-base font-semibold mb-3">Dados da Descarga</h3>
                            <div className="grid grid-cols-3 gap-4 bg-muted/50 rounded-lg p-4">
                                <div>
                                    <span className="text-xs text-muted-foreground uppercase font-medium">
                                        Data
                                    </span>
                                    <p className="text-sm font-semibold mt-1">
                                        {new Date(discharge.discharge_date).toLocaleDateString("pt-BR", {
                                            day: "2-digit",
                                            month: "long",
                                            year: "numeric",
                                        })}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground uppercase font-medium">
                                        Fornecedor
                                    </span>
                                    <p className="text-sm font-semibold mt-1">
                                        {discharge.supplier?.name || "-"}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground uppercase font-medium">
                                        Placa
                                    </span>
                                    <p className="text-sm font-mono font-semibold mt-1">
                                        {discharge.truck_plate}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground uppercase font-medium">
                                        NF
                                    </span>
                                    <p className="text-sm font-semibold mt-1">{discharge.invoice_number}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground uppercase font-medium">
                                        GCA
                                    </span>
                                    <p className="text-sm font-semibold mt-1">{discharge.gca_number}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground uppercase font-medium">
                                        Mês Consolidação
                                    </span>
                                    <p className="text-sm font-semibold mt-1">
                                        {discharge.consolidation_month}
                                    </p>
                                </div>
                            </div>

                            {/* Medições */}
                            <div className="grid grid-cols-3 gap-4 mt-4">
                                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                    <span className="text-xs text-blue-700 dark:text-blue-300 uppercase font-medium">
                                        Volume
                                    </span>
                                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">
                                        {discharge.volume_mdc.toFixed(3)}
                                    </p>
                                    <span className="text-xs text-blue-600 dark:text-blue-400">MDC</span>
                                </div>
                                <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                                    <span className="text-xs text-purple-700 dark:text-purple-300 uppercase font-medium">
                                        Densidade
                                    </span>
                                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-100 mt-1">
                                        {discharge.density.toFixed(3)}
                                    </p>
                                    <span className="text-xs text-purple-600 dark:text-purple-400">
                                        kg/mdc
                                    </span>
                                </div>
                                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
                                    <span className="text-xs text-green-700 dark:text-green-300 uppercase font-medium">
                                        Peso Total
                                    </span>
                                    <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1">
                                        {discharge.weight_tons.toFixed(3)}
                                    </p>
                                    <span className="text-xs text-green-600 dark:text-green-400">
                                        toneladas
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* ✏️ GRUPO 1: Qualidade e Medições */}
                        <div className="border rounded-lg p-4">
                            <h3 className="text-base font-semibold mb-4">Qualidade e Medições</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Impureza (%)
                                    </label>
                                    <input
                                        type="number"
                                        name="impurity_percent"
                                        step="0.01"
                                        min="0"
                                        max="100"
                                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                        placeholder="Ex: 2.5"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Umidade (%)
                                    </label>
                                    <input
                                        type="number"
                                        name="humidity_percent"
                                        step="0.01"
                                        min="0"
                                        max="100"
                                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                        placeholder="Ex: 15.0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Desconto (MDC)
                                    </label>
                                    <input
                                        type="number"
                                        name="discount_mdc"
                                        step="0.001"
                                        min="0"
                                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                        placeholder="Ex: 3.500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Desconto (kg)
                                    </label>
                                    <input
                                        type="number"
                                        name="discount_kg"
                                        step="0.001"
                                        min="0"
                                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                        placeholder="Ex: 500.000"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ✏️ GRUPO 2: Classificação */}
                        <div className="border rounded-lg p-4">
                            <h3 className="text-base font-semibold mb-4">Classificação</h3>
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Tipo de Carga
                                </label>
                                <select
                                    name="cargo_type"
                                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                    <option value="">Selecione...</option>
                                    <option value="juridico">Jurídico</option>
                                    <option value="fisico">Físico</option>
                                </select>
                            </div>
                        </div>

                        {/* ✏️ GRUPO 3: Valores de Referência */}
                        <div className="border rounded-lg p-4">
                            <h3 className="text-base font-semibold mb-4">
                                Valores de Referência <span className="text-muted-foreground text-xs font-normal">(informativos)</span>
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Preço por tonelada (R$/ton)
                                    </label>
                                    <input
                                        type="number"
                                        name="price_per_ton"
                                        step="0.01"
                                        min="0"
                                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                        placeholder="Ex: 1500.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Valor Bruto (R$)
                                    </label>
                                    <input
                                        type="number"
                                        name="gross_value"
                                        step="0.01"
                                        min="0"
                                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                        placeholder="Ex: 37500.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Funrural (R$)
                                    </label>
                                    <input
                                        type="number"
                                        name="funrural_value"
                                        step="0.01"
                                        min="0"
                                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                        placeholder="Ex: 750.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Valor Líquido (R$)
                                    </label>
                                    <input
                                        type="number"
                                        name="net_value"
                                        step="0.01"
                                        min="0"
                                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                        placeholder="Ex: 36750.00"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium mb-2">
                                        Data de Pagamento (informativa)
                                    </label>
                                    <input
                                        type="date"
                                        name="payment_date"
                                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ✏️ GRUPO 4: Identificação */}
                        <div className="border rounded-lg p-4">
                            <h3 className="text-base font-semibold mb-4">Identificação Adicional</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Metreiro
                                    </label>
                                    <input
                                        type="text"
                                        name="meter_operator"
                                        maxLength={100}
                                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                        placeholder="Nome do metreiro"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Procurador
                                    </label>
                                    <input
                                        type="text"
                                        name="agent_name"
                                        maxLength={200}
                                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                        placeholder="Nome do procurador"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ✏️ Observações de Confirmação */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Observações de Confirmação <span className="text-muted-foreground text-xs font-normal">(opcional)</span>
                            </label>
                            <textarea
                                name="confirmation_notes"
                                rows={3}
                                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                placeholder="Adicione observações sobre a confirmação, se necessário"
                            />
                        </div>

                        {/* ⚠️ Alerta Crítico */}
                        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                            <div className="flex gap-3">
                                <svg
                                    className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                    />
                                </svg>
                                <div>
                                    <p className="text-sm font-semibold text-red-900 dark:text-red-100">
                                        Ação Irreversível
                                    </p>
                                    <p className="text-sm text-red-800 dark:text-red-200 mt-1">
                                        Após confirmar, esta descarga <strong>não poderá ser alterada</strong>.
                                        Os dados tornam-se imutáveis e serão utilizados para consolidação e
                                        auditoria.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 p-6 border-t bg-muted/30 sticky bottom-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border rounded-md hover:bg-muted transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isConfirming}
                            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
                        >
                            {isConfirming ? "Confirmando..." : "Confirmar Descarga"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
