"use client";

import { useState, useEffect, useTransition } from "react";
import {
    type PurchaseOrder,
    type Delivery,
    createInboundDelivery,
    getDeliveriesForTransaction,
    updateDelivery,
    deleteDelivery
} from "@/app/(authenticated)/balanca/actions";

interface BalancaWorkspaceProps {
    orders: PurchaseOrder[];
}

export function BalancaWorkspace({ orders }: BalancaWorkspaceProps) {
    const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
    const [isPending, startTransition] = useTransition();
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Form state
    const [plate, setPlate] = useState("");
    const [weight, setWeight] = useState("");
    const [driver, setDriver] = useState("");

    // Delivery history state
    const [deliveries, setDeliveries] = useState<Delivery[]>([]);
    const [isLoadingDeliveries, setIsLoadingDeliveries] = useState(false);
    const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);

    // Load deliveries when order is selected
    useEffect(() => {
        if (selectedOrder) {
            loadDeliveries(selectedOrder.id);
        } else {
            setDeliveries([]);
        }
    }, [selectedOrder]);

    async function loadDeliveries(transactionId: string) {
        setIsLoadingDeliveries(true);
        try {
            const data = await getDeliveriesForTransaction(transactionId);
            setDeliveries(data);
        } catch (err) {
            console.error("Error loading deliveries:", err);
        } finally {
            setIsLoadingDeliveries(false);
        }
    }

    function handleSelect(order: PurchaseOrder) {
        setSelectedOrder(order);
        setMsg(null);
        setWeight("");
        setEditingDelivery(null);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedOrder) return;
        setMsg(null);

        const formData = new FormData();
        formData.set("transactionId", selectedOrder.id);
        formData.set("plate", plate);
        formData.set("weight", weight);
        formData.set("driver", driver);

        startTransition(async () => {
            const result = await createInboundDelivery(formData);
            if (result.success) {
                setMsg({ type: 'success', text: "Entrada registrada com sucesso!" });
                setWeight("");
                // Reload deliveries
                await loadDeliveries(selectedOrder.id);
            } else {
                setMsg({ type: 'error', text: result.error || "Erro ao registrar." });
            }
        });
    }

    async function handleEditSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!editingDelivery || !selectedOrder) return;
        setMsg(null);

        const formData = new FormData();
        formData.set("id", editingDelivery.id);
        formData.set("plate", editingDelivery.plate);
        formData.set("weight", editingDelivery.weight.toString());
        formData.set("driver", editingDelivery.driverName || "");

        startTransition(async () => {
            const result = await updateDelivery(formData);
            if (result.success) {
                setMsg({ type: 'success', text: "Registro atualizado!" });
                setEditingDelivery(null);
                await loadDeliveries(selectedOrder.id);
            } else {
                setMsg({ type: 'error', text: result.error || "Erro ao atualizar." });
            }
        });
    }

    async function handleDelete(delivery: Delivery) {
        if (!confirm(`Excluir registro da placa ${delivery.plate}?\nIsso irá subtrair ${delivery.weight} do estoque.`)) return;
        if (!selectedOrder) return;
        setMsg(null);

        startTransition(async () => {
            const result = await deleteDelivery(delivery.id);
            if (result.success) {
                setMsg({ type: 'success', text: "Registro excluído!" });
                await loadDeliveries(selectedOrder.id);
            } else {
                setMsg({ type: 'error', text: result.error || "Erro ao excluir." });
            }
        });
    }

    return (
        <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-background">
            {/* LEFT: Order List */}
            <div className={`w-full md:w-1/2 lg:w-2/5 border-r border-border flex flex-col ${selectedOrder ? "hidden md:flex" : "flex"}`}>
                <div className="p-4 border-b border-border bg-card">
                    <h2 className="font-semibold text-lg flex items-center gap-2">
                        <span className="bg-primary/10 text-primary p-1.5 rounded-md">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </span>
                        Ordens de Recebimento
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Selecione uma compra para registrar a descarga.
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {orders.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
                            Nenhuma ordem pendente.
                        </div>
                    ) : (
                        orders.map(order => {
                            const progress = Math.min(100, (order.deliveredQuantity / order.totalQuantity) * 100);
                            return (
                                <div
                                    key={order.id}
                                    onClick={() => handleSelect(order)}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md ${selectedOrder?.id === order.id
                                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                        : "border-border bg-card hover:border-primary/50"
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-medium text-foreground">{order.supplierName}</h3>
                                            <p className="text-sm text-muted-foreground">{order.materialName}</p>
                                        </div>
                                        <span className="text-xs px-2 py-1 bg-muted rounded-full font-medium">
                                            #{order.id.slice(0, 6)}
                                        </span>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs font-medium">
                                            <span className="text-muted-foreground">Entregue: {order.deliveredQuantity} {order.materialUnit}</span>
                                            <span className="text-foreground">{progress.toFixed(0)}%</span>
                                        </div>
                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary transition-all duration-500"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-xs mt-1">
                                            <span className="text-muted-foreground">Total: {order.totalQuantity}</span>
                                            <span className="text-green-600 font-semibold">Restam: {order.remainingQuantity.toFixed(1)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* RIGHT: Delivery Form + History */}
            <div className={`w-full md:w-1/2 lg:w-3/5 bg-muted/10 flex flex-col ${!selectedOrder ? "hidden md:flex" : "flex"}`}>
                {selectedOrder ? (
                    <div className="flex-1 flex flex-col h-full overflow-hidden">
                        {/* Header */}
                        <div className="p-4 border-b border-border bg-card flex items-center gap-3">
                            <button
                                onClick={() => setSelectedOrder(null)}
                                className="md:hidden p-2 -ml-2 rounded-full hover:bg-muted"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            <div>
                                <h3 className="font-semibold text-lg">{selectedOrder.supplierName}</h3>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span>{selectedOrder.materialName}</span>
                                    <span>•</span>
                                    <span className="text-green-600 font-medium whitespace-nowrap">
                                        Saldo: {selectedOrder.remainingQuantity.toFixed(1)} {selectedOrder.materialUnit}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                            {/* Messages */}
                            {msg && (
                                <div className={`p-4 rounded-lg border flex items-center gap-3 animate-in slide-in-from-top-2 ${msg.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-700' : 'bg-red-500/10 border-red-500/20 text-red-700'}`}>
                                    {msg.type === 'success' ? (
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    ) : (
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    )}
                                    <p className="font-medium">{msg.text}</p>
                                </div>
                            )}

                            {/* Registration Form */}
                            <div className="bg-card border border-border rounded-xl shadow-lg p-6">
                                <h4 className="text-lg font-semibold border-b border-border pb-4 mb-4">
                                    Registrar Nova Pesagem
                                </h4>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Placa</label>
                                            <input
                                                required
                                                type="text"
                                                value={plate}
                                                onChange={e => setPlate(e.target.value.toUpperCase())}
                                                placeholder="ABC-1234"
                                                className="w-full h-10 px-3 rounded-lg border border-input bg-muted/50 uppercase tracking-wider font-mono"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Peso ({selectedOrder.materialUnit})</label>
                                            <input
                                                required
                                                type="number"
                                                step="0.01"
                                                value={weight}
                                                onChange={e => setWeight(e.target.value)}
                                                placeholder="0.00"
                                                className="w-full h-10 px-3 rounded-lg border border-input bg-muted/50 text-right font-bold"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Motorista (Opcional)</label>
                                        <input
                                            type="text"
                                            value={driver}
                                            onChange={e => setDriver(e.target.value)}
                                            placeholder="Nome do motorista"
                                            className="w-full h-10 px-3 rounded-lg border border-input bg-muted/50"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isPending}
                                        className="w-full h-10 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                    >
                                        {isPending ? "Registrando..." : (
                                            <>
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                Confirmar Entrada
                                            </>
                                        )}
                                    </button>
                                </form>
                            </div>

                            {/* Delivery History */}
                            <div className="bg-card border border-border rounded-xl p-6">
                                <h4 className="text-lg font-semibold border-b border-border pb-4 mb-4 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                    Histórico de Entregas
                                </h4>

                                {isLoadingDeliveries ? (
                                    <div className="text-center py-6 text-muted-foreground">Carregando...</div>
                                ) : deliveries.length === 0 ? (
                                    <div className="text-center py-6 text-muted-foreground">
                                        Nenhuma entrega registrada ainda.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {deliveries.map(delivery => (
                                            <div key={delivery.id} className="p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
                                                {editingDelivery?.id === delivery.id ? (
                                                    // Edit Form
                                                    <form onSubmit={handleEditSubmit} className="space-y-3">
                                                        <div className="grid grid-cols-3 gap-2">
                                                            <input
                                                                type="text"
                                                                value={editingDelivery.plate}
                                                                onChange={e => setEditingDelivery({ ...editingDelivery, plate: e.target.value.toUpperCase() })}
                                                                className="h-8 px-2 rounded border border-input bg-background uppercase text-sm"
                                                            />
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={editingDelivery.weight}
                                                                onChange={e => setEditingDelivery({ ...editingDelivery, weight: parseFloat(e.target.value) || 0 })}
                                                                className="h-8 px-2 rounded border border-input bg-background text-sm text-right"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={editingDelivery.driverName || ""}
                                                                onChange={e => setEditingDelivery({ ...editingDelivery, driverName: e.target.value })}
                                                                placeholder="Motorista"
                                                                className="h-8 px-2 rounded border border-input bg-background text-sm"
                                                            />
                                                        </div>
                                                        <div className="flex gap-2 justify-end">
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingDelivery(null)}
                                                                className="px-3 py-1 text-sm rounded border border-border hover:bg-muted"
                                                            >
                                                                Cancelar
                                                            </button>
                                                            <button
                                                                type="submit"
                                                                disabled={isPending}
                                                                className="px-3 py-1 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                                            >
                                                                Salvar
                                                            </button>
                                                        </div>
                                                    </form>
                                                ) : (
                                                    // Display Row
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-sm font-mono font-medium bg-muted px-2 py-1 rounded">
                                                                {delivery.plate}
                                                            </span>
                                                            <span className="text-lg font-bold text-foreground">
                                                                {delivery.weight.toFixed(2)} {selectedOrder.materialUnit}
                                                            </span>
                                                            {delivery.driverName && (
                                                                <span className="text-sm text-muted-foreground">
                                                                    {delivery.driverName}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-xs text-muted-foreground">
                                                                {new Date(delivery.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                            <button
                                                                onClick={() => setEditingDelivery(delivery)}
                                                                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                                                                title="Editar"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(delivery)}
                                                                disabled={isPending}
                                                                className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 disabled:opacity-50"
                                                                title="Excluir"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
                        <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
                            <svg className="w-12 h-12 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
                        </div>
                        <h3 className="text-xl font-semibold mb-2">Balança Rodoviária</h3>
                        <p className="max-w-md text-center">
                            Selecione uma Ordem de Recebimento no menu lateral para registrar a entrada de carga.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
