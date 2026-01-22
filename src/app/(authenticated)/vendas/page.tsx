"use client";

import { useState, useEffect, useCallback } from "react";
import { ContractDialog } from "@/components/vendas/ContractDialog";
import { ExpeditionDialog } from "@/components/vendas/ExpeditionDialog";
import { ContractsList } from "@/components/vendas/ContractsList";
import { ExpeditionsList } from "@/components/vendas/ExpeditionsList";
import {
    getContracts,
    getActiveContracts,
    getExpeditions,
    deleteContract,
    deleteExpedition,
    type ContractRow,
    type ExpeditionRow,
    type ActiveContract,
} from "./actions";

type TabType = "expeditions" | "contracts";

export default function VendasPage() {
    const [activeTab, setActiveTab] = useState<TabType>("expeditions");
    const [isLoading, setIsLoading] = useState(true);
    const [isContractDialogOpen, setIsContractDialogOpen] = useState(false);
    const [isExpeditionDialogOpen, setIsExpeditionDialogOpen] = useState(false);

    // Data states
    const [contracts, setContracts] = useState<ContractRow[]>([]);
    const [expeditions, setExpeditions] = useState<ExpeditionRow[]>([]);
    const [activeContracts, setActiveContracts] = useState<ActiveContract[]>([]);

    // Edit states
    const [editingContract, setEditingContract] = useState<ContractRow | null>(null);
    const [editingExpedition, setEditingExpedition] = useState<ExpeditionRow | null>(null);

    // Load data
    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [contractsData, expeditionsData, activeContractsData] = await Promise.all([
                getContracts(),
                getExpeditions(),
                getActiveContracts(),
            ]);
            setContracts(contractsData);
            setExpeditions(expeditionsData);
            setActiveContracts(activeContractsData);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // --- Contract Handlers ---
    const handleEditContract = (contract: ContractRow) => {
        setEditingContract(contract);
        setIsContractDialogOpen(true);
    };

    const handleDeleteContract = async (id: string) => {
        if (confirm("Tem certeza que deseja excluir este contrato?")) {
            const result = await deleteContract(id);
            if (result.success) {
                loadData();
            } else {
                alert(result.error);
            }
        }
    };

    const handleContractDialogClose = () => {
        setIsContractDialogOpen(false);
        setEditingContract(null);
        loadData();
    };

    const handleNewContract = () => {
        setEditingContract(null);
        setIsContractDialogOpen(true);
    };

    // --- Expedition Handlers ---
    const handleEditExpedition = (expedition: ExpeditionRow) => {
        setEditingExpedition(expedition);
        setIsExpeditionDialogOpen(true);
    };

    const handleDeleteExpedition = async (id: string) => {
        if (confirm("Tem certeza que deseja excluir esta expedição? O estoque será revertido.")) {
            const result = await deleteExpedition(id);
            if (result.success) {
                loadData();
            } else {
                alert(result.error);
            }
        }
    };

    const handleExpeditionDialogClose = () => {
        setIsExpeditionDialogOpen(false);
        setEditingExpedition(null);
        loadData();
    };

    const handleNewExpedition = () => {
        setEditingExpedition(null);
        setIsExpeditionDialogOpen(true);
    };

    const tabs: { id: TabType; label: string; count: number }[] = [
        { id: "expeditions", label: "Expedições", count: expeditions.length },
        { id: "contracts", label: "Contratos", count: contracts.length },
    ];

    return (
        <div className="space-y-6">
            {/* Header & Tabs */}
            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Vendas</h1>
                    <p className="text-muted-foreground">
                        Gestão de contratos e expedições
                    </p>
                </div>

                {/* Tabs - Segmented Control */}
                <div className="flex">
                    <div className="bg-muted p-1 rounded-lg inline-flex">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2
                                    ${activeTab === tab.id
                                        ? "bg-background text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                    }
                                `}
                            >
                                {tab.label}
                                <span className={`text-xs ml-1 ${activeTab === tab.id ? "text-primary opacity-80" : "text-muted-foreground opacity-60"}`}>
                                    ({tab.count})
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tab Content */}
            {isLoading ? (
                <div className="bg-card border border-border rounded-lg p-8 text-center">
                    <div className="animate-spin w-8 h-8 mx-auto border-2 border-primary border-t-transparent rounded-full" />
                    <p className="text-muted-foreground mt-4">Carregando...</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Action Header */}
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-foreground">
                            {activeTab === "expeditions" ? "Expedições Recentes" : "Contratos de Venda"}
                        </h2>
                        {activeTab === "contracts" ? (
                            <button
                                onClick={handleNewContract}
                                className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground font-medium shadow hover:bg-primary/90 transition-colors text-sm"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Novo Contrato
                            </button>
                        ) : (
                            <button
                                onClick={handleNewExpedition}
                                className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground font-medium shadow hover:bg-primary/90 transition-colors text-sm"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Nova Expedição
                            </button>
                        )}
                    </div>

                    {/* Content */}
                    {activeTab === "expeditions" ? (
                        <ExpeditionsList
                            expeditions={expeditions}
                            onRefresh={loadData}
                            onEdit={handleEditExpedition}
                            onDelete={handleDeleteExpedition}
                        />
                    ) : (
                        <ContractsList
                            contracts={contracts}
                            onEdit={handleEditContract}
                            onDelete={handleDeleteContract}
                        />
                    )}
                </div>
            )}

            {/* Dialogs */}
            <ContractDialog
                isOpen={isContractDialogOpen}
                onClose={handleContractDialogClose}
                contractToEdit={editingContract}
            />
            <ExpeditionDialog
                isOpen={isExpeditionDialogOpen}
                onClose={handleExpeditionDialogClose}
                contracts={activeContracts}
                expeditionToEdit={editingExpedition}
            />
        </div>
    );
}
