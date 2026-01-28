import type { DischargeSchedule } from "@/types/database";

interface ScheduleListProps {
    schedule: DischargeSchedule[];
    isLoading: boolean;
    onEdit: (item: DischargeSchedule) => void;
}

const STATUS_LABELS: Record<string, string> = {
    aguardando: "Aguardando",
    confirmada: "Confirmada",
    descarregada: "Descarregada",
    nao_compareceu: "Não Compareceu",
};

const STATUS_COLORS: Record<string, string> = {
    aguardando: "bg-gray-100 text-gray-800",
    confirmada: "bg-blue-100 text-blue-800",
    descarregada: "bg-green-100 text-green-800",
    nao_compareceu: "bg-red-100 text-red-800",
};

export function ScheduleList({ schedule, isLoading, onEdit }: ScheduleListProps) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-muted-foreground">Carregando agenda...</div>
            </div>
        );
    }

    if (schedule.length === 0) {
        return (
            <div className="flex items-center justify-center py-12 border rounded-lg bg-muted/50">
                <div className="text-center">
                    <p className="text-muted-foreground">Nenhuma descarga agendada</p>
                    <p className="text-sm text-muted-foreground mt-1">Clique em "Novo Agendamento" para começar</p>
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
                        <th className="p-3 text-left text-sm font-medium">Volume (MDC)</th>
                        <th className="p-3 text-left text-sm font-medium">Status</th>
                        <th className="p-3 text-right text-sm font-medium">Ações</th>
                    </tr>
                </thead>
                <tbody className="bg-background">
                    {schedule.map((item) => (
                        <tr key={item.id} className="border-t hover:bg-muted/50 transition-colors">
                            <td className="p-3">
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                                    {item.sequence_order}
                                </div>
                            </td>
                            <td className="p-3 text-foreground">{item.supplier?.name || "-"}</td>
                            <td className="p-3">
                                <span className="font-mono text-sm font-medium">
                                    {item.truck_plate}
                                </span>
                            </td>
                            <td className="p-3 text-sm text-muted-foreground">{item.invoice_number}</td>
                            <td className="p-3 text-sm text-muted-foreground">{item.gca_number}</td>
                            <td className="p-3 text-sm text-foreground">{item.estimated_volume_mdc.toFixed(2)}</td>
                            <td className="p-3">
                                <span
                                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[item.status] || "bg-gray-100 text-gray-800"
                                        }`}
                                >
                                    {STATUS_LABELS[item.status] || item.status}
                                </span>
                            </td>
                            <td className="p-3 text-right">
                                {item.status !== "descarregada" && (
                                    <button
                                        onClick={() => onEdit(item)}
                                        className="text-primary hover:underline text-sm font-medium"
                                    >
                                        Editar
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
