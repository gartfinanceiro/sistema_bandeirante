"use client";

import { useState } from "react";
import { type Material } from "@/app/(authenticated)/estoque/actions";
import { MaterialDialog } from "./MaterialDialog";
import { MaterialActions } from "./MaterialActions";

interface MaterialsListProps {
    materials: Material[];
    onRefresh: () => void;
}

export function MaterialsList({ materials, onRefresh }: MaterialsListProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);

    function handleEdit(material: Material) {
        setEditingMaterial(material);
        setIsDialogOpen(true);
    }

    function handleClose() {
        setIsDialogOpen(false);
        setEditingMaterial(null);
        onRefresh();
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-foreground">Tipos de Material Cadastrados</h2>
                <button
                    onClick={() => setIsDialogOpen(true)}
                    className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground font-medium shadow hover:bg-primary/90 transition-colors text-sm"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Novo Material
                </button>
            </div>

            {materials.length === 0 ? (
                <div className="bg-card border border-border rounded-lg p-8 text-center">
                    <p className="text-muted-foreground">Nenhum material cadastrado</p>
                </div>
            ) : (
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border bg-muted/50">
                                <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                                    Nome
                                </th>
                                <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                                    Unidade
                                </th>
                                <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3">
                                    Estoque Atual
                                </th>
                                <th className="w-[50px] px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {materials.map((material) => (
                                <tr
                                    key={material.id}
                                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                                >
                                    <td className="px-4 py-3 text-sm text-foreground font-medium">
                                        {material.name}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-muted-foreground">
                                        {material.unit}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right text-foreground">
                                        {material.currentStock.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <MaterialActions
                                            material={material}
                                            onEdit={handleEdit}
                                            onDeleted={onRefresh}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <MaterialDialog
                isOpen={isDialogOpen}
                onClose={handleClose}
                materialToEdit={editingMaterial}
            />
        </div>
    );
}
