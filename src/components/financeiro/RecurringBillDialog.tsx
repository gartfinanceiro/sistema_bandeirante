"use client";

import { useState, useEffect, useTransition } from "react";
import {
    createRecurringBill,
    updateRecurringBill,
    deleteRecurringBill,
    type RecurringBill,
} from "@/app/(authenticated)/financeiro/recurring-bills-actions";
import type { CategoryGroup } from "@/app/(authenticated)/financeiro/actions";

interface RecurringBillDialogProps {
    isOpen: boolean;
    onClose: () => void;
    bill?: RecurringBill | null;
    categories: CategoryGroup[];
    suppliers: { id: string; name: string }[];
    onSave: () => void;
}

export function RecurringBillDialog({
    isOpen,
    onClose,
    bill,
    categories,
    suppliers,
    onSave,
}: RecurringBillDialogProps) {
    const isEditing = !!bill;
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState("");

    // Form state
    const [name, setName] = useState(bill?.name || "");
    const [description, setDescription] = useState(bill?.description || "");
    const [categoryId, setCategoryId] = useState(bill?.categoryId || "");
    const [supplierId, setSupplierId] = useState(bill?.supplierId || "");
    const [expectedAmount, setExpectedAmount] = useState(
        bill?.expectedAmount ? String(bill.expectedAmount) : ""
    );
    const [isFixedAmount, setIsFixedAmount] = useState(bill?.isFixedAmount || false);
    const [dueDay, setDueDay] = useState(bill?.dueDay ? String(bill.dueDay) : "");
    const [notes, setNotes] = useState(bill?.notes || "");

    // Reset form when bill changes or dialog opens
    useEffect(() => {
        if (isOpen) {
            setName(bill?.name || "");
            setDescription(bill?.description || "");
            setCategoryId(bill?.categoryId || "");
            setSupplierId(bill?.supplierId || "");
            setExpectedAmount(bill?.expectedAmount ? String(bill.expectedAmount) : "");
            setIsFixedAmount(bill?.isFixedAmount || false);
            setDueDay(bill?.dueDay ? String(bill.dueDay) : "");
            setNotes(bill?.notes || "");
            setError("");
        }
    }, [isOpen, bill]);

    if (!isOpen) return null;

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");

        if (!name.trim()) {
            setError("Nome é obrigatório");
            return;
        }

        if (!dueDay || parseInt(dueDay) < 1 || parseInt(dueDay) > 31) {
            setError("Dia de vencimento deve ser entre 1 e 31");
            return;
        }

        startTransition(async () => {
            try {
                const formData = new FormData();
                if (bill?.id) formData.set("id", bill.id);
                formData.set("name", name.trim());
                formData.set("description", description.trim());
                formData.set("categoryId", categoryId);
                formData.set("supplierId", supplierId);
                formData.set("expectedAmount", expectedAmount);
                formData.set("isFixedAmount", String(isFixedAmount));
                formData.set("dueDay", dueDay);
                formData.set("notes", notes.trim());

                const result = isEditing
                    ? await updateRecurringBill(formData)
                    : await createRecurringBill(formData);

                if (result.success) {
                    onSave();
                } else {
                    setError(result.error || "Erro ao salvar");
                }
            } catch (err) {
                console.error("Error saving bill:", err);
                setError("Erro inesperado ao salvar");
            }
        });
    }

    function handleDelete() {
        if (!bill?.id) return;
        if (!confirm("Tem certeza que deseja desativar esta conta fixa?")) return;

        startTransition(async () => {
            try {
                const result = await deleteRecurringBill(bill.id);
                if (result.success) {
                    onSave();
                } else {
                    setError(result.error || "Erro ao excluir");
                }
            } catch (err) {
                console.error("Error deleting bill:", err);
                setError("Erro inesperado ao excluir");
            }
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60"
                onClick={onClose}
            />

            {/* Dialog */}
            <div className="relative w-full max-w-lg bg-background rounded-xl shadow-2xl animate-in fade-in duration-200 max-h-[90vh] overflow-y-auto">
                <div className="p-6 space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-foreground">
                            {isEditing ? "Editar Conta Fixa" : "Nova Conta Fixa"}
                        </h2>
                        <button
                            onClick={onClose}
                            className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="p-3 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Nome */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                                Nome *
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ex: Energia Elétrica"
                                className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                                required
                            />
                        </div>

                        {/* Categoria */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                                Categoria *
                            </label>
                            <select
                                value={categoryId}
                                onChange={(e) => setCategoryId(e.target.value)}
                                className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                            >
                                <option value="">Selecione...</option>
                                {categories.map((group) => (
                                    <optgroup key={group.id} label={group.name}>
                                        {group.categories.map((cat) => (
                                            <option key={cat.id} value={cat.slug || cat.id}>
                                                {cat.name}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>

                        {/* Fornecedor */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                                Fornecedor
                            </label>
                            <select
                                value={supplierId}
                                onChange={(e) => setSupplierId(e.target.value)}
                                className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                            >
                                <option value="">Nenhum (qualquer fornecedor)</option>
                                {suppliers.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Valor Esperado + Fixo */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Valor Esperado
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={expectedAmount}
                                    onChange={(e) => setExpectedAmount(e.target.value)}
                                    placeholder="Opcional"
                                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                                />
                            </div>
                            <div className="flex items-end pb-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isFixedAmount}
                                        onChange={(e) => setIsFixedAmount(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring"
                                    />
                                    <span className="text-sm text-foreground">Valor fixo</span>
                                </label>
                            </div>
                        </div>

                        {/* Dia de Vencimento */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                                Dia de Vencimento *
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="31"
                                value={dueDay}
                                onChange={(e) => setDueDay(e.target.value)}
                                placeholder="Ex: 10"
                                className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                                required
                            />
                        </div>

                        {/* Observações */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                                Observações
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Notas opcionais..."
                                rows={2}
                                className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors resize-none"
                            />
                        </div>

                        {/* Botões */}
                        <div className="flex gap-3 pt-2">
                            {isEditing && (
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={isPending}
                                    className="h-10 px-4 rounded-md border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 font-medium text-sm hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-50"
                                >
                                    Excluir
                                </button>
                            )}
                            <div className="flex-1" />
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isPending}
                                className="h-10 px-4 rounded-md border border-border text-foreground font-medium text-sm hover:bg-accent transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isPending}
                                className="h-10 px-6 rounded-md bg-primary text-primary-foreground font-medium text-sm shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                                {isPending ? "Salvando..." : isEditing ? "Salvar" : "Criar"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
