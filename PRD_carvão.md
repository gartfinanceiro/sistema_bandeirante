# PRD — Bandeirante | Carvão

**Produto:** Bandeirante | Carvão  
**Tipo:** Sistema operacional de compra e descarga de carvão  
**Status:** Definição oficial  
**Integração:** Sistema Bandeirante (Core)  
**Usuários:** Compradores, Operação de Pátio, Administrativo Operacional

---

## 1. Visão Geral do Produto

O **Bandeirante | Carvão** é um sistema operacional simples e prático para gerenciar todo o ciclo da compra de carvão, desde a negociação com fornecedores até a consolidação histórica das descargas.

O sistema nasce para substituir planilhas e controles manuais, mantendo a lógica operacional já utilizada pela siderúrgica, mas com:

- **rastreabilidade**
- **organização**
- **segurança jurídica**
- **histórico confiável**

> [!IMPORTANT]
> **Princípio-chave:** O sistema deve refletir exatamente como o processo funciona hoje — sem complexidade desnecessária.

---

## 2. Objetivos do Sistema

| Objetivo | Descrição |
|----------|-----------|
| **Organização Comercial** | Controlar negociações ativas com fornecedores |
| **Compliance Jurídico** | Centralizar documentação e contratos |
| **Agenda Operacional** | Organizar a fila diária de descarga |
| **Registro Confiável** | Criar base histórica mensal de descargas |
| **Integração** | Fornecer dados confiáveis ao Sistema Bandeirante |

---

## 3. Público e Perfis de Acesso

### Perfis de Usuário

- **Comprador**
- **Operação (Pátio)**
- **Administrativo**
- **Administrador**

### Restrições

> [!WARNING]
> Nenhum perfil tem acesso a:
> - fluxo de caixa
> - CPT
> - dados financeiros estratégicos
> 
> **O sistema não substitui o financeiro oficial**

---

## 4. Escopo do Sistema

### ✅ Está dentro do escopo

- Fornecedores
- Negociação
- Documentação
- Agenda de descarga
- Registro de descarga
- Consolidação mensal
- Exportação de dados

### ❌ Fora do escopo

- Pagamentos
- Cálculo de custo
- Estoque financeiro
- Relatórios estratégicos (ficam no core)

---

## 5. Fluxo Operacional Oficial

### Fase 1 — Prospecção e Negociação

#### Funcionalidades

- Cadastro de fornecedor
- Atribuição de comprador responsável
- Status comercial:
  - Em prospecção
  - Em negociação
  - Interessado
  - Inativo
- Registro de último contato
- Observações livres

📌 **Objetivo:**  
Dar visibilidade a quem está falando com quem e em que estágio.

---

### Fase 2 — Documentação e Compliance

#### Funcionalidades

- Checklist de documentos obrigatórios
- Upload de arquivos (PDF, imagem)
- Status documental:
  - Pendente
  - Em análise
  - Aprovado
  - Reprovado
- Upload de contrato assinado
- Datas de validade de documentos
- Bloqueio de avanço se não aprovado

> [!CAUTION]
> **Regra de Ouro:** Fornecedor não aprovado não pode agendar descarga.

---

### Fase 3 — Confirmação de Carga e Agenda de Descarga

#### Conceito

A emissão de **NF + GCA** caracteriza uma carga real apta à descarga.

#### Funcionalidades

- Agenda por data
- Ordem sequencial de descarga:
  - 1º do dia
  - 2º do dia
  - 3º do dia
  - (extensível)
- Campos:
  - Fornecedor
  - Placa do caminhão
  - Nota Fiscal
  - GCA
  - Quantidade prevista (MDC)
- Status da carga:
  - Aguardando
  - Confirmada
  - Descarregada
  - Não compareceu

📌 **Saída operacional**
- Geração automática da lista de placas do dia
- Texto pronto para envio no grupo de descarga

---

### Fase 4 — Registro da Descarga

#### Funcionalidades

- Registro pós-descarga:
  - Metragem descarregada
  - Densidade da descarga
  - Observações
- Confirmação definitiva da carga
- Bloqueio de edição após confirmação (com log)

---

### Fase 5 — Consolidação Mensal (Base Histórica)

#### Conceito

Cada descarga confirmada gera um registro histórico **imutável**.

#### Funcionalidades

- Visão por mês
- Uma linha por descarga
- Campos equivalentes à planilha atual:
  - Produtor
  - Procurador
  - Placa
  - NF
  - GCA
  - MDC
  - Densidade
  - Datas
- Exportação:
  - Excel (.xlsx)
  - CSV
- Base utilizada para relatórios anuais

> [!NOTE]
> **Importante:** Esse módulo substitui definitivamente a planilha mensal.

---

## 6. Integração com o Sistema Bandeirante (Core)

O **Bandeirante | Carvão** gera eventos operacionais, não cálculos financeiros.

### Evento principal

```typescript
DescargaConfirmada {
  data,
  fornecedor_id,
  metragem,
  densidade,
  nf,
  gca
}
```

### O Sistema Bandeirante:

- Atualiza estoque
- Usa dados para CPT
- Cruza com financeiro

---

## 7. Requisitos Não Funcionais

### Usabilidade

- Interface simples
- Poucos campos por tela
- Mobile-first (uso em pátio)

### Segurança

- Controle de acesso por perfil
- Logs de alteração
- Arquivamento seguro de documentos

### Confiabilidade

- Dados históricos imutáveis
- Backup automático
- Exportação garantida

---

## 8. Critérios de Sucesso

| Métrica | Meta |
|---------|------|
| Tempo para agendar descarga | < 1 minuto |
| Erros de ordem de descarga | 0 |
| Rastreabilidade documental | 100% |
| Substituição de planilhas | Total |

---

## 9. Observações Estratégicas

> [!TIP]
> - O sistema nasce **simples**
> - Deve crescer apenas quando a operação pedir
> - A planilha atual é o modelo mental oficial
> - O software deve respeitar isso
