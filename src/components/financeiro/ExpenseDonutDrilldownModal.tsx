"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { type ReportCategory } from "@/app/(authenticated)/financeiro/actions";

interface ExpenseDonutDrilldownModalProps {
    isOpen: boolean;
    onClose: () => void;
    groupedCategories: ReportCategory[];
    totalGroupValue: number;
    percentageOfTotal: number;
}

export function ExpenseDonutDrilldownModal({
    isOpen,
    onClose,
    groupedCategories,
    totalGroupValue,
    percentageOfTotal,
}: ExpenseDonutDrilldownModalProps) {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        // Lock body scroll when modal is open
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isOpen]);

    if (!isOpen || !isMounted) return null;

    // Use createPortal to render at document root level
    return createPortal(
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 z-50 animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
                <div
                    className="w-full max-w-lg bg-background border border-border rounded-xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[85vh] pointer-events-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
                        <div>
                            <h2 className="text-lg font-semibold text-foreground">
                                Detalhes: Outros
                            </h2>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                Agrupamento de categorias menores
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Summary Card */}
                    <div className="px-6 py-4 bg-muted/10 border-b border-border">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Valor Total do Grupo</span>
                            <div className="text-right">
                                <span className="block text-lg font-bold text-foreground">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalGroupValue)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    Representa {percentageOfTotal.toFixed(1)}% do total
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Content List */}
                    <div className="flex-1 overflow-y-auto">
                        <div className="min-w-full divide-y divide-border">
                            {groupedCategories.map((cat) => (
                                <div
                                    key={cat.id}
                                    className="flex items-center justify-between px-6 py-3.5 hover:bg-muted/30 transition-colors"
                                >
                                    <div className="min-w-0 pr-4">
                                        <p className="font-medium text-sm text-foreground truncate">
                                            {cat.name}
                                        </p>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <p className="font-medium text-sm text-foreground">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cat.total)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {cat.percentage.toFixed(1)}% do total
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-border bg-muted/30 flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm rounded-md border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
}
