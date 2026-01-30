"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Supplier, CarvaoCommercialStatus, CarvaoComplianceStatus } from "@/types/database";

// =============================================================================
// Get Suppliers
// =============================================================================

export async function getSuppliers(): Promise<Supplier[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("carvao_suppliers")
        .select("*")
        .eq("is_active", true)
        .order("name");

    if (error) {
        console.error("Error fetching suppliers:", error);
        return [];
    }

    return data as Supplier[];
}

// =============================================================================
// Create Supplier
// =============================================================================

export async function createSupplier(formData: FormData): Promise<{
    success: boolean;
    error?: string;
}> {
    const supabase = await createClient();

    const supplierData = {
        name: formData.get("name") as string,
        legal_name: (formData.get("legal_name") as string) || null,
        document: (formData.get("document") as string) || null,
        contact_name: (formData.get("contact_name") as string) || null,
        contact_phone: (formData.get("contact_phone") as string) || null,
        contact_email: (formData.get("contact_email") as string) || null,
        commercial_status: (formData.get("commercial_status") as CarvaoCommercialStatus) || "em_prospeccao",
        compliance_status: "pendente" as CarvaoComplianceStatus,
        notes: (formData.get("notes") as string) || null,
    };

    const { error } = await (supabase
        .from("carvao_suppliers") as any)
        .insert(supplierData);

    if (error) {
        console.error("Error creating supplier:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/carvao/fornecedores");
    return { success: true };
}

// =============================================================================
// Update Supplier
// =============================================================================

export async function updateSupplier(formData: FormData): Promise<{
    success: boolean;
    error?: string;
}> {
    const supabase = await createClient();

    const id = formData.get("id") as string;

    if (!id) {
        return { success: false, error: "ID do fornecedor não informado" };
    }

    const supplierData = {
        name: formData.get("name") as string,
        legal_name: (formData.get("legal_name") as string) || null,
        document: (formData.get("document") as string) || null,
        contact_name: (formData.get("contact_name") as string) || null,
        contact_phone: (formData.get("contact_phone") as string) || null,
        contact_email: (formData.get("contact_email") as string) || null,
        commercial_status: (formData.get("commercial_status") as CarvaoCommercialStatus) || "em_prospeccao",
        compliance_status: (formData.get("compliance_status") as CarvaoComplianceStatus) || "pendente",
        notes: (formData.get("notes") as string) || null,
    };

    const { error } = await (supabase
        .from("carvao_suppliers") as any)
        .update(supplierData)
        .eq("id", id);

    if (error) {
        console.error("Error updating supplier:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/carvao/fornecedores");
    return { success: true };
}

// =============================================================================
// Delete Supplier (Soft Delete)
// =============================================================================

export async function deleteSupplier(id: string): Promise<{
    success: boolean;
    error?: string;
}> {
    const supabase = await createClient();

    const { error } = await (supabase
        .from("carvao_suppliers") as any)
        .update({ is_active: false })
        .eq("id", id);

    if (error) {
        console.error("Error deleting supplier:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/carvao/fornecedores");
    return { success: true };
}

// =============================================================================
// Get Supplier Documents
// =============================================================================

export async function getSupplierDocuments(supplierId: string): Promise<any[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("carvao_supplier_documents")
        .select("*")
        .eq("supplier_id", supplierId)
        .order("document_type");

    if (error) {
        console.error("Error fetching supplier documents:", error);
        return [];
    }

    return data || [];
}

// =============================================================================
// Upsert Supplier Document (metadata only, no file)
// =============================================================================

export async function upsertSupplierDocument(formData: FormData): Promise<{
    success: boolean;
    error?: string;
}> {
    const supabase = await createClient();

    const id = formData.get("id") as string;
    const supplier_id = formData.get("supplier_id") as string;
    const document_type = formData.get("document_type") as string;
    const status = formData.get("status") as string;
    const expiry_date = formData.get("expiry_date") as string;
    const notes = formData.get("notes") as string;

    if (!supplier_id || !document_type) {
        return { success: false, error: "Fornecedor e tipo de documento são obrigatórios" };
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "Usuário não autenticado" };
    }

    const documentData = {
        supplier_id,
        document_type,
        status: status || "pendente",
        expiry_date: expiry_date || null,
        notes: notes || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
    };

    let error;

    if (id) {
        // Update existing document
        ({ error } = await (supabase
            .from("carvao_supplier_documents") as any)
            .update(documentData)
            .eq("id", id));
    } else {
        // Insert new document
        ({ error } = await (supabase
            .from("carvao_supplier_documents") as any)
            .insert(documentData));
    }

    if (error) {
        console.error("Error upserting document:", error);
        return { success: false, error: error.message };
    }

    // Recalculate compliance status
    await recalculateComplianceStatus(supplier_id);

    revalidatePath("/carvao/fornecedores");
    return { success: true };
}

// =============================================================================
// Recalculate Compliance Status (Fase 3 - considers file attachments)
// =============================================================================

export async function recalculateComplianceStatus(supplierId: string): Promise<void> {
    const supabase = await createClient();

    // Get all documents for this supplier (include file_path for Fase 3)
    const { data: documentsData } = await supabase
        .from("carvao_supplier_documents")
        .select("document_type, status, expiry_date, file_path")
        .eq("supplier_id", supplierId);

    const documents = documentsData as any[];

    if (!documents || documents.length === 0) {
        // No documents, set to pendente
        await (supabase
            .from("carvao_suppliers") as any)
            .update({ compliance_status: "pendente" })
            .eq("id", supplierId);
        return;
    }

    // Required documents for approval
    const requiredDocs = ["DOF", "Contrato Assinado"];
    const today = new Date().toISOString().split("T")[0];

    let allRequiredApproved = true;
    let hasExpired = false;

    for (const reqDoc of requiredDocs) {
        const doc = documents.find(d => d.document_type === reqDoc);

        // Fase 3: Document must exist, be approved, have file attached, and not be expired
        if (!doc ||
            doc.status !== "aprovado" ||
            !doc.file_path ||
            (doc.expiry_date && doc.expiry_date < today)) {
            allRequiredApproved = false;
        }

        // Check for any expired documents
        if (doc && doc.expiry_date && doc.expiry_date < today) {
            hasExpired = true;
        }
    }

    // Determine status: vencido > pendente/em_analise > aprovado
    let newStatus: CarvaoComplianceStatus;
    if (hasExpired) {
        newStatus = "vencido";
    } else if (allRequiredApproved) {
        newStatus = "aprovado";
    } else {
        newStatus = "pendente";
    }

    await (supabase
        .from("carvao_suppliers") as any)
        .update({ compliance_status: newStatus })
        .eq("id", supplierId);

    revalidatePath("/carvao/fornecedores");
}

// =============================================================================
// Get Supplier Compliance Data
// =============================================================================

export async function getSupplierCompliance(supplierId: string): Promise<any | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("carvao_supplier_compliance")
        .select("*")
        .eq("supplier_id", supplierId)
        .maybeSingle();

    if (error) {
        console.error("Error fetching compliance:", error);
        return null;
    }

    return data;
}

// =============================================================================
// Upsert Supplier Compliance (property data)
// =============================================================================

export async function upsertSupplierCompliance(formData: FormData): Promise<{
    success: boolean;
    error?: string;
}> {
    const supabase = await createClient();

    const supplier_id = formData.get("supplier_id") as string;

    if (!supplier_id) {
        return { success: false, error: "Fornecedor não informado" };
    }

    const complianceData: any = {
        supplier_id,
        property_name: (formData.get("property_name") as string) || null,
        municipality: (formData.get("municipality") as string) || null,
        uf: (formData.get("uf") as string) || null,
        owner_name: (formData.get("owner_name") as string) || null,
        owner_document: (formData.get("owner_document") as string) || null,
        notes: (formData.get("notes") as string) || null,
    };

    const { error } = await supabase
        .from("carvao_supplier_compliance")
        .upsert(complianceData, { onConflict: "supplier_id" });

    if (error) {
        console.error("Error upserting compliance:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/carvao/fornecedores");
    return { success: true };
}

// =============================================================================
// FASE 3: Document File Upload Functions
// =============================================================================

const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Upload document file to Storage
export async function uploadDocumentFile(formData: FormData): Promise<{
    success: boolean;
    error?: string;
    filePath?: string;
}> {
    const supabase = await createClient();

    const file = formData.get("file") as File;
    const supplierId = formData.get("supplier_id") as string;
    const documentType = formData.get("document_type") as string;
    const documentId = formData.get("document_id") as string;

    if (!file || !supplierId || !documentType) {
        return { success: false, error: "Dados incompletos" };
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        return { success: false, error: "Tipo de arquivo não permitido. Use PDF, JPG ou PNG." };
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
        return { success: false, error: "Arquivo muito grande. Máximo: 10MB" };
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { success: false, error: "Usuário não autenticado" };
    }

    // Build file path
    const timestamp = Date.now();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${supplierId}/${documentType}/${timestamp}_${sanitizedFilename}`;

    // Check if  there's an existing file to delete
    if (documentId) {
        const { data: existingDoc } = await supabase
            .from("carvao_supplier_documents")
            .select("file_path")
            .eq("id", documentId)
            .single();

        if ((existingDoc as any)?.file_path) {
            // Delete old file from storage
            await supabase.storage
                .from('carvao-documents')
                .remove([(existingDoc as any)?.file_path]);
        }
    }

    // Upload to Storage
    const { error: uploadError } = await supabase.storage
        .from('carvao-documents')
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (uploadError) {
        console.error("Upload error:", uploadError);
        return { success: false, error: uploadError.message };
    }

    // Update document record
    const { error: updateError } = await (supabase
        .from("carvao_supplier_documents") as any)
        .update({
            file_path: filePath,
            file_name: file.name,
            file_size_bytes: file.size,
            uploaded_at: new Date().toISOString(),
            uploaded_by: user.id,
            status: 'em_analise', // Auto-set to under review when file uploaded
        })
        .eq("id", documentId);

    if (updateError) {
        console.error("Update error:", updateError);
        // Try to delete the uploaded file
        await supabase.storage
            .from('carvao-documents')
            .remove([filePath]);
        return { success: false, error: updateError.message };
    }

    // Recalculate compliance status
    await recalculateComplianceStatus(supplierId);

    revalidatePath("/carvao/fornecedores");
    return { success: true, filePath };
}

// Generate signed URL for document viewing
export async function generateDocumentSignedUrl(filePath: string): Promise<string | null> {
    const supabase = await createClient();

    const { data, error } = await supabase.storage
        .from('carvao-documents')
        .createSignedUrl(filePath, 3600); // 1 hour

    if (error) {
        console.error("Error generating signed URL:", error);
        return null;
    }

    return data.signedUrl;
}

// Update document details (status, expiry, notes, name)
export async function updateSupplierDocument(formData: FormData): Promise<{
    success: boolean;
    error?: string;
}> {
    const supabase = await createClient();

    const id = formData.get("id") as string;
    const status = formData.get("status") as string;
    const expiry_date = formData.get("expiry_date") as string;
    const notes = formData.get("notes") as string;
    const document_name = formData.get("document_name") as string; // NEW
    const supplier_id = formData.get("supplier_id") as string;

    if (!id) {
        return { success: false, error: "ID do documento não informado" };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { success: false, error: "Usuário não autenticado" };
    }

    const updateData: any = {
        status: status || 'pendente',
        expiry_date: expiry_date || null,
        notes: notes || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
    };

    if (document_name) {
        updateData.document_name = document_name;
    }

    const { error } = await (supabase
        .from("carvao_supplier_documents") as any)
        .update(updateData)
        .eq("id", id);

    if (error) {
        console.error("Error updating document:", error);
        return { success: false, error: error.message };
    }

    // Recalculate compliance status
    if (supplier_id) {
        await recalculateComplianceStatus(supplier_id);
    }

    revalidatePath("/carvao/fornecedores");
    return { success: true };
}

// Delete document file AND record (Hard Delete)
export async function deleteSupplierDocument(documentId: string, supplierId: string): Promise<{
    success: boolean;
    error?: string;
}> {
    const supabase = await createClient();

    // Get document to find file path
    const { data: doc } = await supabase
        .from("carvao_supplier_documents")
        .select("file_path")
        .eq("id", documentId)
        .single();

    // Delete file from storage if exists
    if ((doc as any)?.file_path) {
        await supabase.storage
            .from('carvao-documents')
            .remove([(doc as any).file_path]);
    }

    // HARD DELETE record
    const { error } = await (supabase
        .from("carvao_supplier_documents") as any)
        .delete()
        .eq("id", documentId);

    if (error) {
        return { success: false, error: error.message };
    }

    // Recalculate compliance
    await recalculateComplianceStatus(supplierId);

    revalidatePath("/carvao/fornecedores");
    return { success: true };
}

// =============================================================================
// UPDATE SUPPLIER DOCUMENTATION (ALL 22 FIELDS)
// =============================================================================

export async function updateSupplierDocumentation(formData: FormData): Promise<{
    success: boolean;
    error?: string;
}> {
    const supabase = await createClient();

    const id = formData.get("id") as string;

    if (!id) {
        return { success: false, error: "ID do fornecedor não informado" };
    }

    const documentationData: any = {
        // Dados da Propriedade
        property_name: (formData.get("property_name") as string) || null,
        city: (formData.get("city") as string) || null,
        state: (formData.get("state") as string) || null,
        owner_name: (formData.get("owner_name") as string) || null,
        owner_cpf: (formData.get("owner_cpf") as string) || null,

        // Documentos Ambientais
        dcf_number: (formData.get("dcf_number") as string) || null,
        car_number: (formData.get("car_number") as string) || null,
        dae_forestal_number: (formData.get("dae_forestal_number") as string) || null,
        dae_payment_date: (formData.get("dae_payment_date") as string) || null,
        dae_volume_area: (formData.get("dae_volume_area") as string) || null,
        dstc: (formData.get("dstc") as string) || null,
        authorized_area: (formData.get("authorized_area") as string) || null,
        species: (formData.get("species") as string) || null,

        // Contrato
        contract_exists: formData.get("contract_exists") === "true",
        contract_signed: formData.get("contract_signed") === "true",
        contract_volume: formData.get("contract_volume") ? parseFloat(formData.get("contract_volume") as string) : null,
        contract_value: formData.get("contract_value") ? parseFloat(formData.get("contract_value") as string) : null,

        // Arrendamento
        is_leased: formData.get("is_leased") === "true",
        intermediary_name: (formData.get("intermediary_name") as string) || null,

        // Observações
        documentation_notes: (formData.get("documentation_notes") as string) || null,
    };

    const { error } = await (supabase
        .from("carvao_suppliers") as any)
        .update(documentationData)
        .eq("id", id);

    if (error) {
        console.error("Error updating documentation:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/carvao/fornecedores");
    return { success: true };
}

// =============================================================================
// GET DOCUMENT SIGNED URL FOR VIEWING
// =============================================================================

export async function getDocumentSignedUrl(supplierId: string, documentType: string): Promise<string | null> {
    const supabase = await createClient();

    // Build expected file path
    const filePath = `${supplierId}/${documentType}.pdf`;

    const { data, error } = await supabase.storage
        .from('carvao-documents')
        .createSignedUrl(filePath, 3600); // 1 hour

    if (error) {
        console.error("Error generating signed URL:", error);
        return null;
    }

    return data.signedUrl;
}

// =============================================================================
// UPLOAD SUPPLIER DOCUMENT FILE (WITH REAL STORAGE)
// =============================================================================

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const DOCUMENT_TYPES = ['DOF', 'CONTRATO', 'CONTRATO_ASSINADO', 'DCF', 'CAR', 'OUTRO'];

export async function uploadSupplierDocumentFile(formData: FormData): Promise<{
    success: boolean;
    error?: string;
    signedUrl?: string;
}> {
    const supabase = await createClient();

    const file = formData.get("file") as File;
    const supplierId = formData.get("supplier_id") as string;
    const documentType = formData.get("document_type") as string;
    const documentName = formData.get("document_name") as string; // Optional

    if (!file || !supplierId || !documentType) {
        return { success: false, error: "Dados incompletos" };
    }

    // Validate document type
    if (!DOCUMENT_TYPES.includes(documentType)) {
        return { success: false, error: "Tipo de documento inválido" };
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
        return { success: false, error: "Tipo de arquivo não permitido. Use PDF, JPG ou PNG." };
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
        return { success: false, error: "Arquivo muito grande. Máximo: 10MB" };
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { success: false, error: "Usuário não autenticado" };
    }

    // File path: {supplier_id}/{document_type}/{timestamp}_{filename}
    // Using timestamp to avoid conflicts
    const timestamp = Date.now();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${supplierId}/${documentType}/${timestamp}_${sanitizedFilename}`;

    // Upload to Storage
    const { error: uploadError } = await supabase.storage
        .from('carvao-documents')
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (uploadError) {
        console.error("Upload error:", uploadError);
        return { success: false, error: uploadError.message };
    }

    // Database Operation
    // Logic:
    // 1. If OUTRO -> Always INSERT new record (allows multiples)
    // 2. If Standard -> Check for existing record of this type.
    //      - If exists: UPDATE (replace file)
    //      - If not: INSERT

    let dbError;
    let existingDoc = null;

    if (documentType !== 'OUTRO') {
        // Check for existing standard document
        const { data } = await supabase
            .from("carvao_supplier_documents")
            .select("id, file_path")
            .eq("supplier_id", supplierId)
            .eq("document_type", documentType)
            .maybeSingle();
        existingDoc = data;
    }

    const documentData = {
        supplier_id: supplierId,
        document_type: documentType,
        document_name: documentType === 'OUTRO' ? (documentName || file.name) : null,
        file_path: filePath,
        file_name: file.name,
        file_size_bytes: file.size,
        status: 'em_analise',
        uploaded_at: new Date().toISOString(),
        uploaded_by: user.id
    };

    if (existingDoc) {
        // UPDATE existing standard doc
        // First delete old file from storage to keep it clean
        if ((existingDoc as any).file_path) {
            await supabase.storage
                .from('carvao-documents')
                .remove([(existingDoc as any).file_path]);
        }

        const { error } = await (supabase
            .from("carvao_supplier_documents") as any)
            .update(documentData)
            .eq("id", (existingDoc as any).id);
        dbError = error;
    } else {
        // INSERT new record (Standard or OUTRO)
        const { error } = await (supabase
            .from("carvao_supplier_documents") as any)
            .insert(documentData);
        dbError = error;
    }

    if (dbError) {
        console.error("DB error:", dbError);
        // Clean up uploaded file since DB failed
        await supabase.storage
            .from('carvao-documents')
            .remove([filePath]);
        return { success: false, error: dbError.message };
    }

    // Recalculate compliance status
    await recalculateComplianceStatus(supplierId);

    // Generate signed URL to return
    const { data: urlData } = await supabase.storage
        .from('carvao-documents')
        .createSignedUrl(filePath, 3600);

    revalidatePath("/carvao/fornecedores");
    return {
        success: true,
        signedUrl: urlData?.signedUrl || undefined
    };
}
