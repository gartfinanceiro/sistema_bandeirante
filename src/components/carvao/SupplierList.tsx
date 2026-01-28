import type { Supplier } from "@/types/database";

interface SupplierListProps {
    suppliers: Supplier[];
    isLoading: boolean;
    onEdit: (supplier: Supplier) => void;
}

const STATUS_LABELS: Record<string, string> = {
    em_prospeccao: "Em Prospecção",
    em_negociacao: "Em Negociação",
    interessado: "Interessado",
    inativo: "Inativo",
};

const COMPLIANCE_LABELS: Record<string, string> = {
    pendente: "Pendente",
    em_analise: "Em Análise",
    aprovado: "Aprovado",
    reprovado: "Reprovado",
    vencido: "Vencido",
};

const STATUS_COLORS: Record<string, string> = {
    em_prospeccao: "bg-gray-100 text-gray-800",
    em_negociacao: "bg-blue-100 text-blue-800",
    interessado: "bg-green-100 text-green-800",
    inativo: "bg-red-100 text-red-800",
};

const COMPLIANCE_COLORS: Record<string, string> = {
    pendente: "bg-gray-100 text-gray-800",
    em_analise: "bg-yellow-100 text-yellow-800",
    aprovado: "bg-green-100 text-green-800",
    reprovado: "bg-red-100 text-red-800",
    vencido: "bg-orange-100 text-orange-800",
};

export function SupplierList({ suppliers, isLoading, onEdit }: SupplierListProps) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-muted-foreground">Carregando fornecedores...</div>
            </div>
        );
    }

    if (suppliers.length === 0) {
        return (
            <div className="flex items-center justify-center py-12 border rounded-lg bg-muted/50">
                <div className="text-center">
                    <p className="text-muted-foreground">Nenhum fornecedor cadastrado</p>
                    <p className="text-sm text-muted-foreground mt-1">Clique em "Novo Fornecedor" para começar</p>
                </div>
            </div>
        );
    }

    return (
        <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
                <thead className="bg-muted">
                    <tr>
                        <th className="p-3 text-left text-sm font-medium">Nome</th>
                        <th className="p-3 text-left text-sm font-medium">Contato</th>
                        <th className="p-3 text-left text-sm font-medium">Status Comercial</th>
                        <th className="p-3 text-left text-sm font-medium">Compliance</th>
                        <th className="p-3 text-left text-sm font-medium">Último Contato</th>
                        <th className="p-3 text-right text-sm font-medium">Ações</th>
                    </tr>
                </thead>
                <tbody className="bg-background">
                    {suppliers.map((supplier) => (
                        <tr key={supplier.id} className="border-t hover:bg-muted/50 transition-colors">
                            <td className="p-3">
                                <div className="font-medium text-foreground">{supplier.name}</div>
                                {supplier.legal_name && (
                                    <div className="text-sm text-muted-foreground">{supplier.legal_name}</div>
                                )}
                            </td>
                            <td className="p-3">
                                {supplier.contact_name && (
                                    <div className="text-sm text-foreground">{supplier.contact_name}</div>
                                )}
                                {supplier.contact_phone && (
                                    <div className="text-sm text-muted-foreground">{supplier.contact_phone}</div>
                                )}
                            </td>
                            <td className="p-3">
                                <span
                                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[supplier.commercial_status] || "bg-gray-100 text-gray-800"
                                        }`}
                                >
                                    {STATUS_LABELS[supplier.commercial_status] || supplier.commercial_status}
                                </span>
                            </td>
                            <td className="p-3">
                                <span
                                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${COMPLIANCE_COLORS[supplier.compliance_status] || "bg-gray-100 text-gray-800"
                                        }`}
                                >
                                    {COMPLIANCE_LABELS[supplier.compliance_status] || supplier.compliance_status}
                                </span>
                            </td>
                            <td className="p-3 text-sm text-muted-foreground">
                                {supplier.last_contact_date
                                    ? new Date(supplier.last_contact_date).toLocaleDateString("pt-BR")
                                    : "-"}
                            </td>
                            <td className="p-3 text-right">
                                <button
                                    onClick={() => onEdit(supplier)}
                                    className="text-primary hover:underline text-sm font-medium"
                                >
                                    Editar
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
