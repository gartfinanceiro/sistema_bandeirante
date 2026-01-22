interface ProductionSummaryCardsProps {
    todayProduction: number;
    coalStock: number;
    coalUnit: string;
    estimatedAutonomy: number;
    isLowStock: boolean;
    isLoading?: boolean;
}

export function ProductionSummaryCards({
    todayProduction,
    coalStock,
    coalUnit,
    estimatedAutonomy,
    isLowStock,
    isLoading = false,
}: ProductionSummaryCardsProps) {
    const cards = [
        {
            label: "Produção Hoje",
            value: `${todayProduction.toFixed(1)} t`,
            description: "Ferro-gusa produzido",
            color: "text-primary",
            bgColor: "bg-primary/10",
            borderColor: "border-primary/30",
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
            ),
        },
        {
            label: "Estoque de Carvão",
            value: `${coalStock.toFixed(0)} ${coalUnit}`,
            description: "Saldo atual",
            color: isLowStock ? "text-red-400" : "text-blue-400",
            bgColor: isLowStock ? "bg-red-500/10" : "bg-blue-500/10",
            borderColor: isLowStock ? "border-red-500/30" : "border-blue-500/30",
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
            ),
        },
        {
            label: "Autonomia Estimada",
            value: `${estimatedAutonomy} dias`,
            description: "Com produção atual",
            color: isLowStock ? "text-red-400" : "text-green-400",
            bgColor: isLowStock ? "bg-red-500/10" : "bg-green-500/10",
            borderColor: isLowStock ? "border-red-500/30" : "border-green-500/30",
            icon: isLowStock ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {cards.map((card) => (
                <div
                    key={card.label}
                    className={`${card.bgColor} ${card.borderColor} border rounded-lg p-4 transition-all ${card.label === "Autonomia Estimada" && isLowStock ? "animate-pulse" : ""
                        }`}
                >
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">{card.label}</p>
                        <div className={`${card.color}`}>{card.icon}</div>
                    </div>
                    <p className={`text-2xl font-bold mt-2 ${card.color}`}>
                        {isLoading ? (
                            <span className="inline-block w-20 h-7 bg-muted animate-pulse rounded" />
                        ) : (
                            card.value
                        )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
                    {card.label === "Autonomia Estimada" && isLowStock && !isLoading && (
                        <p className="text-xs text-red-400 mt-2 font-medium">
                            ⚠ Estoque crítico! Reabastecer.
                        </p>
                    )}
                </div>
            ))}
        </div>
    );
}
