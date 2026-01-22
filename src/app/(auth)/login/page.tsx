"use client";

import { useState } from "react";
import { signIn } from "@/app/(auth)/actions";

export default function LoginPage() {
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    async function handleSubmit(formData: FormData) {
        setIsLoading(true);
        setError(null);

        const result = await signIn(formData);

        if (result?.error) {
            setError(result.error);
            setIsLoading(false);
        }
    }

    return (
        <main className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-[400px] space-y-8">
                {/* Logo */}
                <div className="text-center space-y-2">
                    <div className="flex items-center justify-center gap-3">
                        <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                            <span className="text-2xl font-bold text-primary-foreground">G</span>
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        Gusa <span className="text-primary">Intelligence</span>
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Sistema de Gestão para Siderurgia
                    </p>
                </div>

                {/* Login Form */}
                <div className="bg-card border border-border rounded-lg p-6 shadow-lg">
                    <form action={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label
                                htmlFor="email"
                                className="text-sm font-medium text-foreground"
                            >
                                E-mail
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                autoComplete="email"
                                placeholder="seu@email.com"
                                className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                            />
                        </div>

                        <div className="space-y-2">
                            <label
                                htmlFor="password"
                                className="text-sm font-medium text-foreground"
                            >
                                Senha
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                autoComplete="current-password"
                                placeholder="••••••••"
                                className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                            />
                        </div>

                        {error && (
                            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-10 rounded-md bg-primary text-primary-foreground font-medium shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                            fill="none"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        />
                                    </svg>
                                    Entrando...
                                </span>
                            ) : (
                                "Entrar"
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center text-sm text-muted-foreground">
                    Sistema Bandeirante v1.0
                </p>
            </div>
        </main>
    );
}
