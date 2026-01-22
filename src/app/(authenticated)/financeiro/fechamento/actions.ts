"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// =============================================================================
// Types
// =============================================================================

export interface ClosingData {
    date: string;
    openingBalance: number;
    totalEntries: number;
    totalExits: number;
    calculatedBalance: number;
    isFirstDay: boolean;
    previousClosingDate: string | null;
}

export interface ClosingHistoryRow {
    id: string;
    date: string;
    openingBalance: number;
    totalEntries: number;
    totalExits: number;
    calculatedClosing: number;
    realClosing: number;
    difference: number;
    differenceNotes: string | null;
    isClosed: boolean;
}

// =============================================================================
// Get Closing Data for a specific date
// =============================================================================

export async function getClosingData(targetDate?: string): Promise<ClosingData> {
    const supabase = await createClient();

    const date = targetDate || new Date().toISOString().split("T")[0];

    // 1. Check if this date is already closed
    const { data: existingClosing } = await supabase
        .from("daily_cash_closings")
        .select("id")
        .eq("date", date)
        .eq("is_closed", true)
        .single();

    if (existingClosing) {
        // Already closed, find the next unclosed date
        // For now, just work with the current date
    }

    // 2. Get the previous day's closing (THE GOLDEN RULE)
    const { data: previousClosing } = await supabase
        .from("daily_cash_closings")
        .select("date, real_closing")
        .lt("date", date)
        .eq("is_closed", true)
        .order("date", { ascending: false })
        .limit(1)
        .single();

    let openingBalance = 0;
    let isFirstDay = true;
    let previousClosingDate: string | null = null;

    if (previousClosing) {
        openingBalance = Number((previousClosing as { real_closing: number }).real_closing);
        isFirstDay = false;
        previousClosingDate = (previousClosing as { date: string }).date;
    } else {
        // Check for initial balance in settings
        const { data: settings } = await supabase
            .from("settings")
            .select("value")
            .eq("key", "initial_cash_balance")
            .single();

        if (settings) {
            const settingsValue = settings as { value: { value?: number; date?: string } };
            if (settingsValue.value?.value) {
                openingBalance = settingsValue.value.value;
                isFirstDay = false;
            }
        }
    }

    // 3. Get all transactions for the date
    const { data: transactions } = await supabase
        .from("transactions")
        .select("amount, type")
        .eq("date", date)
        .eq("status", "pago");

    const txData = (transactions || []) as { amount: number; type: string }[];

    const totalEntries = txData
        .filter((t) => t.type === "entrada")
        .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalExits = txData
        .filter((t) => t.type === "saida")
        .reduce((sum, t) => sum + Number(t.amount), 0);

    const calculatedBalance = openingBalance + totalEntries - totalExits;

    return {
        date,
        openingBalance,
        totalEntries,
        totalExits,
        calculatedBalance,
        isFirstDay,
        previousClosingDate,
    };
}

// =============================================================================
// Close Cash Day
// =============================================================================

export async function closeCashDay(formData: FormData): Promise<{
    success: boolean;
    error?: string;
}> {
    const supabase = await createClient();

    const date = formData.get("date") as string;
    const openingBalance = parseFloat(formData.get("openingBalance") as string);
    const totalEntries = parseFloat(formData.get("totalEntries") as string);
    const totalExits = parseFloat(formData.get("totalExits") as string);
    const calculatedBalance = parseFloat(formData.get("calculatedBalance") as string);
    const realBalance = parseFloat(formData.get("realBalance") as string);
    const difference = realBalance - calculatedBalance;
    const justification = formData.get("justification") as string;
    const isFirstDay = formData.get("isFirstDay") === "true";

    // Validate required fields
    if (!date || isNaN(realBalance)) {
        return { success: false, error: "Campos obrigatórios não preenchidos" };
    }

    // Validate justification if there's a difference
    if (Math.abs(difference) > 0.01 && !justification?.trim()) {
        return { success: false, error: "Justificativa obrigatória quando há diferença" };
    }

    // If it's the first day, save the initial balance to settings
    if (isFirstDay && openingBalance > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("settings") as any)
            .update({
                value: { value: openingBalance, date },
            })
            .eq("key", "initial_cash_balance");
    }

    // Check if closing already exists for this date
    const { data: existing } = await supabase
        .from("daily_cash_closings")
        .select("id")
        .eq("date", date)
        .single();

    if (existing) {
        // Update existing
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from("daily_cash_closings") as any)
            .update({
                opening_balance: openingBalance,
                total_entries: totalEntries,
                total_exits: totalExits,
                calculated_closing: calculatedBalance,
                real_closing: realBalance,
                difference_notes: justification || null,
                is_closed: true,
                closed_at: new Date().toISOString(),
            })
            .eq("id", (existing as { id: string }).id);

        if (error) {
            console.error("Error updating closing:", error);
            return { success: false, error: error.message };
        }
    } else {
        // Create new
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from("daily_cash_closings") as any).insert({
            date,
            opening_balance: openingBalance,
            total_entries: totalEntries,
            total_exits: totalExits,
            calculated_closing: calculatedBalance,
            real_closing: realBalance,
            difference_notes: justification || null,
            is_closed: true,
            closed_at: new Date().toISOString(),
        });

        if (error) {
            console.error("Error creating closing:", error);
            return { success: false, error: error.message };
        }
    }

    revalidatePath("/financeiro/fechamento");
    revalidatePath("/financeiro");
    return { success: true };
}

// =============================================================================
// Get Closing History
// =============================================================================

export async function getClosingHistory(limit: number = 30): Promise<ClosingHistoryRow[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("daily_cash_closings")
        .select("*")
        .eq("is_closed", true)
        .order("date", { ascending: false })
        .limit(limit);

    if (error || !data) {
        console.error("Error fetching closing history:", error);
        return [];
    }

    return (data as unknown[]).map((c: unknown) => {
        const closing = c as {
            id: string;
            date: string;
            opening_balance: number;
            total_entries: number;
            total_exits: number;
            calculated_closing: number;
            real_closing: number;
            difference: number;
            difference_notes: string | null;
            is_closed: boolean;
        };
        return {
            id: closing.id,
            date: closing.date,
            openingBalance: Number(closing.opening_balance),
            totalEntries: Number(closing.total_entries),
            totalExits: Number(closing.total_exits),
            calculatedClosing: Number(closing.calculated_closing),
            realClosing: Number(closing.real_closing),
            difference: Number(closing.difference),
            differenceNotes: closing.difference_notes,
            isClosed: closing.is_closed,
        };
    });
}
