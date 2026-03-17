# Prompts para Claude Code — Correção do Estoque de Carvão

Envie cada prompt abaixo separadamente ao Claude Code.

---

## Prompt 1: createTransaction deve criar inventory_movement para carvão

```
No arquivo src/app/(authenticated)/financeiro/actions.ts, na função createTransaction(), atualmente quando a transação é de carvão (category_id === "raw_material_charcoal"), o quantity é setado como null e NÃO é criado nenhum inventory_movement. Isso causa discrepância no estoque.

O problema está nas linhas 654-658 onde isCharcoal seta quantity = null, e depois o código simplesmente insere a transaction sem criar inventory_movement.

Preciso que, APÓS a inserção da transação (após o insert em "transactions"), quando isCharcoal === true E o usuário informou quantity > 0:

1. Busque o material de carvão: supabase.from("materials").select("id, current_stock").or("name.ilike.%carvão%,name.ilike.%carvao%").limit(1).single()

2. Crie um inventory_movement:
   - material_id: ID do material carvão
   - date: mesma data da transação
   - quantity: o valor de "quantity" passado pelo usuário (em m³/MDC)
   - unit_price: amount / quantity
   - total_value: amount
   - movement_type: "compra"
   - reference_id: ID da transação recém criada
   - notes: `Compra Carvão - ${quantity} MDC`

3. Atualize o current_stock do material: current_stock + quantity

IMPORTANTE:
- NÃO remova a lógica que seta transactionQuantity = null para carvão (isso é para a balança, continua correto)
- A criação do inventory_movement deve ser INDEPENDENTE do quantity na transação
- Use o parâmetro "quantity" original (antes de ser setado null) para o movimento de estoque
- Mantenha os eslint-disable comments existentes
- Não altere nenhuma outra parte do código
```

---

## Prompt 2: Garantir que finalizeAdvanceWithComplement use advance_transaction_id correto

```
No arquivo src/app/(authenticated)/financeiro/advance-actions.ts, na função finalizeAdvanceWithComplement() (linha ~478):

Há um bug na linha 539: o código faz `const advanceTxId = advance.advance_transaction_id || params.complementTransactionId` mas o SELECT na linha 491 NÃO inclui advance_transaction_id no select.

Corrija o SELECT da linha 490-492 para incluir advance_transaction_id:
.select("id, status, advance_amount, advance_transaction_id, carvao_supplier_id, supplier_id")

Isso garante que a checagem de movimento duplicado funcione corretamente, comparando com o reference_id correto.

Não altere nenhuma outra parte do código.
```

---

## Prompt 3: createTransaction deve salvar quantity para carvão na transação

```
No arquivo src/app/(authenticated)/financeiro/actions.ts, na função createTransaction():

Atualmente nas linhas 654-658, quando isCharcoal === true, o transactionQuantity é forçado para null. Isso impede que a quantidade (em m³/MDC) seja registrada na transação.

Precisamos mudar a lógica: o carvão NÃO deve aparecer na Balança (correto), mas o quantity DEVE ser salvo na transação para referência e para que o inventory_movement possa ser criado.

Altere a linha que faz:
const transactionQuantity = isCharcoal ? null : (quantity && quantity > 0 ? quantity : null);

Para:
const transactionQuantity = quantity && quantity > 0 ? quantity : null;

E para garantir que o carvão não apareça na Balança, adicione um comentário explicando que a Balança filtra por material_id + supplier_id (que são de minérios, não carvão), então o quantity no carvão não causa problemas na Balança.

Não altere nenhuma outra parte do código.
```

---

## Prompt 4: Commit e push de todas as alterações

```
Faça commit de todas as alterações pendentes com a seguinte mensagem:

"fix(carvão): criar inventory_movement ao registrar compra de carvão

- createTransaction agora cria inventory_movement para compras de carvão
- Quantity não é mais forçado null para carvão (necessário para estoque)
- Fix select em finalizeAdvanceWithComplement para incluir advance_transaction_id
- Scripts SQL de diagnóstico e correção do estoque de carvão"

Depois faça git push.
```

---

## Notas

### Fluxo esperado após as correções:

1. **Compra direta de carvão** (via Financeiro):
   - createTransaction() insere transaction COM quantity
   - createTransaction() cria inventory_movement COM quantity em m³
   - createTransaction() atualiza current_stock

2. **Adiantamento de carvão** (via Financeiro):
   - createTransaction() insere transaction (advance, sem volume ainda)
   - createAdvancePayment() cria registro em carvao_advances com status "adiantamento_pago"
   - Nenhum estoque alterado neste momento ✓

3. **Complemento de adiantamento** (diferença em aberto):
   - Se tem descarga vinculada: createComplementPayment() verifica/cria movement
   - Se não tem descarga: finalizeAdvanceWithComplement() cria movement com volume informado
   - Estoque atualizado com o volume da carga

### Sobre a Balança:
- A Balança busca transações com material_id + supplier_id + quantity > 0
- Carvão tem material_id de "Carvão Vegetal" que é diferente dos minérios
- A Balança filtra por type="saida" com material_id de minérios, então carvão não aparece
- Portanto, salvar quantity na transação de carvão NÃO afeta a Balança
