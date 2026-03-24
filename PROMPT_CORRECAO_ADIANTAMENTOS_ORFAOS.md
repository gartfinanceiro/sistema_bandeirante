# Prompt para Claude Code — Correção de Adiantamentos Órfãos de Carvão

## Contexto do Problema

Existem transações financeiras de adiantamento de carvão que são criadas com sucesso na tabela `transactions`, mas o registro correspondente na tabela `carvao_advances` NÃO é criado. Isso faz com que adiantamentos "desapareçam" do módulo de controle de carvão, mesmo o dinheiro tendo saído no financeiro.

**Causa raiz identificada:** Há duas brechas no código:

### Brecha 1 — TransactionDialog.tsx (linhas 354-357)
```typescript
} else if (txResult.success) {
    // Transaction created but no ID returned - still close
    resetForm();
    onClose();
}
```
Se `createTransaction()` retorna `success: true` mas `transactionId` é `undefined` (timeout parcial do Supabase, falha no `.select("id").single()`), o dialog fecha como se tudo estivesse OK, mas `createAdvancePayment()` NUNCA é chamado. A transação fica no banco sem registro de adiantamento.

### Brecha 2 — import-actions.ts (linhas 458-476)
```typescript
if (isAdvance && insertedId) {
    try {
        await (supabase.from("carvao_advances") as any).insert({...});
    } catch (advErr) {
        result.errors.push(`"${tx.description}": Transação criada, mas erro ao registrar adiantamento`);
        console.error("Advance creation error:", advErr);
    }
}
```
Se o insert da transação funciona mas o insert do `carvao_advances` falha (user nulo, constraint violada, etc.), o erro é capturado e ignorado. A transação permanece sem o registro de adiantamento.

## Arquivos que Precisam Ser Corrigidos

1. `src/components/financeiro/TransactionDialog.tsx` — Fluxo manual de criação de adiantamento
2. `src/app/(authenticated)/financeiro/import-actions.ts` — Fluxo de importação de planilha

## O Que Precisa Ser Feito

### 1. Corrigir TransactionDialog.tsx — Eliminar a brecha do `transactionId` undefined

Na seção de adiantamento de carvão (em torno da linha 330-360), substituir o bloco que trata o caso `txResult.success && !txResult.transactionId`:

**Comportamento ATUAL (errado):**
- Se `txResult.success` mas sem `transactionId`: fecha o dialog silenciosamente (adiantamento nunca criado)

**Comportamento CORRETO:**
- Se `txResult.success` mas sem `transactionId`: mostrar erro claro ao usuário informando que a transação foi criada mas o adiantamento não foi registrado, e NÃO fechar o dialog
- A mensagem de erro deve ser algo como: "Transação criada, mas não foi possível registrar o adiantamento. ID da transação não retornado. Contacte o administrador."
- Idealmente, tentar buscar a transação recém-criada por descrição + data + valor para recuperar o ID e criar o adiantamento mesmo assim (retry)

Implementação sugerida — substituir as linhas 354-357 por:

```typescript
} else if (txResult.success) {
    // Transaction created but no ID returned — try to recover
    try {
        // Try to find the just-created transaction by matching fields
        const formDate = formData.get("date") as string;
        const formAmount = parseFloat(formData.get("amount") as string);
        const formDesc = formData.get("description") as string;

        const supabase = (await import("@/lib/supabase/client")).createBrowserClient();
        const { data: recovered } = await supabase
            .from("transactions")
            .select("id")
            .eq("date", formDate)
            .eq("amount", formAmount)
            .eq("description", formDesc)
            .eq("type", "saida")
            .order("created_at", { ascending: false })
            .limit(1);

        if (recovered && recovered.length > 0 && recovered[0].id) {
            // Recovered! Create the advance
            const advResult = await createAdvancePayment({
                advanceTransactionId: recovered[0].id,
                advanceAmount: parseFloat(amount),
                advanceDate: date,
                supplierId: selectedSupplierId || null,
                carvaoSupplierId: selectedCarvaoSupplierId || null,
                notes: description ? `Adiantamento: ${description}` : null,
            });
            if (advResult.success) {
                resetForm();
                onClose();
            } else {
                setError("Transação criada, mas erro ao registrar adiantamento: " + (advResult.error || "Erro desconhecido"));
            }
        } else {
            setError(
                "Transação criada no financeiro, mas o ID não foi retornado e não foi possível recuperá-lo. " +
                "O adiantamento NÃO foi registrado no módulo de carvão. " +
                "Verifique a transação no financeiro e registre o adiantamento manualmente."
            );
        }
    } catch (recoveryErr) {
        console.error("Recovery attempt failed:", recoveryErr);
        setError(
            "Transação criada no financeiro, mas erro ao registrar adiantamento. " +
            "Verifique a transação no financeiro e registre o adiantamento manualmente."
        );
    }
}
```

**IMPORTANTE:** Note que a recovery usa `createBrowserClient` (client-side). Verifique se existe um client browser exportado em `@/lib/supabase/client`. Se não existir, use uma server action dedicada para buscar a transação.

### 2. Corrigir import-actions.ts — Tratar falha do adiantamento como erro da transação

Na seção de importação de adiantamento (em torno das linhas 458-476):

**Comportamento ATUAL (errado):**
- Se o insert do adiantamento falha: apenas loga o erro e continua (transação fica órfã)

**Comportamento CORRETO:**
- Se o insert do adiantamento falha: **deletar a transação recém-inserida** para não deixar órfã, e reportar erro completo ao usuário
- Alternativa: fazer retry antes de deletar

Implementação sugerida — substituir o bloco try/catch:

```typescript
if (isAdvance && insertedId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: { user } } = await supabase.auth.getUser() as any;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: advError } = await (supabase.from("carvao_advances") as any).insert({
        advance_transaction_id: insertedId,
        advance_amount: tx.amount,
        advance_date: tx.date,
        supplier_id: tx.supplierId || null,
        carvao_supplier_id: tx.carvaoSupplierId || null,
        status: "adiantamento_pago",
        notes: `Adiantamento importado da planilha: ${tx.description}`,
        created_by: user?.id || null,
    });

    if (advError) {
        console.error("Advance creation error:", advError);
        // Rollback: delete the orphan transaction
        await (supabase.from("transactions") as any)
            .delete()
            .eq("id", insertedId);
        result.errors.push(
            `"${tx.description}": Erro ao registrar adiantamento de carvão (transação revertida). ` +
            `Erro: ${advError.message}`
        );
        continue; // Skip to next transaction
    }
}
```

### 3. (Opcional mas recomendado) Adicionar server action de recuperação

Criar uma nova server action em `advance-actions.ts` para recuperar adiantamentos órfãos:

```typescript
export async function recoverOrphanAdvances(): Promise<{
    found: number;
    recovered: number;
    errors: string[];
}> {
    const supabase = await createClient();
    const result = { found: 0, recovered: 0, errors: [] as string[] };

    // Find transactions that look like advances but have no carvao_advances record
    const { data: orphans } = await (supabase as any).rpc("find_orphan_advances");
    // Alternatively, raw query:
    // SELECT t.id, t.description, t.amount, t.date, t.supplier_id
    // FROM transactions t
    // WHERE t.type = 'saida' AND t.status = 'pago'
    //   AND t.category_id = 'raw_material_charcoal'
    //   AND (t.description ILIKE '%adiantamento%' OR t.notes ILIKE '%adiantamento%')
    //   AND t.id NOT IN (SELECT advance_transaction_id FROM carvao_advances WHERE advance_transaction_id IS NOT NULL)
    //   AND t.id NOT IN (SELECT complement_transaction_id FROM carvao_advances WHERE complement_transaction_id IS NOT NULL)

    // For each orphan, create the missing carvao_advances record
    // (requires manual review — could be exposed in AdvanceTrackerDialog as a warning)

    return result;
}
```

## Regras Importantes

- Manter todos os padrões existentes do projeto (Server Actions, Supabase client, Tailwind, TypeScript)
- Não quebrar funcionalidades existentes — o fluxo normal de adiantamento que funciona deve continuar igual
- O fix deve garantir atomicidade: ou cria AMBOS (transação + adiantamento) ou não cria NENHUM
- Testar com: criação manual de adiantamento, importação de adiantamento via planilha
- Não alterar a tabela `carvao_advances` nem criar migrations — a estrutura está correta, o problema é no código da aplicação
