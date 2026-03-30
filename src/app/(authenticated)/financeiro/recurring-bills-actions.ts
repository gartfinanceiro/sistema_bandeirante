"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// =============================================================================
// Types
// =============================================================================

export interface RecurringBill {
    id: string;
    name: string;
    description: string | null;
    categoryId: string | null;
    categoryName: string | null;
    supplierId: string | null;
    supplierName: string | null;
    expectedAmount: number | null;
    isFixedAmount: boolean;
    dueDay: number;
    isActive: boolean;
    notes: string | null;
}

export interface MonthlyBillStatus extends RecurringBill {
    status: "paid" | "pending" | "overdue";
    paidAmount: number | null;
    paidDate: string | null;
    transactionId: string | null;
    transactionDescription: string | null;
    linkedBy: "auto" | "manual" | null;
}

export interface AvailableTransaction {
    id: string;
    date: string;
    amount: number;
    description: string;
    categoryName: string | null;
    supplierName: string | null;
    linkedToBillName: string | null;
}

// =============================================================================
// 1. getRecurringBills — lista todas as contas fixas ativas
// =============================================================================

export async function getRecurringBills(): Promise<RecurringBill[]> {
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
        .from("recurring_bills")
        .select(`
            id, name, description, category_id, supplier_id,
            expected_amount, is_fixed_amount, due_day, is_active, notes,
            transaction_categories ( name ),
            suppliers ( name )
        `)
        .eq("is_active", true)
        .order("due_day", { ascending: true });

    if (error || !data) {
        console.error("Error fetching recurring bills:", error);
        return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.map((b: any) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        categoryId: b.category_id,
        categoryName: b.transaction_categories?.name || null,
        supplierId: b.supplier_id,
        supplierName: b.suppliers?.name || null,
        expectedAmount: b.expected_amount ? Number(b.expected_amount) : null,
        isFixedAmount: b.is_fixed_amount,
        dueDay: b.due_day,
        isActive: b.is_active,
        notes: b.notes,
    }));
}

// =============================================================================
// 2. getMonthlyBillsStatus — status de cada conta no mês
//    Usa recurring_bill_payments para vínculos persistidos.
//    Se não existe vínculo, tenta auto-match e persiste automaticamente.
// =============================================================================

export async function getMonthlyBillsStatus(
    month: number,
    year: number
): Promise<MonthlyBillStatus[]> {
    const supabase = await createClient();

    // 1. Buscar contas fixas ativas
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bills, error: billsError } = await (supabase as any)
        .from("recurring_bills")
        .select(`
            id, name, description, category_id, supplier_id,
            expected_amount, is_fixed_amount, due_day, is_active, notes,
            transaction_categories ( name ),
            suppliers ( name )
        `)
        .eq("is_active", true)
        .order("due_day", { ascending: true });

    if (billsError || !bills) {
        console.error("Error fetching recurring bills:", billsError);
        return [];
    }

    // 2. Buscar vínculos existentes para este mês/ano
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingLinks } = await (supabase as any)
        .from("recurring_bill_payments")
        .select("recurring_bill_id, transaction_id, linked_by")
        .eq("reference_month", month)
        .eq("reference_year", year);

    const linkMap = new Map<string, { transactionId: string; linkedBy: string }>();
    if (existingLinks) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const link of existingLinks as any[]) {
            linkMap.set(link.recurring_bill_id, {
                transactionId: link.transaction_id,
                linkedBy: link.linked_by,
            });
        }
    }

    // Set of transaction IDs already linked this month (to avoid double-linking)
    const linkedTxIds = new Set<string>(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (existingLinks || []).map((l: any) => l.transaction_id)
    );

    // 3. Buscar transações do mês para auto-match
    const dateStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const dateEnd = month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: monthTransactions } = await (supabase as any)
        .from("transactions")
        .select("id, date, amount, description, status, category_id, supplier_id")
        .eq("type", "saida")
        .eq("status", "pago")
        .gte("date", dateStart)
        .lt("date", dateEnd)
        .order("date", { ascending: false });

    // Build lookup: transaction ID → transaction data
    const txMap = new Map<string, {
        id: string; date: string; amount: number;
        description: string; category_id: string | null; supplier_id: string | null;
    }>();
    if (monthTransactions) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const tx of monthTransactions as any[]) {
            txMap.set(tx.id, tx);
        }
    }

    // 4. Para cada conta, resolver vínculo
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const currentDay = today.getDate();

    // Track newly auto-linked transaction IDs within this run
    const newlyLinkedTxIds = new Set<string>();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: MonthlyBillStatus[] = await Promise.all(bills.map(async (bill: any) => {
        const base: RecurringBill = {
            id: bill.id,
            name: bill.name,
            description: bill.description,
            categoryId: bill.category_id,
            categoryName: bill.transaction_categories?.name || null,
            supplierId: bill.supplier_id,
            supplierName: bill.suppliers?.name || null,
            expectedAmount: bill.expected_amount ? Number(bill.expected_amount) : null,
            isFixedAmount: bill.is_fixed_amount,
            dueDay: bill.due_day,
            isActive: bill.is_active,
            notes: bill.notes,
        };

        let tx: { id: string; date: string; amount: number; description: string } | null = null;
        let linkedBy: "auto" | "manual" | null = null;

        // A. Check existing persistent link
        const existingLink = linkMap.get(bill.id);
        if (existingLink) {
            const linkedTx = txMap.get(existingLink.transactionId);
            if (linkedTx) {
                tx = linkedTx;
                linkedBy = existingLink.linkedBy as "auto" | "manual";
            } else {
                // Transaction was deleted — fetch from DB as fallback
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data: fallbackTx } = await (supabase as any)
                    .from("transactions")
                    .select("id, date, amount, description")
                    .eq("id", existingLink.transactionId)
                    .limit(1);

                if (fallbackTx && fallbackTx.length > 0) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    tx = fallbackTx[0] as any;
                    linkedBy = existingLink.linkedBy as "auto" | "manual";
                }
                // If transaction truly gone, CASCADE should have removed the link,
                // but if not, we'll treat as unlinked
            }
        }

        // B. No existing link — try auto-match with scoring
        if (!tx && monthTransactions) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const scored = (monthTransactions as any[])
                .filter((t: any) => {
                    if (linkedTxIds.has(t.id) || newlyLinkedTxIds.has(t.id)) return false;
                    if (bill.category_id && t.category_id !== bill.category_id) return false;
                    if (bill.supplier_id && t.supplier_id !== bill.supplier_id) return false;
                    if (!bill.category_id) return false;
                    return true;
                })
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((t: any) => {
                    let score = 0;

                    // Amount match (only for fixed-amount bills with expected_amount set)
                    if (bill.is_fixed_amount && bill.expected_amount && t.amount) {
                        const ratio = Math.abs(Number(t.amount) - Number(bill.expected_amount)) / Number(bill.expected_amount);
                        if (ratio <= 0.05) score += 100;
                        else if (ratio <= 0.20) score += 50;
                    }

                    // Supplier match (already guaranteed by filter, award points)
                    if (bill.supplier_id && t.supplier_id === bill.supplier_id) score += 60;

                    // Bill name words found in transaction description
                    const billWords = (bill.name as string).toLowerCase().split(/\s+/).filter((w: string) => w.length >= 4);
                    const desc = ((t.description as string) || "").toLowerCase();
                    if (billWords.some((w: string) => desc.includes(w))) score += 30;

                    return { t, score };
                });

            // Sort descending by score
            scored.sort((a, b) => b.score - a.score);

            const MIN_SCORE = 60;
            const MIN_LEAD = 30;
            const best = scored[0];
            const second = scored[1];

            const passesMinScore = best && best.score >= MIN_SCORE;
            const passesLead = !second || (best.score - second.score) >= MIN_LEAD;

            if (passesMinScore && passesLead) {
                tx = best.t;
                linkedBy = "auto";
                newlyLinkedTxIds.add(best.t.id);
                linkedTxIds.add(best.t.id);

                // Persist the auto-link (fire-and-forget)
                try {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (supabase as any)
                        .from("recurring_bill_payments")
                        .upsert({
                            recurring_bill_id: bill.id,
                            transaction_id: best.t.id,
                            reference_month: month,
                            reference_year: year,
                            linked_by: "auto",
                        }, {
                            onConflict: "recurring_bill_id,reference_month,reference_year",
                        });
                } catch (err) {
                    console.error("Error persisting auto-link:", err);
                }
            }
        }

        // C. Determine status
        let status: "paid" | "pending" | "overdue";
        if (tx) {
            status = "paid";
        } else if (
            year < currentYear ||
            (year === currentYear && month < currentMonth) ||
            (year === currentYear && month === currentMonth && currentDay > bill.due_day)
        ) {
            status = "overdue";
        } else {
            status = "pending";
        }

        return {
            ...base,
            status,
            paidAmount: tx ? Number(tx.amount) : null,
            paidDate: tx ? tx.date : null,
            transactionId: tx ? tx.id : null,
            transactionDescription: tx ? tx.description : null,
            linkedBy,
        };
    }));

    return results;
}

// =============================================================================
// 3. linkBillToTransaction — vincular manualmente
// =============================================================================

export async function linkBillToTransaction(
    billId: string,
    transactionId: string,
    month: number,
    year: number
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    // Validate transaction exists and is type saida
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tx, error: txError } = await (supabase as any)
        .from("transactions")
        .select("id, type")
        .eq("id", transactionId)
        .limit(1);

    if (txError || !tx || tx.length === 0) {
        return { success: false, error: "Transacao nao encontrada" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((tx[0] as any).type !== "saida") {
        return { success: false, error: "Transacao deve ser do tipo saida" };
    }

    // Upsert the link
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
        .from("recurring_bill_payments")
        .upsert({
            recurring_bill_id: billId,
            transaction_id: transactionId,
            reference_month: month,
            reference_year: year,
            linked_by: "manual",
            linked_at: new Date().toISOString(),
        }, {
            onConflict: "recurring_bill_id,reference_month,reference_year",
        });

    if (error) {
        console.error("Error linking bill to transaction:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/financeiro");
    return { success: true };
}

// =============================================================================
// 4. unlinkBillTransaction — desvincular
// =============================================================================

export async function unlinkBillTransaction(
    billId: string,
    month: number,
    year: number
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
        .from("recurring_bill_payments")
        .delete()
        .eq("recurring_bill_id", billId)
        .eq("reference_month", month)
        .eq("reference_year", year);

    if (error) {
        console.error("Error unlinking bill transaction:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/financeiro");
    return { success: true };
}

// =============================================================================
// 5. getAvailableTransactionsForLinking — transações disponíveis no mês
// =============================================================================

export async function getAvailableTransactionsForLinking(
    month: number,
    year: number,
    billCategoryId?: string | null,
    billSupplierId?: string | null,
    excludeBillId?: string | null
): Promise<AvailableTransaction[]> {
    const supabase = await createClient();

    const dateStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const dateEnd = month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`;

    // Get all linked transaction IDs for this month (with bill name for warning)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: links } = await (supabase as any)
        .from("recurring_bill_payments")
        .select("transaction_id, recurring_bills ( name )")
        .eq("reference_month", month)
        .eq("reference_year", year);

    // Map: transaction_id → bill name (for already-linked warning)
    const linkedMap = new Map<string, string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const l of (links || []) as any[]) {
        linkedMap.set(l.transaction_id, l.recurring_bills?.name || "Outra conta");
    }

    // In replace-mode: remove this bill's own current transaction from the linked set
    // so it appears as a normal selectable option in the dialog
    if (excludeBillId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: currentLink } = await (supabase as any)
            .from("recurring_bill_payments")
            .select("transaction_id")
            .eq("recurring_bill_id", excludeBillId)
            .eq("reference_month", month)
            .eq("reference_year", year)
            .limit(1);
        if (currentLink?.[0]) linkedMap.delete(currentLink[0].transaction_id);
    }

    // Fetch transactions for the month
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
        .from("transactions")
        .select(`
            id, date, amount, description,
            transaction_categories ( name ),
            suppliers ( name )
        `)
        .eq("type", "saida")
        .eq("status", "pago")
        .gte("date", dateStart)
        .lt("date", dateEnd)
        .order("date", { ascending: false });

    // Optional category/supplier filter
    if (billCategoryId) {
        query = query.eq("category_id", billCategoryId);
    }
    if (billSupplierId) {
        query = query.eq("supplier_id", billSupplierId);
    }

    const { data: transactions, error } = await query;

    if (error || !transactions) {
        console.error("Error fetching available transactions:", error);
        return [];
    }

    // Include all transactions; mark already-linked ones with the bill name
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const available = (transactions as any[]).map((t) => ({
        id: t.id,
        date: t.date,
        amount: Number(t.amount),
        description: t.description || "",
        categoryName: t.transaction_categories?.name || null,
        supplierName: t.suppliers?.name || null,
        linkedToBillName: linkedMap.get(t.id) || null,
    }));

    // Sort: unlinked first, then linked
    return available.sort((a, b) => {
        if (a.linkedToBillName && !b.linkedToBillName) return 1;
        if (!a.linkedToBillName && b.linkedToBillName) return -1;
        return 0;
    });
}

// =============================================================================
// 6. createRecurringBill — criar nova conta fixa
// =============================================================================

export async function createRecurringBill(formData: FormData) {
    const supabase = await createClient();

    const name = formData.get("name") as string;
    const description = (formData.get("description") as string) || null;
    const categoryId = (formData.get("categoryId") as string) || null;
    const supplierId = (formData.get("supplierId") as string) || null;
    const expectedAmountStr = formData.get("expectedAmount") as string;
    const expectedAmount = expectedAmountStr ? parseFloat(expectedAmountStr) : null;
    const isFixedAmount = formData.get("isFixedAmount") === "true";
    const dueDay = parseInt(formData.get("dueDay") as string);
    const notes = (formData.get("notes") as string) || null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
        .from("recurring_bills")
        .insert({
            name,
            description,
            category_id: categoryId,
            supplier_id: supplierId || null,
            expected_amount: expectedAmount,
            is_fixed_amount: isFixedAmount,
            due_day: dueDay,
            notes,
        });

    if (error) {
        console.error("Error creating recurring bill:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/financeiro");
    return { success: true };
}

// =============================================================================
// 7. updateRecurringBill — editar conta fixa
// =============================================================================

export async function updateRecurringBill(formData: FormData) {
    const supabase = await createClient();

    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const description = (formData.get("description") as string) || null;
    const categoryId = (formData.get("categoryId") as string) || null;
    const supplierId = (formData.get("supplierId") as string) || null;
    const expectedAmountStr = formData.get("expectedAmount") as string;
    const expectedAmount = expectedAmountStr ? parseFloat(expectedAmountStr) : null;
    const isFixedAmount = formData.get("isFixedAmount") === "true";
    const dueDay = parseInt(formData.get("dueDay") as string);
    const notes = (formData.get("notes") as string) || null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
        .from("recurring_bills")
        .update({
            name,
            description,
            category_id: categoryId,
            supplier_id: supplierId || null,
            expected_amount: expectedAmount,
            is_fixed_amount: isFixedAmount,
            due_day: dueDay,
            notes,
            updated_at: new Date().toISOString(),
        })
        .eq("id", id);

    if (error) {
        console.error("Error updating recurring bill:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/financeiro");
    return { success: true };
}

// =============================================================================
// 8. deleteRecurringBill — desativar conta fixa (soft delete)
// =============================================================================

export async function deleteRecurringBill(id: string) {
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
        .from("recurring_bills")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", id);

    if (error) {
        console.error("Error deleting recurring bill:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/financeiro");
    return { success: true };
}

// =============================================================================
// 9. getOverdueBillsCount — contagem de vencidas no mês
// =============================================================================

export async function getOverdueBillsCount(
    month: number,
    year: number
): Promise<number> {
    try {
        const statuses = await getMonthlyBillsStatus(month, year);
        return statuses.filter((s) => s.status === "overdue").length;
    } catch (error) {
        console.error("Error getting overdue bills count:", error);
        return 0;
    }
}
