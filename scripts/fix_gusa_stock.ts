
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// Load env
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Use direct env vars since we are running outside of Next.js context
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runFix() {
    console.log("Starting Ferro-Gusa Stock Fix...");

    // 1. Find Ferro-Gusa
    const { data: gusaMaterial } = await supabase
        .from("materials")
        .select("id, name, current_stock")
        .ilike("name", "%ferro-gusa%")
        .or("name.ilike.%ferro gusa%")
        .limit(1)
        .single();

    if (!gusaMaterial) {
        console.error("Ferro-Gusa material not found!");
        return;
    }

    console.log(`Found Gusa: ${gusaMaterial.name} (Current Stock: ${gusaMaterial.current_stock})`);

    // 2. Get All Productions
    const { data: productions } = await supabase.from("production").select("*");

    if (!productions || productions.length === 0) {
        console.log("No production records found.");
        return;
    }

    console.log(`Found ${productions.length} production records.`);

    let updatedCount = 0;
    let totalTonsAdded = 0;

    for (const prod of productions) {
        // 3. Check if movement exists
        const { data: existingMovement } = await supabase
            .from("inventory_movements")
            .select("id")
            .eq("reference_id", prod.id)
            .eq("material_id", gusaMaterial.id)
            .single();

        if (!existingMovement) {
            console.log(`Fixing production ${prod.id} (${prod.tons_produced}t)...`);

            // Create Movement
            await supabase.from("inventory_movements").insert({
                material_id: gusaMaterial.id,
                date: prod.date,
                quantity: prod.tons_produced,
                movement_type: "producao_entrada", // Must match what we used in actions.ts
                reference_id: prod.id,
                notes: `Entrada via Produção (Correção Automática): ${prod.tons_produced}t`,
            });

            // Update Stock
            // We do this individually to avoid race conditions if run live, though script is sequential
            // Ideally we would fetch fresh stock but this is a fix script
            // Update Stock
            const { error: rpcError } = await supabase.rpc('increment_stock', {
                row_id: gusaMaterial.id,
                quantity: prod.tons_produced
            });

            if (rpcError) {
                // Fallback if RPC doesn't exist (it doesn't by default), use manual update
                const { data: current } = await supabase.from("materials").select("current_stock").eq("id", gusaMaterial.id).single();
                await supabase.from("materials").update({ current_stock: Number(current?.current_stock) + Number(prod.tons_produced) }).eq("id", gusaMaterial.id);
            }

            updatedCount++;
            totalTonsAdded += Number(prod.tons_produced);
        }
    }

    console.log("========================================");
    console.log(`Fix Complete.`);
    console.log(`Updated Records: ${updatedCount}`);
    console.log(`Total Added to Stock: ${totalTonsAdded}t`);
}

runFix();
