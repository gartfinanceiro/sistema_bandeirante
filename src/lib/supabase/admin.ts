import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";

/**
 * Cliente Supabase com SERVICE ROLE — ignora RLS. USO EXCLUSIVO server-side
 * (ex.: rota do cron de importação automática, que roda sem sessão de usuário).
 * NUNCA importar isto em código client nem expor a chave em NEXT_PUBLIC_*.
 */
export function createAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
        throw new Error(
            "createAdminClient: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios."
        );
    }
    return createSupabaseClient<Database>(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}
