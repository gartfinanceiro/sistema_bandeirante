import { NextRequest, NextResponse } from "next/server";
import { autoImportCurrentMonth } from "@/app/(authenticated)/financeiro/auto-import-actions";

// Rota do cron de importação automática. Protegida por CRON_SECRET (o Vercel Cron envia
// "Authorization: Bearer <CRON_SECRET>" automaticamente quando a env existe).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
    const secret = process.env.CRON_SECRET;
    const auth = req.headers.get("authorization");
    if (!secret || auth !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const result = await autoImportCurrentMonth();
        console.log("[auto-import]", JSON.stringify(result));
        return NextResponse.json({ ok: true, ...result });
    } catch (e) {
        console.error("[auto-import] erro", e);
        return NextResponse.json(
            { ok: false, error: e instanceof Error ? e.message : "erro desconhecido" },
            { status: 500 }
        );
    }
}
