# Plano — Fase 3: Importação automática (Vercel Cron) + badge de revisão

> Decisões travadas: (1) importa tudo; incertos entram com flag de revisão / bucket
> "A Classificar"; totais sempre fecham. (2) cron acessa o banco via **service role key**
> em rota protegida por **CRON_SECRET** (você adiciona as duas no Vercel).

## Visão
Toda madrugada, um Vercel Cron chama `/api/financeiro/auto-import`, que busca a planilha do
mês corrente, categoriza pelo motor da F2 e insere (idempotente). Lançamentos confiantes
entram prontos; os incertos entram marcados `needs_review` e aparecem num **badge** no app
pra você ajustar. Importação **puramente financeira** (sem efeitos de estoque/carvão).

## Passos / arquivos

### 1. `supabase/migrations/043_review_flag.sql` (NOVO)
- `alter table public.transactions add column needs_review boolean not null default false;`
- Categoria bucket **"A Classificar"** (slug `a_classificar`, ativa) para itens sem palpite.
- Índice parcial `where needs_review` (badge é uma contagem barata).

### 2. `src/lib/supabase/admin.ts` (NOVO)
- Cliente Supabase com `SUPABASE_SERVICE_ROLE_KEY` (sem sessão, ignora RLS). Uso **somente**
  server-side, na rota do cron. Nunca exposto ao client.

### 3. `src/lib/financeiro/sheet-parser.ts` (NOVO — extração)
- Mover `SHEET_ID`, `MONTH_TABS`, `fetchSheetCSV`, `parseCSV`, `parseSpreadsheetData`,
  `MONTH_NAMES` do `ImportFinanceiroDialog.tsx` para cá (sem mudar a lógica).
- O dialog passa a importar daqui. O cron usa as mesmas funções (paridade total client/cron).

### 4. `src/app/(authenticated)/financeiro/auto-import-actions.ts` (NOVO)
- `autoImportCurrentMonth()`: descobre mês/ano em America/São_Paulo, busca+parseia a planilha,
  chama `matchTransactionsWithCategories`, e insere via **admin client**:
  - confiança `high` → categoria = palpite, `needs_review = false`, e **aprende** (vota).
  - `medium/low/none` → categoria = palpite ou `a_classificar`, `needs_review = true`, **não**
    aprende (não polui o mapa com palpite não revisado).
  - Dedup idêntico ao import atual (data+tipo+valor+descrição) → rodar todo dia é seguro.
  - Insert enxuto: date, amount, type, description, category_id, status, needs_review, notes.
- Retorna resumo {importados, marcados_revisar, pulados}.

### 5. `src/app/api/financeiro/auto-import/route.ts` (NOVO)
- `GET` protegido: confere header `Authorization: Bearer ${CRON_SECRET}`. Sem o secret → 401.
- Chama `autoImportCurrentMonth()` e responde o resumo (logado).

### 6. `vercel.json` (NOVO)
- `crons: [{ path: "/api/financeiro/auto-import", schedule: "0 8 * * *" }]` (08:00 UTC ≈ 05:00
  BRT, diário). Vercel injeta o `CRON_SECRET` no header automaticamente quando a env existe.

### 7. Badge + revisão (UI)
- **Badge**: contador de `needs_review = true` no menu/topo do Financeiro (server component
  faz `count`).
- **Revisão**: filtro "A revisar (N)" na tabela de transações; ao escolher a categoria certa,
  grava categoria + `needs_review = false` + **aprende** (vota). Reusa a tabela existente.

## Você precisa adicionar no Vercel (eu te guio)
- `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Settings → API → service_role) — SECRETA.
- `CRON_SECRET` (string aleatória).

## Riscos / mitigações
- **Chave service role vaza** → usada só em código server (rota API), nunca em `NEXT_PUBLIC_*`.
- **Cron dispara 2× / replay** → dedup idempotente protege.
- **Planilha do mês ainda vazia/incompleta** → dedup + re-execução diária preenchem
  incrementalmente; nada quebra.
- **Fuso/virada de mês** → mês calculado em America/São_Paulo.

## Validação antes do deploy
1. `npm run build` + tipos.
2. Teste manual da rota: `curl -H "Authorization: Bearer <secret>" .../api/financeiro/auto-import`
   apontando pro mês corrente, conferir resumo e o flag `needs_review` no banco.
3. Revisão do diff. Deploy só com seu OK.

## Ordem de execução
043 → admin client → extrair parser (refactor dialog) → auto-import-actions → rota →
vercel.json → badge/revisão UI → build → teste → revisão → deploy.
