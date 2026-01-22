import type { TransactionRow } from "@/app/(authenticated)/financeiro/actions";

interface TransactionTableProps {
    transactions: TransactionRow[];
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onEdit: (transaction: TransactionRow) => void;
    onDelete: (id: string) => void;
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(value);
}

function formatDate(dateString: string): string {
    return new Date(dateString + "T00:00:00").toLocaleDateString("pt-BR");
}

export function TransactionTable({
    transactions,
    page,
    totalPages,
    onPageChange,
    onEdit,
    onDelete,
}: TransactionTableProps) {
    if (transactions.length === 0) {
        return (
            <div className="bg-card border border-border rounded-lg p-8 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                </div>
                <p className="text-muted-foreground">Nenhuma transação encontrada</p>
                <p className="text-sm text-muted-foreground mt-1">
                    Clique em &quot;Nova Transação&quot; para começar
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
                            <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                                Descrição
                            </th>
                            <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">
                                Categoria
                            </th>
                            <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">
                                Status
                            </th>
                            <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3">
                                Valor
                            </th>
                            <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3 w-[100px]">
                                Ações
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map((tx) => (
                            <tr
                                key={tx.id}
                                className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                            >
                                <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                                    {formatDate(tx.date)}
                                </td>
                                <td className="px-4 py-3 text-sm text-foreground">
                                    <span className="line-clamp-1">
                                        {tx.description || (
                                            <span className="text-muted-foreground italic">
                                                Sem descrição
                                            </span>
                                        )}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                                    {tx.category ? (
                                        <span className="inline-flex items-center gap-1">
                                            <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                                {tx.category.costCenter.code}
                                            </span>
                                            {tx.category.name}
                                        </span>
                                    ) : (
                                        <span className="italic">-</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-sm hidden sm:table-cell">
                                    <span
                                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${tx.status === "pago"
                                            ? "bg-green-500/20 text-green-400"
                                            : "bg-yellow-500/20 text-yellow-400"
                                            }`}
                                    >
                                        {tx.status === "pago" ? "Pago" : "Pendente"}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-right whitespace-nowrap">
                                    <span
                                        className={
                                            tx.type === "entrada" ? "text-green-400" : "text-red-400"
                                        }
                                    >
                                        {tx.type === "entrada" ? "+" : "-"}
                                        {formatCurrency(tx.amount)}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => onEdit(tx)}
                                            className="p-1 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 rounded transition-colors"
                                            title="Editar"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => onDelete(tx.id)}
                                            className="p-1 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
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
