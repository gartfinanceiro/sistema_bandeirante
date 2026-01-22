
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
    const supabase = await createClient();

    // 1. Find Ferro-Gusa
    const { data: gusaMaterial } = await supabase
        .from("materials")
        .select("id, name, current_stock")
        .ilike("name", "%ferro-gusa%")
        .or("name.ilike.%ferro gusa%")
        .limit(1)
        .single();

    if (!gusaMaterial) {
        return NextResponse.json({ error: "Material Ferro-Gusa not found" }, { status: 404 });
    }

    // 2. Get All Productions
    const { data: productions } = await supabase.from("production").select("*");

    if (!productions || productions.length === 0) {
        return NextResponse.json({ message: "No productions found" });
    }

    let updatedCount = 0;
    let totalTonsAdded = 0;
    const logs: string[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const prod of (productions as any[])) {
        // 3. Check if movement exists
        const { data: existingMovement } = await supabase
            .from("inventory_movements")
            .select("id")
            .eq("reference_id", prod.id)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .eq("material_id", (gusaMaterial as any).id)
            .single();

        if (!existingMovement) {
            logs.push(`Fixing production ${prod.id} (${prod.tons_produced}t)...`);

            // Create Movement
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from("inventory_movements") as any).insert({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                material_id: (gusaMaterial as any).id,
                date: prod.date,
                quantity: prod.tons_produced,
                movement_type: "producao_entrada",
                reference_id: prod.id,
                notes: `Entrada via Produção (Correção Automática): ${prod.tons_produced}t`,
            });

            // Update Stock
            // Fetch fresh stock to be safe
            const { data: currentMat } = await supabase
                .from("materials")
                .select("current_stock")
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .eq("id", (gusaMaterial as any).id)
                .single();

            if (currentMat) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase.from("materials") as any)
                    .update({
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        current_stock: Number((currentMat as any).current_stock) + Number(prod.tons_produced)
                    })
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .eq("id", (gusaMaterial as any).id);
            }

            updatedCount++;
            totalTonsAdded += Number(prod.tons_produced);
        }
    }

    return NextResponse.json({
        success: true,
        updatedCount,
        totalTonsAdded,
        logs
    });
}
