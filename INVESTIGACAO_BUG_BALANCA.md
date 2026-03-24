# Investigação: Bug de OC não encontrada na Balança após pagamento no Financeiro

**Data:** 2026-03-24
**Status:** Diagnóstico completo — aguardando implementação

---

## 1. Arquivos relevantes encontrados

| Arquivo | Papel |
|---------|-------|
| [balanca/actions.ts](src/app/(authenticated)/balanca/actions.ts) | `getPurchaseOrders()` — monta "Ordens de Compra virtuais" agrupando transações por `supplier_id + material_id` |
| [balanca/import-actions.ts](src/app/(authenticated)/balanca/import-actions.ts) | `matchTicketsWithOrders()` — busca OC aberta para cada ticket da balança; `findOpenOrder()` usa `supplier_id + material_id` como chave |
| [financeiro/actions.ts](src/app/(authenticated)/financeiro/actions.ts) | `createTransaction()` — cria transação manual; resolve `material_id` e `supplier_id` |
| [financeiro/import-actions.ts](src/app/(authenticated)/financeiro/import-actions.ts) | `importSheetTransactions()` — importa transações da planilha; insere com `supplier_id`, `material_id`, `quantity` |
| [components/financeiro/ImportFinanceiroDialog.tsx](src/components/financeiro/ImportFinanceiroDialog.tsx) | UI de importação — formulário onde o usuário seleciona fornecedor e quantidade |
| [components/balanca/ImportBalancaDialog.tsx](src/components/balanca/ImportBalancaDialog.tsx) | UI de importação da Balança — upload de HTML da balança |
| [supabase/fix_missing_material_id.sql](supabase/fix_missing_material_id.sql) | Script de correção de transações sem `material_id` (problema anterior já conhecido) |

---

## 2. Modelo de dados

```
suppliers                       materials
┌──────────────────────┐       ┌──────────────────────┐
│ id (UUID)            │       │ id (UUID)            │
│ name                 │       │ name                 │
│ material_id (FK) ────┼──────→│ unit (tonelada, etc) │
│ default_price        │       │ current_stock        │
│ is_active            │       │ is_active            │
└──────────┬───────────┘       └──────────┬───────────┘
           │                              │
           │  supplier_id (FK)            │  material_id (FK)
           │                              │
           ▼                              ▼
┌─────────────────────────────────────────────────────┐
│                    transactions                      │
│ id (UUID)                                           │
│ date, amount, type ('saida'), description           │
│ category_id (slug: raw_material_ore, etc.)          │
│ status ('pendente'|'pago'|'parcial'|'cancelado')    │
│ supplier_id (FK) ← CAMPO CRÍTICO                   │
│ material_id (FK) ← CAMPO CRÍTICO                   │
│ quantity (DECIMAL) ← CAMPO CRÍTICO                  │
│ has_icms_credit, icms_rate                          │
└──────────────────────┬──────────────────────────────┘
                       │
                       │  transaction_id (FK)
                       ▼
┌─────────────────────────────────────────────────────┐
│               inbound_deliveries                     │
│ id (UUID)                                           │
│ transaction_id (FK) → transactions.id               │
│ plate, driver_name                                  │
│ weight_measured (kg), weight_fiscal (kg)             │
│ date                                                │
│ deleted_at, deleted_by, status                      │
└─────────────────────────────────────────────────────┘
```

### Como a Balança monta as "OCs"

**NÃO EXISTE uma tabela `purchase_orders`.** A "Ordem de Compra" é um **conceito virtual** montado em runtime por `getPurchaseOrders()`:

1. Busca todas as `transactions` com `type='saida'`, `material_id IS NOT NULL`, `quantity IS NOT NULL`, `quantity > 0`
2. Agrupa por `${supplier_id}_${material_id}` (groupKey)
3. Soma `quantity` de todas as transações do grupo = total contratado
4. Soma `weight_measured` de todas as `inbound_deliveries` vinculadas = total entregue
5. `remaining = total_contratado - total_entregue`
6. Se `remaining > 0.1` → `computedStatus = 'open'`

### Critérios para uma transação aparecer como OC na Balança

Uma transação **SÓ aparece** na Balança como OC se **TODOS** estes campos forem preenchidos:

- `type = 'saida'`
- `material_id IS NOT NULL`
- `quantity IS NOT NULL`
- `quantity > 0`

Se **qualquer um** desses campos estiver `NULL` ou `0`, a transação é **invisível** para a Balança.

---

## 3. Causa raiz provável

### Hipótese principal: Transação do pagamento MSM foi criada SEM `quantity` e/ou SEM `supplier_id`

**Evidência no código — [import-actions.ts:411-417](src/app/(authenticated)/financeiro/import-actions.ts#L411-L417):**

```typescript
// For raw materials: set quantity appropriately
// Charcoal: quantity=null in transaction (won't appear in Balança)
// Charcoal advance: quantity=null (volume unknown until discharge)
// Ore/Flux: quantity=value (will appear in Balança as purchase order)
const transactionQuantity = isRawMaterial && tx.quantity && !isAdvance
    ? (isCharcoal ? null : tx.quantity)
    : null;
```

Para que `quantity` seja preenchido na importação, **o usuário precisa preencher o campo `quantity` no formulário de importação**. Se o campo ficou vazio, `tx.quantity` será `null`, e a expressão `isRawMaterial && tx.quantity` será falsy → `transactionQuantity = null` → **transação invisível na Balança**.

**Cenário do bug:**

1. Usuário importa planilha com lançamento "MSM Mineração Serra da Moeda - 1.000 Ton"
2. O sistema sugere categoria "Minério de Ferro" (via keyword rule `msm mineração` → `raw_material_ore`)
3. O campo `supplierId` e `quantity` dependem de preenchimento manual pelo usuário no formulário de importação
4. Se o usuário:
   - **Selecionou o fornecedor** → `supplier_id` fica preenchido
   - **NÃO preencheu `quantity`** (1000 tons) → `transactionQuantity = null`
5. Resultado: transação criada com `material_id` preenchido mas `quantity = NULL`
6. A query da Balança filtra com `.gt("quantity", 0)` → **transação excluída**

### Trecho da query da Balança que exclui a transação — [actions.ts:51-62](src/app/(authenticated)/balanca/actions.ts#L51-L62):

```typescript
const { data: transactions, error } = await supabase
    .from("transactions")
    .select(...)
    .eq("type", "saida")
    .not("material_id", "is", null)   // ✓ material_id preenchido
    .not("quantity", "is", null)       // ✗ quantity = NULL → EXCLUÍDA
    .gt("quantity", 0)                 // ✗ quantity = NULL → EXCLUÍDA
    .order("date", { ascending: false });
```

---

## 4. Causas alternativas

### 4a. `supplier_id` não preenchido ou diferente

Se o `supplier_id` na transação do pagamento MSM for diferente do `supplier_id` esperado pela Balança, o agrupamento `${supplier_id}_${material_id}` não vai casar.

**Como verificar:** Consultar no banco:
```sql
SELECT id, supplier_id, material_id, quantity, description
FROM transactions
WHERE description ILIKE '%msm%' AND type = 'saida';
```

### 4b. `material_id` não preenchido

Se a transação foi importada antes da correção de `fix_missing_material_id.sql`, pode ter ficado com `material_id = NULL`.

**Evidência:** O arquivo [fix_missing_material_id.sql](supabase/fix_missing_material_id.sql) documenta exatamente este problema e foi criado para corrigir transações históricas.

### 4c. Matching de fornecedor por nome na importação da Balança

O módulo de importação da Balança usa **fuzzy matching por nome** para encontrar fornecedores ([import-actions.ts:170-198](src/app/(authenticated)/balanca/import-actions.ts#L170-L198)):

- Nome na OC (financeiro): possivelmente "MSM - Mineração Serra da Moeda"
- Nome no relatório da balança: possivelmente "Msm Mineração Serra Da Moeda"
- Nome no cadastro de fornecedores: depende do que foi cadastrado

O matching fuzzy é razoavelmente robusto (exact + contains + keyword), mas se o nome do fornecedor no cadastro for significativamente diferente do que aparece no relatório da balança, pode falhar.

### 4d. Transação duplicada sem os campos corretos

Se a transação foi criada manualmente (via "Nova Transação") sem selecionar fornecedor/quantidade, e depois importada novamente da planilha, o duplicate check pode ter barrado a segunda importação (correta), mantendo apenas a primeira (incompleta).

**Duplicate check — [import-actions.ts:388-404](src/app/(authenticated)/financeiro/import-actions.ts#L388-L404):**
```typescript
const { data: existing } = await supabase
    .from("transactions")
    .select("id")
    .eq("date", tx.date)
    .eq("type", tx.type)
    .eq("amount", tx.amount)
    .ilike("description", tx.description)
    .limit(1);

if (existing && existing.length > 0) {
    result.skipped++;  // ← PULA a transação mesmo que a existente esteja incompleta
    continue;
}
```

---

## 5. Impacto

### 5.1 Direto
- **Balança não encontra OC** para o fornecedor MSM → operador não consegue importar descarregamentos deste fornecedor
- Tickets da MSM aparecem como **"partial"** (fornecedor + material encontrados, mas sem OC aberta) ou até como **"matched"** com outra OC errada de outro fornecedor

### 5.2 Indireto — Qualquer transação de matéria-prima importada sem `quantity`
- O mesmo bug afeta **qualquer fornecedor** cuja transação tenha sido importada sem o campo `quantity` preenchido
- Transações manuais ("Nova Transação") também podem ter esse problema se o campo quantidade não for obrigatório na UI

### 5.3 Saldo de estoque
- Se a transação não tem `quantity`, a Balança não consegue vincular deliveries
- Deliveries não vinculadas = estoque não atualizado corretamente
- Isso explica parcialmente o problema anterior de "saldo de carvão zerado"

### 5.4 Relatórios
- O "Saldo por Fornecedor" na Balança não mostra o contratado para este fornecedor
- O dashboard de "Ordens de Recebimento" fica incompleto

---

## 6. Próximos passos recomendados

### Passo 1: Diagnóstico no banco (URGENTE)

Executar no Supabase SQL Editor:

```sql
-- A. Verificar a transação MSM específica
SELECT id, date, description, amount, quantity, material_id, supplier_id, category_id, status
FROM transactions
WHERE description ILIKE '%msm%' AND type = 'saida'
ORDER BY date DESC;

-- B. Verificar TODAS as transações de matéria-prima sem quantity
SELECT t.id, t.date, t.description, t.amount, t.quantity, t.material_id, t.supplier_id,
       s.name as supplier_name, m.name as material_name
FROM transactions t
LEFT JOIN suppliers s ON s.id = t.supplier_id
LEFT JOIN materials m ON m.id = t.material_id
WHERE t.type = 'saida'
  AND t.material_id IS NOT NULL
  AND (t.quantity IS NULL OR t.quantity = 0)
ORDER BY t.date DESC;

-- C. Verificar fornecedores MSM cadastrados
SELECT id, name, material_id FROM suppliers WHERE name ILIKE '%msm%' OR name ILIKE '%serra%';
```

### Passo 2: Correção pontual dos dados (após confirmar diagnóstico)

```sql
-- Corrigir a transação MSM (ajustar ID e quantity conforme necessário)
UPDATE transactions
SET quantity = 1000  -- 1.000 toneladas
WHERE id = '<UUID_DA_TRANSACAO_MSM>'
  AND quantity IS NULL;
```

### Passo 3: Correção em massa de transações históricas

Criar script semelhante ao `fix_missing_material_id.sql` para preencher `quantity` em transações de matéria-prima que contenham a tonelagem na descrição (ex: "1.000 Ton", "500 Ton").

### Passo 4: Tornar `quantity` obrigatório para matéria-prima na UI

**Arquivos a modificar:**

1. **[ImportFinanceiroDialog.tsx](src/components/financeiro/ImportFinanceiroDialog.tsx)** — Tornar o campo `quantity` obrigatório quando a categoria é matéria-prima (ore/flux). Validar antes de permitir importação.

2. **[TransactionDialog.tsx](src/components/financeiro/TransactionDialog.tsx)** — Mesmo tratamento para criação manual de transações.

3. **[import-actions.ts](src/app/(authenticated)/financeiro/import-actions.ts)** — Adicionar validação server-side: rejeitar transação de matéria-prima sem `quantity`.

### Passo 5: Auto-extrair tonelagem da descrição

Se a descrição contém padrões como "1.000 Ton" ou "500 T", o sistema pode sugerir automaticamente o `quantity` durante a importação. Isso reduziria erros de preenchimento.

**Regex sugerida:**
```typescript
const tonMatch = description.match(/(\d[\d.,]*)\s*(?:ton|t\b)/i);
if (tonMatch) {
    const qty = parseFloat(tonMatch[1].replace(/\./g, '').replace(',', '.'));
    // Sugerir quantity = qty
}
```

### Passo 6: Melhorar feedback na Balança

Quando a importação retorna `matchStatus = 'partial'` (fornecedor/material encontrados mas sem OC), incluir na mensagem: **"Verifique se a transação do financeiro possui quantidade (toneladas) preenchida."**

---

## Resumo executivo

| Item | Detalhe |
|------|---------|
| **Bug** | Balança não encontra OC da MSM ao importar descarregamento |
| **Causa raiz provável** | Transação no Financeiro criada sem `quantity` → invisível para a Balança |
| **Query que filtra** | `getPurchaseOrders()` exige `quantity > 0` e `material_id IS NOT NULL` |
| **Não existe** | Tabela `purchase_orders` — OCs são virtuais, montadas em runtime |
| **Não existe** | Campo `purchase_order_id` em transactions |
| **Pagamento NÃO altera** | Nenhum campo de OC — `status` é apenas estado financeiro (pago/pendente) |
| **Correção imediata** | Preencher `quantity` na transação MSM via SQL |
| **Correção definitiva** | Tornar `quantity` obrigatório para matérias-primas na UI |
