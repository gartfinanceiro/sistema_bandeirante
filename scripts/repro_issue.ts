
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function runTest() {
    console.log("=== STARTING TEST: Order Visibility with Fiscal Weight ===");

    // 1. Create a Test Transaction (Order)
    console.log("Creating Test Transaction...");
    const { data: tx, error: txError } = await (supabase.from('transactions') as any).insert({
        date: new Date().toISOString(),
        amount: 0,
        type: 'saida',
        category_id: null, // skip if not needed or fetch one
        description: 'TEST ORDER',
        quantity: 1000,
        status: 'pendente'
    }).select().single();

    if (txError) {
        console.error("Failed to create transaction:", txError);
        return;
    }
    const txId = tx.id;
    console.log("Transaction Created:", txId, "Total Qty: 1000");

    // 2. Register Partial Delivery (Real Weight Only)
    console.log("Registering Delivery 1: 400kg Real...");
    const { data: d1, error: d1Error } = await (supabase.from('inbound_deliveries') as any).insert({
        transaction_id: txId,
        plate: 'TEST-001',
        weight_measured: 400,
        weight_fiscal: null,
        date: new Date().toISOString()
    }).select().single();

    if (d1Error) {
        console.error("Failed to create delivery:", d1Error);
        return;
    }
    console.log("Delivery 1 Created:", d1.id);

    // 3. Check Visibility
    const { data: orders1 } = await checkOpenOrders(txId);
    console.log("Remaining after D1 (Should be 600):", orders1?.remainingQuantity);

    // 4. Update Delivery with Fiscal Weight
    console.log("Updating Delivery 1: Adding 400kg Fiscal...");
    const { error: uError } = await (supabase.from('inbound_deliveries') as any)
        .update({
            weight_measured: 400, // Keep real weight
            weight_fiscal: 400    // Add fiscal weight
        })
        .eq('id', d1.id);

    if (uError) {
        console.error("Failed to update delivery:", uError);
        return;
    }

    // 5. Check Visibility Again
    const { data: orders2 } = await checkOpenOrders(txId);
    console.log("Remaining after Update (Should be 600):", orders2?.remainingQuantity);

    if (!orders2) {
        console.error("❌ FAILURE: Order disappeared from list!");
    } else if (orders2.remainingQuantity !== 600) {
        console.error(`❌ FAILURE: Incorrect remaining quantity. Expected 600, got ${orders2.remainingQuantity}`);
    } else {
        console.log("✅ SUCCESS: Order is visible and balance is correct.");
    }

    // Cleanup
    console.log("Cleaning up...");
    await supabase.from('inbound_deliveries').delete().eq('transaction_id', txId);
    await supabase.from('transactions').delete().eq('id', txId);
}

// Helper to simulate getOpenPurchaseOrders logic
async function checkOpenOrders(txId: string) {
    // Mimic the query in actions.ts
    // 1. Get Transaction
    const { data: tx } = await supabase.from('transactions').select('quantity').eq('id', txId).single();
    if (!tx) return { data: null };

    // 2. Get Deliveries
    const { data: deliveries } = await supabase.from('inbound_deliveries').select('weight_measured').eq('transaction_id', txId);

    // 3. Sum
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delivered = (deliveries as any[]).reduce((sum, d) => sum + Number(d.weight_measured), 0);
    const remaining = (tx as any).quantity - delivered;

    if (remaining > 0.1) {
        return { data: { id: txId, remainingQuantity: remaining } };
    }
    return { data: null };
}

runTest();
