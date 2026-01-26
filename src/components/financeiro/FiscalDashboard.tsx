"use client";

import { useState, useEffect } from "react";
import { getFiscalDashboard, type FiscalDashboardData } from "@/app/(authenticated)/financeiro/fiscal-actions";
import { FiscalKPICards } from "./FiscalKPICards";
import { FiscalExtractTable } from "./FiscalExtractTable";
import { FiscalChart } from "./FiscalChart";

interface FiscalDashboardProps {
    month: number;
    year: number;
}

export function FiscalDashboard({ month, year }: FiscalDashboardProps) {
    const [data, setData] = useState<FiscalDashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        async function loadData() {
            setIsLoading(true);
            try {
                const result = await getFiscalDashboard(month, year);
                if (isMounted) {
                    setData(result);
                }
            } catch (error) {
                console.error("Failed to load fiscal data:", error);
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }
        loadData();
        return () => { isMounted = false; };
    }, [month, year]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 min-h-[400px]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                <p className="mt-4 text-muted-foreground text-sm">Calculando apuração de ICMS...</p>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* KPI Cards */}
            <FiscalKPICards 
                credits={data.credits}
                debits={data.debits}
                balance={data.balance}
                status={data.status}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart (Optional) */}
                <div className="lg:col-span-1">
                     <FiscalChart credits={data.credits} debits={data.debits} />
                </div>
                
                {/* Detailed Table */}
                <div className="lg:col-span-2">
                    <FiscalExtractTable items={data.extract} />
                </div>
            </div>
        </div>
    );
}
