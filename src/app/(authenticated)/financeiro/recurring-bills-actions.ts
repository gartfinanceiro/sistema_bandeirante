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
// =============================================================================

export async function getMonthlyBillsStatus(
    month: number,
    year: number
): Promise<MonthlyBillStatus[]> {
    const supabase = await createClient();

    // Buscar contas fixas ativas
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

    // Para cada conta, buscar a transação correspondente no mês
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const currentDay = today.getDate();

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

        // Buscar transação paga no mês/ano com mesma categoria (e fornecedor se definido)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let query = (supabase as any)
            .from("transactions")
            .select("id, date, amount, description, status")
            .eq("type", "saida")
            .eq("status", "pago")
            .gte("date", `${year}-${String(month).padStart(2, "0")}-01`)
            .lt(
                "date",
                month === 12
                    ? `${year + 1}-01-01`
                    : `${year}-${String(month + 1).padStart(2, "0")}-01`
            );

        if (bill.category_id) {
            query = query.eq("category_id", bill.category_id);
        }

        if (bill.supplier_id) {
            query = query.eq("supplier_id", bill.supplier_id);
        }

        const { data: txData } = await query
            .order("date", { ascending: false })
            .limit(1);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tx = txData && txData.length > 0 ? txData[0] as any : null;

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
        };
    }));

    return results;
}

// =============================================================================
// 3. createRecurringBill — criar nova conta fixa
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
// 4. updateRecurringBill — editar conta fixa
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
// 5. deleteRecurringBill — desativar conta fixa (soft delete)
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
// 6. getOverdueBillsCount — contagem de vencidas no mês
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
