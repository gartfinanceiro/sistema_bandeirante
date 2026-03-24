# Prompt para Claude Code — Correção da Vinculação de Contas Fixas

## Contexto do Problema

A aba "Contas Fixas" do módulo financeiro (`/financeiro`) vincula automaticamente cada conta fixa a uma transação de pagamento no mês. Porém a vinculação está errada — o sistema pega transações que não correspondem à conta fixa correta, e não há como corrigir manualmente.

**Causa raiz:** A lógica atual em `src/app/(authenticated)/financeiro/recurring-bills-actions.ts` (função `getMonthlyBillsStatus`, linhas 127-150) faz o match apenas por `category_id` + `supplier_id` + mês/ano, pegando a transação mais recente (`LIMIT 1`). Quando múltiplas contas fixas compartilham a mesma categoria (ex: duas contas de telecomunicações), o sistema não diferencia e vincula a transação errada. Além disso, não existe vínculo persistido — é recalculado a cada carregamento, impossibilitando correção manual.

## Arquivos Relevantes

- `src/app/(authenticated)/financeiro/recurring-bills-actions.ts` — Server actions (lógica de match na função `getMonthlyBillsStatus`)
- `src/components/financeiro/RecurringBillsView.tsx` — Componente da view de contas fixas
- `src/components/financeiro/RecurringBillDialog.tsx` — Dialog de criar/editar conta fixa
- `supabase/migrations/035_recurring_bills.sql` — Migration da tabela `recurring_bills`

## O Que Precisa Ser Feito

### 1. Criar tabela de vínculo `recurring_bill_payments`

Criar nova migration SQL (seguir numeração sequencial das migrations existentes em `supabase/migrations/`):

```sql
CREATE TABLE IF NOT EXISTS recurring_bill_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recurring_bill_id UUID NOT NULL REFERENCES recurring_bills(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    reference_month INTEGER NOT NULL CHECK (reference_month >= 1 AND reference_month <= 12),
    reference_year INTEGER NOT NULL CHECK (reference_year >= 2020 AND reference_year <= 2100),
    linked_at TIMESTAMPTZ DEFAULT NOW(),
    linked_by TEXT DEFAULT 'auto', -- 'auto' ou 'manual'

    -- Uma conta fixa só pode ter um pagamento por mês
    UNIQUE(recurring_bill_id, reference_month, reference_year),
    -- Uma transação só pode estar vinculada a uma conta fixa por mês
    UNIQUE(transaction_id, reference_month, reference_year)
);

CREATE INDEX idx_rbp_bill_month ON recurring_bill_payments(recurring_bill_id, reference_year, reference_month);
CREATE INDEX idx_rbp_transaction ON recurring_bill_payments(transaction_id);

-- RLS
ALTER TABLE recurring_bill_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage recurring bill payments"
    ON recurring_bill_payments FOR ALL
    TO authenticated
    USING (true) WITH CHECK (true);
```

### 2. Refatorar `getMonthlyBillsStatus` em `recurring-bills-actions.ts`

A nova lógica deve:

1. **Primeiro:** Verificar se já existe um vínculo explícito na tabela `recurring_bill_payments` para aquela conta fixa naquele mês/ano.
2. **Se existe vínculo:** Usar a transação vinculada (buscar dados da transaction pelo `transaction_id`).
3. **Se NÃO existe vínculo:** Tentar auto-match com a lógica melhorada:
   - Filtrar transações do mês com `type = 'saida'`, `status = 'pago'`
   - Filtrar por `category_id` E `supplier_id` (se definidos na conta fixa)
   - **IMPORTANTE:** Excluir transações que já estão vinculadas a OUTRA conta fixa naquele mês (fazer LEFT JOIN ou sub-query na `recurring_bill_payments`)
   - Se encontrar match, criar o vínculo automaticamente na `recurring_bill_payments` com `linked_by = 'auto'`
4. Manter a lógica de status (paid/pending/overdue) como está hoje.

### 3. Criar server actions para vincular/desvincular manualmente

Adicionar em `recurring-bills-actions.ts`:

**`linkBillToTransaction(billId, transactionId, month, year)`**
- Insere/atualiza registro em `recurring_bill_payments` com `linked_by = 'manual'`
- Deve validar que a transação existe e é do tipo saída
- Chamar `revalidatePath("/financeiro")`

**`unlinkBillTransaction(billId, month, year)`**
- Remove o registro de `recurring_bill_payments` para aquela conta/mês
- Chamar `revalidatePath("/financeiro")`

**`getAvailableTransactionsForLinking(month, year, billCategoryId?, billSupplierId?)`**
- Retorna transações do mês (type=saida, status=pago) que NÃO estão vinculadas a nenhuma conta fixa
- Filtrar opcionalmente por categoria/fornecedor para facilitar a busca
- Retornar: id, date, amount, description, category_name, supplier_name

### 4. Atualizar a UI — `RecurringBillsView.tsx`

Adicionar na listagem de cada conta fixa com status "paid":
- Mostrar um indicador se a vinculação foi automática ou manual (ícone pequeno ou badge)
- Ao clicar em uma conta paga, mostrar opção de "Desvincular pagamento"
- Ao clicar em uma conta pendente/vencida, mostrar opção de "Vincular pagamento manualmente" que abre um seletor com as transações disponíveis (usar `getAvailableTransactionsForLinking`)

### 5. Criar componente `LinkTransactionDialog.tsx`

Novo componente em `src/components/financeiro/`:
- Modal/dialog que lista transações disponíveis para vinculação
- Mostrar: data, descrição, valor, categoria, fornecedor
- Campo de busca/filtro opcional
- Botão para confirmar vinculação
- Chamar `linkBillToTransaction` ao confirmar

## Regras Importantes

- Manter o padrão existente do projeto: Server Actions, Supabase client, Tailwind, mesmos patterns de tipagem
- Não quebrar funcionalidades existentes — as contas fixas que já estão corretas devem continuar funcionando
- A auto-vinculação deve ser inteligente: se uma transação já foi vinculada a outra conta fixa, ela NÃO pode ser vinculada novamente (resolver o problema de duplicidade)
- Ao deletar uma transação vinculada, o CASCADE deve limpar o vínculo automaticamente
- Testar com: duas contas fixas na mesma categoria mas fornecedores diferentes, e duas na mesma categoria E mesmo fornecedor (o sistema deve pegar a correta ou deixar para vinculação manual)
