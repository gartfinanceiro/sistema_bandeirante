import { createClient } from "@/lib/supabase/server";
import { getDashboardKPIs } from "./kpi-service";

export default async function DashboardPage() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    // Fetch Real KPIs
    const kpis = await getDashboardKPIs();

    // Formatters
    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    const formatNumber = (value: number) =>
        new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="space-y-1">
                <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
                <p className="text-muted-foreground">
                    Bem-vindo ao Sistema Bandeirante
                </p>
            </div>

            {/* Welcome Card */}
            <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/30 rounded-lg p-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">
                            Gusa Intelligence
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            {user?.email || "Usuário autenticado"}
                        </p>
                    </div>
                </div>
            </div>

            {/* Real KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Saldo do Dia */}
                <div className="bg-card border border-border rounded-lg p-4 space-y-2">
                    <p className="text-sm text-muted-foreground">Saldo do Dia</p>
                    <p className={`text-2xl font-bold ${kpis.dailyBalance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {formatCurrency(kpis.dailyBalance)}
                    </p>
                    <p className="text-xs text-muted-foreground">Fluxo de caixa</p>
                </div>

                {/* Produção Hoje */}
                <div className="bg-card border border-border rounded-lg p-4 space-y-2">
                    <p className="text-sm text-muted-foreground">Produção Hoje</p>
                    <p className="text-2xl font-bold text-foreground">
                        {formatNumber(kpis.productionToday)} t
                    </p>
                    <p className="text-xs text-muted-foreground">Ferro-gusa</p>
                </div>

                {/* Estoque Carvão */}
                <div className="bg-card border border-border rounded-lg p-4 space-y-2">
                    <p className="text-sm text-muted-foreground">Estoque Carvão</p>
                    <p className="text-2xl font-bold text-foreground">
                        {formatNumber(kpis.charcoalStock)} m³
                    </p>
                    <p className="text-xs text-muted-foreground">Insumo principal</p>
                </div>

                {/* CPT */}
                <div className="bg-card border border-border rounded-lg p-4 space-y-2">
                    <p className="text-sm text-muted-foreground">CPT (Mês Atual)</p>
                    <p className="text-2xl font-bold text-foreground">
                        {kpis.cpt > 0 ? `${formatCurrency(kpis.cpt)}/t` : 'Calculando...'}
                    </p>
                    <p className="text-xs text-muted-foreground">Custo por Tonelada</p>
                </div>
            </div>
        </div>
    );
}
