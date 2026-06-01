# Plano — Fase 2: Motor de categorização preciso + auto-aprendizado

> Pré-requisitos já entregues: taxonomia consolidada (migrations 038/039) e mapa
> aprendido semeado (040). Esta fase **mexe no código do app** (não só banco).

## Objetivo
Fazer a importação categorizar com precisão usando o **mapa aprendido do histórico**
(`merchant_category_map`), e **aprender** com cada confirmação/correção sua — de modo que,
com o tempo, quase nada caia na revisão manual.

## Descoberta que motiva a mudança
No motor atual (`matchTransactionsWithCategories`), a maioria das `KEYWORD_RULES` aponta
para slugs **inexistentes** no banco (`electricity`, `water`, `maintenance`,
`health_insurance`, `pig_iron_sales`, `rent`, `legal`, `office_supplies`…). Quando o slug
não existe, a regra é silenciosamente descartada (import-actions.ts:258-259). Ou seja: hoje
o motor de keyword é majoritariamente letra morta. O mapa aprendido (98% dos fornecedores
com categoria confiante) substitui isso de forma correta.

---

## Arquivos e mudanças

### 1. `supabase/migrations/041_merchant_votes.sql` (NOVO)
**Por quê:** a tabela 040 guarda só a categoria vencedora por fornecedor (1 linha). Para
**aprender de verdade** (e poder mudar o vencedor quando você corrige), preciso de votos
**por categoria**.

- Recriar como `merchant_category_votes (merchant_key, category_slug, votes, updated_at)`
  com PK composta `(merchant_key, category_slug)`.
- Re-semear a partir das transações (contagem por par fornecedor×categoria).
- View `merchant_best_category` que devolve, por fornecedor: vencedora, votos, total e
  `confidence = votos/total` e flag `is_ambiguous = confidence < 0.60`.
- Manter RLS habilitado (política `authenticated`).
- Descartar a `merchant_category_map` da 040 (substituída).

### 2. `src/lib/financeiro/merchant-key.ts` (NOVO)
**Por quê:** a normalização do nome do fornecedor precisa ser **idêntica** em SQL e no app,
senão o lookup não bate.
- `export function merchantKey(description: string): string` →
  `lowercase` + `trim` + colapsa espaços + pega o trecho antes do primeiro `-`
  (espelha exatamente o `regexp_replace(split_part(...,'-',1))` do SQL).
- Função pura, testável.

### 3. `src/app/(authenticated)/financeiro/import-actions.ts` (EDITAR)
**3a. `matchTransactionsWithCategories` — consultar o mapa PRIMEIRO:**
- Carregar `merchant_best_category` (1 query) num Map em memória.
- Para cada transação: calcular `merchantKey(description)` e buscar no mapa.
  - achou + `confidence ≥ 0.80` e não ambíguo → `matchConfidence: "high"`, nota
    `"Histórico: <categoria> (<n> lançamentos)"`.
  - achou + ambíguo (0.60–0.80) → `matchConfidence: "medium"`.
  - não achou → cai nas `KEYWORD_RULES` (saneadas, ver 3c) → fuzzy → `none`.
- Resultado: confiança vira sinal real para auto-confirmar (F3) vs revisar.

**3b. `importSheetTransactions` — gravar aprendizado:**
- Após cada inserção bem-sucedida, com a categoria final escolhida, fazer **upsert**
  `merchant_category_votes(merchantKey(description), categoryFinal) votes += 1`
  (`source` lógico = correção/confirmação).
- Efeito: toda confirmação sua reforça o acerto; toda correção empurra o vencedor para a
  categoria certa. O sistema melhora sozinho.

**3c. Saneamento das `KEYWORD_RULES`:**
- Remover/realinhar as regras que apontam para slugs inexistentes; manter só as válidas
  como **fallback** para fornecedores novos (sem histórico). Lista de slugs válidos vem do
  banco (já temos: `energy`, `gas_industrial`, `maintenance_mech`, `freight`, `fuel`,
  `salary`, `taxes`, `bank_fees`, `sale_pig_iron`, matérias-primas…).

### 4. `src/components/financeiro/ImportFinanceiroDialog.tsx` (EDITAR — leve)
- Pré-selecionar a categoria sugerida quando `high` (você só confere).
- Mostrar a origem da sugestão ("Histórico" vs "Regra" vs "Revisar").
- **Não** construir o badge/fila completa aqui — isso é Fase 3.

---

## Fora de escopo nesta fase (ficam para a F3/F4)
- Cron diário na Vercel + badge "a revisar" no painel.
- Remoção dos módulos não usados (carvão, balança, vendas, produção, estoque).
- Tornar a importação 100% "puramente financeira" (descartar efeitos de estoque) — começa
  aqui no conceito, mas a poda dos side-effects é F4.

## Riscos e mitigações
- **Normalização divergente SQL×TS** → função única + teste com casos reais (DAE, DARF,
  Pró-labore, Atacadão…).
- **Aprendizado poluído** por uma correção errada → voto é incremental (1 erro não vira
  vencedor sozinho); ambíguos vão para revisão.
- **Mudança de comportamento na tela** → manter o override manual sempre disponível.

## Validação antes do deploy
1. `npm run build` + checagem de tipos limpos.
2. Teste a seco: rodar `matchTransactionsWithCategories` sobre abril e comparar a categoria
   sugerida com a categoria real já gravada → medir % de acerto (meta ≥ 95%).
3. Revisão sua do diff antes de qualquer deploy.

## Ordem de execução
041 (migration) → merchant-key util → engine (3a) → aprendizado (3b) → saneamento (3c) →
dialog (4) → build → teste a seco → revisão → deploy.
