"use client";

import { useState, useTransition } from "react";
import { updateExpeditionArrival, type ExpeditionRow } from "@/app/(authenticated)/vendas/actions";

interface ExpeditionsListProps {
    expeditions: ExpeditionRow[];
    onRefresh: () => void;
    onEdit: (expedition: ExpeditionRow) => void;
    onDelete: (id: string) => void;
}

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
    em_usina: { label: "Em Usina", className: "bg-gray-500/20 text-gray-400" },
    em_transito: { label: "Em Trânsito", className: "bg-yellow-500/20 text-yellow-400" },
    entregue: { label: "Entregue", className: "bg-blue-500/20 text-blue-400" },
    aguardando_pagamento: { label: "Aguard. Pgto", className: "bg-purple-500/20 text-purple-400" },
    finalizado: { label: "Finalizado", className: "bg-green-500/20 text-green-400" },
};

export function ExpeditionsList({ expeditions, onRefresh, onEdit, onDelete }: ExpeditionsListProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [weightDestination, setWeightDestination] = useState("");
    const [isPending, startTransition] = useTransition();

    if (expeditions.length === 0) {
        return (
            <div className="bg-card border border-border rounded-lg p-8 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                </div>
                <p className="text-muted-foreground">Nenhuma expedição registrada</p>
                <p className="text-sm text-muted-foreground mt-1">
                    Clique em &quot;Nova Expedição&quot; para começar
                </p>
            </div>
        );
    }

    async function handleSaveArrival(expeditionId: string) {
        const weight = parseFloat(weightDestination);
        if (!weight || weight <= 0) return;

        startTransition(async () => {
            const result = await updateExpeditionArrival(expeditionId, weight);
            if (result.success) {
                setEditingId(null);
                setWeightDestination("");
                onRefresh();
            }
        });
    }

    return (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-border bg-muted/50">
                            <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                                Data
                            </th>
                            <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                                Placa
                            </th>
                            <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">
                                Cliente
                            </th>
                            <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3">
                                Saída
                            </th>
                            <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3">
                                Chegada
                            </th>
                            <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">
                                Quebra
                            </th>
                            <th className="text-center text-sm font-medium text-muted-foreground px-4 py-3">
                                Status
                            </th>
                            <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3">
                                Ações
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {expeditions.map((exp) => {
                            const badge = STATUS_BADGES[exp.status] || STATUS_BADGES.em_transito;
                            const isEditing = editingId === exp.id;

                            return (
                                <tr
                                    key={exp.id}
                                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                                >
                                    <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                                        {formatDate(exp.departureDate)}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-mono text-foreground">
                                        {exp.truckPlate}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                                        <span className="line-clamp-1">{exp.customerName}</span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right text-foreground">
                                        {exp.weightOrigin.toFixed(3)} t
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right">
                                        {isEditing ? (
                                            <div className="flex items-center gap-1 justify-end">
                                                <input
                                                    type="number"
                                                    step="0.001"
                                                    value={weightDestination}
                                                    onChange={(e) => setWeightDestination(e.target.value)}
                                                    className="w-20 h-7 px-2 text-xs rounded border border-input bg-background text-foreground"
                                                    placeholder="0.000"
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={() => handleSaveArrival(exp.id)}
                                                    disabled={isPending}
                                                    className="h-7 px-2 rounded bg-green-500/20 text-green-400 text-xs hover:bg-green-500/30"
                                                >
                                                    ✓
                                                </button>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="h-7 px-2 rounded bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ) : exp.weightDestination ? (
                                            <span className="text-foreground">{exp.weightDestination.toFixed(3)} t</span>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    setEditingId(exp.id);
                                                    setWeightDestination("");
                                                }}
                                                className="text-xs text-primary hover:underline"
                                            >
                                                + Registrar
                                            </button>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right hidden sm:table-cell">
                                        {exp.transportLossPercent !== null ? (
                                            <span
                                                className={
                                                    exp.transportLossPercent > 1
                                                        ? "text-red-400 font-medium"
                                                        : "text-muted-foreground"
                                                }
                                            >
                                                {exp.transportLossPercent.toFixed(2)}%
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span
                                            className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}
                                        >
                                            {badge.label}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right whitespace-nowrap">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => onEdit(exp)}
                                                className="p-1 text-muted-foreground hover:text-blue-500 transition-colors"
                                                title="Editar"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => onDelete(exp.id)}
                                                className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                                                title="Excluir"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
