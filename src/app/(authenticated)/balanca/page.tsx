import { BalancaWorkspace } from "@/components/balanca/BalancaWorkspace";
import { getPurchaseOrders, getSupplierBalances } from "./actions";

export const metadata = {
    title: "Balança | Gusa Intelligence",
};

export default async function BalancaPage() {
    const orders = await getPurchaseOrders();
    const balances = await getSupplierBalances();

    return (
        <main className="min-h-screen bg-background">
            <BalancaWorkspace orders={orders} balances={balances} />
        </main>
    );
}
