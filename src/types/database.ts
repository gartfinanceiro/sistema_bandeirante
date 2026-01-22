/**
 * Sistema Bandeirante - Database Types
 * 
 * These types are generated based on the database schema.
 * For full auto-generation, run:
 * npx supabase gen types typescript --project-id <your-project-id> > src/types/database.ts
 * 
 * Current types are based on migration: 001_initial_schema.sql
 */

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

// =============================================================================
// ENUMs
// =============================================================================

export type TransactionType = "entrada" | "saida";
export type ContractStatus = "ativo" | "pausado" | "encerrado";
export type LogisticsStatus =
    | "em_usina"
    | "em_transito"
    | "entregue"
    | "aguardando_pagamento"
    | "finalizado";
export type PaymentStatus = "pendente" | "pago" | "parcial" | "cancelado";
export type UnitType = "tonelada" | "m3" | "unidade" | "litro";
export type CostCenterType =
    | "operacional_direto"
    | "operacional_indireto"
    | "recursos_humanos"
    | "administrativo"
    | "financeiro_tributario"
    | "nao_operacional";

// =============================================================================
// Database Schema
// =============================================================================

export interface Database {
    public: {
        Tables: {
            materials: {
                Row: {
                    id: string;
                    name: string;
                    unit: UnitType;
                    default_icms_rate: number | null;
                    current_stock: number | null;
                    average_price: number | null;
                    min_stock_alert: number | null;
                    description: string | null;
                    is_active: boolean | null;
                    created_at: string | null;
                    updated_at: string | null;
                };
                Insert: {
                    id?: string;
                    name: string;
                    unit: UnitType;
                    default_icms_rate?: number | null;
                    current_stock?: number | null;
                    average_price?: number | null;
                    min_stock_alert?: number | null;
                    description?: string | null;
                    is_active?: boolean | null;
                    created_at?: string | null;
                    updated_at?: string | null;
                };
                Update: {
                    id?: string;
                    name?: string;
                    unit?: UnitType;
                    default_icms_rate?: number | null;
                    current_stock?: number | null;
                    average_price?: number | null;
                    min_stock_alert?: number | null;
                    description?: string | null;
                    is_active?: boolean | null;
                    created_at?: string | null;
                    updated_at?: string | null;
                };
            };
            cost_centers: {
                Row: {
                    id: string;
                    code: string;
                    name: string;
                    type: CostCenterType;
                    description: string | null;
                    affects_cpt: boolean | null;
                    display_order: number | null;
                    is_active: boolean | null;
                    created_at: string | null;
                };
                Insert: {
                    id?: string;
                    code: string;
                    name: string;
                    type: CostCenterType;
                    description?: string | null;
                    affects_cpt?: boolean | null;
                    display_order?: number | null;
                    is_active?: boolean | null;
                    created_at?: string | null;
                };
                Update: {
                    id?: string;
                    code?: string;
                    name?: string;
                    type?: CostCenterType;
                    description?: string | null;
                    affects_cpt?: boolean | null;
                    display_order?: number | null;
                    is_active?: boolean | null;
                    created_at?: string | null;
                };
            };
            transaction_categories: {
                Row: {
                    id: string;
                    cost_center_id: string;
                    name: string;
                    description: string | null;
                    examples: string | null;
                    material_id: string | null;
                    requires_weight: boolean | null;
                    default_icms_rate: number | null;
                    display_order: number | null;
                    is_active: boolean | null;
                    created_at: string | null;
                };
                Insert: {
                    id?: string;
                    cost_center_id: string;
                    name: string;
                    description?: string | null;
                    examples?: string | null;
                    material_id?: string | null;
                    requires_weight?: boolean | null;
                    default_icms_rate?: number | null;
                    display_order?: number | null;
                    is_active?: boolean | null;
                    created_at?: string | null;
                };
                Update: {
                    id?: string;
                    cost_center_id?: string;
                    name?: string;
                    description?: string | null;
                    examples?: string | null;
                    material_id?: string | null;
                    requires_weight?: boolean | null;
                    default_icms_rate?: number | null;
                    display_order?: number | null;
                    is_active?: boolean | null;
                    created_at?: string | null;
                };
            };
            transactions: {
                Row: {
                    id: string;
                    date: string;
                    amount: number;
                    type: TransactionType;
                    description: string | null;
                    category_id: string | null;
                    status: PaymentStatus | null;
                    due_date: string | null;
                    weight_linked: number | null;
                    material_id: string | null;
                    has_icms_credit: boolean | null;
                    icms_rate: number | null;
                    icms_value: number | null;
                    ofx_transaction_id: string | null;
                    ofx_imported_at: string | null;
                    bank_memo: string | null;
                    shipment_id: string | null;
                    notes: string | null;
                    created_by: string | null;
                    created_at: string | null;
                    updated_at: string | null;
                };
                Insert: {
                    id?: string;
                    date: string;
                    amount: number;
                    type: TransactionType;
                    description?: string | null;
                    category_id?: string | null;
                    status?: PaymentStatus | null;
                    due_date?: string | null;
                    weight_linked?: number | null;
                    material_id?: string | null;
                    has_icms_credit?: boolean | null;
                    icms_rate?: number | null;
                    icms_value?: number | null;
                    ofx_transaction_id?: string | null;
                    ofx_imported_at?: string | null;
                    bank_memo?: string | null;
                    shipment_id?: string | null;
                    notes?: string | null;
                    created_by?: string | null;
                    created_at?: string | null;
                    updated_at?: string | null;
                };
                Update: {
                    id?: string;
                    date?: string;
                    amount?: number;
                    type?: TransactionType;
                    description?: string | null;
                    category_id?: string | null;
                    status?: PaymentStatus | null;
                    due_date?: string | null;
                    weight_linked?: number | null;
                    material_id?: string | null;
                    has_icms_credit?: boolean | null;
                    icms_rate?: number | null;
                    icms_value?: number | null;
                    ofx_transaction_id?: string | null;
                    ofx_imported_at?: string | null;
                    bank_memo?: string | null;
                    shipment_id?: string | null;
                    notes?: string | null;
                    created_by?: string | null;
                    created_at?: string | null;
                    updated_at?: string | null;
                };
            };
            production: {
                Row: {
                    id: string;
                    date: string;
                    tons_produced: number;
                    shift: string | null;
                    technical_notes: string | null;
                    created_by: string | null;
                    created_at: string | null;
                };
                Insert: {
                    id?: string;
                    date: string;
                    tons_produced: number;
                    shift?: string | null;
                    technical_notes?: string | null;
                    created_by?: string | null;
                    created_at?: string | null;
                };
                Update: {
                    id?: string;
                    date?: string;
                    tons_produced?: number;
                    shift?: string | null;
                    technical_notes?: string | null;
                    created_by?: string | null;
                    created_at?: string | null;
                };
            };
            inventory_movements: {
                Row: {
                    id: string;
                    material_id: string;
                    date: string;
                    quantity: number;
                    unit_price: number | null;
                    total_value: number | null;
                    movement_type: string;
                    reference_id: string | null;
                    notes: string | null;
                    created_by: string | null;
                    created_at: string | null;
                };
                Insert: {
                    id?: string;
                    material_id: string;
                    date: string;
                    quantity: number;
                    unit_price?: number | null;
                    total_value?: number | null;
                    movement_type: string;
                    reference_id?: string | null;
                    notes?: string | null;
                    created_by?: string | null;
                    created_at?: string | null;
                };
                Update: {
                    id?: string;
                    material_id?: string;
                    date?: string;
                    quantity?: number;
                    unit_price?: number | null;
                    total_value?: number | null;
                    movement_type?: string;
                    reference_id?: string | null;
                    notes?: string | null;
                    created_by?: string | null;
                    created_at?: string | null;
                };
            };
            customers: {
                Row: {
                    id: string;
                    name: string;
                    legal_name: string | null;
                    document: string | null;
                    terminal_address: string | null;
                    city: string | null;
                    state: string | null;
                    contact_name: string | null;
                    contact_phone: string | null;
                    contact_email: string | null;
                    payment_terms: string | null;
                    notes: string | null;
                    is_active: boolean | null;
                    created_at: string | null;
                    updated_at: string | null;
                };
                Insert: {
                    id?: string;
                    name: string;
                    legal_name?: string | null;
                    document?: string | null;
                    terminal_address?: string | null;
                    city?: string | null;
                    state?: string | null;
                    contact_name?: string | null;
                    contact_phone?: string | null;
                    contact_email?: string | null;
                    payment_terms?: string | null;
                    notes?: string | null;
                    is_active?: boolean | null;
                    created_at?: string | null;
                    updated_at?: string | null;
                };
                Update: {
                    id?: string;
                    name?: string;
                    legal_name?: string | null;
                    document?: string | null;
                    terminal_address?: string | null;
                    city?: string | null;
                    state?: string | null;
                    contact_name?: string | null;
                    contact_phone?: string | null;
                    contact_email?: string | null;
                    payment_terms?: string | null;
                    notes?: string | null;
                    is_active?: boolean | null;
                    created_at?: string | null;
                    updated_at?: string | null;
                };
            };
            contracts: {
                Row: {
                    id: string;
                    contract_number: string | null;
                    customer_id: string;
                    contracted_quantity: number;
                    price_per_ton: number;
                    total_value: number | null;
                    start_date: string;
                    end_date: string;
                    status: ContractStatus | null;
                    payment_terms: string | null;
                    payment_days: number | null;
                    delivered_quantity: number | null;
                    remaining_quantity: number | null;
                    completion_percent: number | null;
                    invoiced_value: number | null;
                    pending_value: number | null;
                    notes: string | null;
                    created_by: string | null;
                    created_at: string | null;
                    updated_at: string | null;
                };
                Insert: {
                    id?: string;
                    contract_number?: string | null;
                    customer_id: string;
                    contracted_quantity: number;
                    price_per_ton: number;
                    start_date: string;
                    end_date: string;
                    status?: ContractStatus | null;
                    payment_terms?: string | null;
                    payment_days?: number | null;
                    delivered_quantity?: number | null;
                    invoiced_value?: number | null;
                    notes?: string | null;
                    created_by?: string | null;
                    created_at?: string | null;
                    updated_at?: string | null;
                };
                Update: {
                    id?: string;
                    contract_number?: string | null;
                    customer_id?: string;
                    contracted_quantity?: number;
                    price_per_ton?: number;
                    start_date?: string;
                    end_date?: string;
                    status?: ContractStatus | null;
                    payment_terms?: string | null;
                    payment_days?: number | null;
                    delivered_quantity?: number | null;
                    invoiced_value?: number | null;
                    notes?: string | null;
                    created_by?: string | null;
                    created_at?: string | null;
                    updated_at?: string | null;
                };
            };
            shipments: {
                Row: {
                    id: string;
                    contract_id: string;
                    departure_date: string;
                    truck_plate: string;
                    driver_name: string | null;
                    weight_origin: number;
                    weight_destination: number | null;
                    transport_loss: number | null;
                    transport_loss_percent: number | null;
                    unit_price: number | null;
                    total_value: number | null;
                    status: LogisticsStatus | null;
                    delivery_date: string | null;
                    payment_due_date: string | null;
                    payment_date: string | null;
                    transaction_id: string | null;
                    notes: string | null;
                    created_by: string | null;
                    created_at: string | null;
                    updated_at: string | null;
                };
                Insert: {
                    id?: string;
                    contract_id: string;
                    departure_date: string;
                    truck_plate: string;
                    driver_name?: string | null;
                    weight_origin: number;
                    weight_destination?: number | null;
                    unit_price?: number | null;
                    status?: LogisticsStatus | null;
                    delivery_date?: string | null;
                    payment_due_date?: string | null;
                    payment_date?: string | null;
                    transaction_id?: string | null;
                    notes?: string | null;
                    created_by?: string | null;
                    created_at?: string | null;
                    updated_at?: string | null;
                };
                Update: {
                    id?: string;
                    contract_id?: string;
                    departure_date?: string;
                    truck_plate?: string;
                    driver_name?: string | null;
                    weight_origin?: number;
                    weight_destination?: number | null;
                    unit_price?: number | null;
                    status?: LogisticsStatus | null;
                    delivery_date?: string | null;
                    payment_due_date?: string | null;
                    payment_date?: string | null;
                    transaction_id?: string | null;
                    notes?: string | null;
                    created_by?: string | null;
                    created_at?: string | null;
                    updated_at?: string | null;
                };
            };
            daily_cash_closings: {
                Row: {
                    id: string;
                    date: string;
                    opening_balance: number;
                    total_entries: number | null;
                    total_exits: number | null;
                    calculated_closing: number;
                    real_closing: number | null;
                    difference: number | null;
                    difference_percent: number | null;
                    difference_notes: string | null;
                    is_closed: boolean | null;
                    closed_by: string | null;
                    closed_at: string | null;
                    created_at: string | null;
                    updated_at: string | null;
                };
                Insert: {
                    id?: string;
                    date: string;
                    opening_balance: number;
                    total_entries?: number | null;
                    total_exits?: number | null;
                    calculated_closing: number;
                    real_closing?: number | null;
                    difference_notes?: string | null;
                    is_closed?: boolean | null;
                    closed_by?: string | null;
                    closed_at?: string | null;
                    created_at?: string | null;
                    updated_at?: string | null;
                };
                Update: {
                    id?: string;
                    date?: string;
                    opening_balance?: number;
                    total_entries?: number | null;
                    total_exits?: number | null;
                    calculated_closing?: number;
                    real_closing?: number | null;
                    difference_notes?: string | null;
                    is_closed?: boolean | null;
                    closed_by?: string | null;
                    closed_at?: string | null;
                    created_at?: string | null;
                    updated_at?: string | null;
                };
            };
            settings: {
                Row: {
                    id: string;
                    key: string;
                    value: Json;
                    description: string | null;
                    updated_by: string | null;
                    updated_at: string | null;
                };
                Insert: {
                    id?: string;
                    key: string;
                    value: Json;
                    description?: string | null;
                    updated_by?: string | null;
                    updated_at?: string | null;
                };
                Update: {
                    id?: string;
                    key?: string;
                    value?: Json;
                    description?: string | null;
                    updated_by?: string | null;
                    updated_at?: string | null;
                };
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            [_ in never]: never;
        };
        Enums: {
            transaction_type: TransactionType;
            contract_status: ContractStatus;
            logistics_status: LogisticsStatus;
            payment_status: PaymentStatus;
            unit_type: UnitType;
            cost_center_type: CostCenterType;
        };
    };
}

// =============================================================================
// Helper Types
// =============================================================================

export type Tables<T extends keyof Database["public"]["Tables"]> =
    Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
    Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
    Database["public"]["Tables"][T]["Update"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
    Database["public"]["Enums"][T];

// Convenience type aliases
export type Material = Tables<"materials">;
export type CostCenter = Tables<"cost_centers">;
export type TransactionCategory = Tables<"transaction_categories">;
export type Transaction = Tables<"transactions">;
export type Production = Tables<"production">;
export type InventoryMovement = Tables<"inventory_movements">;
export type Customer = Tables<"customers">;
export type Contract = Tables<"contracts">;
export type Shipment = Tables<"shipments">;
export type DailyCashClosing = Tables<"daily_cash_closings">;
export type Setting = Tables<"settings">;
