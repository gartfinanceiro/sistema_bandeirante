import { SupplierBalance } from "@/app/(authenticated)/balanca/actions";
import { SupplierBalanceCard } from "./SupplierBalanceCard";

interface SupplierBalanceListProps {
    balances: SupplierBalance[];
}

export function SupplierBalanceList({ balances }: SupplierBalanceListProps) {
    if (balances.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in zoom-in-95 duration-300">
                <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-10 h-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h3 className="text-xl font-semibold text-foreground">Tudo em dia!</h3>
                <p className="text-muted-foreground max-w-sm mt-2">
                    Não há saldos pendentes de entrega para nenhum fornecedor no momento.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
            {balances.map(balance => (
                <SupplierBalanceCard key={balance.supplierId} balance={balance} />
            ))}
        </div>
    );
}
