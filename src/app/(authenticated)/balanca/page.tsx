import { BalancaWorkspace } from "@/components/balanca/BalancaWorkspace";
import { getOpenPurchaseOrders } from "./actions";

export const metadata = {
    title: "Balança | Gusa Intelligence",
};

export default async function BalancaPage() {
    const orders = await getOpenPurchaseOrders();

    return (
        <main className="min-h-screen bg-background">
            <BalancaWorkspace orders={orders} />
        </main>
    );
}
