"use server";

import { createClient } from "@/lib/supabase/server";

export interface FiscalItem {
    id: string;
    date: string;
    type: "credito" | "debito";
    entityName: string; // Supplier or Customer Name
    description: string;
    baseValue: number;
    aliquota: number;
    icmsValue: number;
    status: string; // e.g., 'pago', 'em_transito'
}

export interface FiscalDashboardData {
    credits: number;
    debits: number;
    balance: number;
    status: "credor" | "devedor";
    extract: FiscalItem[];
}

export async function getFiscalDashboard(
    month: number,
    year: number
): Promise<FiscalDashboardData> {
    const supabase = await createClient();

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(year, month, 0).toISOString().split("T")[0];

    // 1. Fetch Credits (Purchase Transactions with ICMS)
    const { data: creditsData, error: creditError } = await supabase
        .from("transactions")
        .select(`
            id,
            date,
            amount,
            description,
            status,
            icms_rate,
            icms_value,
            supplier:supplier_id ( name )
        `)
        .eq("type", "saida")
        .eq("has_icms_credit", true)
        .gte("date", startDate)
        .lte("date", endDate);

    if (creditError) {
        console.error("Error fetching fiscal credits:", creditError);
    }

    // 2. Fetch Debits (Shipments/Sales)
    const { data: debitsData, error: debitError } = await supabase
        .from("shipments")
        .select(`
            id,
            departure_date,
            total_value,
            status,
            icms_rate,
            icms_value,
            contract:contract_id (
                customer:customer_id ( name )
            )
        `)
        .gte("departure_date", startDate) // Using departure date as tax event date
        .lte("departure_date", endDate + "T23:59:59");

    if (debitError) {
        console.error("Error fetching fiscal debits:", debitError);
    }

    // 3. Process Data
    const extract: FiscalItem[] = [];
    let totalCredits = 0;
    let totalDebits = 0;

    // Process Credits
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    creditsData?.forEach((tx: any) => {
        const icmsVal = Number(tx.icms_value) || 0;
        totalCredits += icmsVal;

        extract.push({
            id: tx.id,
            date: tx.date,
            type: "credito",
            entityName: tx.supplier?.name || "Fornecedor Desconhecido",
            description: tx.description || "Compra",
            baseValue: Number(tx.amount),
            aliquota: Number(tx.icms_rate) || 0,
            icmsValue: icmsVal,
            status: tx.status,
        });
    });

    // Process Debits
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    debitsData?.forEach((sh: any) => {
        const icmsVal = Number(sh.icms_value) || 0;
        totalDebits += icmsVal;

        extract.push({
            id: sh.id,
            date: sh.departure_date.split("T")[0],
            type: "debito",
            entityName: sh.contract?.customer?.name || "Cliente Desconhecido",
            description: "Expedição de Gusa",
            baseValue: Number(sh.total_value),
            aliquota: Number(sh.icms_rate) || 0,
            icmsValue: icmsVal,
            status: sh.status,
        });
    });

    // Sort Extract by Date
    extract.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const balance = totalCredits - totalDebits;

    return {
        credits: totalCredits,
        debits: totalDebits,
        balance,
        status: balance >= 0 ? "credor" : "devedor",
        extract,
    };
}
