# Prompts para Claude Code — Balança Consolidada por Fornecedor + Material

## Contexto da mudança

A aba Balança atualmente mostra um card individual para cada transação financeira (ex: 10 cards de Bauxita/Santo Expedito de 34t cada). Isso causa problemas no matching FIFO durante importação.

A nova abordagem: **um card único por combinação fornecedor + material**, com saldo acumulado de todas as transações. As deliveries continuam vinculadas a transações individuais (FK), mas a visualização e o matching são consolidados.

---

## Prompt 1: Refatorar getPurchaseOrders para agrupar por fornecedor + material

```
No arquivo src/app/(authenticated)/balanca/actions.ts, refatore a função getPurchaseOrders() para retornar dados AGRUPADOS por supplier_id + material_id em vez de uma linha por transação.

MUDANÇA NA INTERFACE PurchaseOrder:
A interface PurchaseOrder deve representar um GRUPO (fornecedor+material), não uma transação individual. Altere para:

export interface PurchaseOrder {
    // Chave composta para o grupo
    groupKey: string;              // `${supplierId}_${materialId}`
    id: string;                    // Mantém o ID da transação mais recente (para compatibilidade)
    transactionIds: string[];      // TODOS os IDs de transações do grupo
    date: string;                  // Data da transação MAIS RECENTE
    firstDate: string;             // Data da PRIMEIRA transação
    supplierId: string;
    supplierName: string;
    materialId: string;
    materialName: string;
    materialUnit: string;
    quantity: number;              // SOMA de todas as transações do grupo
    deliveredQuantity: number;     // SOMA de todas as deliveries do grupo
    deliveredQuantityFiscal: number | null;
    lastDeliveryDate: string | null;
    remainingQuantity: number;     // quantity - deliveredQuantity
    remainingQuantityFiscal: number | null;
    status: string;
    computedStatus: 'open' | 'completed';
    orderCount: number;            // Quantas transações compõem este grupo
}

LÓGICA:
1. Buscar todas as transações (type='saida', material_id NOT NULL, quantity > 0) — mesmo filtro atual
2. Buscar todas as deliveries para essas transações — mesmo que hoje
3. Agrupar transações por supplier_id + material_id:
   - Somar quantity de todas as transações do grupo
   - Somar weight_measured de todas as deliveries do grupo (convertendo kg→ton)
   - remaining = total_quantity - total_delivered
   - computedStatus = remaining <= 0.1 ? 'completed' : 'open'
   - Guardar todos os transactionIds no array
   - date = data mais recente, firstDate = data mais antiga
4. Ordenar: open primeiro, depois por date desc

IMPORTANTE:
- NÃO altere as funções createInboundDelivery, updateDelivery, deleteDelivery — elas continuam trabalhando com transaction_id individual
- NÃO altere getDeliveriesForTransaction — ela recebe um transaction_id individual
- Mantenha a função getSupplierBalances (ela usa getPurchaseOrders internamente)
- Adicione materialId à interface PurchaseOrder (necessário para o matching)
```

---

## Prompt 2: Criar função getDeliveriesForGroup no actions.ts

```
No arquivo src/app/(authenticated)/balanca/actions.ts, adicione uma NOVA função getDeliveriesForGroup que busca entregas de TODAS as transações de um grupo.

A função existente getDeliveriesForTransaction recebe UM transaction_id. A nova função recebe um ARRAY de transaction_ids:

export async function getDeliveriesForGroup(transactionIds: string[]): Promise<Delivery[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("inbound_deliveries")
        .select("id, date, plate, weight_measured, weight_fiscal, driver_name")
        .in("transaction_id", transactionIds)
        .is("deleted_at", null)
        .order("date", { ascending: false });

    if (error || !data) {
        console.error("Error fetching group deliveries:", error);
        return [];
    }

    return data.map((d: any) => ({
        id: d.id,
        date: d.date,
        plate: d.plate,
        weight: Number(d.weight_measured),
        weightFiscal: d.weight_fiscal ? Number(d.weight_fiscal) : null,
        driverName: d.driver_name,
    }));
}

Mantenha a função getDeliveriesForTransaction existente para compatibilidade.
```

---

## Prompt 3: Atualizar BalancaWorkspace.tsx para o modelo consolidado

```
No arquivo src/components/balanca/BalancaWorkspace.tsx, ajuste a UI para trabalhar com o novo modelo consolidado (PurchaseOrder agora representa um grupo fornecedor+material).

Mudanças necessárias:

1. Na função loadDeliveries(orderId), trocar para usar getDeliveriesForGroup:
   - Antes: getDeliveriesForTransaction(orderId)
   - Agora: getDeliveriesForGroup(selectedOrder.transactionIds)
   - Importar getDeliveriesForGroup de actions

2. No card da lista (linha ~209), ajustar o display:
   - Mostrar quantidade de ordens: ex "(3 compras)" se orderCount > 1
   - Usar firstDate para "Desde dd/mm" e lastDeliveryDate para "Última dd/mm"

3. Na criação manual de delivery (handleSubmit), quando selectedOrder é um grupo:
   - O createInboundDelivery precisa de UM transactionId
   - Usar a PRIMEIRA transação aberta do grupo (que tenha saldo):
     Buscar a primeira transação do transactionIds que ainda tenha capacidade.
     Por simplicidade, usar selectedOrder.transactionIds[0] (a mais antiga) é suficiente.
     O id do grupo (selectedOrder.id) já é a transação mais recente, mas para FIFO devemos usar a mais antiga.
   - Adicionar uma propriedade oldestOpenTransactionId ao PurchaseOrder no Prompt 1 para este fim.

4. Ajustar o texto dos cards:
   - Em vez de "Saldo: X t" e "Total: Y t", manter igual mas agora representam o total do grupo
   - Se orderCount > 1, mostrar "(X compras)" ao lado do nome do material

NÃO altere o formulário de pesagem em si (campos, layout). Apenas ajuste a lógica de binding.
```

---

## Prompt 4: Ajustar matching da importação para modelo consolidado

```
No arquivo src/app/(authenticated)/balanca/import-actions.ts, ajuste a função de matching (matchTicketsWithOrders / findOpenOrder) para o modelo consolidado.

O matching atual busca a primeira transação individual com saldo para aquele supplier+material. Com o modelo consolidado, o matching fica MAIS SIMPLES:

1. Na função matchTicketsWithOrders, ao buscar ordens abertas:
   - Agrupar por supplier_id + material_id (mesmo que getPurchaseOrders)
   - Verificar se o grupo tem saldo > 0 (total comprado - total entregue > 0)

2. Ao importar (importMatchedTickets), a delivery ainda precisa vincular a um transaction_id específico:
   - Pegar a transação MAIS ANTIGA do grupo que ainda tenha capacidade (FIFO dentro do grupo)
   - Se a transação mais antiga já está cheia, ir para a próxima
   - Isso distribui as deliveries uniformemente entre as transações do grupo

3. Especificamente, refatore findOpenOrder / o loop de matching:
   - ANTES: procurava uma transação individual com remaining > 0
   - AGORA: procura um GRUPO (supplier+material) com remaining > 0
     - Se o grupo tem saldo, pega a primeira transação do grupo com capacidade
     - Se nenhuma transação individual tem capacidade mas o grupo tem saldo (overflow),
       usa a transação mais recente (permite delivery > remaining individual, pois o grupo aceita)

O ponto-chave: o matching decide se aceita o ticket baseado no SALDO DO GRUPO, não da transação individual. Isso resolve o problema da Bauxita onde cada ordem era de 34t mas o caminhão traz ~32t (e o segundo caminhão precisa ir para a próxima ordem, não para os 2t restantes da primeira).

Não altere o parser de tickets nem o fuzzy matching de fornecedor/material.
```

---

## Prompt 5: Commit e push

```
Faça commit de todas as alterações com a mensagem:

"refactor(balança): consolidar ordens por fornecedor + material

- getPurchaseOrders agora agrupa transações por supplier_id + material_id
- Card único por combinação fornecedor/material com saldo acumulado
- getDeliveriesForGroup busca entregas de todas transações do grupo
- Matching de importação usa saldo do grupo (não da transação individual)
- UI ajustada para mostrar dados consolidados"

Depois faça git push.
```

---

## Ordem de execução

Envie os prompts na sequência 1 → 2 → 3 → 4 → 5. Cada um depende do anterior.
Após o prompt 4, teste a importação com um relatório da balança para validar que o matching funciona.
