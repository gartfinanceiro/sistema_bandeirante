"use client";

import { useState, useEffect, ChangeEvent } from "react";
import {
    createSupplier,
    updateSupplier,
    getSupplierDocuments,
    uploadSupplierDocumentFile,
    getDocumentSignedUrl,
    updateSupplierDocumentation,
} from "@/app/(carvao)/carvao/fornecedores/actions";
import type { Supplier, CarvaoCommercialStatus } from "@/types/database";

interface SupplierDialogProps {
    isOpen: boolean;
    onClose: () => void;
    initialData: Supplier | null;
}

type Tab = "general" | "documentation";

const DOCUMENT_TYPES = ['DOF', 'CONTRATO', 'CONTRATO_ASSIN ADO', 'DCF', 'CAR'] as const;

export function SupplierDialog({ isOpen, onClose, initialData }: SupplierDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>("general");
    const [documents, setDocuments] = useState<Record<string, any>>({});
    const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

    // Reset when modal opens/closes
    useEffect(() => {
        if (isOpen && initialData) {
            loadDocuments();
            setActiveTab("general");
        }
    }, [isOpen, initialData]);

    async function loadDocuments() {
        if (!initialData) return;

        const docs = await getSupplierDocuments(initialData.id);
        const docsMap: Record<string, any> = {};
        docs.forEach(doc => {
            docsMap[doc.document_type] = doc;
        });
        setDocuments(docsMap);
    }

    async function handleGeneralSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsSubmitting(true);

        const form = e.currentTarget;
        const data = new FormData(form);

        if (initialData) {
            data.append("id", initialData.id);
        }

        const result = initialData ? await updateSupplier(data) : await createSupplier(data);

        setIsSubmitting(false);

        if (result.success) {
            onClose();
        } else {
            alert(result.error || "Erro ao salvar fornecedor");
        }
    }

    async function handleDocumentationSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!initialData) return;

        setIsSubmitting(true);

        const form = e.currentTarget;
        const data = new FormData(form);
        data.append("id", initialData.id);

        const result = await updateSupplierDocumentation(data);

        setIsSubmitting(false);

        if (result.success) {
            alert("Documentação salva com sucesso!");
        } else {
            alert(result.error || "Erro ao salvar documentação");
        }
    }

    async function handleFileUpload(e: ChangeEvent<HTMLInputElement>, documentType: string) {
        const file = e.target.files?.[0];
        if (!file || !initialData) return;

        setUploadingDoc(documentType);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('supplier_id', initialData.id);
        formData.append(' document_type', documentType);

        const result = await uploadSupplierDocumentFile(formData);

        setUploadingDoc(null);

        if (result.success) {
            alert(`Documento ${documentType} enviado com sucesso!`);
            loadDocuments(); // Reload
        } else {
            alert(result.error || 'Erro ao enviar documento');
        }

        // Reset input
        e.target.value = '';
    }

    async function handleViewDocument(documentType: string) {
        if (!initialData) return;

        const url = await getDocumentSignedUrl(initialData.id, documentType);
        if (url) {
            window.open(url, '_blank');
        } else {
            alert('Erro ao gerar link do documento');
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />

            {/* Dialog */}
            <div className="relative bg-background rounded-lg shadow-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <h2 className="text-xl font-semibold">
                        {initialData ? "Editar Fornecedor" : "Novo Fornecedor"}
                    </h2>
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

                {/* Tabs */}
                <div className="border-b">
                    <div className="flex px-6">
                        <button
                            type="button"
                            onClick={() => setActiveTab("general")}
                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "general"
                                    ? "border-primary text-primary"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            Dados Gerais
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("documentation")}
                            disabled={!initialData}
                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "documentation"
                                    ? "border-primary text-primary"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            Documentação {!initialData && "(Salve primeiro)"}
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Tab: Dados Gerais */}
                    {activeTab === "general" && (
                        <form onSubmit={handleGeneralSubmit} id="general-form">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Nome <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        defaultValue={initialData?.name || ''}
                                        required
                                        className="w-full px-3 py-2 border rounded-md"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm mb-1">Razão Social</label>
                                        <input
                                            type="text"
                                            name="legal_name"
                                            defaultValue={initialData?.legal_name || ''}
                                            className="w-full px-3 py-2 border rounded-md"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm mb-1">CNPJ/CPF</label>
                                        <input
                                            type="text"
                                            name="document"
                                            defaultValue={initialData?.document || ''}
                                            className="w-full px-3 py-2 border rounded-md"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm mb-1">Contato</label>
                                        <input
                                            type="text"
                                            name="contact_name"
                                            defaultValue={initialData?.contact_name || ''}
                                            className="w-full px-3 py-2 border rounded-md"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm mb-1">Telefone</label>
                                        <input
                                            type="tel"
                                            name="contact_phone"
                                            defaultValue={initialData?.contact_phone || ''}
                                            className="w-full px-3 py-2 border rounded-md"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm mb-1">Email</label>
                                        <input
                                            type="email"
                                            name="contact_email"
                                            defaultValue={initialData?.contact_email || ''}
                                            className="w-full px-3 py-2 border rounded-md"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm mb-1">Status Comercial</label>
                                    <select
                                        name="commercial_status"
                                        defaultValue={initialData?.commercial_status || 'em_prospeccao'}
                                        className="w-full px-3 py-2 border rounded-md"
                                    >
                                        <option value="em_prospeccao">Em Prospecção</option>
                                        <option value="em_negociacao">Em Negociação</option>
                                        <option value="interessado">Interessado</option>
                                        <option value="inativo">Inativo</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm mb-1">Observações</label>
                                    <textarea
                                        name="notes"
                                        defaultValue={initialData?.notes || ''}
                                        rows={3}
                                        className="w-full px-3 py-2 border rounded-md"
                                    />
                                </div>
                            </div>
                        </form>
                    )}

                    {/* Tab: Documentação */}
                    {activeTab === "documentation" && initialData && (
                        <div className="space-y-6">
                            {/* Seção 1: Formulário com TODOS os 22 campos */}
                            <form onSubmit={handleDocumentationSubmit} id="documentation-form">
                                <div className="border rounded-lg p-5 bg-muted/20 space-y-6">
                                    <h3 className="text-sm font-semibold mb-3 border-b pb-2">
                                        🏡 Dados da Propriedade e Documentação
                                    </h3>

                                    {/* Propriedade */}
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium mb-1">Propriedade</label>
                                            <input
                                                type="text"
                                                name="property_name"
                                                defaultValue={initialData.property_name || ''}
                                                className="w-full px-3 py-2 border rounded-md text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1">Município</label>
                                            <input
                                                type="text"
                                                name="city"
                                                defaultValue={initialData.city || ''}
                                                className="w-full px-3 py-2 border rounded-md text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1">UF</label>
                                            <input
                                                type="text"
                                                name="state"
                                                defaultValue={initialData.state || ''}
                                                maxLength={2}
                                                className="w-full px-3 py-2 border rounded-md text-sm uppercase"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium mb-1">Proprietário</label>
                                            <input
                                                type="text"
                                                name="owner_name"
                                                defaultValue={initialData.owner_name || ''}
                                                className="w-full px-3 py-2 border rounded-md text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1">CPF Proprietário</label>
                                            <input
                                                type="text"
                                                name="owner_cpf"
                                                defaultValue={initialData.owner_cpf || ''}
                                                className="w-full px-3 py-2 border rounded-md text-sm"
                                            />
                                        </div>
                                    </div>

                                    {/* Documentos Ambientais */}
                                    <div className="border-t pt-4">
                                        <h4 className="text-xs font-semibold mb-3 text-muted-foreground">Documentos Ambientais</h4>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-xs mb-1">DCF</label>
                                                <input type="text" name="dcf_number" defaultValue={initialData.dcf_number || ''} className="w-full px-3 py-2 border rounded-md text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-xs mb-1">CAR</label>
                                                <input type="text" name="car_number" defaultValue={initialData.car_number || ''} className="w-full px-3 py-2 border rounded-md text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-xs mb-1">DAE Taxa Florestal</label>
                                                <input type="text" name="dae_forestal_number" defaultValue={initialData.dae_forestal_number || ''} className="w-full px-3 py-2 border rounded-md text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-xs mb-1">Data Pgto DAE</label>
                                                <input type="date" name="dae_payment_date" defaultValue={initialData.dae_payment_date || ''} className="w-full px-3 py-2 border rounded-md text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-xs mb-1">Vol DAE / Área</label>
                                                <input type="text" name="dae_volume_area" defaultValue={initialData.dae_volume_area || ''} className="w-full px-3 py-2 border rounded-md text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-xs mb-1">DSTC</label>
                                                <input type="text" name="dstc" defaultValue={initialData.dstc || ''} className="w-full px-3 py-2 border rounded-md text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-xs mb-1">Área Autorizada</label>
                                                <input type="text" name="authorized_area" defaultValue={initialData.authorized_area || ''} className="w-full px-3 py-2 border rounded-md text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-xs mb-1">Espécie</label>
                                                <input type="text" name="species" defaultValue={initialData.species || ''} className="w-full px-3 py-2 border rounded-md text-sm" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Contrato */}
                                    <div className="border-t pt-4">
                                        <h4 className="text-xs font-semibold mb-3 text-muted-foreground">Contrato</h4>
                                        <div className="grid grid-cols-4 gap-4">
                                            <div className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    name="contract_exists"
                                                    value="true"
                                                    defaultChecked={initialData.contract_exists || false}
                                                    className="mr-2"
                                                />
                                                <label className="text-xs">Contrato Existe?</label>
                                            </div>
                                            <div className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    name="contract_signed"
                                                    value="true"
                                                    defaultChecked={initialData.contract_signed || false}
                                                    className="mr-2"
                                                />
                                                <label className="text-xs">Contrato Assinado?</label>
                                            </div>
                                            <div>
                                                <label className="block text-xs mb-1">Volume Contrato</label>
                                                <input type="number" step="0.01" name="contract_volume" defaultValue={initialData.contract_volume || ''} className="w-full px-3 py-2 border rounded-md text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-xs mb-1">Valor Contrato</label>
                                                <input type="number" step="0.01" name="contract_value" defaultValue={initialData.contract_value || ''} className="w-full px-3 py-2 border rounded-md text-sm" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Arrendamento */}
                                    <div className="border-t pt-4">
                                        <h4 className="text-xs font-semibold mb-3 text-muted-foreground">Arrendamento / Intermediação</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    name="is_leased"
                                                    value="true"
                                                    defaultChecked={initialData.is_leased || false}
                                                    className="mr-2"
                                                />
                                                <label className="text-xs">Arrendamento?</label>
                                            </div>
                                            <div>
                                                <label className="block text-xs mb-1">Intermediador / Transportador</label>
                                                <input type="text" name="intermediary_name" defaultValue={initialData.intermediary_name || ''} className="w-full px-3 py-2 border rounded-md text-sm" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Observações */}
                                    <div className="border-t pt-4">
                                        <label className="block text-xs font-medium mb-1">Observações</label>
                                        <textarea
                                            name="documentation_notes"
                                            defaultValue={initialData.documentation_notes || ''}
                                            rows={3}
                                            className="w-full px-3 py-2 border rounded-md text-sm font-mono"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        form="documentation-form"
                                        disabled={isSubmitting}
                                        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm disabled:opacity-50"
                                    >
                                        {isSubmitting ? "Salvando..." : "Salvar Dados da Propriedade"}
                                    </button>
                                </div>
                            </form>

                            {/* Seção 2: Upload de Documentos */}
                            <div className="border rounded-lg p-5 bg-muted/20">
                                <h3 className="text-sm font-semibold mb-4 border-b pb-2">
                                    📎 Upload de Documentos
                                </h3>

                                <table className="w-full text-sm">
                                    <thead className="bg-muted">
                                        <tr>
                                            <th className="text-left px-3 py-2 font-medium">Documento</th>
                                            <th className="text-left px-3 py-2 font-medium">Arquivo</th>
                                            <th className="text-left px-3 py-2 font-medium">Status</th>
                                            <th className="text-center px-3 py-2 font-medium">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {DOCUMENT_TYPES.map(type => {
                                            const doc = documents[type];
                                            const hasFile = doc?.file_path;

                                            return (
                                                <tr key={type} className="border-t">
                                                    <td className="px-3 py-3 font-medium">{type}</td>
                                                    <td className="px-3 py-3">
                                                        {uploadingDoc === type ? (
                                                            <span className="text-blue-600 text-xs">⏳ Enviando...</span>
                                                        ) : hasFile ? (
                                                            <span className="text-green-600 text-xs flex items-center gap-1">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                </svg>
                                                                Anexado
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground text-xs">Sem arquivo</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        {doc ? (
                                                            <span className={`px-2 py-1 rounded text-xs ${doc.status === 'aprovado' ? 'bg-green-100 text-green-700' :
                                                                    doc.status === 'pendente' ? 'bg-gray-100 text-gray-700' :
                                                                        'bg-yellow-100 text-yellow-700'
                                                                }`}>
                                                                {doc.status === 'aprovado' ? 'Aprovado' :
                                                                    doc.status === 'pendente' ? 'Pendente' : 'Em Análise'}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            {hasFile && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleViewDocument(type)}
                                                                    className="text-xs text-blue-600 hover:underline"
                                                                >
                                                                    Ver
                                                                </button>
                                                            )}
                                                            <label className="cursor-pointer">
                                                                <input
                                                                    type="file"
                                                                    accept=".pdf,.jpg,.jpeg,.png"
                                                                    onChange={(e) => handleFileUpload(e, type)}
                                                                    className="hidden"
                                                                    disabled={uploadingDoc !== null}
                                                                />
                                                                <span className="text-xs text-primary hover:underline">
                                                                    {hasFile ? 'Substituir' : 'Anexar'}
                                                                </span>
                                                            </label>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>

                                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                                    <p className="text-xs text-blue-800">
                                        💡 <strong>Regra Automática:</strong> DOF + CONTRATO_ASSINADO anexados e aprovados = Status "Aprovado"
                                    </p>
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className="text-xs">Status Atual:</span>
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${initialData.compliance_status === 'aprovado' ? 'bg-green-100 text-green-700' :
                                                initialData.compliance_status === 'vencido' ? 'bg-red-100 text-red-700' :
                                                    'bg-yellow-100 text-yellow-700'
                                            }`}>
                                            {initialData.compliance_status === 'aprovado' ? 'Regular' :
                                                initialData.compliance_status === 'vencido' ? 'Vencido' : 'Pendente'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t bg-muted/30">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 border rounded-md hover:bg-muted transition-colors"
                    >
                        Cancelar
                    </button>
                    {activeTab === "general" && (
                        <button
                            type="submit"
                            form="general-form"
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            {isSubmitting ? "Salvando..." : "Salvar Fornecedor"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
