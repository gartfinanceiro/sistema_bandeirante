"use client";

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { type ReportCategory } from '@/app/(authenticated)/financeiro/actions';

interface ExpenseDonutChartProps {
    categories: ReportCategory[];
    totalExpenses: number;
    title?: string;
}

const COLORS = [
    '#0ea5e9', // Sky 500
    '#ec4899', // Pink 500
    '#8b5cf6', // Violet 500
    '#10b981', // Emerald 500
    '#f59e0b', // Amber 500
    '#ef4444', // Red 500
    '#6366f1', // Indigo 500
    '#14b8a6', // Teal 500
];

export function ExpenseDonutChart({ categories, totalExpenses, title = "Distribuição de Despesas" }: ExpenseDonutChartProps) {
    const data = useMemo(() => {
        return categories
            .filter(cat => cat.total > 0)
            .map(cat => ({
                name: cat.name,
                value: cat.total,
                percentage: cat.percentage
            }));
    }, [categories]);

    if (totalExpenses === 0) {
        return (
            <div className="h-64 flex items-center justify-center text-muted-foreground bg-muted/20 rounded-lg border border-border border-dashed">
                Sem dados para exibir
            </div>
        );
    }

    // Custom Tooltip
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-background border border-border p-3 rounded-lg shadow-lg z-50">
                    <p className="font-semibold text-sm">{data.name}</p>
                    <p className="text-sm text-foreground">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.value)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {data.percentage.toFixed(1)}% do total
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-background rounded-xl border border-border p-6 shadow-sm flex flex-col h-full">
            <h3 className="text-lg font-semibold mb-6 text-foreground">{title}</h3>
            <div className="flex-1 w-full min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            layout="vertical"
                            verticalAlign="middle"
                            align="right"
                            wrapperStyle={{ fontSize: '12px', paddingLeft: '20px' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="mt-4 text-center">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-foreground">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalExpenses)}
                </p>
            </div>
        </div>
    );
}

