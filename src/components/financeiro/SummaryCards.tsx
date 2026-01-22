interface SummaryCardsProps {
    totalEntries: number;
    totalExits: number;
    balance: number;
    isLoading?: boolean;
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(value);
}

export function SummaryCards({
    totalEntries,
    totalExits,
    balance,
    isLoading = false,
}: SummaryCardsProps) {
    const cards = [
        {
            label: "Entradas do Mês",
            value: totalEntries,
            color: "text-green-400",
            bgColor: "bg-green-500/10",
            borderColor: "border-green-500/30",
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                </svg>
            ),
        },
        {
            label: "Saídas do Mês",
            value: totalExits,
            color: "text-red-400",
            bgColor: "bg-red-500/10",
            borderColor: "border-red-500/30",
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                </svg>
            ),
        },
        {
            label: "Saldo Acumulado",
            value: balance,
            color: balance >= 0 ? "text-primary" : "text-red-400",
            bgColor: balance >= 0 ? "bg-primary/10" : "bg-red-500/10",
            borderColor: balance >= 0 ? "border-primary/30" : "border-red-500/30",
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
            ),
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {cards.map((card) => (
                <div
                    key={card.label}
                    className={`${card.bgColor} ${card.borderColor} border rounded-lg p-4 transition-all`}
                >
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">{card.label}</p>
                        <div className={`${card.color}`}>{card.icon}</div>
                    </div>
                    <p className={`text-2xl font-bold mt-2 ${card.color}`}>
                        {isLoading ? (
                            <span className="inline-block w-24 h-7 bg-muted animate-pulse rounded" />
                        ) : (
                            formatCurrency(card.value)
                        )}
                    </p>
                </div>
            ))}
        </div>
    );
}
