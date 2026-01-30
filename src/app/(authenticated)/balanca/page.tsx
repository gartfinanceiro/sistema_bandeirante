import { BalancaWorkspace } from "@/components/balanca/BalancaWorkspace";
import { getOpenPurchaseOrders, getSupplierBalances } from "./actions";

export const metadata = {
    title: "Balança | Gusa Intelligence",
};

export default async function BalancaPage() {
    const orders = await getOpenPurchaseOrders();
    const balances = await getSupplierBalances();

    return (
        <main className="min-h-screen bg-background">
            <BalancaWorkspace orders={orders} balances={balances} />
        </main>
    );
}
