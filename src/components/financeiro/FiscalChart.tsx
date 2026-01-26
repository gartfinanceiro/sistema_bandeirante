"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';

interface FiscalChartProps {
    credits: number;
    debits: number;
}

export function FiscalChart({ credits, debits }: FiscalChartProps) {
    const data = [
        {
            name: 'Atual',
            Crédito: credits,
            Débito: debits,
        },
    ];

    if (credits === 0 && debits === 0) return null;

    return (
        <div className="bg-background rounded-xl border border-border p-6 shadow-sm hidden md:block">
            <h3 className="text-lg font-semibold mb-6 text-foreground">Balanço Fiscal</h3>
            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        layout="vertical"
                        barSize={40}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.3} />
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" hide />
                        <Tooltip
                            cursor={{ fill: 'transparent' }}
                            contentStyle={{
                                backgroundColor: 'hsl(var(--background))',
                                borderColor: 'hsl(var(--border))',
                                borderRadius: '0.5rem'
                            }}
                            itemStyle={{ color: 'hsl(var(--foreground))' }}
                            formatter={(value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)}
                        />
                        <Legend verticalAlign="top" height={36} />
                        <Bar name="Créditos (Entradas)" dataKey="Crédito" fill="#10b981" radius={[0, 4, 4, 0]} />
                        <Bar name="Débitos (Saídas)" dataKey="Débito" fill="#f43f5e" radius={[0, 4, 4, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
