import { SupplierBalance } from "@/app/(authenticated)/balanca/actions";

interface SupplierBalanceCardProps {
    balance: SupplierBalance;
}

export function SupplierBalanceCard({ balance }: SupplierBalanceCardProps) {
    const progress = Math.min(100, (balance.totalEntregueReal / (balance.totalContratado || 1)) * 100);
    const hasExcedente = balance.totalEntregueReal > balance.totalContratado;
    const excedenteAmount = balance.totalEntregueReal - balance.totalContratado;

    return (
        <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/50 transition-colors flex flex-col h-full">
            {/* Header */}
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

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                {/* Contratado */}
                <div className="p-3 bg-muted/30 rounded-lg col-span-2">
                    <p className="text-xs text-muted-foreground uppercase font-medium">Total Contratado</p>
                    <p className="text-xl font-bold">{balance.totalContratado.toLocaleString('pt-BR')} t</p>
                </div>

                {/* Real */}
                <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg">
                    <p className="text-xs text-blue-700 uppercase font-medium mb-1">Entregue (Real)</p>
                    <p className="text-lg font-semibold text-blue-900">{balance.totalEntregueReal.toLocaleString('pt-BR')} t</p>
                    {hasExcedente && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700 mt-1">
                            +{excedenteAmount.toLocaleString('pt-BR')} t Excedente
                        </span>
                    )}
                </div>

                {/* Fiscal */}
                <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg">
                    <p className="text-xs text-gray-500 uppercase font-medium mb-1">Entregue (Fiscal)</p>
                    <p className="text-lg font-semibold text-gray-700">
                        {balance.totalEntregueFiscal > 0 ? balance.totalEntregueFiscal.toLocaleString('pt-BR') + ' t' : '-'}
                    </p>
                </div>
            </div>

            {/* Progress */}
            <div className="space-y-2 mb-6">
                <div className="flex justify-between items-end">
                    <span className="text-sm font-medium text-muted-foreground">Progresso Real</span>
                    <span className={`text-sm font-bold ${hasExcedente ? 'text-orange-600' : 'text-foreground'}`}>
                        {Math.round((balance.totalEntregueReal / (balance.totalContratado || 1)) * 100)}%
                    </span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden relative">
                    <div
                        className={`h-full transition-all duration-500 ${hasExcedente ? 'bg-orange-500' : 'bg-primary'}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Balances */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-dashed border-gray-200 mb-4">
                <div>
                    <span className="text-xs font-medium text-gray-400 uppercase">Saldo Real</span>
                    <p className={`text-xl font-bold ${balance.saldoReal <= 0 ? 'text-gray-400' : 'text-primary'}`}>
                        {balance.saldoReal > 0 ? balance.saldoReal.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '0'} t
                    </p>
                </div>
                <div>
                    <span className="text-xs font-medium text-gray-400 uppercase">Saldo Fiscal</span>
                    <p className="text-lg font-semibold text-gray-600">
                        {balance.saldoFiscal > 0 ? balance.saldoFiscal.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '0'} t
                    </p>
                </div>
            </div>

            {/* Recent History */}
            {balance.recentDeliveries && balance.recentDeliveries.length > 0 && (
                <div className="mt-auto pt-4 border-t border-border">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Últimas Entregas</p>
                    <div className="space-y-2">
                        {balance.recentDeliveries.slice(0, 3).map((d, i) => (
                            <div key={i} className="flex justify-between items-center text-xs">
                                <span className="text-gray-500 font-mono">{new Date(d.date).toLocaleDateString('pt-BR')}</span>
                                <span className="text-gray-600 font-medium">{d.weightReal.toLocaleString('pt-BR')} kg</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
