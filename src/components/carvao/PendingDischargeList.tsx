import type { Discharge } from "@/types/database";

interface PendingDischargeListProps {
    discharges: Discharge[];
    isLoading: boolean;
    onConfirm: (discharge: Discharge) => void;
}

export function PendingDischargeList({ discharges, isLoading, onConfirm }: PendingDischargeListProps) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-muted-foreground">Carregando descargas pendentes...</div>
            </div>
        );
    }

    if (discharges.length === 0) {
        return (
            <div className="flex items-center justify-center py-12 border rounded-lg bg-muted/50">
                <div className="text-center">
                    <svg
                        className="w-12 h-12 mx-auto text-green-500 mb-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                    <p className="text-muted-foreground font-medium">Todas as descargas foram confirmadas</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        Não há descargas pendentes de confirmação
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
                        <th className="p-3 text-left text-sm font-medium">Data</th>
                        <th className="p-3 text-left text-sm font-medium">Fornecedor</th>
                        <th className="p-3 text-left text-sm font-medium">Placa</th>
                        <th className="p-3 text-left text-sm font-medium">NF</th>
                        <th className="p-3 text-left text-sm font-medium">GCA</th>
                        <th className="p-3 text-right text-sm font-medium">Volume (MDC)</th>
                        <th className="p-3 text-right text-sm font-medium">Densidade</th>
                        <th className="p-3 text-right text-sm font-medium">Peso (ton)</th>
                        <th className="p-3 text-right text-sm font-medium">Ação</th>
                    </tr>
                </thead>
                <tbody className="bg-background">
                    {discharges.map((discharge) => (
                        <tr key={discharge.id} className="border-t hover:bg-muted/50 transition-colors">
                            <td className="p-3 text-sm">
                                {new Date(discharge.discharge_date).toLocaleDateString("pt-BR")}
                            </td>
                            <td className="p-3 font-medium text-foreground">
                                {discharge.supplier?.name || "-"}
                            </td>
                            <td className="p-3">
                                <span className="font-mono text-sm font-medium">{discharge.truck_plate}</span>
                            </td>
                            <td className="p-3 text-sm text-muted-foreground">{discharge.invoice_number}</td>
                            <td className="p-3 text-sm text-muted-foreground">{discharge.gca_number}</td>
                            <td className="p-3 text-right text-sm font-medium">
                                {discharge.volume_mdc.toFixed(3)}
                            </td>
                            <td className="p-3 text-right text-sm text-muted-foreground">
                                {discharge.density.toFixed(3)}
                            </td>
                            <td className="p-3 text-right text-sm font-bold text-foreground">
                                {discharge.weight_tons.toFixed(3)}
                            </td>
                            <td className="p-3 text-right">
                                <button
                                    onClick={() => onConfirm(discharge)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    Confirmar
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
