"use client";

import { useState, useCallback } from "react";
import { Upload, X, CheckCircle, AlertTriangle, XCircle, FileSpreadsheet, Loader2 } from "lucide-react";
import type { ParsedTicket, MatchedTicket, ImportResult } from "@/app/(authenticated)/balanca/import-actions";

// =============================================================================
// File Parser (client-side) — HTML-disguised .xls
// =============================================================================

function parseBalancaFile(htmlContent: string): ParsedTicket[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");
    const rows = doc.querySelectorAll("table tr");
    const tickets: ParsedTicket[] = [];

    for (let i = 0; i < rows.length; i++) {
        const cells = rows[i].querySelectorAll("td");
        if (cells.length < 12) continue;

        const tipo = cells[0]?.textContent?.trim() || "";
        if (!tipo.includes("TICKET DE PESAGEM")) continue;

        const ticketNumber = cells[1]?.textContent?.trim() || "";
        const rawDate = cells[3]?.textContent?.trim() || "";
        const time = cells[4]?.textContent?.trim() || "";
        // Nota: cells[5] e [6] são colunas ocultas (Data/Hora Saída)
        const plate = cells[7]?.textContent?.trim() || "";       // Veículo
        const driver = cells[8]?.textContent?.trim() || "";      // Motorista
        const transporter = cells[9]?.textContent?.trim() || ""; // Transportador
        const origin = cells[10]?.textContent?.trim() || "";     // Origem (fornecedor)
        // cells[11] = Destino, cells[12] = Doc Externo (hidden)
        const material = cells[13]?.textContent?.trim() || "";   // Carga (material real)
        // cells[14-18] são colunas ocultas (Grupo, MDC, Umidade, Moinha, Tição)
        const weightStr = cells[19]?.textContent?.trim() || "0"; // Peso Líquido

        // Parse date: "DD/MM/YYYY HH:MM:SS" or "DD/MM/YYYY 00:00:00" → "YYYY-MM-DD"
        let isoDate = "";
        const dateParts = rawDate.split(/[\s/]/);
        if (dateParts.length >= 3) {
            const day = dateParts[0].padStart(2, "0");
            const month = dateParts[1].padStart(2, "0");
            const year = dateParts[2].substring(0, 4);
            isoDate = `${year}-${month}-${day}`;
        }

        // Extract codes from brackets
        const originCode = origin.match(/\[(\d+)\]/)?.[1] || "";
        const materialCode = material.match(/\[(\d+)\]/)?.[1] || "";

        const weightKg = parseInt(weightStr.replace(/[^\d]/g, ""), 10) || 0;

        if (weightKg > 0 && isoDate) {
            tickets.push({
                ticketNumber,
                date: isoDate,
                time,
                plate,
                driver,
                transporter,
                origin,
                originCode,
                material,
                materialCode,
                weightKg,
            });
        }
    }

    return tickets;
}

// =============================================================================
// Component
// =============================================================================

interface ImportBalancaDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onImportComplete: () => void;
}

type Step = "upload" | "matching" | "review" | "importing" | "done";

export function ImportBalancaDialog({ isOpen, onClose, onImportComplete }: ImportBalancaDialogProps) {
    const [step, setStep] = useState<Step>("upload");
    const [fileName, setFileName] = useState("");
    const [parsedTickets, setParsedTickets] = useState<ParsedTicket[]>([]);
    const [matchedTickets, setMatchedTickets] = useState<MatchedTicket[]>([]);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedTickets, setSelectedTickets] = useState<Set<number>>(new Set());

    const reset = useCallback(() => {
        setStep("upload");
        setFileName("");
        setParsedTickets([]);
        setMatchedTickets([]);
        setImportResult(null);
        setError(null);
        setSelectedTickets(new Set());
    }, []);

    const handleClose = useCallback(() => {
        reset();
        onClose();
    }, [reset, onClose]);

    // Step 1: File Upload & Parse
    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setError(null);

        try {
            const text = await file.text();
            const tickets = parseBalancaFile(text);

            if (tickets.length === 0) {
                setError("Nenhum ticket encontrado no arquivo. Verifique se o formato é o relatório analítico da balança.");
                return;
            }

            setParsedTickets(tickets);
            setStep("matching");

            // Call server action for matching
            const { matchTicketsWithOrders } = await import("@/app/(authenticated)/balanca/import-actions");
            const matched = await matchTicketsWithOrders(tickets);
            setMatchedTickets(matched);

            // Pre-select all matched tickets
            const preSelected = new Set<number>();
            matched.forEach((t, i) => {
                if (t.matchStatus === "matched") preSelected.add(i);
            });
            setSelectedTickets(preSelected);

            setStep("review");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erro ao processar arquivo");
            setStep("upload");
        }
    }

    // Step 3: Import
    async function handleImport() {
        setStep("importing");

        try {
            const toImport = matchedTickets.filter((_, i) => selectedTickets.has(i));
            const { importMatchedTickets } = await import("@/app/(authenticated)/balanca/import-actions");
            const result = await importMatchedTickets(toImport);
            setImportResult(result);
            setStep("done");
            if (result.imported > 0) {
                onImportComplete();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erro na importação");
            setStep("review");
        }
    }

    function toggleTicket(index: number) {
        const next = new Set(selectedTickets);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        setSelectedTickets(next);
    }

    function toggleAll() {
        if (selectedTickets.size === matchedTickets.filter(t => t.matchStatus === "matched").length) {
            setSelectedTickets(new Set());
        } else {
            const all = new Set<number>();
            matchedTickets.forEach((t, i) => {
                if (t.matchStatus === "matched") all.add(i);
            });
            setSelectedTickets(all);
        }
    }

    if (!isOpen) return null;

    const matchedCount = matchedTickets.filter(t => t.matchStatus === "matched").length;
    const partialCount = matchedTickets.filter(t => t.matchStatus === "partial").length;
    const unmatchedCount = matchedTickets.filter(t => t.matchStatus === "unmatched").length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

            {/* Dialog */}
            <div className="relative bg-white rounded-xl shadow-2xl w-[95vw] max-w-5xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <div className="flex items-center gap-3">
                        <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-semibold">Importar Relatório da Balança</h2>
                    </div>
                    <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Progress Steps */}
                <div className="px-6 py-3 border-b bg-gray-50 flex gap-4 text-sm">
                    {[
                        { key: "upload", label: "1. Upload" },
                        { key: "review", label: "2. Revisão" },
                        { key: "done", label: "3. Concluído" },
                    ].map(({ key, label }) => (
                        <span
                            key={key}
                            className={`px-3 py-1 rounded-full transition-colors ${
                                step === key || (key === "review" && step === "matching") || (key === "done" && step === "importing")
                                    ? "bg-blue-100 text-blue-700 font-medium"
                                    : "text-gray-400"
                            }`}
                        >
                            {label}
                        </span>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {/* STEP: Upload */}
                    {step === "upload" && (
                        <div className="flex flex-col items-center justify-center py-12">
                            <label className="w-full max-w-md border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                                <Upload className="w-10 h-10 text-gray-400 mb-3" />
                                <span className="text-sm font-medium text-gray-700">
                                    Arraste ou clique para selecionar
                                </span>
                                <span className="text-xs text-gray-500 mt-1">
                                    Relatório Tickets Analítico (.xls)
                                </span>
                                <input
                                    type="file"
                                    accept=".xls,.xlsx,.html"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                            </label>
                            {error && (
                                <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
                                    <XCircle className="w-4 h-4 shrink-0" />
                                    {error}
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP: Matching (loading) */}
                    {step === "matching" && (
                        <div className="flex flex-col items-center justify-center py-16">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                            <p className="text-gray-600 font-medium">Analisando {parsedTickets.length} tickets...</p>
                            <p className="text-gray-400 text-sm mt-1">Buscando fornecedores e ordens de compra no sistema</p>
                        </div>
                    )}

                    {/* STEP: Review */}
                    {step === "review" && (
                        <div className="space-y-4">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-4 gap-3">
                                <div className="bg-gray-50 rounded-lg p-3 text-center">
                                    <div className="text-2xl font-bold text-gray-800">{matchedTickets.length}</div>
                                    <div className="text-xs text-gray-500">Total Tickets</div>
                                </div>
                                <div className="bg-green-50 rounded-lg p-3 text-center">
                                    <div className="text-2xl font-bold text-green-700">{matchedCount}</div>
                                    <div className="text-xs text-green-600">Vinculados</div>
                                </div>
                                <div className="bg-yellow-50 rounded-lg p-3 text-center">
                                    <div className="text-2xl font-bold text-yellow-700">{partialCount}</div>
                                    <div className="text-xs text-yellow-600">Sem Ordem</div>
                                </div>
                                <div className="bg-red-50 rounded-lg p-3 text-center">
                                    <div className="text-2xl font-bold text-red-700">{unmatchedCount}</div>
                                    <div className="text-xs text-red-600">Não encontrados</div>
                                </div>
                            </div>

                            {/* File info */}
                            <div className="text-sm text-gray-500 flex items-center gap-2">
                                <FileSpreadsheet className="w-4 h-4" />
                                {fileName}
                                <span className="text-gray-300">|</span>
                                Período: {matchedTickets.length > 0 && (
                                    <>
                                        {new Date(matchedTickets[0].date).toLocaleDateString('pt-BR')} a{' '}
                                        {new Date(matchedTickets[matchedTickets.length - 1].date).toLocaleDateString('pt-BR')}
                                    </>
                                )}
                                <span className="text-gray-300">|</span>
                                Peso total: {(matchedTickets.reduce((s, t) => s + t.weightKg, 0) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ton
                            </div>

                            {error && (
                                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
                                    <XCircle className="w-4 h-4 shrink-0" />
                                    {error}
                                </div>
                            )}

                            {/* Table */}
                            <div className="border rounded-lg overflow-auto max-h-[45vh]">
                                <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2 text-left">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedTickets.size === matchedCount && matchedCount > 0}
                                                    onChange={toggleAll}
                                                    className="rounded"
                                                />
                                            </th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Placa</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Motorista</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Origem (Relatório)</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Peso (kg)</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Match</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {matchedTickets.map((ticket, i) => (
                                            <tr
                                                key={i}
                                                className={`${
                                                    ticket.matchStatus === 'unmatched'
                                                        ? 'bg-red-50/50'
                                                        : ticket.matchStatus === 'partial'
                                                        ? 'bg-yellow-50/50'
                                                        : selectedTickets.has(i) ? 'bg-green-50/30' : ''
                                                } hover:bg-gray-50`}
                                            >
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedTickets.has(i)}
                                                        onChange={() => toggleTicket(i)}
                                                        disabled={ticket.matchStatus !== 'matched'}
                                                        className="rounded"
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    {ticket.matchStatus === 'matched' && <CheckCircle className="w-4 h-4 text-green-600" />}
                                                    {ticket.matchStatus === 'partial' && <AlertTriangle className="w-4 h-4 text-yellow-600" />}
                                                    {ticket.matchStatus === 'unmatched' && <XCircle className="w-4 h-4 text-red-500" />}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">
                                                    {new Date(ticket.date).toLocaleDateString('pt-BR')}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{ticket.plate}</td>
                                                <td className="px-3 py-2 whitespace-nowrap text-xs">{ticket.driver}</td>
                                                <td className="px-3 py-2 text-xs max-w-[200px] truncate" title={ticket.origin}>
                                                    {ticket.origin.replace(/\s*-\s*\[\d+\]/, '')}
                                                </td>
                                                <td className="px-3 py-2 text-xs">
                                                    {ticket.materialName || ticket.material.replace(/\s*-\s*\[\d+\]/, '')}
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono font-medium">
                                                    {ticket.weightKg.toLocaleString('pt-BR')}
                                                </td>
                                                <td className="px-3 py-2 text-xs text-gray-500 max-w-[200px]" title={ticket.matchNote}>
                                                    {ticket.matchNote.length > 50 ? ticket.matchNote.substring(0, 50) + '...' : ticket.matchNote}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* STEP: Importing */}
                    {step === "importing" && (
                        <div className="flex flex-col items-center justify-center py-16">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                            <p className="text-gray-600 font-medium">Importando {selectedTickets.size} entregas...</p>
                            <p className="text-gray-400 text-sm mt-1">Registrando pesagens e atualizando estoque</p>
                        </div>
                    )}

                    {/* STEP: Done */}
                    {step === "done" && importResult && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-6">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                                importResult.imported > 0 ? 'bg-green-100' : 'bg-yellow-100'
                            }`}>
                                {importResult.imported > 0
                                    ? <CheckCircle className="w-8 h-8 text-green-600" />
                                    : <AlertTriangle className="w-8 h-8 text-yellow-600" />
                                }
                            </div>
                            <div className="text-center">
                                <h3 className="text-xl font-bold text-gray-900">Importação Concluída</h3>
                                <p className="text-gray-500 mt-1">
                                    {importResult.imported} de {importResult.total} entregas importadas
                                </p>
                            </div>
                            <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
                                <div className="bg-green-50 rounded-lg p-3 text-center">
                                    <div className="text-xl font-bold text-green-700">{importResult.imported}</div>
                                    <div className="text-xs text-green-600">Importadas</div>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3 text-center">
                                    <div className="text-xl font-bold text-gray-700">{importResult.skipped}</div>
                                    <div className="text-xs text-gray-500">Ignoradas</div>
                                </div>
                                <div className="bg-red-50 rounded-lg p-3 text-center">
                                    <div className="text-xl font-bold text-red-700">{importResult.errors.length}</div>
                                    <div className="text-xs text-red-600">Erros</div>
                                </div>
                            </div>
                            {importResult.errors.length > 0 && (
                                <div className="w-full max-w-lg bg-red-50 rounded-lg p-4">
                                    <h4 className="text-sm font-medium text-red-800 mb-2">Detalhes dos erros:</h4>
                                    <ul className="text-xs text-red-700 space-y-1 max-h-32 overflow-auto">
                                        {importResult.errors.map((err, i) => (
                                            <li key={i}>• {err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t bg-gray-50 flex justify-between">
                    <button
                        onClick={step === "done" ? handleClose : reset}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                    >
                        {step === "done" ? "Fechar" : "Cancelar"}
                    </button>
                    {step === "review" && (
                        <button
                            onClick={handleImport}
                            disabled={selectedTickets.size === 0}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-2"
                        >
                            <Upload className="w-4 h-4" />
                            Importar {selectedTickets.size} Entregas
                        </button>
                    )}
                    {step === "done" && (
                        <button
                            onClick={handleClose}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                            Concluir
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
