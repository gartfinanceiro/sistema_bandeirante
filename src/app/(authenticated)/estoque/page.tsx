"use client";

import { useState, useEffect, useCallback } from "react";
import { SupplierDialog } from "@/components/estoque/SupplierDialog";
import { SupplierActions } from "@/components/estoque/SupplierActions";
import { MaterialsList } from "@/components/estoque/MaterialsList";
import {
    getMaterials,
    getSuppliers,
    type Material,
    type Supplier,
} from "./actions";
import { getVisualTypeFromName } from "./utils";

// Icons map based on visual keys
const MATERIAL_ICONS_BY_TYPE: Record<string, React.ReactNode> = {
    carvao: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
        </svg>
    ),
    minerio: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
    ),
    fundentes: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
    ),
    outros: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4m16 0-4-4m4 4-4 4M4 12l4-4m-4 4 4 4" />
        </svg>
    ),
};

type ViewMode = "stocks" | "materials";

export default function EstoquePage() {
    const [view, setView] = useState<ViewMode>("stocks");
    const [isLoading, setIsLoading] = useState(true);

    const [materials, setMaterials] = useState<Material[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);

    const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [materialsData, suppliersData] = await Promise.all([
                getMaterials(),
                getSuppliers(),
            ]);
            setMaterials(materialsData);
            setSuppliers(suppliersData);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Supplier handlers
    function handleEditSupplier(supplier: Supplier) {
        setEditingSupplier(supplier);
        setIsSupplierDialogOpen(true);
    }

    function handleCloseSupplierDialog() {
        setIsSupplierDialogOpen(false);
        setEditingSupplier(null);
        loadData();
    }

    // Helper for rendering cards
    function getIconForMaterial(name: string) {
        const type = getVisualTypeFromName(name);
        return MATERIAL_ICONS_BY_TYPE[type] || MATERIAL_ICONS_BY_TYPE.outros;
    }

    function getColorClassForMaterial(name: string) {
        const type = getVisualTypeFromName(name);
        switch (type) {
            case "carvao": return "bg-orange-500/20 text-orange-400";
            case "minerio": return "bg-blue-500/20 text-blue-400";
            case "fundentes": return "bg-purple-500/20 text-purple-400";
            default: return "bg-gray-500/20 text-gray-400";
        }
    }

    return (
        <div className="space-y-6">
            {/* Header & Tabs */}
            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Estoque</h1>
                    <p className="text-muted-foreground">Controle de matérias-primas e insumos</p>
                </div>

                {/* Tabs - Segmented Control */}
                <div className="flex">
                    <div className="bg-muted p-1 rounded-lg inline-flex">
                        <button
                            onClick={() => setView("stocks")}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${view === "stocks"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            Estoque e Fornecedores
                        </button>
                        <button
                            onClick={() => setView("materials")}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${view === "materials"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            Tipos de Material
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="animate-in fade-in duration-300">
                {view === "materials" ? (
                    <MaterialsList materials={materials} onRefresh={loadData} />
                ) : (
                    <>
                        {/* Stocks View */}
                        <div className="space-y-6">
                            {/* Action Header */}
                            <div className="flex justify-between items-center">
                                <h2 className="text-lg font-semibold text-foreground">Visão Geral</h2>
                                <button
                                    onClick={() => setIsSupplierDialogOpen(true)}
                                    className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground font-medium shadow hover:bg-primary/90 transition-colors text-sm"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    Gerenciar Fornecedores
                                </button>
                            </div>

                            {/* Material Cards */}
                            {isLoading ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="bg-card border border-border rounded-lg p-6 animate-pulse">
                                            <div className="h-6 bg-muted rounded w-1/2 mb-4" />
                                            <div className="h-10 bg-muted rounded w-3/4" />
                                        </div>
                                    ))}
                                </div>
                            ) : materials.length === 0 ? (
                                <div className="bg-card border border-border rounded-lg p-8 text-center">
                                    <p className="text-muted-foreground">Nenhum material cadastrado</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {materials.map((material) => {
                                        const isLow = material.minStockAlert !== null && material.currentStock < material.minStockAlert;
                                        return (
                                            <div
                                                key={material.id}
                                                className={`bg-card border rounded-lg p-6 transition-all ${isLow ? "border-red-500/50 bg-red-500/5" : "border-border"
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-lg ${getColorClassForMaterial(material.name)}`}>
                                                            {getIconForMaterial(material.name)}
                                                        </div>
                                                        <h3 className="font-semibold text-foreground">{material.name}</h3>
                                                    </div>
                                                    {isLow && (
                                                        <span className="px-2 py-1 rounded text-xs font-medium bg-red-500/20 text-red-400">
                                                            Baixo
                                                        </span>
                                                    )}
                                                </div>
                                                <p className={`text-3xl font-bold ${isLow ? "text-red-400" : "text-primary"}`}>
                                                    {material.currentStock.toFixed(2)} <span className="text-lg font-normal text-muted-foreground">{material.unit}</span>
                                                </p>
                                                {material.minStockAlert && (
                                                    <p className="text-xs text-muted-foreground mt-2">
                                                        Alerta: &lt; {material.minStockAlert} {material.unit}
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Suppliers Section (Integrated here for context) */}
                            <div className="space-y-4">
                                <h2 className="text-lg font-semibold text-foreground">Fornecedores Cadastrados</h2>
                                {suppliers.length === 0 ? (
                                    <div className="bg-card border border-border rounded-lg p-8 text-center">
                                        <p className="text-muted-foreground">Nenhum fornecedor cadastrado</p>
                                        <button
                                            onClick={() => setIsSupplierDialogOpen(true)}
                                            className="mt-4 text-sm text-primary hover:underline"
                                        >
                                            + Cadastrar primeiro fornecedor
                                        </button>
                                    </div>
                                ) : (
                                    <div className="bg-card border border-border rounded-lg overflow-hidden">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-border bg-muted/50">
                                                    <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">Fornecedor</th>
                                                    <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">Material</th>
                                                    <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3">Preço Padrão</th>
                                                    <th className="text-center text-sm font-medium text-muted-foreground px-4 py-3">ICMS</th>
                                                    <th className="w-[50px] px-4 py-3"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {suppliers.map((supplier) => (
                                                    <tr key={supplier.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                                                        <td className="px-4 py-3 text-sm text-foreground">{supplier.name}</td>
                                                        <td className="px-4 py-3 text-sm text-muted-foreground">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`w-2 h-2 rounded-full ${getColorClassForMaterial(supplier.materialName).split(" ")[0].replace("/20", "")}`} />
                                                                {supplier.materialName}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-right font-medium text-foreground">
                                                            {supplier.defaultPrice
                                                                ? `R$ ${supplier.defaultPrice.toFixed(2)}`
                                                                : <span className="text-muted-foreground italic">Variável</span>
                                                            }
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-center">
                                                            {supplier.hasIcms ? <span className="text-green-400">✓</span> : <span className="text-muted-foreground">-</span>}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <SupplierActions
                                                                supplier={supplier}
                                                                onEdit={handleEditSupplier}
                                                                onDeleted={loadData}
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Supplier Dialog */}
                        <SupplierDialog
                            isOpen={isSupplierDialogOpen}
                            onClose={handleCloseSupplierDialog}
                            supplierToEdit={editingSupplier}
                            materials={materials}
                        />
                    </>
                )}
            </div>
        </div>
    );
}
