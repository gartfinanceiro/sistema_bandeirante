"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ContractStatus, LogisticsStatus } from "@/types/database";

// =============================================================================
// Types
// =============================================================================

export interface ContractRow {
    id: string;
    contractNumber: string | null;
    customerName: string;
    contractedQuantity: number;
    deliveredQuantity: number;
    remainingQuantity: number;
    pricePerTon: number;
    totalValue: number;
    status: ContractStatus;
    startDate: string;
    endDate: string;
}

export interface ExpeditionRow {
    id: string;
    contractNumber: string | null;
    customerName: string;
    departureDate: string;
    truckPlate: string;
    weightOrigin: number;
    weightDestination: number | null;
    transportLoss: number | null;
    transportLossPercent: number | null;
    status: LogisticsStatus;
    totalValue: number | null;
}

export interface ActiveContract {
    id: string;
    contractNumber: string | null;
    customerName: string;
    remainingQuantity: number;
    pricePerTon: number;
}

// =============================================================================
// CONTRACTS
// =============================================================================

export async function getContracts(): Promise<ContractRow[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("contracts")
        .select(`
      id,
      contract_number,
      contracted_quantity,
      delivered_quantity,
      remaining_quantity,
      price_per_ton,
      total_value,
      status,
      start_date,
      end_date,
      customer:customers(name)
    `)
        .order("created_at", { ascending: false });

    if (error || !data) {
        console.error("Error fetching contracts:", error);
        return [];
    }

    return (data as unknown[]).map((c: unknown) => {
        const contract = c as {
            id: string;
            contract_number: string | null;
            contracted_quantity: number;
            delivered_quantity: number;
            remaining_quantity: number;
            price_per_ton: number;
            total_value: number;
            status: ContractStatus;
            start_date: string;
            end_date: string;
            customer: { name: string } | null;
        };
        return {
            id: contract.id,
            contractNumber: contract.contract_number,
            customerName: contract.customer?.name || "Cliente não informado",
            contractedQuantity: Number(contract.contracted_quantity),
            deliveredQuantity: Number(contract.delivered_quantity),
            remainingQuantity: Number(contract.remaining_quantity),
            pricePerTon: Number(contract.price_per_ton),
            totalValue: Number(contract.total_value),
            status: contract.status,
            startDate: contract.start_date,
            endDate: contract.end_date,
        };
    });
}

export async function getActiveContracts(): Promise<ActiveContract[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("contracts")
        .select(`
      id,
      contract_number,
      remaining_quantity,
      price_per_ton,
      customer:customers(name)
    `)
        .eq("status", "ativo")
        .gt("remaining_quantity", 0);

    if (error || !data) {
        console.error("Error fetching active contracts:", error);
        return [];
    }

    return (data as unknown[]).map((c: unknown) => {
        const contract = c as {
            id: string;
            contract_number: string | null;
            remaining_quantity: number;
            price_per_ton: number;
            customer: { name: string } | null;
        };
        return {
            id: contract.id,
            contractNumber: contract.contract_number,
            customerName: contract.customer?.name || "Cliente",
            remainingQuantity: Number(contract.remaining_quantity),
            pricePerTon: Number(contract.price_per_ton),
        };
    });
}

export async function createContract(formData: FormData): Promise<{
    success: boolean;
    error?: string;
}> {
    const supabase = await createClient();

    const customerName = formData.get("customerName") as string;
    const contractedQuantity = parseFloat(formData.get("contractedQuantity") as string);
    const pricePerTon = parseFloat(formData.get("pricePerTon") as string);
    const startDate = formData.get("startDate") as string;
    const endDate = formData.get("endDate") as string;

    if (!customerName || !contractedQuantity || !pricePerTon || !startDate || !endDate) {
        return { success: false, error: "Campos obrigatórios não preenchidos" };
    }

    // First, create or get customer
    const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id")
        .ilike("name", customerName)
        .limit(1)
        .single();

    let customerId: string;

    if (existingCustomer) {
        customerId = (existingCustomer as { id: string }).id;
    } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newCustomer, error: custError } = await (supabase.from("customers") as any)
            .insert({ name: customerName })
            .select("id")
            .single();

        if (custError || !newCustomer) {
            return { success: false, error: "Erro ao criar cliente: " + custError?.message };
        }
        customerId = (newCustomer as { id: string }).id;
    }

    // Generate contract number
    const contractNumber = `CTR-${Date.now().toString(36).toUpperCase()}`;

    // Create contract
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("contracts") as any).insert({
        contract_number: contractNumber,
        customer_id: customerId,
        contracted_quantity: contractedQuantity,
        price_per_ton: pricePerTon,
        start_date: startDate,
        end_date: endDate,
        status: "ativo",
    });

    if (error) {
        console.error("Error creating contract:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/vendas");
    return { success: true };
}

export async function updateContract(id: string, formData: FormData): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    const customerName = formData.get("customerName") as string;
    const contractedQuantity = parseFloat(formData.get("contractedQuantity") as string);
    const pricePerTon = parseFloat(formData.get("pricePerTon") as string);
    const startDate = formData.get("startDate") as string;
    const endDate = formData.get("endDate") as string;
    const status = formData.get("status") as ContractStatus || "ativo";

    if (!customerName || !contractedQuantity || !pricePerTon || !startDate || !endDate) {
        return { success: false, error: "Campos obrigatórios não preenchidos" };
    }

    // Update customer name if changed (or find existing)
    // For simplicity, we'll look for the customer by name again. 
    // Ideally, we might want to update the connected customer record or switch IDs.
    // Given the current logic is "create or get", we stick to that.

    const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id")
        .ilike("name", customerName)
        .limit(1)
        .single();

    let customerId: string;

    if (existingCustomer) {
        customerId = (existingCustomer as { id: string }).id;
    } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newCustomer, error: custError } = await (supabase.from("customers") as any)
            .insert({ name: customerName })
            .select("id")
            .single();

        if (custError || !newCustomer) {
            return { success: false, error: "Erro ao criar cliente: " + custError?.message };
        }
        customerId = (newCustomer as { id: string }).id;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("contracts") as any)
        .update({
            customer_id: customerId,
            contracted_quantity: contractedQuantity,
            price_per_ton: pricePerTon,
            start_date: startDate,
            end_date: endDate,
            status: status
        })
        .eq("id", id);

    if (error) {
        console.error("Error updating contract:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/vendas");
    return { success: true };
}

export async function deleteContract(id: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    // Check for shipments
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error: countError } = await (supabase.from("shipments") as any)
        .select("*", { count: 'exact', head: true })
        .eq("contract_id", id);

    if (countError) {
        return { success: false, error: "Erro ao verificar expedições vinculadas" };
    }

    if (count && count > 0) {
        return {
            success: false,
            error: "Não é possível excluir este contrato pois existem expedições vinculadas a ele. Tente arquivá-lo ou excluir as expedições primeiro."
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("contracts") as any).delete().eq("id", id);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath("/vendas");
    return { success: true };
}

// =============================================================================
// EXPEDITIONS
// =============================================================================

export async function getExpeditions(): Promise<ExpeditionRow[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("shipments")
        .select(`
      id,
      departure_date,
      truck_plate,
      weight_origin,
      weight_destination,
      transport_loss,
      transport_loss_percent,
      status,
      total_value,
      contract:contracts(
        contract_number,
        customer:customers(name)
      )
    `)
        .order("departure_date", { ascending: false })
        .limit(50);

    if (error || !data) {
        console.error("Error fetching expeditions:", error);
        return [];
    }

    return (data as unknown[]).map((s: unknown) => {
        const shipment = s as {
            id: string;
            departure_date: string;
            truck_plate: string;
            weight_origin: number;
            weight_destination: number | null;
            transport_loss: number | null;
            transport_loss_percent: number | null;
            status: LogisticsStatus;
            total_value: number | null;
            contract: {
                contract_number: string | null;
                customer: { name: string } | null;
            } | null;
        };
        return {
            id: shipment.id,
            contractNumber: shipment.contract?.contract_number || null,
            customerName: shipment.contract?.customer?.name || "N/A",
            departureDate: shipment.departure_date,
            truckPlate: shipment.truck_plate,
            weightOrigin: Number(shipment.weight_origin),
            weightDestination: shipment.weight_destination ? Number(shipment.weight_destination) : null,
            transportLoss: shipment.transport_loss ? Number(shipment.transport_loss) : null,
            transportLossPercent: shipment.transport_loss_percent ? Number(shipment.transport_loss_percent) : null,
            status: shipment.status,
            totalValue: shipment.total_value ? Number(shipment.total_value) : null,
        };
    });
}

export async function createExpedition(formData: FormData): Promise<{
    success: boolean;
    error?: string;
}> {
    const supabase = await createClient();

    const contractId = formData.get("contractId") as string;
    const truckPlate = formData.get("truckPlate") as string;
    const weightOrigin = parseFloat(formData.get("weightOrigin") as string);
    const departureDate = formData.get("departureDate") as string;
    const departureTime = formData.get("departureTime") as string;

    if (!contractId || !truckPlate || !weightOrigin || !departureDate) {
        return { success: false, error: "Campos obrigatórios não preenchidos" };
    }

    const departureDatetime = `${departureDate}T${departureTime || "00:00"}:00`;

    // Create expedition with status "em_transito"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("shipments") as any).insert({
        contract_id: contractId,
        truck_plate: truckPlate.toUpperCase(),
        weight_origin: weightOrigin,
        departure_date: departureDatetime,
        status: "em_transito",
    });

    if (error) {
        console.error("Error creating expedition:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/vendas");
    return { success: true };
}

export async function updateExpeditionArrival(
    expeditionId: string,
    weightDestination: number
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    // Update expedition with weight_destination and change status to "entregue"
    // The trigger in the database will calculate transport_loss automatically
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("shipments") as any)
        .update({
            weight_destination: weightDestination,
            status: "entregue",
            delivery_date: new Date().toISOString(),
        })
        .eq("id", expeditionId);

    if (error) {
        console.error("Error updating expedition:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/vendas");
    return { success: true };
}

export async function deleteExpedition(id: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    // 1. Get expedition to check weight and status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: shipment, error: fetchError } = await (supabase.from("shipments") as any)
        .select("*")
        .eq("id", id)
        .single();

    if (fetchError || !shipment) {
        return { success: false, error: "Expedição não encontrada" };
    }

    // 2. Revert Stock (Ferro-Gusa)
    // Find material
    const { data: gusaMaterial } = await supabase
        .from("materials")
        .select("id, current_stock")
        .ilike("name", "%ferro-gusa%")
        .or("name.ilike.%ferro gusa%")
        .limit(1)
        .single();

    if (gusaMaterial) {
        // If the shipment deducted from stock (it usually does on creation/transit), add it back.
        // We assume it did. To be safe, we could check for an inventory_movement linked to this reference_id.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: movement } = await (supabase.from("inventory_movements") as any)
            .select("id, quantity")
            .eq("reference_id", id)
            .eq("movement_type", "venda")
            .single();

        if (movement) {
            // Revert stock logic: movement quantity is negative (saw -30), so we subtract it from current stock?
            // current - (-30) = current + 30. Correct.
            // Or cleaner: just add the absolute weight back.
            // Let's stick to: restore the amount that was taken.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from("materials") as any)
                .update({
                    current_stock: Number(gusaMaterial.current_stock) - Number(movement.quantity) // - (-X) = +X
                })
                .eq("id", gusaMaterial.id);

            // Delete movement
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from("inventory_movements") as any).delete().eq("id", movement.id);
        }
    }

    // 3. Delete shipment
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase.from("shipments") as any).delete().eq("id", id);

    if (deleteError) {
        return { success: false, error: deleteError.message };
    }

    revalidatePath("/vendas");
    return { success: true };
}

export async function updateExpedition(id: string, formData: FormData): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    const truckPlate = formData.get("truckPlate") as string;
    const weightOrigin = parseFloat(formData.get("weightOrigin") as string);
    const departureDate = formData.get("departureDate") as string;
    const departureTime = formData.get("departureTime") as string;

    if (!truckPlate || !weightOrigin || !departureDate) {
        return { success: false, error: "Campos obrigatórios não preenchidos" };
    }

    const departureDatetime = `${departureDate}T${departureTime || "00:00"}:00`;

    // 1. Get Old Shipment
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: oldShipment } = await (supabase.from("shipments") as any).select("*").eq("id", id).single();
    if (!oldShipment) return { success: false, error: "Expedição não encontrada" };

    const oldWeight = Number(oldShipment.weight_origin);
    const weightDiff = weightOrigin - oldWeight; // Positive if increased, Negative if decreased

    // 2. Adjust Stock if weight changed
    if (Math.abs(weightDiff) > 0.001) {
        const { data: gusaMaterial } = await supabase
            .from("materials")
            .select("id, current_stock")
            .ilike("name", "%ferro-gusa%")
            .or("name.ilike.%ferro gusa%")
            .limit(1)
            .single();

        if (gusaMaterial) {
            // Find existing movement
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: movement } = await (supabase.from("inventory_movements") as any)
                .select("id")
                .eq("reference_id", id)
                .eq("movement_type", "venda")
                .single();

            if (movement) {
                // Determine new stock
                // If weight INCREASED (diff > 0), we need to consume MORE stock (decrease stock).
                // If weight DECREASED (diff < 0), we need to return stock (increase stock).
                // New Stock = Old Stock - Diff

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase.from("materials") as any)
                    .update({
                        current_stock: Number(gusaMaterial.current_stock) - weightDiff
                    })
                    .eq("id", gusaMaterial.id);

                // Update movement
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase.from("inventory_movements") as any)
                    .update({ quantity: -weightOrigin }) // Ensure it matches new weight (negative)
                    .eq("id", movement.id);
            }
        }
    }

    // 3. Update Shipment
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("shipments") as any)
        .update({
            truck_plate: truckPlate.toUpperCase(),
            weight_origin: weightOrigin,
            departure_date: departureDatetime,
        })
        .eq("id", id);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath("/vendas");
    return { success: true };
}
