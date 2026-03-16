# Contexto Completo — Sistema Bandeirante

## Sobre o Projeto

O **Sistema Bandeirante** é um ERP para uma siderúrgica (indústria de ferro-gusa) da família do Gustavo. Ele é responsável pelo setor financeiro — pagamentos, controle de caixa, e organização das finanças. O sistema integra módulos de Financeiro, Produção, Estoque, Balança, Vendas e Carvão.

### Stack Técnica
- **Frontend/Backend**: Next.js (App Router, Server Components, Server Actions)
- **Database**: Supabase (PostgreSQL hospedado)
- **Auth**: Supabase Auth
- **Supabase URL**: `https://oiooefgucrbiwetltptc.supabase.co`
- **Supabase Project ID**: `oiooefgucrbiwetltptc`
- **Repo**: `git@github.com:gartfinanceiro/sistema_bandeirante.git` (branch: main)

### Estrutura de Pastas Principal
```
src/
├── app/
│   ├── (auth)/login/                  # Login
│   ├── (authenticated)/               # Módulos principais
│   │   ├── balanca/                   # Balança (pesagem de caminhões)
│   │   │   ├── actions.ts             # CRUD entregas, ordens de compra
│   │   │   ├── import-actions.ts      # ★ Importador de tickets da balança
│   │   │   └── page.tsx
│   │   ├── financeiro/                # Financeiro
│   │   │   ├── actions.ts             # CRUD transações, categorias, relatórios
│   │   │   ├── import-actions.ts      # ★ Importador do Google Sheets
│   │   │   ├── category-actions.ts    # Gerenciamento de categorias
│   │   │   ├── fiscal-actions.ts      # Dashboard fiscal
│   │   │   ├── fechamento/            # Fechamento de caixa
│   │   │   └── page.tsx
│   │   ├── estoque/                   # Estoque de matéria-prima
│   │   ├── producao/                  # Produção (ferro-gusa)
│   │   ├── vendas/                    # Vendas e expedição
│   │   └── dashboard/                 # Dashboard geral
│   └── (carvao)/carvao/              # Módulo Carvão (fornecedores, descargas, agenda)
├── components/
│   ├── balanca/
│   │   ├── BalancaWorkspace.tsx        # Workspace principal
│   │   ├── ImportBalancaDialog.tsx     # ★ Dialog de importação balança
│   │   └── SupplierBalance*.tsx        # Cards de saldo fornecedor
│   ├── financeiro/
│   │   ├── ImportFinanceiroDialog.tsx  # ★ Dialog de importação planilha
│   │   ├── TransactionDialog.tsx       # Dialog criar/editar transação
│   │   ├── TransactionTable.tsx        # Tabela de transações
│   │   ├── SummaryCards.tsx            # KPI cards
│   │   ├── CategoryManagerDialog.tsx   # Gerenciar categorias
│   │   ├── FinancialAnalysisView.tsx   # Relatórios (donut charts)
│   │   └── Fiscal*.tsx                 # Dashboard fiscal
│   ├── estoque/                        # Materiais e fornecedores
│   ├── vendas/                         # Contratos e expedições
│   ├── producao/                       # Produção
│   └── carvao/                         # Módulo carvão
└── types/database.ts                   # Tipos TypeScript do banco
```

## Banco de Dados (Supabase/PostgreSQL)

### Tabelas Principais

**`transactions`** — Transações financeiras
- `id` (UUID), `date`, `amount` (numeric), `type` ("entrada" | "saida"), `description`, `category_id` (FK → transaction_categories.slug ou UUID), `status` ("pendente" | "pago" | "parcial" | "cancelado"), `material_id` (FK → materials), `supplier_id`, `quantity`, `has_icms_credit`, `icms_rate`, `ofx_transaction_id`, `notes`

**`transaction_categories`** — Categorias de transação
- `id` (UUID), `cost_center_id` (FK), `name`, `slug` (ex: "raw_material_charcoal", "freight", "salary"), `description`, `examples`, `material_id`, `requires_weight`, `category_type` ("despesa" | "receita"), `display_order`, `is_active`

**`cost_centers`** — Centros de custo
- `id`, `code` ("OD" = Operacional Direto, "OI" = Operacional Indireto, "RH", "ADM", "FT" = Financeiro/Tributário), `name`, `type`, `display_order`

**`materials`** — Materiais (matéria-prima)
- `id`, `name` (Minério de Ferro, Carvão Vegetal, Fundentes, Bauxita, etc.), `unit` ("tonelada"), `current_stock`, `average_price`, `min_stock_alert`, `is_active`

**`suppliers`** — Fornecedores (balança/estoque, NÃO confundir com carvao_suppliers)
- `id`, `name`, `material_id` (FK → materials), `default_price`, `has_icms`, `icms_rate`, `is_active`

**`inbound_deliveries`** — Entregas recebidas (pesagem na balança)
- `id`, `transaction_id` (FK → transactions), `plate`, `weight_measured`, `weight_fiscal`, `driver_name`, `date`, `deleted_at`

**`inventory_movements`** — Movimentações de estoque
- `id`, `material_id`, `quantity`, `movement_type` ("compra", "consumo", "ajuste"), `reference_id`, `date`, `notes`

**`production`** — Produção diária de ferro-gusa
- `id`, `date`, `tons_produced`, `shift`, `technical_notes`

**`customers`** / **`contracts`** / **`shipments`** — Vendas e logística

**`daily_cash_closings`** — Fechamento de caixa diário

**`carvao_suppliers`** / **`carvao_discharges`** / **`carvao_discharge_schedule`** — Módulo Carvão (separado dos suppliers gerais)

### Padrão de categorias com materiais
Categorias "virtuais" são geradas dinamicamente na UI para materiais. O `categoryId` pode ser:
- Um slug real (ex: `"raw_material_charcoal"`, `"freight"`, `"salary"`)
- Um ID virtual de material (ex: `"material_UUID-DO-MATERIAL"`)

Quando começa com `material_`, o sistema:
1. Extrai o UUID do material
2. Define `material_id` na transação
3. Classifica automaticamente em `raw_material_charcoal` / `raw_material_ore` / `raw_material_flux` / `raw_material_general` baseado no nome

## Google Sheets — Planilha "Financeiro 2026"

- **ID**: `1J1KVgILegd9RDQLcMB-68I14bYpn1UqwUiFPlBxmuW0`
- **Acesso**: Público (qualquer pessoa com link pode visualizar)
- **Abas mensais**: JANEIRO, FEVEREIRO, MARÇO, ABRIL... (gid=276230667 para MARÇO)

### Estrutura da Planilha
Dias são organizados **horizontalmente** (lado a lado). Cada bloco de dia tem ~9 colunas:
- **Seção Principal** (cols 0-2): descrição, valor, situação
- **Seção Outros** (cols 3-5): descrição, valor, situação (overflow do principal)
- **Seção Carvão do dia** (cols 6-8): descrição, valor, situação

Layout de linhas por dia (~27 linhas):
- Linha 0: Header com data ("02 de Março")
- Linha 1: SALDO ANTERIOR
- Linhas 2-23: Transações
- Linha 24: Subtotal CARVÃO
- Linha 25: Subtotal OUTROS
- Linha 26: SALDO FINAL

Valores: negativos = saídas, positivos = entradas. Status: "Pago", "Pendente", etc.

A seção "Outros" é **continuação** do Principal (quando não cabem todos os pagamentos em uma coluna). A seção "Carvão do dia" é separada para melhor visualização mas deve ser importada também.

## Automações Implementadas

### Automação 1 — Importador da Balança (COMPLETO)

**Arquivos:**
- `src/app/(authenticated)/balanca/import-actions.ts` — Server actions
- `src/components/balanca/ImportBalancaDialog.tsx` — Componente UI
- `src/components/balanca/BalancaWorkspace.tsx` — Modificado (botão "Importar Balança")

**Fluxo:** Upload (.xls HTML) → Matching (fuzzy supplier/material + FIFO orders) → Review → Import → Done

**Detalhes técnicos:**
- Arquivo .xls do sistema externo é na verdade **HTML disfarçado** (começa com `<html xm`)
- Parsing client-side com `DOMParser`
- 12 colunas: Tipo Ticket, Número, Movimento, Data Entrada, Hora, Veículo, Motorista, Transportador, Origem, Destino, Carga, Peso Líquido
- Fuzzy matching de fornecedores com constraint de material (NÃO faz match sem material para evitar erros)
- FIFO order assignment para entregas
- Detecção de duplicatas por transaction_id + plate + weight + date range
- Ao importar: insere inbound_delivery + inventory_movement + atualiza materials.current_stock

### Automação 2 — Importação Google Sheets (COMPLETO)

**Arquivos:**
- `src/app/(authenticated)/financeiro/import-actions.ts` — Server actions
- `src/components/financeiro/ImportFinanceiroDialog.tsx` — Componente UI
- `src/app/(authenticated)/financeiro/page.tsx` — Modificado (botão "Importar Planilha")

**Fluxo em 3 passos:**
1. **Configuração**: Seleção de mês/aba + período de dias (ex: dia 1 até dia 13)
2. **Revisão**: Tabela agrupada por dia com dropdown editável de categoria + indicador de confiança
3. **Importação**: Processa transações selecionadas com detecção de duplicatas

**Detalhes técnicos:**
- Fetch client-side via Google Visualization API (`/gviz/tq?tqx=out:csv&sheet=NOME`)
- Parsing CSV customizado para a estrutura horizontal
- Motor de sugestão de categorias por keywords (40+ regras cobrindo matéria-prima, operacional, RH, administrativo, financeiro/tributário, receitas)
- Dropdown com todas as categorias do DB agrupadas por centro de custo
- Indicadores visuais de confiança: verde (alta), azul (média), amarelo (baixa), vermelho (sem categoria)
- Detecção de duplicatas: mesma data + tipo + valor + descrição
- Importação marca `notes = "Importação Planilha Google Sheets"` para rastreabilidade

## Padrões de Código

- **Server Actions**: `"use server"` com Supabase client via `createClient()` de `@/lib/supabase/server`
- **Client Components**: `"use client"` com estado local, chamam server actions
- **ESLint**: Usa `// eslint-disable-next-line @typescript-eslint/no-explicit-any` quando necessário (padrão do codebase)
- **Tipos Supabase**: Casts com `as any` em queries complexas (jointures, etc.)
- **Ícones**: `lucide-react`
- **Estilo**: Tailwind CSS com variáveis CSS customizadas (bg-card, text-foreground, border-border, etc.)
- **Revalidação**: `revalidatePath("/rota")` após mutações

## Workflow do Gustavo (contexto de negócio)

1. Gustavo lança pagamentos na **planilha Google Sheets** diariamente
2. Depois replica as informações no **Sistema Bandeirante** (dor principal: dupla entrada manual)
3. A planilha ajuda no processo de pagamentos e compartilhamento em tempo real com sócios
4. O sistema externo da balança gera relatórios .xls que precisam ser importados

As automações eliminam a necessidade de digitar tudo duas vezes — agora ele pode importar direto da planilha e dos relatórios da balança.

## Observação Importante sobre categorias

O Gustavo enfatizou: **"Um detalhe que acho muito relevante é eu poder conferir os lançamentos no sistema. Geralmente as categorias não são tão intuitivas."** Por isso o ImportFinanceiroDialog tem dropdowns editáveis para cada transação — ele PRECISA poder revisar e ajustar categorias antes de importar.
