"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import {
    getAdvances,
    createComplementPayment,
    type AdvanceListItem,
} from "@/app/(authenticated)/financeiro/advance-actions";
import { createTransaction } from "@/app/(authenticated)/financeiro/actions";

// =============================================================================
// Status helpers
// =============================================================================

const STATUS_CONFIG = {
    adiantamento_pago: { label: "Aguardando Descarga", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
    descarregado: { label: "Aguardando Complemento", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
    finalizado: { label: "Finalizado", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
} as const;

function formatCurrency(value: number): string {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr: string): string {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
}

// =============================================================================
// Component
// =============================================================================

interface AdvanceTrackerDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AdvanceTrackerDialog({ isOpen, onClose }: AdvanceTrackerDialogProps) {
    const [advances, setAdvances] = useState<AdvanceListItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Complement form state
    const [complementDate, setComplementDate] = useState(new Date().toISOString().split("T")[0]);
    const [complementDescription, setComplementDescription] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const loadAdvances = useCallback(async () => {
        setIsLoading(true);
        const data = await getAdvances(filterStatus !== "all" ? { status: filterStatus } : undefined);
        setAdvances(data);
        setIsLoading(false);
    }, [filterStatus]);

    useEffect(() => {
        if (isOpen) {
            loadAdvances();
            setExpandedId(null);
            setError(null);
            setSuccessMessage(null);
        }
    }, [isOpen, loadAdvances]);

    async function handlePayComplement(advance: AdvanceListItem) {
        if (!advance.pending_balance || advance.pending_balance <= 0) {
            setError("Não há saldo pendente para complementar");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            // 1. Create the complement transaction
            const formData = new FormData();
            formData.set("type", "saida");
            formData.set("amount", Math.abs(advance.pending_balance).toString());
            formData.set("date", complementDate);
            formData.set("categoryId", "raw_material_charcoal");
            formData.set("status", "pago");
            formData.set("description", complementDescription || `Complemento Carvão - ${advance.supplier_name || advance.carvao_supplier_name || "Fornecedor"}`);
            formData.set("hasIcmsCredit", "false");
            formData.set("icmsRate", "0");

            const txResult = await createTransaction(formData);

            if (!txResult.success || !txResult.transactionId) {
                setError(txResult.error || "Erro ao criar transação do complemento");
                setIsSubmitting(false);
                return;
            }

            // 2. Link complement to advance
            const compResult = await createComplementPayment({
                advanceId: advance.id,
                complementTransactionId: txResult.transactionId,
                complementAmount: Math.abs(advance.pending_balance),
                complementDate,
            });

            if (compResult.success) {
                setSuccessMessage(`Complemento de ${formatCurrency(Math.abs(advance.pending_balance))} registrado com sucesso!`);
                setExpandedId(null);
                loadAdvances();
            } else {
                setError(compResult.error || "Erro ao vincular complemento");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erro inesperado");
        }

        setIsSubmitting(false);
    }

    if (!isOpen) return null;

    const filteredAdvances = advances;
    const pendingComplementCount = advances.filter(a => a.status === "descarregado").length;
    const pendingDischargeCount = advances.filter(a => a.status === "adiantamento_pago").length;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                            <svg className="w-5 h-5 text-amber-700 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-foreground">
                                Adiantamentos de Carvão
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {pendingDischargeCount > 0 && `${pendingDischargeCount} aguardando descarga`}
                                {pendingDischargeCount > 0 && pendingComplementCount > 0 && " · "}
                                {pendingComplementCount > 0 && `${pendingComplementCount} aguardando complemento`}
                                {pendingDischargeCount === 0 && pendingComplementCount === 0 && "Nenhum adiantamento pendente"}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
                    {["all", "adiantamento_pago", "descarregado", "finalizado"].map(s => {
                        const label = s === "all" ? "Todos" : STATUS_CONFIG[s as keyof typeof STATUS_CONFIG].label;
                        return (
                            <button
                                key={s}
                                onClick={() => setFilterStatus(s)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                    filterStatus === s
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted hover:bg-accent text-muted-foreground"
                                }`}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>

                {/* Messages */}
                {error && (
                    <div className="mx-4 mt-3 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                        {error}
                    </div>
                )}
                {successMessage && (
                    <div className="mx-4 mt-3 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-300">
                        {successMessage}
                    </div>
                )}

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        </div>
                    ) : filteredAdvances.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <p className="text-lg font-medium">Nenhum adiantamento encontrado</p>
                            <p className="text-sm mt-1">
                                Adiantamentos aparecem aqui quando marcados na importação ou criação manual de transações.
                            </p>
                        </div>
                    ) : (
                        filteredAdvances.map(adv => {
                            const statusConf = STATUS_CONFIG[adv.status];
                            const isExpanded = expandedId === adv.id;

                            return (
                                <div
                                    key={adv.id}
                                    className={`border rounded-lg overflow-hidden transition-colors ${
                                        adv.status === "descarregado"
                                            ? "border-blue-200 dark:border-blue-800"
                                            : adv.status === "adiantamento_pago"
                                                ? "border-amber-200 dark:border-amber-800"
                                                : "border-border"
                                    }`}
                                >
                                    {/* Advance row */}
                                    <button
                                        onClick={() => setExpandedId(isExpanded ? null : adv.id)}
                                        className="w-full flex items-center gap-3 p-3 hover:bg-accent/30 transition-colors text-left"
                                    >
                                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}

                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusConf.color}`}>
                                            {statusConf.label}
                                        </span>

                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-foreground truncate">
                                                {adv.supplier_name || adv.carvao_supplier_name || "Fornecedor não informado"}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatDate(adv.advance_date)}
                                                {adv.advance_transaction_description && ` — ${adv.advance_transaction_description}`}
                                            </p>
                                        </div>

                                        <div className="text-right">
                                            <p className="text-sm font-mono font-semibold text-foreground">
                                                {formatCurrency(adv.advance_amount)}
                                            </p>
                                            {adv.pending_balance !== null && adv.pending_balance > 0 && (
                                                <p className="text-xs font-mono text-red-600 dark:text-red-400">
                                                    Saldo: {formatCurrency(adv.pending_balance)}
                                                </p>
                                            )}
                                        </div>
                                    </button>

                                    {/* Expanded details */}
                                    {isExpanded && (
                                        <div className="border-t border-border p-4 bg-muted/20 space-y-3">
                                            {/* Info grid */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                                <div>
                                                    <span className="text-xs text-muted-foreground uppercase">Adiantamento</span>
                                                    <p className="font-semibold">{formatCurrency(adv.advance_amount)}</p>
                                                    <p className="text-xs text-muted-foreground">{formatDate(adv.advance_date)}</p>
                                                </div>
                                                {adv.discharge_id && (
                                                    <div>
                                                        <span className="text-xs text-muted-foreground uppercase">Descarga</span>
                                                        <p className="font-semibold">
                                                            {adv.discharge_volume_mdc?.toFixed(3)} MDC / {adv.discharge_weight_tons?.toFixed(3)}t
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {adv.discharge_date && formatDate(adv.discharge_date)}
                                                        </p>
                                                    </div>
                                                )}
                                                {adv.total_calculated_value && (
                                                    <div>
                                                        <span className="text-xs text-muted-foreground uppercase">Valor Total</span>
                                                        <p className="font-semibold">{formatCurrency(adv.total_calculated_value)}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            R$ {adv.price_per_ton_used?.toFixed(2)}/ton
                                                        </p>
                                                    </div>
                                                )}
                                                {adv.complement_amount && (
                                                    <div>
                                                        <span className="text-xs text-muted-foreground uppercase">Complemento</span>
                                                        <p className="font-semibold text-green-700 dark:text-green-400">
                                                            {formatCurrency(adv.complement_amount)}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {adv.complement_date && formatDate(adv.complement_date)}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            {adv.notes && (
                                                <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                                                    {adv.notes}
                                                </p>
                                            )}

                                            {/* Complement action — only for descarregado status */}
                                            {adv.status === "descarregado" && adv.pending_balance !== null && adv.pending_balance > 0 && (
                                                <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-3 bg-blue-50 dark:bg-blue-950/20 space-y-3">
                                                    <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                                                        Registrar Complemento
                                                    </h4>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="text-xs font-medium text-blue-700 dark:text-blue-300">
                                                                Valor
                                                            </label>
                                                            <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
                                                                {formatCurrency(adv.pending_balance)}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-medium text-blue-700 dark:text-blue-300">
                                                                Data do Complemento
                                                            </label>
                                                            <input
                                                                type="date"
                                                                value={complementDate}
                                                                onChange={(e) => setComplementDate(e.target.value)}
                                                                className="w-full h-8 px-2 rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-background text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-medium text-blue-700 dark:text-blue-300">
                                                            Descrição (opcional)
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={complementDescription}
                                                            onChange={(e) => setComplementDescription(e.target.value)}
                                                            placeholder={`Complemento Carvão - ${adv.supplier_name || ""}`}
                                                            className="w-full h-8 px-2 rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-background text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => handlePayComplement(adv)}
                                                        disabled={isSubmitting}
                                                        className="w-full py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                                    >
                                                        {isSubmitting ? "Registrando..." : `Pagar Complemento de ${formatCurrency(adv.pending_balance)}`}
                                                    </button>
                                                </div>
                                            )}

                                            {/* Waiting for discharge */}
                                            {adv.status === "adiantamento_pago" && (
                                                <div className="border border-amber-200 dark:border-amber-800 rounded-lg p-3 bg-amber-50 dark:bg-amber-950/20">
                                                    <p className="text-sm text-amber-800 dark:text-amber-200">
                                                        Aguardando descarga. Quando o carvão for descarregado, vincule este adiantamento
                                                        na tela de <strong>Confirmação de Descargas</strong> do módulo Carvão.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t border-border bg-muted/30">
                    <p className="text-xs text-muted-foreground">
                        {filteredAdvances.length} adiantamento{filteredAdvances.length !== 1 ? "s" : ""}
                    </p>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-accent transition-colors"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}
