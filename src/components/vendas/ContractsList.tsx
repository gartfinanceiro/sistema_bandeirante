import type { ContractRow } from "@/app/(authenticated)/vendas/actions";

interface ContractsListProps {
    contracts: ContractRow[];
    onEdit: (contract: ContractRow) => void;
    onDelete: (id: string) => void;
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(value);
}

function formatDate(dateString: string): string {
    if (!dateString) return "-";
    // naive parse
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
}

export function ContractsList({ contracts, onEdit, onDelete }: ContractsListProps) {
    if (contracts.length === 0) {
        return (
            <div className="bg-card border border-border rounded-lg p-8 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                </div>
                <p className="text-muted-foreground">Nenhum contrato cadastrado</p>
                <p className="text-sm text-muted-foreground mt-1">
                    Clique em &quot;Novo Contrato&quot; para começar
                </p>
            </div>
        );
    }

    return (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-border bg-muted/50">
                            <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                                Cliente
                            </th>
                            <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">
                                Vigência
                            </th>
                            <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3">
                                Contratado
                            </th>
                            <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">
                                Entregue
                            </th>
                            <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3">
                                Saldo
                            </th>
                            <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">
                                Valor
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
                        {contracts.map((contract) => {
                            const completionPercent = contract.contractedQuantity > 0
                                ? (contract.deliveredQuantity / contract.contractedQuantity) * 100
                                : 0;
                            return (
                                <tr
                                    key={contract.id}
                                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                                >
                                    <td className="px-4 py-3">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">
                                                {contract.customerName}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {contract.contractNumber || "S/N"}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-muted-foreground hidden lg:table-cell">
                                        {formatDate(contract.startDate)} - {formatDate(contract.endDate)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm text-foreground">
                                        {contract.contractedQuantity.toFixed(0)} t
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm text-muted-foreground hidden md:table-cell">
                                        <div>
                                            <span>{contract.deliveredQuantity.toFixed(0)} t</span>
                                            <span className="text-xs ml-1">({completionPercent.toFixed(0)}%)</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm font-medium text-primary">
                                        {contract.remainingQuantity.toFixed(0)} t
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm text-muted-foreground hidden lg:table-cell">
                                        <div>
                                            <p>{formatCurrency(contract.totalValue)}</p>
                                            <p className="text-xs opacity-70">{formatCurrency(contract.pricePerTon)}/t</p>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span
                                            className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${contract.status === "ativo"
                                                ? "bg-green-500/20 text-green-400"
                                                : contract.status === "pausado"
                                                    ? "bg-yellow-500/20 text-yellow-400"
                                                    : "bg-gray-500/20 text-gray-400"
                                                }`}
                                        >
                                            {contract.status === "ativo" ? "Ativo" : contract.status === "pausado" ? "Pausado" : "Encerrado"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right whitespace-nowrap">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => onEdit(contract)}
                                                className="p-1 text-muted-foreground hover:text-blue-500 transition-colors"
                                                title="Editar"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => onDelete(contract.id)}
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
