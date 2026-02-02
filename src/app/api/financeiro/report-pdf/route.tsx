import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { getExpensesReport, getEntriesReport, getMonthSummary } from "@/app/(authenticated)/financeiro/actions";
import { generateFinancialReportHtml } from "@/components/financeiro/pdf/generateFinancialReportHtml";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const month = parseInt(searchParams.get("month") || "");
    const year = parseInt(searchParams.get("year") || "");

    if (!month || !year) {
        return NextResponse.json({ error: "Month and Year are required" }, { status: 400 });
    }

    try {
        // 1. Fetch Data
        const [summary, expensesReport, entriesReport] = await Promise.all([
            getMonthSummary(month, year),
            getExpensesReport(month, year),
            getEntriesReport(month, year)
        ]);

        // 2. Generate HTML String
        const htmlContent = generateFinancialReportHtml({
            month,
            year,
            summary,
            expensesReport,
            entriesReport,
            generatedAt: new Date().toLocaleString("pt-BR"),
        });

        // 3. Launch Puppeteer
        const browser = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
        const page = await browser.newPage();

        await page.emulateMediaType("print");

        await page.setContent(htmlContent, {
            waitUntil: "networkidle0",
        });

        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: {
                top: "20px",
                bottom: "20px",
            },
        });

        await browser.close();

        // 4. Return Response
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return new NextResponse(new Blob([pdfBuffer as any]), {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="Relatorio_Financeiro_${month}_${year}.pdf"`,
            },
        });

    } catch (error) {
        console.error("Error generating PDF:", error);
        return NextResponse.json(
            { error: "Failed to generate report", details: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
