"use client";

import { useState, useTransition } from "react";
import { deleteMaterial, type Material } from "@/app/(authenticated)/estoque/actions";

interface MaterialActionsProps {
    material: Material;
    onEdit: (material: Material) => void;
    onDeleted: () => void;
}

export function MaterialActions({ material, onEdit, onDeleted }: MaterialActionsProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    function handleDelete() {
        startTransition(async () => {
            const result = await deleteMaterial(material.id);
            if (result.success) {
                setIsDeleteDialogOpen(false);
                onDeleted();
            } else {
                setError(result.error || "Erro ao excluir");
            }
        });
    }

    return (
        <>
            <div className="relative">
                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                </button>

                {isMenuOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsMenuOpen(false)}
                        />
                        <div className="absolute right-0 top-full mt-1 w-40 bg-card border border-border rounded-md shadow-lg z-50 py-1 animate-in fade-in zoom-in-95 duration-100">
                            <button
                                onClick={() => {
                                    setIsMenuOpen(false);
                                    onEdit(material);
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-accent transition-colors flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Editar
                            </button>
                            <button
                                onClick={() => {
                                    setIsMenuOpen(false);
                                    setIsDeleteDialogOpen(true);
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Excluir
                            </button>
                        </div>
                    </>
                )}
            </div>

            {isDeleteDialogOpen && (
                <>
                    <div
                        className="fixed inset-0 bg-black/60 z-50 animate-in fade-in duration-200"
                        onClick={() => setIsDeleteDialogOpen(false)}
                    />
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div
                            className="w-full max-w-sm bg-card border border-border rounded-lg shadow-xl animate-in zoom-in-95 duration-200"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
                                        <svg className="w-6 h-6 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-foreground">
                                            Excluir Material
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            &quot;{material.name}&quot;
                                        </p>
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground mb-6">
                                    Se houver fornecedores ou estoque para este material, a exclusão será bloqueada.
                                </p>
                                {error && (
                                    <p className="text-sm text-destructive mb-4 p-2 bg-destructive/10 rounded">
                                        {error}
                                    </p>
                                )}
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsDeleteDialogOpen(false)}
                                        className="flex-1 h-10 rounded-md border border-border text-foreground font-medium hover:bg-accent transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        disabled={isPending}
                                        className="flex-1 h-10 rounded-md bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 disabled:opacity-50 transition-colors"
                                    >
                                        {isPending ? "Excluindo..." : "Confirmar"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
