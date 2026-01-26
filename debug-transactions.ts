import { getTransactions } from "./src/app/(authenticated)/financeiro/actions";

async function debug() {
    console.log("Fetching transactions...");
    try {
        const result = await getTransactions(1, 2026); // Jan 2026
        console.log("Transactions found:", result.total);
        console.log("Data sample:", JSON.stringify(result.data.slice(0, 1), null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

debug();
