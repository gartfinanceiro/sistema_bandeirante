# Prompts para Claude Code — Controle de Contas Fixas Mensais

## Contexto

O sistema Financeiro precisa de um controle de contas fixas mensais (~20-25 contas).
Algumas têm valor fixo (aluguel), outras variam (energia). O controle deve:
- Mostrar checklist mensal com status pago/pendente/vencido
- Marcar automaticamente como "pago" quando a transação é criada no Financeiro
- Alertar sobre vencimentos próximos
- Ser uma nova aba dentro do Financeiro existente

A abordagem é simples: uma tabela de definição das contas fixas + query que cruza
com transactions para determinar o status mensal. SEM tabela intermediária.

---

## Prompt 1: Criar migration da tabela recurring_bills

```
Crie um novo arquivo de migration em supabase/migrations/ chamado 010_recurring_bills.sql com o seguinte conteúdo:

-- Tabela de contas fixas mensais
CREATE TABLE IF NOT EXISTS recurring_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id VARCHAR(100) REFERENCES transaction_categories(slug),
    supplier_id UUID REFERENCES suppliers(id),
    expected_amount DECIMAL(12,2),      -- Valor esperado (null = variável sem estimativa)
    is_fixed_amount BOOLEAN DEFAULT false,  -- true = valor sempre igual
    due_day INTEGER NOT NULL CHECK (due_day >= 1 AND due_day <= 31),  -- Dia do vencimento
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_recurring_bills_active ON recurring_bills(is_active) WHERE is_active = true;
CREATE INDEX idx_recurring_bills_category ON recurring_bills(category_id);

-- Seed: contas fixas comuns de uma siderúrgica (o usuário vai ajustar depois)
-- NÃO inserir dados de seed, apenas a estrutura.

-- RLS
ALTER TABLE recurring_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage recurring bills"
    ON recurring_bills FOR ALL
    TO authenticated
    USING (true) WITH CHECK (true);

Rode esta migration no Supabase SQL Editor.
Não altere nenhum outro arquivo.
```

---

## Prompt 2: Criar server actions para contas fixas

```
Crie um novo arquivo src/app/(authenticated)/financeiro/recurring-bills-actions.ts com as seguintes server actions:

"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Types
export interface RecurringBill {
    id: string;
    name: string;
    description: string | null;
    categoryId: string | null;
    categoryName: string | null;
    supplierId: string | null;
    supplierName: string | null;
    expectedAmount: number | null;
    isFixedAmount: boolean;
    dueDay: number;
    isActive: boolean;
    notes: string | null;
}

export interface MonthlyBillStatus extends RecurringBill {
    status: 'paid' | 'pending' | 'overdue';
    paidAmount: number | null;
    paidDate: string | null;
    transactionId: string | null;
    transactionDescription: string | null;
}

// 1. getRecurringBills() — lista todas as contas fixas ativas
// Query: recurring_bills JOIN transaction_categories + suppliers
// Retorna RecurringBill[]

// 2. getMonthlyBillsStatus(month: number, year: number) — status de cada conta no mês
// Para cada recurring_bill ativa:
//   - Buscar transações do mês/ano com mesmo category_id
//   - Se a conta tem supplier_id, também filtrar por supplier_id
//   - Se encontrou transação com status='pago': status = 'paid'
//   - Se não encontrou e hoje > dia de vencimento no mês: status = 'overdue'
//   - Senão: status = 'pending'
// A query deve ser:
//   SELECT t.id, t.date, t.amount, t.description, t.status
//   FROM transactions t
//   WHERE t.type = 'saida'
//     AND EXTRACT(MONTH FROM t.date) = month
//     AND EXTRACT(YEAR FROM t.date) = year
//     AND t.category_id = bill.category_id
//     AND (bill.supplier_id IS NULL OR t.supplier_id = bill.supplier_id)
//     AND t.status = 'pago'
//   ORDER BY t.date DESC LIMIT 1
// Retorna MonthlyBillStatus[]

// 3. createRecurringBill(formData: FormData) — criar nova conta fixa
// Campos: name, description, categoryId, supplierId, expectedAmount, isFixedAmount, dueDay, notes
// Insert em recurring_bills
// revalidatePath("/financeiro")

// 4. updateRecurringBill(formData: FormData) — editar conta fixa
// Mesmo que create mas com UPDATE WHERE id = formData.get("id")

// 5. deleteRecurringBill(id: string) — desativar conta fixa
// UPDATE recurring_bills SET is_active = false WHERE id = $1
// (soft delete)

// 6. getOverdueBillsCount(month: number, year: number) — conta de vencidas
// Retorna número de contas vencidas no mês (para badge de alerta)

Implemente todas as funções com tratamento de erro e tipos corretos.
Use os padrões existentes do projeto (supabase client, eslint-disable any, etc).
```

---

## Prompt 3: Criar componente RecurringBillsView

```
Crie um novo componente em src/components/financeiro/RecurringBillsView.tsx

Este componente mostra o checklist mensal de contas fixas. Deve ter:

LAYOUT:
- Seletor de mês (◄ Março 2026 ►) no topo
- Resumo: "X de Y pagas | Z vencidas | Total previsto: R$ XX.XXX"
- Lista de contas com cards compactos

CADA CARD DE CONTA:
- Ícone de status à esquerda:
  - ✅ (verde) para 'paid'
  - ⏳ (amarelo) para 'pending'
  - 🔴 (vermelho) para 'overdue'
- Nome da conta (bold)
- Categoria (small text, gray)
- Valor esperado (ou "Variável" se null)
- Se pago: valor pago + data ("R$ 45.230 — Pago em 15/02")
- Se pendente: "Vence dia {dueDay}"
- Se vencido: "Vencido (dia {dueDay})" em vermelho

BOTÕES:
- "Gerenciar Contas" (abre dialog de CRUD das contas fixas)
- Cada card tem botão "Lançar" que abre o TransactionDialog pré-preenchido
  com a categoria e fornecedor da conta

PROPS:
interface RecurringBillsViewProps {
    initialMonth: number;
    initialYear: number;
    categories: CategoryGroup[];  // Reusa do Financeiro existente
}

O componente deve chamar getMonthlyBillsStatus() ao trocar de mês.
Use os mesmos padrões visuais do Financeiro (Tailwind, cores, fontes).
Não use emojis literais — use ícones do lucide-react (CheckCircle2, Clock, AlertCircle).

IMPORTANTE: o componente deve ser "use client" e buscar dados via import dinâmico
das server actions, seguindo o padrão já usado em BalancaWorkspace.tsx.
```

---

## Prompt 4: Criar dialog de gerenciamento (CRUD) das contas fixas

```
Crie um novo componente em src/components/financeiro/RecurringBillDialog.tsx

Este é um dialog modal para criar/editar contas fixas. Campos do formulário:

- Nome (text, required) — ex: "Energia Elétrica"
- Categoria (select, required) — dropdown com as categorias existentes (agrupadas por centro de custo)
- Fornecedor (select, optional) — dropdown com fornecedores ativos
- Valor Esperado (number, optional) — valor estimado mensal
- Valor Fixo? (checkbox) — se marcado, valor é sempre igual
- Dia de Vencimento (number 1-31, required)
- Observações (textarea, optional)

Props:
interface RecurringBillDialogProps {
    isOpen: boolean;
    onClose: () => void;
    bill?: RecurringBill | null;  // null = criar, preenchido = editar
    categories: CategoryGroup[];
    suppliers: { id: string; name: string }[];
    onSave: () => void;  // callback para refresh
}

O dialog deve chamar createRecurringBill() ou updateRecurringBill() via server actions.
Inclua botão "Excluir" quando editando (chama deleteRecurringBill).
Use o mesmo estilo visual do TransactionDialog existente.
```

---

## Prompt 5: Integrar aba "Contas Fixas" no Financeiro

```
No arquivo src/app/(authenticated)/financeiro/page.tsx, adicione uma NOVA aba "Contas Fixas"
ao lado das abas existentes (Transações, Relatórios, Fiscal).

Mudanças:

1. Adicionar estado para a nova aba:
   - O estado activeTab já existe ou é controlado de alguma forma
   - Adicionar 'recurring' como valor possível

2. Adicionar botão da aba na navegação:
   - Texto: "Contas Fixas"
   - Posicionar entre "Transações" e "Relatórios"
   - Se houver contas vencidas no mês atual, mostrar um badge vermelho com o número

3. Quando a aba 'recurring' está ativa, renderizar o componente RecurringBillsView:
   <RecurringBillsView
       initialMonth={currentMonth}
       initialYear={currentYear}
       categories={categories}
   />

4. Buscar os dados necessários no page.tsx (server component):
   - Chamar getOverdueBillsCount() para o badge de alerta
   - Passar categories (já existente) para o RecurringBillsView

IMPORTANTE:
- Não altere as abas existentes (Transações, Relatórios, Fiscal)
- Não altere o layout existente
- Manter o padrão visual consistente
- Se o page.tsx usa abas como componente (ex: Tab), siga o mesmo padrão
```

---

## Prompt 6: Commit e push

```
Faça commit de todas as alterações com a mensagem:

"feat(financeiro): adicionar controle de contas fixas mensais

- Nova tabela recurring_bills para cadastro de contas fixas
- Server actions para CRUD e status mensal das contas
- RecurringBillsView com checklist mensal (pago/pendente/vencido)
- RecurringBillDialog para gerenciar contas fixas
- Nova aba 'Contas Fixas' integrada ao Financeiro
- Match automático via category_id + supplier_id + mês"

Depois faça git push.
```

---

## Como funciona o match automático

O sistema NÃO precisa de tabela intermediária. O status de cada conta fixa é calculado em tempo real:

1. Para cada `recurring_bill`, busca em `transactions` onde:
   - `type = 'saida'`
   - `category_id = bill.category_id`
   - `supplier_id = bill.supplier_id` (se definido)
   - `mês/ano = mês selecionado`
   - `status = 'pago'`

2. Se encontrou transação → **pago** (mostra valor e data)
3. Se não encontrou e hoje > vencimento → **vencido** (alerta vermelho)
4. Se não encontrou e hoje <= vencimento → **pendente** (aguardando)

Isso significa que quando o usuário lança uma transação normal no Financeiro
(ex: paga a conta de energia na categoria "Energia Elétrica"), a conta fixa
é automaticamente marcada como paga na aba Contas Fixas. Zero trabalho extra.
