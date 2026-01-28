"use client";

import { useState, useEffect } from "react";
import { getScheduleByDate, generateWhatsAppText } from "./actions";
import { ScheduleList } from "@/components/carvao/ScheduleList";
import { ScheduleDialog } from "@/components/carvao/ScheduleDialog";
import { WhatsAppPreview } from "@/components/carvao/WhatsAppPreview";
import type { DischargeSchedule } from "@/types/database";

export default function AgendaPage() {
    const today = new Date().toISOString().split("T")[0];
    const [selectedDate, setSelectedDate] = useState(today);
    const [schedule, setSchedule] = useState<DischargeSchedule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<DischargeSchedule | null>(null);
    const [whatsappText, setWhatsappText] = useState("");

    async function loadSchedule() {
        setIsLoading(true);
        const data = await getScheduleByDate(selectedDate);
        setSchedule(data);

        // Gerar texto do WhatsApp
        const text = await generateWhatsAppText(selectedDate);
        setWhatsappText(text);

        setIsLoading(false);
    }

    useEffect(() => {
        loadSchedule();
    }, [selectedDate]);

    function handleEdit(item: DischargeSchedule) {
        setEditingSchedule(item);
        setIsDialogOpen(true);
    }

    function handleDialogClose() {
        setIsDialogOpen(false);
        setEditingSchedule(null);
        loadSchedule();
    }

    function handleNewSchedule() {
        setEditingSchedule(null);
        setIsDialogOpen(true);
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Agenda de Descarga</h1>
                    <p className="text-muted-foreground">Organização diária da fila de descargas</p>
                </div>
                <button
                    onClick={handleNewSchedule}
                    className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground font-medium shadow hover:bg-primary/90 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Novo Agendamento
                </button>
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

            {/* Lista de Agenda */}
            <ScheduleList
                schedule={schedule}
                isLoading={isLoading}
                onEdit={handleEdit}
            />

            {/* Preview do WhatsApp */}
            <WhatsAppPreview text={whatsappText} />

            {/* Dialog */}
            <ScheduleDialog
                isOpen={isDialogOpen}
                onClose={handleDialogClose}
                initialData={editingSchedule}
                selectedDate={selectedDate}
            />
        </div>
    );
}
