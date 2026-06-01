import type {
    ParsedSheetTransaction,
    MatchedSheetTransaction,
    CategoryOption,
} from "@/app/(authenticated)/financeiro/import-actions";
import { merchantKey } from "@/lib/financeiro/merchant-key";

// =============================================================================
// Motor de categorização (PURO — sem acesso a banco). Recebe categorias e o mapa
// aprendido já carregados, e devolve as sugestões. Reusado pelo dialog (sessão) e
// pelo cron (service role). Estratégia: mapa aprendido -> keyword rules -> fuzzy -> none.
// =============================================================================

interface KeywordRule {
    keywords: string[];
    excludeKeywords?: string[];
    categorySlug: string;
    confidence: "high" | "medium";
}

// Fallback para fornecedores SEM histórico no mapa aprendido. Apenas slugs reais (taxonomia
// consolidada 038/039). O mapa aprendido (merchant_best_category) é a fonte primária.
export const KEYWORD_RULES: KeywordRule[] = [
    // ===== Matéria-Prima (Operacional Direto) =====
    { keywords: ["carvão", "carvao", "moinha"], categorySlug: "raw_material_charcoal", confidence: "high" },
    { keywords: ["minério", "minerio", "santo expedito", "msm mineração"], excludeKeywords: ["sucata"], categorySlug: "raw_material_ore", confidence: "high" },
    { keywords: ["calcário", "calcario", "fundente", "brita", "bauxita"], categorySlug: "raw_material_flux", confidence: "high" },
    { keywords: ["frete", "transporte", "carreto"], categorySlug: "freight", confidence: "high" },
    { keywords: ["energia", "cemig", "eletricidade"], categorySlug: "energy", confidence: "high" },
    { keywords: ["oxigênio", "oxigenio", "gás industrial", "gas industrial"], categorySlug: "gas_industrial", confidence: "medium" },

    // ===== Operacional Indireto =====
    { keywords: ["diesel", "combustível", "combustivel", "gasolina", "posto", "etanol"], categorySlug: "fuel", confidence: "high" },
    { keywords: ["manutenção", "manutencao", "reparo", "conserto", "rolamento", "correia", "solda", "parafuso"], categorySlug: "maintenance_mech", confidence: "medium" },
    { keywords: ["epi", "luva", "bota", "consumível", "consumivel"], categorySlug: "consumables", confidence: "medium" },

    // ===== Recursos Humanos =====
    { keywords: ["salário", "salario", "folha salarial", "holerite", "adiantamento sal"], categorySlug: "salary", confidence: "high" },
    { keywords: ["pró-labore", "pro-labore", "pro labore"], categorySlug: "pro_labore", confidence: "high" },
    { keywords: ["inss", "gfip", "encargos s/ folha"], categorySlug: "encargos_e_impostos_s_folha", confidence: "high" },
    { keywords: ["fgts", "rescisão", "rescisao", "aviso prévio"], categorySlug: "encargos_rescisorios_fgts_multas", confidence: "high" },
    { keywords: ["plano de saúde", "plano saude", "unimed", "amil", "vale transporte", "vale alimentação"], categorySlug: "benefits", confidence: "medium" },
    { keywords: ["mercadinho", "atacadão", "atacadao", "assaí", "assai", "supermercado", "mart minas", "mercado"], categorySlug: "mercadinho", confidence: "medium" },

    // ===== Administrativo =====
    { keywords: ["telefone", "celular", "internet", "telecom", "vivo", "claro", "uol", "email"], categorySlug: "telecom", confidence: "high" },
    { keywords: ["contabilidade", "contador", "contábil", "contabil", "advogado", "advocat", "jurídico", "juridico", "assessoria"], categorySlug: "servinos_terceirizados", confidence: "medium" },

    // ===== Financeiro / Tributário =====
    { keywords: ["imposto", "icms", "pis", "cofins", "ipi", "darf", "dare", "dae", "iss", "iptu", "fgts darf"], categorySlug: "taxes", confidence: "high" },
    { keywords: ["juros", "empréstimo", "emprestimo", "financiamento", "encargos financ"], categorySlug: "juros_e_emprestimos", confidence: "high" },
    { keywords: ["tarifa bancária", "tarifa bancaria", "ted", "iof", "consulta saldo"], categorySlug: "bank_fees", confidence: "medium" },
    { keywords: ["saque"], categorySlug: "saque", confidence: "high" },

    // ===== Receita (Entradas) =====
    { keywords: ["venda gusa", "ferro gusa", "ferro-gusa", "venda ferro", "receita venda"], categorySlug: "sale_pig_iron", confidence: "high" },
    { keywords: ["rendimento", "aplicação", "aplicacao", "resgate investimento"], categorySlug: "financial_income", confidence: "medium" },

    // ===== Não Operacional / Patrimonial =====
    { keywords: ["igreja", "capela", "paróquia", "paroquia", "dízimo", "dizimo"], categorySlug: "igreja", confidence: "medium" },
];

export interface BestCategoryRow {
    merchant_key: string;
    best_category_slug: string;
    best_votes: number;
    total_votes: number;
    confidence: number | string;
    is_ambiguous: boolean;
}

export function categorizeTransactions(
    transactions: ParsedSheetTransaction[],
    categories: CategoryOption[],
    bestRows: BestCategoryRow[]
): MatchedSheetTransaction[] {
    const slugMap = new Map<string, CategoryOption>();
    for (const cat of categories) {
        if (cat.slug) slugMap.set(cat.slug, cat);
    }

    const bestMap = new Map<string, { slug: string; votes: number; total: number; confidence: number; ambiguous: boolean }>();
    for (const r of bestRows) {
        bestMap.set(r.merchant_key, {
            slug: r.best_category_slug,
            votes: Number(r.best_votes),
            total: Number(r.total_votes),
            confidence: Number(r.confidence),
            ambiguous: !!r.is_ambiguous,
        });
    }

    return transactions.map((tx) => {
        const descLower = tx.description.toLowerCase().trim();

        // 1) Mapa aprendido — fornecedor já visto no histórico
        const learned = bestMap.get(merchantKey(tx.description));
        if (learned) {
            const cat = slugMap.get(learned.slug);
            if (cat) {
                const conf: "high" | "medium" =
                    !learned.ambiguous && learned.confidence >= 0.8 ? "high" : "medium";
                return {
                    ...tx,
                    suggestedCategoryId: cat.id,
                    suggestedCategoryName: cat.name,
                    matchConfidence: conf,
                    matchNote: `Histórico: "${cat.name}" (${learned.votes}/${learned.total})${learned.ambiguous ? " — revisar" : ""}`,
                };
            }
        }

        // 2) Keyword rules
        for (const rule of KEYWORD_RULES) {
            const matches = rule.keywords.some((kw) => descLower.includes(kw.toLowerCase()));
            if (!matches) continue;
            if (rule.excludeKeywords && rule.excludeKeywords.some((ek) => descLower.includes(ek.toLowerCase()))) {
                continue;
            }
            const cat = slugMap.get(rule.categorySlug);
            if (cat) {
                return {
                    ...tx,
                    suggestedCategoryId: cat.id,
                    suggestedCategoryName: cat.name,
                    matchConfidence: rule.confidence,
                    matchNote: `Regra: "${cat.name}" (${cat.costCenterName})`,
                };
            }
        }

        // 3) Fuzzy contra nomes de categoria
        for (const cat of categories) {
            const catNameLower = cat.name.toLowerCase();
            if (descLower.includes(catNameLower) || catNameLower.includes(descLower)) {
                return {
                    ...tx,
                    suggestedCategoryId: cat.id,
                    suggestedCategoryName: cat.name,
                    matchConfidence: "low" as const,
                    matchNote: `Fuzzy: "${cat.name}"`,
                };
            }
        }

        // 4) Sem match
        return {
            ...tx,
            suggestedCategoryId: null,
            suggestedCategoryName: null,
            matchConfidence: "none" as const,
            matchNote: "Categoria não identificada",
        };
    });
}
