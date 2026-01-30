"use client";

import { useState, useEffect } from "react";
import {
    updateSupplierDocument,
    uploadDocumentFile,
    generateDocumentSignedUrl,
    deleteSupplierDocument,
} from "@/app/(carvao)/carvao/fornecedores/actions";

interface DocumentEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    document: any | null;
    supplierId: string;
}

export function DocumentEditModal({
    isOpen,
    onClose,
    document,
    supplierId,
}: DocumentEditModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const [formData, setFormData] = useState({
        status: "pendente",
        expiry_date: "",
        notes: "",
    });

    useEffect(() => {
        if (document) {
            setFormData({
                status: document.status || "pendente",
                expiry_date: document.expiry_date || "",
                notes: document.notes || "",
            });
        }
    }, [document]);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!document) return;

        setIsSubmitting(true);

        const form = e.currentTarget;
        const data = new FormData(form);
        data.append("id", document.id);
        data.append("supplier_id", supplierId);
        // data.append("document_name", ... ) - handled by input name="document_name"

        const result = await updateSupplierDocument(data);

        setIsSubmitting(false);

        if (result.success) {
            onClose();
        } else {
            alert(result.error || "Erro ao salvar documento");
        }
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !document) return;

        // Validate file type
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
        if (!allowedTypes.includes(file.type)) {
            alert("Tipo de arquivo não permitido. Use PDF, JPG ou PNG.");
            e.target.value = '';
            return;
        }

        // Validate file size
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            alert("Arquivo muito grande. Máximo: 10MB");
            e.target.value = '';
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("supplier_id", supplierId);
        formData.append("document_type", document.document_type);
        formData.append("document_id", document.id);
        // For OUTRO, preserve name
        if (document.document_type === 'OUTRO' && document.document_name) {
            formData.append("document_name", document.document_name);
        }

        // Simulate progress (since we can't track real progress easily)
        const progressInterval = setInterval(() => {
            setUploadProgress(prev => Math.min(prev + 10, 90));
        }, 200);

        const result = await uploadDocumentFile(formData);

        clearInterval(progressInterval);
        setUploadProgress(100);

        setTimeout(() => {
            setIsUploading(false);
            setUploadProgress(0);

            if (result.success) {
                alert("Documento enviado com sucesso!");
                onClose();
            } else {
                console.error("Upload error:", result.error);
                if (result.error?.includes("Bucket not found")) {
                    alert("Erro de configuração: bucket de documentos não encontrado. Verifique o Supabase Storage.");
                } else {
                    alert(result.error || "Erro ao enviar documento");
                }
            }
        }, 500);
    }

    async function handleViewDocument() {
        if (!document?.file_path) return;

        const signedUrl = await generateDocumentSignedUrl(document.file_path);
        if (signedUrl) {
            window.open(signedUrl, '_blank');
        } else {
            alert("Erro ao gerar link do documento");
        }
    }

    async function handleDeleteFile() {
        if (!document?.id) return;

        if (!confirm("Tem certeza que deseja EXCLUIR DEFINITIVAMENTE este documento e seu arquivo?")) return;

        setIsSubmitting(true);
        const result = await deleteSupplierDocument(document.id, supplierId);
        setIsSubmitting(false);

        if (result.success) {
            alert("Documento excluído com sucesso");
            onClose();
        } else {
            alert(result.error || "Erro ao remover documento");
        }
    }

    function isExpired() {
        if (!formData.expiry_date) return false;
        return new Date(formData.expiry_date) < new Date();
    }

    // ... helper functions ...

    if (!isOpen || !document) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-background rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <form onSubmit={handleSubmit} className="flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b">
                        <div>
                            <h2 className="text-xl font-semibold">Editar Documento</h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                {document.document_type === 'OUTRO' ? 'Documento Personalizado' : document.document_type}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {/* Name Field (Only for OUTRO) */}
                        {document.document_type === 'OUTRO' && (
                            <div>
                                <label htmlFor="document_name" className="block text-sm font-medium mb-1">
                                    Nome do Documento
                                </label>
                                <input
                                    type="text"
                                    id="document_name"
                                    name="document_name"
                                    defaultValue={document.document_name || ''}
                                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                    required
                                />
                            </div>
                        )}

                        {/* Status */}
                        <div>
                            <label htmlFor="status" className="block text-sm font-medium mb-1">
                                Status
                            </label>
                            <select
                                id="status"
                                name="status"
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                <option value="pendente">Pendente</option>
                                <option value="em_analise">Em Análise</option>
                                <option value="aprovado">Aprovado</option>
                                <option value="reprovado">Reprovado</option>
                                <option value="expirado">Expirado</option>
                            </select>
                        </div>

                        {/* Expiry Date */}
                        <div>
                            <label htmlFor="expiry_date" className="block text-sm font-medium mb-1">
                                Data de Validade
                            </label>
                            <input
                                type="date"
                                id="expiry_date"
                                name="expiry_date"
                                value={formData.expiry_date}
                                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                            {/* ... warning flags ... */}
                        </div>

                        {/* File Upload / Management */}
                        <div className="border-t pt-4">
                            <label className="block text-sm font-medium mb-2">
                                Arquivo do Documento
                            </label>

                            {document.file_path && !isUploading && (
                                <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-md">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {/* Icon */}
                                            <span className="text-xl">📄</span>
                                            <div>
                                                <p className="text-sm font-medium text-green-900">
                                                    {document.file_name || 'Arquivo anexado'}
                                                </p>
                                                {document.file_size_bytes && (
                                                    <p className="text-xs text-green-700">
                                                        {(document.file_size_bytes / 1024).toFixed(1)} KB
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={handleViewDocument}
                                                className="text-xs text-blue-600 hover:underline"
                                            >
                                                Ver
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {isUploading && (
                                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                                    <p className="text-sm text-blue-900 mb-2">Enviando documento...</p>
                                    <div className="w-full bg-blue-200 rounded-full h-2">
                                        <div
                                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <label className="flex-1">
                                    <span className="sr-only">Escolher arquivo</span>
                                    <input
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={handleFileUpload}
                                        disabled={isUploading}
                                        className="block w-full text-sm text-slate-500
                                          file:mr-4 file:py-2 file:px-4
                                          file:rounded-md file:border-0
                                          file:text-sm file:font-semibold
                                          file:bg-primary file:text-primary-foreground
                                          hover:file:bg-primary/90
                                        "
                                    />
                                </label>
                            </div>
                        </div>

                        {/* Notes */}
                        <div>
                            <label htmlFor="notes" className="block text-sm font-medium mb-1">
                                Observações
                            </label>
                            <textarea
                                id="notes"
                                name="notes"
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                rows={4}
                                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring font-mono text-sm"
                                placeholder="Observações sobre este documento..."
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between p-6 border-t bg-muted/30">
                        <button
                            type="button"
                            onClick={handleDeleteFile}
                            className="text-red-600 hover:text-red-700 text-sm font-medium hover:underline"
                        >
                            Excluir Documento
                        </button>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 border rounded-md hover:bg-muted transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || isUploading}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                                {isSubmitting ? "Salvando..." : "Salvar"}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
