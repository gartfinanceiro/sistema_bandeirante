"use client";

import { useState, useEffect, useTransition } from "react";
import { createTransaction, updateTransaction, type CategoryGroup, type TransactionRow } from "@/app/(authenticated)/financeiro/actions";
import {
    getSuppliers,
    createPurchaseTransaction,
    getMaterialByType,
    type Supplier
} from "@/app/(authenticated)/estoque/actions";
import { type VisualMaterialType } from "@/app/(authenticated)/estoque/utils";

interface TransactionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    categories: CategoryGroup[];
    initialData?: TransactionRow | null; // Data for editing
}

// Configuration for category behaviors based on slug
const CATEGORY_CONFIG: Record<string, { isMaterial: boolean; materialType?: VisualMaterialType }> = {
    'raw_material_charcoal': { isMaterial: true, materialType: 'carvao' },
    'raw_material_ore': { isMaterial: true, materialType: 'minerio' },
    'raw_material_flux': { isMaterial: true, materialType: 'fundentes' },
    // Defaults for others are implied as false/undefined
};

// Check if category is a raw material (matéria-prima) category
function getCategoryConfig(slug: string | null): { isMaterial: boolean; materialType?: VisualMaterialType } {
    if (slug && CATEGORY_CONFIG[slug]) {
        return CATEGORY_CONFIG[slug];
    }

    // Fallback for legacy/UUID-only categories (keep existing logic as backup)
    // This allows the system to work even if slugs aren't fully populated yet
    return { isMaterial: false };
}

export function TransactionDialog({
    isOpen,
    onClose,
    categories,
    initialData,
}: TransactionDialogProps) {
    const [isPending, startTransition] = useTransition();
    const [type, setType] = useState<"entrada" | "saida">("saida");
    const [error, setError] = useState<string | null>(null);

    // Smart purchase state
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
    const [materialType, setMaterialType] = useState<VisualMaterialType | null>(null);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
    const [amount, setAmount] = useState<string>("");
    const [calculatedQty, setCalculatedQty] = useState<number>(0);
    const [manualQty, setManualQty] = useState<string>("");
    const [addToStock, setAddToStock] = useState(true);
    const [materialId, setMaterialId] = useState<string>("");
    const [materialUnit, setMaterialUnit] = useState<string>("t");

    // Additional fields for edit
    const [date, setDate] = useState<string>("");
    const [description, setDescription] = useState<string>("");
    const [status, setStatus] = useState<string>("pago");

    // Fiscal fields
    const [hasIcmsCredit, setHasIcmsCredit] = useState(false);
    const [icmsRate, setIcmsRate] = useState<string>("");

    const isEditing = !!initialData;

    // Load suppliers on mount
    useEffect(() => {
        if (isOpen) {
            getSuppliers(true).then(setSuppliers);
        }
    }, [isOpen]);

    // Populate form on open/change
    useEffect(() => {
        if (isOpen && initialData) {
            // Edit Mode
            setType(initialData.type);
            setAmount(initialData.amount.toString());
            setDate(initialData.date);
            setDescription(initialData.description || "");
            setStatus(initialData.status || "pago");

            // Category population
            // If category has slug, use it. Otherwise use ID (for backward compat if needed)
            if (initialData.category) {
                // Determine if we should set slug or ID. The select options use `cat.slug || cat.id`.
                // We prefer slug.
                setSelectedCategoryId(initialData.category.slug || initialData.category.id);
            }

            // Set Fiscal Data if present (assuming TransactionRow updated to include these, otherwise standard defaulting)
            // Note: We need to ensure logic handles if fields are missing in type, but DB has them.
            // For now, let's assume they might be in `initialData` as any extended type or just default false.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const txData = initialData as any;
            if (txData.has_icms_credit) {
                setHasIcmsCredit(true);
                setIcmsRate(txData.icms_rate?.toString() || "0");
            }
        } else if (isOpen && !initialData) {
            // Create Mode - Reset
            resetForm();
            setDate(new Date().toISOString().split("T")[0]);
        }
    }, [isOpen, initialData]);

    // Check category when it changes
    useEffect(() => {
        if (!selectedCategoryId) {
            setMaterialType(null);
            setMaterialId("");
            setMaterialUnit("t");
            return;
        }

        // Find the category object in the nested structure
        let selectedCat: { id: string; name: string; slug?: string | null; materialId?: string | null } | undefined;

        for (const group of categories) {
            const cat = group.categories.find((c) => c.id === selectedCategoryId || c.slug === selectedCategoryId);
            if (cat) {
                selectedCat = cat;
                break;
            }
        }

        if (selectedCat) {
            // New Logic: Check if it has a direct materialId (Dynamic Material Category)
            if (selectedCat.materialId) {
                setMaterialId(selectedCat.materialId);
                // We assume unit is 't' or need to fetch details. 
                // Since getCategories only fetched minimal info, we might rely on the fact 
                // that stock actions usually assume 't' or fetch material details.
                // ideally getCategories should return unit too, but let's stick to 't' default or fetch if needed.
                // For now, set generic 't' or keep previous unit if not changed.
                setMaterialType('carvao'); // Hack to enable "Purchase Mode" UI, visualType doesn't matter much if materialId is set directly
            }
            // Legacy Logic: Check config by slug
            else {
                const config = getCategoryConfig(selectedCat.slug || null);
                setMaterialType(config.materialType || null);

                // Get material ID for this type if applicable (Legacy Pattern)
                if (config.isMaterial && config.materialType) {
                    getMaterialByType(config.materialType).then((mat) => {
                        if (mat) {
                            setMaterialId(mat.id);
                            setMaterialUnit(mat.unit);
                        } else {
                            setMaterialId("");
                        }
                    });
                } else {
                    setMaterialId("");
                }
            }
        }

        // Reset Fiscal if category changes and it's not freight (optional, user might want persistence but cleaner to reset)
        // We'll check isFreightLogic in render or here. 
        // Let's rely on the user to uncheck if they switch cat, or we can auto-reset.
        // Auto-reset seems safer to avoid accidental credit claiming.
        if (selectedCat) {
            const isFreight = selectedCat.name?.toLowerCase().includes("frete");
            if (!isFreight && !isEditing) {
                setHasIcmsCredit(false);
                setIcmsRate("");
            }
        }

    }, [selectedCategoryId, categories]);

    // Calculate quantity when amount or supplier changes
    useEffect(() => {
        if (!selectedSupplierId || !amount) {
            setCalculatedQty(0);
            return;
        }

        const supplier = suppliers.find((s) => s.id === selectedSupplierId);

        // Scenario A: Supplier has default price (Auto-calculate)
        if (supplier && supplier.defaultPrice && supplier.defaultPrice > 0) {
            const qty = parseFloat(amount) / supplier.defaultPrice;
            setCalculatedQty(qty);
            setManualQty(qty.toFixed(2));
        }
        // Scenario B: Variable pricing (Manual entry) - Do nothing, let user type
        else {
            setCalculatedQty(0);
            // Don't override manualQty here to allow user typing
        }
    }, [selectedSupplierId, amount, suppliers]);

    if (!isOpen) return null;

    const filteredSuppliers = materialId
        ? suppliers.filter((s) => s.materialId === materialId)
        : suppliers;

    // Purchase mode only enabled for creation, or potentially edit if valid?
    // For simplicity, stock logic usually applies on creation. 
    // If editing a historical transaction, re-triggering stock logic is complex.
    // We'll disable "Purchase Mode" features (stock add) in Edit Mode for safety unless requested.
    const isPurchaseMode = !isEditing && type === "saida" && materialType !== null;

    // Check if selected category is Logistics/Freight
    const selectedCategoryName = categories
        .flatMap(g => g.categories)
        .find(c => c.id === selectedCategoryId || c.slug === selectedCategoryId)
        ?.name.toLowerCase() || "";

    const isFreightCategory = selectedCategoryName.includes("frete");

    async function handleSubmit(formData: FormData) {
        formData.set("type", type);
        // Explicitly set controlled inputs if needed, though name attr handles it usually.
        // But for Selects reacting to state, ensuring correctness:
        if (isEditing && initialData) {
            formData.set("id", initialData.id);
        }

        setError(null);

        startTransition(async () => {
            if (isEditing) {
                // Update
                const result = await updateTransaction(formData);
                if (result.success) {
                    onClose();
                } else {
                    setError(result.error || "Erro ao atualizar transação");
                }
            } else if (isPurchaseMode && addToStock) {
                // Use purchase transaction (creates financial + stock entry)
                formData.set("supplierId", selectedSupplierId);
                formData.set("quantity", manualQty || calculatedQty.toString());
                formData.set("addToStock", addToStock ? "true" : "false");
                formData.set("materialId", materialId);
                formData.set("hasIcmsCredit", hasIcmsCredit ? "true" : "false");
                formData.set("icmsRate", icmsRate);

                const result = await createPurchaseTransaction(formData);
                if (result.success) {
                    resetForm();
                    onClose();
                } else {
                    setError(result.error || "Erro ao criar transação");
                }
            } else {
                // Regular transaction
                formData.set("hasIcmsCredit", hasIcmsCredit ? "true" : "false");
                formData.set("icmsRate", icmsRate);

                const result = await createTransaction(formData);
                if (result.success) {
                    resetForm();
                    onClose();
                } else {
                    setError(result.error || "Erro ao criar transação");
                }
            }
        });
    }

    function resetForm() {
        setType("saida");
        setSelectedCategoryId("");
        setMaterialType(null);
        setSelectedSupplierId("");
        setAmount("");
        setDate(new Date().toISOString().split("T")[0]);
        setDescription("");
        setStatus("pago");
        setCalculatedQty(0);
        setManualQty("");
        setAddToStock(true);
        setHasIcmsCredit(false);
        setIcmsRate("");
        setError(null);
    }

    return (
        <>
            <div
                className="fixed inset-0 bg-black/60 z-50 animate-in fade-in duration-200"
                onClick={onClose}
            />

            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                <div
                    className="w-full max-w-lg bg-background border border-border rounded-xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
                        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                            {type === "entrada" ? (
                                <span className="text-green-600 bg-green-100 p-1.5 rounded-md">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" /></svg>
                                </span>
                            ) : (
                                <span className="text-red-600 bg-red-100 p-1.5 rounded-md">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" /></svg>
                                </span>
                            )}
                            {isEditing ? "Editar Transação" : "Nova Transação"}
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="p-6 overflow-y-auto custom-scrollbar">
                        {error && (
                            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2 animate-in slide-in-from-top-2">
                                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {error}
                            </div>
                        )}

                        <form action={handleSubmit} className="space-y-5">
                            {/* Type Toggle */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider text-xs">
                                    Tipo de Movimentação
                                </label>
                                <div className="grid grid-cols-2 gap-3 p-1 bg-muted/50 rounded-lg border border-border/50">
                                    <button
                                        type="button"
                                        onClick={() => setType("entrada")}
                                        className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${type === "entrada"
                                            ? "bg-white text-green-700 shadow-sm border border-green-200/50"
                                            : "text-muted-foreground hover:text-foreground hover:bg-white/50"
                                            }`}
                                    >
                                        Entrada (Receita)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setType("saida")}
                                        className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${type === "saida"
                                            ? "bg-white text-red-700 shadow-sm border border-red-200/50"
                                            : "text-muted-foreground hover:text-foreground hover:bg-white/50"
                                            }`}
                                    >
                                        Saída (Despesa)
                                    </button>
                                </div>
                            </div>

                            {/* Category (Grouped) */}
                            <div className="space-y-2">
                                <label htmlFor="categoryId" className="text-sm font-medium text-foreground">
                                    Categoria
                                </label>
                                <select
                                    id="categoryId"
                                    name="categoryId"
                                    value={selectedCategoryId}
                                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                                >
                                    <option value="">Selecione...</option>
                                    {categories.map((group) => (
                                        <optgroup key={group.id} label={`${group.code} - ${group.name}`}>
                                            {group.categories.map((cat) => (
                                                <option key={cat.id} value={cat.slug || cat.id}>
                                                    {cat.name}
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>

                            {/* Smart Purchase Mode Banner */}
                            {isPurchaseMode && (
                                <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm">
                                    <p className="font-medium">💡 Compra de Matéria-Prima Detectada</p>
                                    <p className="text-xs mt-1 text-blue-400/80">
                                        O sistema pode atualizar automaticamente o estoque.
                                    </p>
                                </div>
                            )}

                            {/* Supplier (only for raw materials) */}
                            {isPurchaseMode && (
                                <div className="space-y-2">
                                    <label htmlFor="supplierId" className="text-sm font-medium text-foreground">
                                        Fornecedor
                                    </label>
                                    <select
                                        id="supplierId"
                                        name="supplierId"
                                        value={selectedSupplierId}
                                        onChange={(e) => setSelectedSupplierId(e.target.value)}
                                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                                    >
                                        <option value="">Selecione fornecedor...</option>
                                        {filteredSuppliers.map((supplier) => (
                                            <option key={supplier.id} value={supplier.id}>
                                                {supplier.name} {supplier.defaultPrice ? `(R$ ${supplier.defaultPrice.toFixed(2)}/${materialUnit})` : "(Variável)"}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Amount */}
                            <div className="space-y-2">
                                <label htmlFor="amount" className="text-sm font-medium text-foreground">
                                    Valor (R$)
                                </label>
                                <input
                                    id="amount"
                                    name="amount"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    required
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0,00"
                                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                                />
                            </div>

                            {/* Quantity (Hybrid: Auto-calc or Manual) */}
                            {isPurchaseMode && selectedSupplierId && amount && (
                                <div className="space-y-2 p-3 rounded-md bg-muted/50 border border-border">
                                    <div className="flex items-center justify-between">
                                        <label htmlFor="quantity" className="text-sm font-medium text-foreground">
                                            {calculatedQty > 0 ? "Quantidade Calculada" : "Quantidade (Entrada Estoque)"}
                                        </label>
                                        {calculatedQty > 0 && (
                                            <span className="text-xs text-muted-foreground">
                                                Valor / Preço = {calculatedQty.toFixed(2)} {materialUnit}
                                            </span>
                                        )}
                                    </div>
                                    <input
                                        id="quantity"
                                        name="quantity"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        required
                                        value={manualQty}
                                        onChange={(e) => setManualQty(e.target.value)}
                                        placeholder={calculatedQty > 0 ? calculatedQty.toFixed(2) : `Ex: 10 ${materialUnit}`}
                                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {calculatedQty > 0
                                            ? "Edite se o preço da carga for diferente"
                                            : "Fornecedor com preço variável: informe a quantidade real medida."}
                                    </p>
                                </div>
                            )}


                            {/* Section: Fiscal Data (Only for Freight) */}
                            {isFreightCategory && type === "saida" && (
                                <div className="p-4 rounded-md bg-purple-50 border border-purple-100 space-y-3 animate-in fade-in slide-in-from-top-2">
                                    <h3 className="text-sm font-semibold text-purple-900 flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                        Dados Fiscais
                                    </h3>

                                    <div className="flex items-center gap-2">
                                        <input
                                            id="hasIcmsCredit"
                                            type="checkbox"
                                            checked={hasIcmsCredit}
                                            onChange={(e) => setHasIcmsCredit(e.target.checked)}
                                            className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                        />
                                        <label htmlFor="hasIcmsCredit" className="text-sm text-purple-800 font-medium cursor-pointer">
                                            Gera crédito de ICMS
                                        </label>
                                    </div>

                                    {hasIcmsCredit && (
                                        <div className="space-y-1 animate-in slide-in-from-top-2">
                                            <label htmlFor="icmsRate" className="text-xs font-medium text-purple-800 ml-6 block">
                                                Alíquota de ICMS (%)
                                            </label>
                                            <div className="ml-6 relative">
                                                <input
                                                    id="icmsRate"
                                                    type="number"
                                                    value={icmsRate}
                                                    onChange={(e) => setIcmsRate(e.target.value)}
                                                    placeholder="0,00"
                                                    min="0"
                                                    step="0.01"
                                                    className="w-full h-9 pl-3 pr-3 rounded-md border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Stock Info Alert (Replacing Auto-Stock) */}
                            {isPurchaseMode && (
                                <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm">
                                    <p className="font-medium flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        Pedido de Compra
                                    </p>
                                    <p className="text-xs mt-1 text-blue-400/80">
                                        O estoque será atualizado apenas quando a entrada for registrada na <strong>Balança</strong>.
                                    </p>
                                </div>
                            )}

                            {/* Date */}
                            <div className="space-y-2">
                                <label htmlFor="date" className="text-sm font-medium text-foreground">
                                    Data
                                </label>
                                <input
                                    id="date"
                                    name="date"
                                    type="date"
                                    required
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                                />
                            </div>

                            {/* Status */}
                            <div className="space-y-2">
                                <label htmlFor="status" className="text-sm font-medium text-foreground">
                                    Status
                                </label>
                                <select
                                    id="status"
                                    name="status"
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                                >
                                    <option value="pago">Pago</option>
                                    <option value="pendente">Pendente</option>
                                </select>
                            </div>

                            {/* Description */}
                            <div className="space-y-2">
                                <label htmlFor="description" className="text-sm font-medium text-foreground">
                                    Descrição
                                </label>
                                <input
                                    id="description"
                                    name="description"
                                    type="text"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Descrição curta..."
                                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                                />
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                                    {error}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 h-10 rounded-md border border-border text-foreground font-medium hover:bg-accent transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isPending}
                                    className="flex-1 h-10 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isPending ? "Salvando..." : isEditing ? "Atualizar" : isPurchaseMode && addToStock ? "Salvar + Estoque" : "Salvar"}
                                </button>
                            </div>
                        </form >
                    </div >
                </div >
            </div >
        </>
    );
}
