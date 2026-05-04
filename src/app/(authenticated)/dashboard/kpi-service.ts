import { createClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/supabase/paginate";

export async function getDashboardKPIs() {
    const supabase = await createClient();
    const today = new Date().toISOString().split("T")[0];
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

    // 1. Saldo do Dia (Entradas - Saídas)
    // A single day is unlikely to exceed 1000 rows but paginate defensively.
    const transactions = await fetchAllPages<{ type: string; amount: number }>(
        (from, to) =>
            supabase
                .from("transactions")
                .select("type, amount")
                .eq("date", today)
                .range(from, to),
    );

    const dailyBalance = transactions.reduce((acc, curr) => {
        return curr.type === "entrada"
            ? acc + Number(curr.amount)
            : acc - Number(curr.amount);
    }, 0);

    // 2. Produção Hoje (Ferro-gusa)
    const { data: production } = await supabase
        .from("production")
        .select("tons_produced")
        .eq("date", today);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const productionToday = ((production as any[]) || []).reduce((acc, curr) => acc + Number(curr.tons_produced), 0);

    // 3. Estoque Carvão
    const { data: charcoal } = await supabase
        .from("materials")
        .select("current_stock")
        .eq("name", "Carvão Vegetal")
        .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const charcoalStock = (charcoal as any)?.current_stock || 0;

    // 4. CPT (Despesas do Mês / Produção do Mês)
    // Despesas — paginated to avoid PostgREST's 1000-row truncation as the
    // monthly volume of saídas grows.
    const monthExpenses = await fetchAllPages<{ amount: number }>(
        (from, to) =>
            supabase
                .from("transactions")
                .select("amount")
                .eq("type", "saida")
                .gte("date", startOfMonth)
                .range(from, to),
    );

    const totalExpenses = monthExpenses.reduce((acc, curr) => acc + Number(curr.amount), 0);

    // Produção Mensal
    const { data: monthProduction } = await supabase
        .from("production")
        .select("tons_produced")
        .gte("date", startOfMonth);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalProduction = ((monthProduction as any[]) || []).reduce((acc, curr) => acc + Number(curr.tons_produced), 0);

    // Cálculo CPT
    const cpt = totalProduction > 0 ? totalExpenses / totalProduction : 0;

    return {
        dailyBalance,
        productionToday,
        charcoalStock,
        cpt
    };
}
