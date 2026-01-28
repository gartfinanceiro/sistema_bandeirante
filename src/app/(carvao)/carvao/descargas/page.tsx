"use client";

import { useState, useEffect } from "react";
import { getSchedulesForDischarge } from "./actions";
import { DischargeList } from "@/components/carvao/DischargeList";
import { DischargeDialog } from "@/components/carvao/DischargeDialog";
import type { DischargeSchedule } from "@/types/database";

export default function DescargasPage() {
    const today = new Date().toISOString().split("T")[0];
    const [selectedDate, setSelectedDate] = useState(today);
    const [schedules, setSchedules] = useState<DischargeSchedule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedSchedule, setSelectedSchedule] = useState<DischargeSchedule | null>(null);

    async function loadSchedules() {
        setIsLoading(true);
        const data = await getSchedulesForDischarge(selectedDate);
        setSchedules(data);
        setIsLoading(false);
    }

    useEffect(() => {
        loadSchedules();
    }, [selectedDate]);

    function handleRegister(schedule: DischargeSchedule) {
        setSelectedSchedule(schedule);
        setIsDialogOpen(true);
    }

    function handleDialogClose() {
        setIsDialogOpen(false);
        setSelectedSchedule(null);
        loadSchedules();
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-foreground">Registro de Descarga</h1>
                <p className="text-muted-foreground">Registre as descargas realizadas no pátio</p>
            </div>

            {/* Seletor de Data */}
            <div className="flex items-center gap-3">
                <label htmlFor="date-selector" className="text-sm font-medium">
                    Data:
                </label>
                <input
                    id="date-selector"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                    onClick={() => setSelectedDate(today)}
                    className="px-3 py-2 text-sm border rounded-md hover:bg-muted transition-colors"
                >
                    Hoje
                </button>
            </div>

            {/* Informação sobre filtro */}
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
                    <p className="text-sm text-blue-900 dark:text-blue-100">
                        Mostrando apenas agendas <strong>aguardando</strong> ou <strong>confirmadas</strong>.
                        Descargas já registradas não aparecem nesta lista.
                    </p>
                </div>
            </div>

            {/* Lista de Agendas */}
            <DischargeList
                schedules={schedules}
                isLoading={isLoading}
                onRegister={handleRegister}
            />

            {/* Dialog */}
            <DischargeDialog
                isOpen={isDialogOpen}
                onClose={handleDialogClose}
                schedule={selectedSchedule}
            />
        </div>
    );
}
