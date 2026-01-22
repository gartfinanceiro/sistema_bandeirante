import type { ProductionRow } from "@/app/(authenticated)/producao/actions";

interface ProductionTableProps {
    productions: ProductionRow[];
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onEdit: (production: ProductionRow) => void;
    onDelete: (id: string) => void;
}

function formatDate(dateString: string): string {
    // Add timezone offset correction or just parse as UTC split
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
}

export function ProductionTable({
    productions,
    page,
    totalPages,
    onPageChange,
    onEdit,
    onDelete,
}: ProductionTableProps) {
    if (productions.length === 0) {
        return (
            <div className="bg-card border border-border rounded-lg p-8 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                </div>
                <p className="text-muted-foreground">Nenhuma produção registrada</p>
                <p className="text-sm text-muted-foreground mt-1">
                    Clique em &quot;Lançar Produção&quot; para começar
                </p>
            </div>
        );
    }

    return (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-border bg-muted/50">
                            <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                                Data
                            </th>
                            <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3">
                                Produção
                            </th>
                            <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">
                                Observações
                            </th>
                            <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3">
                                Ações
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {productions.map((prod) => (
                            <tr
                                key={prod.id}
                                className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                            >
                                <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                                    {formatDate(prod.date)}
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-right whitespace-nowrap">
                                    <span className="text-primary">{prod.tonsProduced.toFixed(1)} t</span>
                                </td>
                                <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                                    <span className="line-clamp-1">
                                        {prod.technicalNotes || (
                                            <span className="italic">-</span>
                                        )}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => onEdit(prod)}
                                            className="p-1 text-muted-foreground hover:text-blue-500 transition-colors"
                                            title="Editar"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => onDelete(prod.id)}
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
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                        Página {page} de {totalPages}
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => onPageChange(page - 1)}
                            disabled={page <= 1}
                            className="h-8 px-3 rounded-md text-sm border border-border text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Anterior
                        </button>
                        <button
                            onClick={() => onPageChange(page + 1)}
                            disabled={page >= totalPages}
                            className="h-8 px-3 rounded-md text-sm border border-border text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Próxima
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
