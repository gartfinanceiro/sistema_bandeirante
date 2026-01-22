"use client";

import { useState } from "react";
import Image from "next/image";
import { signIn } from "@/app/(auth)/actions";

export default function HomePage() {
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
        <main className="relative min-h-screen flex flex-col items-center justify-center p-4">
            {/* Background Image & Overlay */}
            <div
                className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: "url('/landing-bg.jpg')" }}
            >
                <div className="absolute inset-0 bg-black/60" />
            </div>

            <div className="relative z-10 w-full max-w-md space-y-8">
                {/* Header: Logo & Title */}
                <div className="flex flex-col items-center text-center">
                    <div className="mb-6 w-48 md:w-56 relative h-24">
                        <Image
                            src="/logo-header.png"
                            alt="Siderúrgica Bandeirante"
                            fill
                            className="object-contain"
                            priority
                        />
                    </div>
                    <h1 className="text-xl md:text-2xl font-bold tracking-wider text-white uppercase drop-shadow-md">
                        SISTEMA GERENCIAL
                    </h1>
                </div>


                {/* Login Card */}
                <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-xl p-8 shadow-2xl">
                    <form action={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label
                                htmlFor="email"
                                className="text-sm font-medium text-gray-200"
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
                                className="w-full rounded-md border border-white/20 bg-black/40 px-4 py-3 text-white placeholder-gray-400 focus:border-orange-500 focus:outline-hidden focus:ring-1 focus:ring-orange-500 transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label
                                htmlFor="password"
                                className="text-sm font-medium text-gray-200"
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
                                className="w-full rounded-md border border-white/20 bg-black/40 px-4 py-3 text-white placeholder-gray-400 focus:border-orange-500 focus:outline-hidden focus:ring-1 focus:ring-orange-500 transition-all"
                            />
                        </div>

                        {error && (
                            <div className="p-3 rounded-md bg-red-500/20 border border-red-500/50 text-red-100 text-sm text-center">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full rounded-md bg-gradient-to-r from-orange-600 to-orange-500 py-3 font-bold text-white shadow-lg shadow-orange-900/20 hover:from-orange-500 hover:to-orange-400 hover:shadow-orange-900/40 active:scale-[0.98] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Entrando...</span>
                                </>
                            ) : (
                                "Entrar"
                            )}
                        </button>

                        <div className="text-center pt-2">
                            <a href="#" className="text-xs text-gray-400 hover:text-white transition-colors">
                                Esqueceu sua senha?
                            </a>
                        </div>
                    </form>
                </div>

                {/* Footer info */}
                <div className="text-center text-xs text-white/40 pt-8">
                    <p>© {new Date().getFullYear()} Siderúrgica Bandeirante. Todos os direitos reservados.</p>
                </div>
            </div>
        </main>
    );
}
