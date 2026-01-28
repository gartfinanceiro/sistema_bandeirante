"use client";

import { useState, useEffect } from "react";
import { getPendingDischarges } from "./actions";
import { PendingDischargeList } from "@/components/carvao/PendingDischargeList";
import { ConfirmDischargeDialog } from "@/components/carvao/ConfirmDischargeDialog";
import type { Discharge } from "@/types/database";

export default function ConfirmacoesPage() {
    const [discharges, setDischarges] = useState<Discharge[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedDischarge, setSelectedDischarge] = useState<Discharge | null>(null);

    async function loadDischarges() {
        setIsLoading(true);
        const data = await getPendingDischarges();
        setDischarges(data);
        setIsLoading(false);
    }

    useEffect(() => {
        loadDischarges();
    }, []);

    function handleConfirm(discharge: Discharge) {
        setSelectedDischarge(discharge);
        setIsDialogOpen(true);
    }

    function handleDialogClose() {
        setIsDialogOpen(false);
        setSelectedDischarge(null);
        loadDischarges();
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-foreground">Confirmação de Descargas</h1>
                <p className="text-muted-foreground">Revise e confirme descargas para torná-las imutáveis</p>
            </div>

            {/* Informação sobre permissões */}
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex gap-3">
                    <svg
                        className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                    </svg>
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                            Acesso Restrito
                        </p>
                        <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                            Esta funcionalidade está disponível apenas para <strong>administradores</strong>.
                            Após a confirmação, os dados da descarga tornam-se permanentes e imutáveis.
                        </p>
                    </div>
                </div>
            </div>

            {/* Contador de Pendentes */}
            {!isLoading && discharges.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 font-bold text-xs">
                        {discharges.length}
                    </span>
                    <span className="text-muted-foreground">
                        {discharges.length === 1
                            ? "1 descarga pendente de confirmação"
                            : `${discharges.length} descargas pendentes de confirmação`}
                    </span>
                </div>
            )}

            {/* Lista de Descargas Pendentes */}
            <PendingDischargeList
                discharges={discharges}
                isLoading={isLoading}
                onConfirm={handleConfirm}
            />

            {/* Dialog */}
            <ConfirmDischargeDialog
                isOpen={isDialogOpen}
                onClose={handleDialogClose}
                discharge={selectedDischarge}
            />
        </div>
    );
}
