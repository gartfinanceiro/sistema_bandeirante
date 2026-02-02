"use client";

import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, Sector } from 'recharts';
import { type ReportCategory } from '@/app/(authenticated)/financeiro/actions';
import { ExpenseDonutDrilldownModal } from './ExpenseDonutDrilldownModal';

interface ExpenseDonutChartProps {
    categories: ReportCategory[];
    totalValue: number;
    title?: string;
    threshold?: number; // Percent threshold for grouping (default 3)
    maxLegendItems?: number; // Max items in legend (default 8)
}

interface ChartData {
    name: string;
    value: number;
    percentage: number;
    isGrouped: boolean;
    fill: string;
    subCategories: ReportCategory[];
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
    '#84cc16', // Lime 500
    '#f97316', // Orange 500
];

const OTHER_COLOR = '#94a3b8'; // Slate 400 for specific "Outros"

export function ExpenseDonutChart({
    categories,
    totalValue,
    title = "Distribuição de Despesas",
    threshold = 3,
    maxLegendItems = 8
}: ExpenseDonutChartProps) {
    const [activeSectorIndex, setActiveSectorIndex] = useState<number | undefined>();
    const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);
    const [drilldownData, setDrilldownData] = useState<{
        subCategories: ReportCategory[];
        total: number;
        percentage: number;
    } | null>(null);

    const data = useMemo(() => {
        // 1. Sort by value descending
        const sorted = [...categories].sort((a, b) => b.total - a.total);

        // 2. Identify heavy hitters vs small fries
        const mainCategories: ChartData[] = [];
        const smallCategories: ReportCategory[] = [];

        sorted.forEach((cat) => {
            if (cat.percentage >= threshold) {
                mainCategories.push({
                    name: cat.name,
                    value: cat.total,
                    percentage: cat.percentage,
                    isGrouped: false,
                    fill: '', // assigned later
                    subCategories: [cat]
                });
            } else {
                smallCategories.push(cat);
            }
        });

        // 3. Create "Outros" group if needed
        if (smallCategories.length > 0) {
            const smallTotal = smallCategories.reduce((sum, cat) => sum + cat.total, 0);
            const smallPercentage = (smallTotal / totalValue) * 100;

            mainCategories.push({
                name: "Outros",
                value: smallTotal,
                percentage: smallPercentage,
                isGrouped: true,
                fill: OTHER_COLOR,
                subCategories: smallCategories
            });
        }

        // 4. Assign colors to main categories
        // "Outros" is typically last, we want to ensure it gets a neutral color if we didn't force it above
        // But for consistency let's loop
        return mainCategories.map((item, index) => ({
            ...item,
            fill: item.isGrouped ? OTHER_COLOR : COLORS[index % COLORS.length]
        }));

    }, [categories, totalValue, threshold]);

    // Handle "Outros" click
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlePieClick = (data: any, index: number) => {
        if (data && data.isGrouped) {
            setDrilldownData({
                subCategories: data.subCategories,
                total: data.value,
                percentage: data.percentage
            });
            setIsDrilldownOpen(true);
        }
        setActiveSectorIndex(index === activeSectorIndex ? undefined : index);
    };

    if (totalValue === 0) {
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
            const item = payload[0].payload as ChartData;

            if (item.isGrouped) {
                const topSubs = [...item.subCategories]
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 5);
                const remainingCount = item.subCategories.length - 5;

                return (
                    <div className="bg-background border border-border p-3 rounded-lg shadow-lg z-50 min-w-[200px]">
                        <div className="border-b border-border pb-2 mb-2">
                            <p className="font-semibold text-sm">{item.name}</p>
                            <p className="text-sm font-bold text-primary">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.value)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {item.percentage.toFixed(1)}% do total
                            </p>
                        </div>
                        <div className="space-y-1">
                            {topSubs.map((sub) => (
                                <div key={sub.id} className="flex justify-between text-xs">
                                    <span className="text-muted-foreground truncate max-w-[120px]">{sub.name}</span>
                                    <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sub.total)}</span>
                                </div>
                            ))}
                            {remainingCount > 0 && (
                                <p className="text-xs text-muted-foreground pt-1 italic">
                                    + {remainingCount} categorias...
                                    <span className="block text-primary font-medium not-italic mt-0.5">Clique para ver detalhes</span>
                                </p>
                            )}
                            {remainingCount <= 0 && (
                                <p className="text-xs text-primary font-medium pt-1 mt-1 border-t border-border/50">
                                    Clique para ver detalhes
                                </p>
                            )}
                        </div>
                    </div>
                );
            }

            return (
                <div className="bg-background border border-border p-3 rounded-lg shadow-lg z-50">
                    <p className="font-semibold text-sm">{item.name}</p>
                    <p className="text-sm text-foreground">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.value)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {item.percentage.toFixed(1)}% do total
                    </p>
                </div>
            );
        }
        return null;
    };

    // Custom Active Shape (Optional: Highlight on click/hover)
    // using default behavior for now, but adding pointer cursor via css class or inline style

    return (
        <>
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
                                onClick={handlePieClick}
                                cursor="pointer"
                            >
                                {data.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.fill}
                                        strokeWidth={0}
                                        className="outline-none"
                                        style={{ opacity: activeSectorIndex === index ? 0.8 : 1 }}
                                    />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend
                                layout="vertical"
                                verticalAlign="middle"
                                align="right"
                                wrapperStyle={{ fontSize: '12px', paddingLeft: '20px' }}
                                // @ts-expect-error - Recharts types are strict but payload works at runtime
                                payload={
                                    data.slice(0, maxLegendItems).map((item) => ({
                                        id: item.name,
                                        type: 'square',
                                        value: `${item.name} (${item.percentage.toFixed(0)}%)`,
                                        color: item.fill
                                    })) as any
                                }
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-4 text-center">
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold text-foreground">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}
                    </p>
                </div>
            </div>

            {/* Drilldown Modal */}
            <ExpenseDonutDrilldownModal
                isOpen={isDrilldownOpen}
                onClose={() => setIsDrilldownOpen(false)}
                groupedCategories={drilldownData?.subCategories || []}
                totalGroupValue={drilldownData?.total || 0}
                percentageOfTotal={drilldownData?.percentage || 0}
            />
        </>
    );
}

