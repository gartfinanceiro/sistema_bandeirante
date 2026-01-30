import { SupplierBalance } from "@/app/(authenticated)/balanca/actions";

interface SupplierBalanceCardProps {
    balance: SupplierBalance;
}

export function SupplierBalanceCard({ balance }: SupplierBalanceCardProps) {
    const progress = Math.min(100, (balance.deliveredQuantity / balance.totalQuantity) * 100);

    return (
        <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/50 transition-colors">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="font-semibold text-lg text-foreground">{balance.supplierName}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        {balance.materials.join(", ")}
                    </p>
                </div>
                <div className="bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 rounded-full">
                    {balance.openOrdersCount} {balance.openOrdersCount === 1 ? "ordem ativa" : "ordens ativas"}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground uppercase font-medium">Contratado</p>
                    <p className="text-lg font-semibold">{balance.totalQuantity.toLocaleString('pt-BR')} t</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground uppercase font-medium">Entregue</p>
                    <p className="text-lg font-semibold">{balance.deliveredQuantity.toLocaleString('pt-BR')} t</p>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between items-end">
                    <span className="text-sm font-medium text-muted-foreground">Progresso</span>
                    <span className="text-sm font-bold text-foreground">{progress.toFixed(1)}%</span>
                </div>

                <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border flex justify-between items-center bg-orange-500/5 -mx-5 -mb-5 px-5 py-3">
                <span className="text-sm font-medium text-orange-700">Saldo Pendente</span>
                <span className="text-xl font-bold text-orange-600">
                    {balance.remainingQuantity.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} t
                </span>
            </div>
        </div>
    );
}
