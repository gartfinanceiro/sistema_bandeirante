import type { DischargeSchedule } from "@/types/database";

interface DischargeListProps {
    schedules: DischargeSchedule[];
    isLoading: boolean;
    onRegister: (schedule: DischargeSchedule) => void;
}

export function DischargeList({ schedules, isLoading, onRegister }: DischargeListProps) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-muted-foreground">Carregando agendas...</div>
            </div>
        );
    }

    if (schedules.length === 0) {
        return (
            <div className="flex items-center justify-center py-12 border rounded-lg bg-muted/50">
                <div className="text-center">
                    <p className="text-muted-foreground">Nenhuma agenda pendente para descarga</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        Todas as descargas do dia foram registradas
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
                <thead className="bg-muted">
                    <tr>
                        <th className="p-3 text-left text-sm font-medium w-16">Ordem</th>
                        <th className="p-3 text-left text-sm font-medium">Fornecedor</th>
                        <th className="p-3 text-left text-sm font-medium">Placa</th>
                        <th className="p-3 text-left text-sm font-medium">NF</th>
                        <th className="p-3 text-left text-sm font-medium">GCA</th>
                        <th className="p-3 text-left text-sm font-medium">Vol. Est. (MDC)</th>
                        <th className="p-3 text-right text-sm font-medium">Ação</th>
                    </tr>
                </thead>
                <tbody className="bg-background">
                    {schedules.map((schedule) => (
                        <tr key={schedule.id} className="border-t hover:bg-muted/50 transition-colors">
                            <td className="p-3">
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-bold text-sm">
                                    {schedule.sequence_order}
                                </div>
                            </td>
                            <td className="p-3 font-medium text-foreground">
                                {schedule.supplier?.name || "-"}
                            </td>
                            <td className="p-3">
                                <span className="font-mono text-sm font-medium">{schedule.truck_plate}</span>
                            </td>
                            <td className="p-3 text-sm text-muted-foreground">{schedule.invoice_number}</td>
                            <td className="p-3 text-sm text-muted-foreground">{schedule.gca_number}</td>
                            <td className="p-3 text-sm text-foreground">
                                {schedule.estimated_volume_mdc.toFixed(2)}
                            </td>
                            <td className="p-3 text-right">
                                <button
                                    onClick={() => onRegister(schedule)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                    Registrar
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
