"use client";

import { useState, useTransition, useEffect } from "react";

import { PurchaseOrder, Delivery, SupplierBalance } from "@/app/(authenticated)/balanca/actions";
import { SupplierBalanceList } from "./SupplierBalanceList";
// Note: Verification - we need to make sure these imports are correct and available
import { createInboundDelivery, updateDelivery, deleteDelivery } from "@/app/(authenticated)/balanca/actions";

interface BalancaWorkspaceProps {
    orders: PurchaseOrder[];
    balances: SupplierBalance[];
}

export function BalancaWorkspace({ orders, balances }: BalancaWorkspaceProps) {
    const [activeTab, setActiveTab] = useState<'orders' | 'suppliers'>('orders');
    const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
    const [deliveries, setDeliveries] = useState<Delivery[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);

    // Form States
    const [plate, setPlate] = useState("");
    const [weight, setWeight] = useState("");
    const [weightFiscal, setWeightFiscal] = useState("");
    const [driver, setDriver] = useState("");
    // Use ISO string for input value, controlled component
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // Derived State for Divergence
    const realWeight = parseFloat(weight) || 0;
    const fiscalWeight = parseFloat(weightFiscal) || 0;
    const divergence = (weight && weightFiscal) ? (realWeight - fiscalWeight) : null;

    const [statusFilter, setStatusFilter] = useState<'open' | 'completed' | 'all'>('open');

    // Filter Logic
    const filteredOrders = orders.filter(o => {
        if (statusFilter === 'all') return true;
        // Fallback to 'open' if computedStatus is missing (legacy safety)
        const status = o.computedStatus || (o.remainingQuantity > 0.1 ? 'open' : 'completed');
        return status === statusFilter;
    });

    const [isPending, startTransition] = useTransition();

    async function loadDeliveries(orderId: string) {
        setLoading(true);
        // Dynamic import to avoid server-action serialization issues if any
        const { getDeliveriesForTransaction } = await import("@/app/(authenticated)/balanca/actions");
        const data = await getDeliveriesForTransaction(orderId);
        setDeliveries(data);
        setLoading(false);
    }

    function handleSelectOrder(order: PurchaseOrder) {
        setSelectedOrder(order);
        setSelectedDelivery(null);
        resetForm();
        loadDeliveries(order.id);
    }

    function resetForm() {
        setPlate("");
        setWeight("");
        setWeightFiscal("");
        setDriver("");
        setDate(new Date().toISOString().split('T')[0]);
        setSelectedDelivery(null);
    }

    function handleEdit(delivery: Delivery) {
        setSelectedDelivery(delivery);
        setPlate(delivery.plate);
        setWeight(delivery.weight.toString());
        setWeightFiscal(delivery.weightFiscal ? delivery.weightFiscal.toString() : "");
        setDriver(delivery.driverName || "");
        setDate(new Date(delivery.date).toISOString().split('T')[0]);
    }

    async function handleDelete(deliveryId: string) {
        if (!confirm("Tem certeza que deseja EXCLUIR esta entrega? Esta ação irá estornar o estoque.")) return;

        startTransition(async () => {
            const { deleteDelivery } = await import("@/app/(authenticated)/balanca/actions");
            const result = await deleteDelivery(deliveryId);
            if (result.success) {
                if (selectedOrder) loadDeliveries(selectedOrder.id);
            } else {
                alert(result.error || "Erro ao excluir.");
            }
        });
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedOrder) return;
        // Prevent editing if order is completed? User said "Não editáveis para novas pesagens".
        // But maybe allow editing OLD deliveries?
        // I will implement disable logic in the button, not here for now.

        startTransition(async () => {
            const formData = new FormData();

            // If editing, append ID
            if (selectedDelivery) {
                formData.append("id", selectedDelivery.id);
            } else {
                formData.append("transactionId", selectedOrder.id);
            }

            formData.append("plate", plate);
            formData.append("weight", weight);
            if (weightFiscal) formData.append("weightFiscal", weightFiscal);
            formData.append("driver", driver);
            formData.append("date", date);

            const result = selectedDelivery
                ? await updateDelivery(formData)
                : await createInboundDelivery(formData);

            if (result.success) {
                resetForm();
                loadDeliveries(selectedOrder.id);
            } else {
                alert(result.error || "Erro ao salvar.");
            }
        });
    }

    return (
        <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="flex space-x-4 border-b">
                <button
                    onClick={() => setActiveTab('orders')}
                    className={`pb-2 px-1 text-sm font-medium transition-colors ${activeTab === 'orders'
                        ? 'border-b-2 border-blue-500 text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Ordens de Recebimento
                </button>
                <button
                    onClick={() => setActiveTab('suppliers')}
                    className={`pb-2 px-1 text-sm font-medium transition-colors ${activeTab === 'suppliers'
                        ? 'border-b-2 border-blue-500 text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Saldo por Fornecedor
                </button>
            </div>

            {/* Content Area */}
            {activeTab === 'suppliers' ? (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <SupplierBalanceList balances={balances || []} />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Left: Open Orders List */}
                    <div className="lg:col-span-1 bg-white p-4 rounded-lg shadow h-[600px] overflow-y-auto">
                        <div className="flex flex-col gap-3 mb-4">
                            <h3 className="text-lg font-semibold">Ordens de Compra</h3>
                            {/* Filter Pills */}
                            <div className="flex bg-gray-100 p-1 rounded-md self-start">
                                <button
                                    onClick={() => setStatusFilter('open')}
                                    className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${statusFilter === 'open' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    Abertas
                                </button>
                                <button
                                    onClick={() => setStatusFilter('completed')}
                                    className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${statusFilter === 'completed' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    Concluídas
                                </button>
                                <button
                                    onClick={() => setStatusFilter('all')}
                                    className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${statusFilter === 'all' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    Todas
                                </button>
                            </div>
                        </div>

                        {filteredOrders.length === 0 ? (
                            <p className="text-gray-500 text-sm p-2">Nenhuma ordem encontrada no filtro atual.</p>
                        ) : (
                            <div className="space-y-3">
                                {filteredOrders.map((order) => (
                                    <div
                                        key={order.id}
                                        onClick={() => handleSelectOrder(order)}
                                        className={`p-3 border rounded cursor-pointer transition-colors relative ${selectedOrder?.id === order.id
                                            ? "border-blue-500 bg-blue-50"
                                            : "hover:bg-gray-50"
                                            } ${order.computedStatus === 'completed' ? 'opacity-80' : ''}`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-gray-900">{order.materialName}</span>
                                                {order.computedStatus === 'completed' && (
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Concluído</span>
                                                )}
                                            </div>
                                            <div className="text-xs font-mono bg-gray-100 px-1 rounded flex flex-col items-end">
                                                <span>{new Date(order.lastDeliveryDate || order.date).toLocaleDateString("pt-BR", { timeZone: 'UTC', day: "2-digit", month: "2-digit" })}</span>
                                                {order.lastDeliveryDate && <span className="text-[9px] text-gray-400 uppercase">Última</span>}
                                            </div>
                                        </div>
                                        <div className="flex justify-between mt-1 text-sm text-gray-600">
                                            <span>{order.supplierName}</span>
                                        </div>
                                        <div className="mt-2 text-xs flex justify-between">
                                            <span>Saldo: {(order.remainingQuantity || 0).toLocaleString("pt-BR")} kg</span>
                                            <span className="text-gray-400">Total: {(order.quantity || 0).toLocaleString("pt-BR")}</span>
                                        </div>
                                        <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                                            <div
                                                className="bg-blue-600 h-1.5 rounded-full"
                                                style={{
                                                    width: `${Math.min(
                                                        (((order.quantity || 0) - (order.remainingQuantity || 0)) / (order.quantity || 1)) * 100,
                                                        100
                                                    )}%`,
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right: Master-Detail Workspace */}
                    <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow">
                        {!selectedOrder ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                    <span className="text-2xl text-gray-400">⚖️</span>
                                </div>
                                <h3 className="text-lg font-medium text-gray-900">Nenhuma Ordem Selecionada</h3>
                                <p className="mt-2 text-sm text-gray-500 max-w-xs text-center">
                                    Selecione uma ordem de compra à esquerda para registrar uma nova pesagem ou ver o histórico.
                                </p>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col">
                                <div className="border-b pb-4 mb-4">
                                    <h2 className="text-xl font-bold flex items-center gap-2">
                                        {selectedOrder.materialName}
                                        <span className="text-sm font-normal text-gray-500">
                                            ({selectedOrder.supplierName})
                                        </span>
                                    </h2>
                                </div>

                                {/* Registration Form */}
                                <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200">
                                    <h3 className="text-sm font-semibold uppercase text-gray-500 mb-3">
                                        {selectedDelivery ? "Editar Pesagem" : "Registrar Nova Pesagem"}
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Data e Hora</label>
                                            <input
                                                type="date"
                                                required
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                                value={date}
                                                onChange={(e) => setDate(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Placa do Veículo</label>
                                            <input
                                                type="text"
                                                required
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm uppercase"
                                                placeholder="ABC-1234"
                                                value={plate}
                                                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Peso Entrada (Real) - kg</label>
                                            <input
                                                type="number"
                                                required
                                                step="0.01"
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                                placeholder="0.00"
                                                value={weight}
                                                onChange={(e) => setWeight(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Peso Fiscal (NF) - kg</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                                placeholder="Opcional"
                                                value={weightFiscal}
                                                onChange={(e) => setWeightFiscal(e.target.value)}
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700">Motorista</label>
                                            <input
                                                type="text"
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                                placeholder="Nome do motorista"
                                                value={driver}
                                                onChange={(e) => setDriver(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {/* Live Divergence Feedback */}
                                    {(weight && weightFiscal) && (
                                        <div className={`mt-3 p-2 rounded text-sm font-medium flex justify-between items-center ${divergence === 0 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                            }`}>
                                            <span>Divergência (Real - Fiscal):</span>
                                            <span className="text-lg">
                                                {divergence && divergence > 0 ? '+' : ''}{divergence?.toLocaleString('pt-BR')} kg
                                            </span>
                                        </div>
                                    )}

                                    <div className="mt-4 flex justify-end gap-2">
                                        {selectedDelivery && (
                                            <button
                                                type="button"
                                                onClick={resetForm}
                                                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                        )}
                                        <button
                                            type="submit"
                                            disabled={isPending || (!selectedDelivery && selectedOrder?.computedStatus === 'completed')}
                                            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isPending
                                                ? "Salvando..."
                                                : (!selectedDelivery && selectedOrder?.computedStatus === 'completed')
                                                    ? "Ordem Concluída"
                                                    : (selectedDelivery ? "Atualizar Pesagem" : "Registrar Entrada")
                                            }
                                        </button>
                                    </div>
                                </form>

                                {/* History List */}
                                <div className="flex-1 overflow-auto">
                                    <h3 className="font-semibold mb-3">Histórico de Entregas</h3>
                                    {loading ? (
                                        <p className="text-gray-500 animate-pulse">Carregando...</p>
                                    ) : deliveries.length === 0 ? (
                                        <p className="text-gray-400 italic">Nenhuma entrega registrada para esta ordem.</p>
                                    ) : (
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Placa</th>
                                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Peso Real</th>
                                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Peso Fiscal</th>
                                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Diverg.</th>
                                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200 text-sm">
                                                {deliveries.map((delivery) => {
                                                    const div = (delivery.weightFiscal !== null && delivery.weightFiscal !== undefined)
                                                        ? delivery.weight - delivery.weightFiscal
                                                        : null;

                                                    return (
                                                        <tr key={delivery.id} className="hover:bg-gray-50">
                                                            <td className="px-3 py-2 whitespace-nowrap">{new Date(delivery.date).toLocaleDateString("pt-BR", { timeZone: 'UTC', day: "2-digit", month: "2-digit", year: "numeric" })}</td>
                                                            <td className="px-3 py-2 whitespace-nowrap font-mono">{delivery.plate}</td>
                                                            <td className="px-3 py-2 whitespace-nowrap text-right font-medium">{delivery.weight.toLocaleString('pt-BR')}</td>
                                                            <td className="px-3 py-2 whitespace-nowrap text-right text-gray-600">
                                                                {delivery.weightFiscal ? delivery.weightFiscal.toLocaleString('pt-BR') : <span className="text-xs text-orange-500 bg-orange-50 px-1 rounded">Aguardando</span>}
                                                            </td>
                                                            <td className="px-3 py-2 whitespace-nowrap text-right">
                                                                {div !== null ? (
                                                                    <span className={div === 0 ? "text-gray-400" : "text-red-600 font-bold"}>
                                                                        {div > 0 ? '+' : ''}{div.toLocaleString('pt-BR')}
                                                                    </span>
                                                                ) : "-"}
                                                            </td>
                                                            <td className="px-3 py-2 whitespace-nowrap text-right">
                                                                <button
                                                                    onClick={() => handleEdit(delivery)}
                                                                    className="text-blue-600 hover:text-blue-900"
                                                                >
                                                                    Editar
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDelete(delivery.id)}
                                                                    className="text-red-600 hover:text-red-900 ml-3"
                                                                >
                                                                    Excluir
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
