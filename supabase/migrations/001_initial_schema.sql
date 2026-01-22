-- =============================================================================
-- SISTEMA BANDEIRANTE - Gusa Intelligence
-- Migração Inicial: Schema Completo
-- Versão: 1.0.0
-- Data: 2026-01-21
-- =============================================================================
-- 
-- Este script cria toda a fundação de dados para o Sistema Bandeirante,
-- um ERP simplificado para gestão de siderurgia de ferro-gusa.
--
-- IMPORTANTE: Execute este script no Editor SQL do Supabase.
-- =============================================================================


-- =============================================================================
-- SEÇÃO 1: TIPOS ENUMERADOS (ENUMs)
-- =============================================================================

-- Tipo de transação financeira
CREATE TYPE transaction_type AS ENUM (
  'entrada',   -- Receitas, pagamentos recebidos
  'saida'      -- Despesas, pagamentos efetuados
);

-- Status do contrato de venda
CREATE TYPE contract_status AS ENUM (
  'ativo',      -- Contrato em execução
  'pausado',    -- Contrato temporariamente suspenso
  'encerrado'   -- Contrato finalizado ou cancelado
);

-- Status logístico da expedição (shipments)
-- Segue o fluxo: Em Usina -> Em Trânsito -> Entregue -> Aguardando Pagamento -> Finalizado
CREATE TYPE logistics_status AS ENUM (
  'em_usina',              -- Gusa produzido, aguardando expedição
  'em_transito',           -- Caminhão a caminho do terminal
  'entregue',              -- Descarga confirmada no terminal
  'aguardando_pagamento',  -- Dentro do prazo de pagamento (D+1)
  'finalizado'             -- Pagamento confirmado
);

-- Status do pagamento de transações
CREATE TYPE payment_status AS ENUM (
  'pendente',     -- Aguardando pagamento
  'pago',         -- Pago integralmente
  'parcial',      -- Pago parcialmente
  'cancelado'     -- Cancelado
);

-- Unidades de medida para materiais
CREATE TYPE unit_type AS ENUM (
  'tonelada', -- t
  'm3',       -- metros cúbicos (carvão)
  'unidade',  -- peças, itens
  'litro'     -- combustíveis
);

-- Tipos de centro de custo (classificação macro)
CREATE TYPE cost_center_type AS ENUM (
  'operacional_direto',   -- Impacta CPT diretamente
  'operacional_indireto', -- Manutenção, consumíveis
  'recursos_humanos',     -- Folha e benefícios
  'administrativo',       -- Serviços, taxas, TI
  'financeiro_tributario',-- Tarifas, impostos, juros
  'nao_operacional'       -- Não reflete eficiência (sócios, investimentos)
);


-- =============================================================================
-- SEÇÃO 2: TABELAS CORE (Materiais, Centros de Custo, Categorias)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabela: materials
-- Cadastro de matérias-primas e materiais controlados em estoque
-- -----------------------------------------------------------------------------
CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  unit unit_type NOT NULL,
  default_icms_rate DECIMAL(5, 2) DEFAULT 0,  -- Alíquota padrão de ICMS (%)
  current_stock DECIMAL(15, 3) DEFAULT 0,      -- Saldo atual na unidade
  average_price DECIMAL(15, 2) DEFAULT 0,      -- Preço médio ponderado
  min_stock_alert DECIMAL(15, 3) DEFAULT 0,    -- Nível mínimo para alerta
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE materials IS 'Cadastro de matérias-primas e materiais com controle de estoque';
COMMENT ON COLUMN materials.current_stock IS 'Saldo atual na unidade definida (tons, m³, etc)';
COMMENT ON COLUMN materials.average_price IS 'Preço médio ponderado móvel';

-- -----------------------------------------------------------------------------
-- Tabela: cost_centers
-- Centros de custo macro para classificação de despesas
-- -----------------------------------------------------------------------------
CREATE TABLE cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) NOT NULL UNIQUE,  -- Código curto (ex: "OD", "OI", "RH")
  name VARCHAR(100) NOT NULL,
  type cost_center_type NOT NULL,
  description TEXT,
  affects_cpt BOOLEAN DEFAULT false, -- Se impacta o Custo por Tonelada
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE cost_centers IS 'Centros de custo para categorização de despesas';
COMMENT ON COLUMN cost_centers.affects_cpt IS 'TRUE se este centro impacta o cálculo de CPT';

-- -----------------------------------------------------------------------------
-- Tabela: transaction_categories
-- Subcategorias de transações financeiras, vinculadas a centros de custo
-- -----------------------------------------------------------------------------
CREATE TABLE transaction_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_center_id UUID NOT NULL REFERENCES cost_centers(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  examples TEXT,  -- Exemplos de uso (para ajudar no tagueamento)
  material_id UUID REFERENCES materials(id) ON DELETE SET NULL, -- Se vinculado a um material (carvão, minério)
  requires_weight BOOLEAN DEFAULT false, -- Se exige preenchimento de peso
  default_icms_rate DECIMAL(5, 2),       -- Alíquota ICMS padrão
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(cost_center_id, name)
);

COMMENT ON TABLE transaction_categories IS 'Subcategorias de transações vinculadas a centros de custo';
COMMENT ON COLUMN transaction_categories.requires_weight IS 'TRUE se a transação exige registro de peso (insumos)';


-- =============================================================================
-- SEÇÃO 3: TABELAS FINANCEIRAS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabela: transactions
-- Lançamentos de receitas e despesas (fluxo de caixa)
-- -----------------------------------------------------------------------------
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Dados básicos
  date DATE NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  type transaction_type NOT NULL,
  description TEXT,
  
  -- Categorização
  category_id UUID REFERENCES transaction_categories(id) ON DELETE SET NULL,
  
  -- Status e controle
  status payment_status DEFAULT 'pago',
  due_date DATE,                        -- Data de vencimento (se pendente)
  
  -- Integração com industrial (insumos)
  weight_linked DECIMAL(15, 3),         -- Peso vinculado (tons ou m³)
  material_id UUID REFERENCES materials(id) ON DELETE SET NULL,
  
  -- Gestão tributária
  has_icms_credit BOOLEAN DEFAULT false,
  icms_rate DECIMAL(5, 2),
  icms_value DECIMAL(15, 2),            -- Valor recuperável de ICMS
  
  -- Rastreabilidade OFX
  ofx_transaction_id VARCHAR(100),
  ofx_imported_at TIMESTAMPTZ,
  bank_memo TEXT,                        -- Descrição original do banco
  
  -- Vinculação com vendas (quando type = 'entrada' de contrato)
  shipment_id UUID,  -- Será FK após criar shipments
  
  -- Metadados
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_ofx ON transactions(ofx_transaction_id);

COMMENT ON TABLE transactions IS 'Lançamentos financeiros de receitas e despesas';
COMMENT ON COLUMN transactions.weight_linked IS 'Peso do insumo vinculado (obrigatório para categorias de insumos)';
COMMENT ON COLUMN transactions.icms_value IS 'Valor de ICMS recuperável calculado automaticamente';

-- -----------------------------------------------------------------------------
-- Tabela: daily_cash_closings
-- Fechamento de caixa diário com snapshot de saldos
-- Implementa a "Regra de Ouro": Saldo Final Real (D-1) = Saldo Inicial (D)
-- -----------------------------------------------------------------------------
CREATE TABLE daily_cash_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  date DATE NOT NULL UNIQUE,  -- Uma linha por dia
  
  -- Saldos do dia
  opening_balance DECIMAL(15, 2) NOT NULL,      -- Herdado do dia anterior
  total_entries DECIMAL(15, 2) DEFAULT 0,       -- Soma de entradas do dia
  total_exits DECIMAL(15, 2) DEFAULT 0,         -- Soma de saídas do dia
  calculated_closing DECIMAL(15, 2) NOT NULL,   -- opening + entries - exits
  real_closing DECIMAL(15, 2),                  -- Informado pelo gestor
  
  -- Diferença e justificativa
  difference DECIMAL(15, 2) GENERATED ALWAYS AS (real_closing - calculated_closing) STORED,
  difference_percent DECIMAL(5, 2) GENERATED ALWAYS AS (
    CASE 
      WHEN calculated_closing = 0 THEN 0
      ELSE ROUND(((real_closing - calculated_closing) / ABS(calculated_closing)) * 100, 2)
    END
  ) STORED,
  difference_notes TEXT,  -- Justificativa obrigatória se diferença > limite
  
  -- Controle
  is_closed BOOLEAN DEFAULT false,  -- TRUE quando gestor confirma fechamento
  closed_by UUID REFERENCES auth.users(id),
  closed_at TIMESTAMPTZ,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_daily_cash_date ON daily_cash_closings(date DESC);
CREATE INDEX idx_daily_cash_closed ON daily_cash_closings(is_closed);

COMMENT ON TABLE daily_cash_closings IS 'Snapshot diário do caixa para conciliação e rastreabilidade';
COMMENT ON COLUMN daily_cash_closings.opening_balance IS 'Saldo inicial herdado automaticamente do real_closing do dia anterior';
COMMENT ON COLUMN daily_cash_closings.calculated_closing IS 'Saldo calculado: opening + entries - exits';
COMMENT ON COLUMN daily_cash_closings.real_closing IS 'Saldo real informado pelo gestor na conferência';


-- =============================================================================
-- SEÇÃO 4: TABELAS INDUSTRIAIS (Produção e Estoque)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabela: production
-- Registro diário de produção de ferro-gusa
-- -----------------------------------------------------------------------------
CREATE TABLE production (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  tons_produced DECIMAL(15, 3) NOT NULL,
  shift VARCHAR(20),                    -- Turno (opcional)
  technical_notes TEXT,                 -- Observações técnicas
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_production_date ON production(date);

COMMENT ON TABLE production IS 'Registro de produção diária de ferro-gusa';

-- -----------------------------------------------------------------------------
-- Tabela: inventory_movements
-- Histórico de movimentações de estoque (entradas e baixas)
-- -----------------------------------------------------------------------------
CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  date DATE NOT NULL,
  quantity DECIMAL(15, 3) NOT NULL,     -- Positivo = entrada, Negativo = saída
  unit_price DECIMAL(15, 2),
  total_value DECIMAL(15, 2),
  movement_type VARCHAR(50) NOT NULL,    -- 'compra', 'consumo_producao', 'ajuste', 'venda'
  reference_id UUID,                     -- ID da transação, produção ou shipment relacionado
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inventory_mov_material ON inventory_movements(material_id);
CREATE INDEX idx_inventory_mov_date ON inventory_movements(date);

COMMENT ON TABLE inventory_movements IS 'Histórico de todas as movimentações de estoque';

-- -----------------------------------------------------------------------------
-- Tabela: settings
-- Configurações do sistema (parâmetros técnicos e metas)
-- -----------------------------------------------------------------------------
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir configurações iniciais
INSERT INTO settings (key, value, description) VALUES
  ('coal_consumption_index', '0.85'::jsonb, 'Índice de consumo de carvão: tons de carvão por ton de gusa'),
  ('monthly_production_goal', '{"tons": 3000}'::jsonb, 'Meta de produção mensal em toneladas'),
  ('estimated_fixed_costs', '{"value": 500000}'::jsonb, 'Custos fixos mensais estimados em R$'),
  ('cash_difference_alert_percent', '1'::jsonb, 'Limite percentual para alerta de diferença no fechamento de caixa'),
  ('transport_loss_alert_percent', '1'::jsonb, 'Limite percentual para alerta de quebra de transporte'),
  ('initial_cash_balance', '{"value": 0, "date": null}'::jsonb, 'Saldo inicial de implantação do sistema');

COMMENT ON TABLE settings IS 'Parâmetros configuráveis do sistema';


-- =============================================================================
-- SEÇÃO 5: TABELAS COMERCIAIS (Clientes, Contratos, Expedições)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabela: customers
-- Cadastro de clientes/compradores de ferro-gusa
-- -----------------------------------------------------------------------------
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  legal_name VARCHAR(200),              -- Razão Social
  document VARCHAR(20),                 -- CNPJ
  terminal_address TEXT,                -- Endereço do terminal de descarga
  city VARCHAR(100),
  state VARCHAR(2),
  contact_name VARCHAR(100),
  contact_phone VARCHAR(20),
  contact_email VARCHAR(100),
  payment_terms TEXT,                   -- Condições de pagamento preferenciais
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE customers IS 'Cadastro de clientes compradores de ferro-gusa';

-- -----------------------------------------------------------------------------
-- Tabela: contracts
-- Contratos de fornecimento de ferro-gusa
-- Representa o acordo macro de entrega ao longo de um período
-- -----------------------------------------------------------------------------
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação
  contract_number VARCHAR(50) UNIQUE,   -- Número do contrato (gerado ou manual)
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  
  -- Termos comerciais
  contracted_quantity DECIMAL(15, 3) NOT NULL,  -- Volume total acordado (tons)
  price_per_ton DECIMAL(15, 2) NOT NULL,        -- Preço unitário (R$/ton)
  total_value DECIMAL(15, 2) GENERATED ALWAYS AS (contracted_quantity * price_per_ton) STORED,
  
  -- Vigência
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status contract_status DEFAULT 'ativo',
  
  -- Pagamento
  payment_terms TEXT,                   -- Ex: "D+1 após descarga"
  payment_days INT DEFAULT 1,           -- Prazo em dias após entrega
  
  -- Métricas calculadas (atualizadas por triggers)
  delivered_quantity DECIMAL(15, 3) DEFAULT 0,  -- Total já expedido
  remaining_quantity DECIMAL(15, 3) GENERATED ALWAYS AS (contracted_quantity - delivered_quantity) STORED,
  completion_percent DECIMAL(5, 2) GENERATED ALWAYS AS (
    CASE 
      WHEN contracted_quantity = 0 THEN 0
      ELSE ROUND((delivered_quantity / contracted_quantity) * 100, 2)
    END
  ) STORED,
  invoiced_value DECIMAL(15, 2) DEFAULT 0,      -- Valor já faturado
  pending_value DECIMAL(15, 2) GENERATED ALWAYS AS ((contracted_quantity * price_per_ton) - invoiced_value) STORED,
  
  -- Notas
  notes TEXT,
  
  -- Metadados
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Validação
  CONSTRAINT check_dates CHECK (end_date >= start_date),
  CONSTRAINT check_quantity CHECK (contracted_quantity > 0),
  CONSTRAINT check_price CHECK (price_per_ton > 0)
);

CREATE INDEX idx_contracts_customer ON contracts(customer_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_dates ON contracts(start_date, end_date);

COMMENT ON TABLE contracts IS 'Contratos de fornecimento de ferro-gusa com clientes';
COMMENT ON COLUMN contracts.delivered_quantity IS 'Quantidade total já expedida (atualizado por trigger)';
COMMENT ON COLUMN contracts.remaining_quantity IS 'Saldo a entregar: contratado - expedido';

-- -----------------------------------------------------------------------------
-- Tabela: shipments
-- Expedições / Romaneios de saída ("puxadas")
-- Cada registro representa uma viagem de caminhão da usina ao terminal
-- -----------------------------------------------------------------------------
CREATE TABLE shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Vinculação
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
  
  -- Identificação da viagem
  departure_date TIMESTAMPTZ NOT NULL,  -- Data/hora de saída da usina
  truck_plate VARCHAR(20) NOT NULL,     -- Placa do caminhão
  driver_name VARCHAR(100),
  
  -- Pesos (balança)
  weight_origin DECIMAL(15, 3) NOT NULL,  -- Peso na saída (balança usina) - tons
  weight_destination DECIMAL(15, 3),       -- Peso na chegada (balança terminal) - tons
  
  -- Quebra de transporte (calculada por trigger)
  transport_loss DECIMAL(15, 3),           -- Diferença: origin - destination
  transport_loss_percent DECIMAL(5, 2),    -- Percentual de quebra
  
  -- Valor da carga
  unit_price DECIMAL(15, 2),              -- Preço/ton do contrato (snapshot)
  total_value DECIMAL(15, 2),             -- Valor total da carga
  
  -- Status logístico
  status logistics_status DEFAULT 'em_usina',
  
  -- Datas do fluxo
  delivery_date TIMESTAMPTZ,             -- Data de entrega no terminal
  payment_due_date DATE,                 -- Data prevista de pagamento
  payment_date DATE,                     -- Data efetiva de pagamento
  
  -- Transação financeira vinculada (quando pago)
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  
  -- Notas
  notes TEXT,
  
  -- Metadados
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shipments_contract ON shipments(contract_id);
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_date ON shipments(departure_date DESC);
CREATE INDEX idx_shipments_payment ON shipments(payment_date);

COMMENT ON TABLE shipments IS 'Expedições de ferro-gusa (romaneios/puxadas)';
COMMENT ON COLUMN shipments.weight_origin IS 'Peso aferido na balança da usina (saída)';
COMMENT ON COLUMN shipments.weight_destination IS 'Peso aferido na balança do terminal (chegada)';
COMMENT ON COLUMN shipments.transport_loss IS 'Quebra de transporte: peso_origem - peso_destino';

-- Adicionar FK de transactions para shipments (referência circular)
ALTER TABLE transactions 
  ADD CONSTRAINT fk_transactions_shipment 
  FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE SET NULL;


-- =============================================================================
-- SEÇÃO 6: FUNÇÕES E TRIGGERS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Função: Atualizar timestamp de updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em todas as tabelas relevantes
CREATE TRIGGER update_materials_updated_at
  BEFORE UPDATE ON materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shipments_updated_at
  BEFORE UPDATE ON shipments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_cash_updated_at
  BEFORE UPDATE ON daily_cash_closings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- Função: Calcular quebra de transporte automaticamente
-- Atualiza os campos transport_loss e transport_loss_percent quando ambos
-- os pesos (origin e destination) estiverem preenchidos
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_transport_loss()
RETURNS TRIGGER AS $$
BEGIN
  -- Só calcula se ambos os pesos estiverem preenchidos
  IF NEW.weight_origin IS NOT NULL AND NEW.weight_destination IS NOT NULL THEN
    -- Calcular perda absoluta
    NEW.transport_loss := NEW.weight_origin - NEW.weight_destination;
    
    -- Calcular percentual de perda
    IF NEW.weight_origin > 0 THEN
      NEW.transport_loss_percent := ROUND(
        ((NEW.weight_origin - NEW.weight_destination) / NEW.weight_origin) * 100, 
        2
      );
    ELSE
      NEW.transport_loss_percent := 0;
    END IF;
  ELSE
    NEW.transport_loss := NULL;
    NEW.transport_loss_percent := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_transport_loss
  BEFORE INSERT OR UPDATE OF weight_origin, weight_destination ON shipments
  FOR EACH ROW EXECUTE FUNCTION calculate_transport_loss();

COMMENT ON FUNCTION calculate_transport_loss() IS 
  'Calcula automaticamente a quebra de transporte quando os pesos de origem e destino são informados';

-- -----------------------------------------------------------------------------
-- Função: Atualizar estoque de gusa (product finished) ao criar expedição
-- Quando um shipment é criado com status 'em_transito', baixa o estoque
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_gusa_stock_on_shipment()
RETURNS TRIGGER AS $$
DECLARE
  gusa_material_id UUID;
BEGIN
  -- Encontrar o material "Ferro-Gusa" (produto acabado)
  SELECT id INTO gusa_material_id 
  FROM materials 
  WHERE LOWER(name) LIKE '%gusa%' OR LOWER(name) LIKE '%ferro-gusa%'
  LIMIT 1;
  
  -- Se não encontrar, não faz nada
  IF gusa_material_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Quando shipment é criado ou muda para 'em_transito', baixar estoque
  IF TG_OP = 'INSERT' AND NEW.status IN ('em_usina', 'em_transito') THEN
    -- Baixar estoque (valor negativo)
    UPDATE materials 
    SET current_stock = current_stock - NEW.weight_origin
    WHERE id = gusa_material_id;
    
    -- Registrar movimentação
    INSERT INTO inventory_movements (
      material_id, date, quantity, movement_type, reference_id, notes
    ) VALUES (
      gusa_material_id,
      NEW.departure_date::date,
      -NEW.weight_origin,
      'venda',
      NEW.id,
      'Expedição: ' || NEW.truck_plate
    );
  END IF;
  
  -- Se status mudar de 'em_usina' para 'em_transito' e não tinha baixado antes
  IF TG_OP = 'UPDATE' AND OLD.status = 'em_usina' AND NEW.status = 'em_transito' THEN
    -- Verificar se já não foi baixado
    IF NOT EXISTS (
      SELECT 1 FROM inventory_movements 
      WHERE reference_id = NEW.id AND movement_type = 'venda'
    ) THEN
      UPDATE materials 
      SET current_stock = current_stock - NEW.weight_origin
      WHERE id = gusa_material_id;
      
      INSERT INTO inventory_movements (
        material_id, date, quantity, movement_type, reference_id, notes
      ) VALUES (
        gusa_material_id,
        NEW.departure_date::date,
        -NEW.weight_origin,
        'venda',
        NEW.id,
        'Expedição: ' || NEW.truck_plate
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_gusa_stock
  AFTER INSERT OR UPDATE OF status ON shipments
  FOR EACH ROW EXECUTE FUNCTION update_gusa_stock_on_shipment();

COMMENT ON FUNCTION update_gusa_stock_on_shipment() IS 
  'Baixa automaticamente o estoque de ferro-gusa quando uma expedição é criada ou enviada';

-- -----------------------------------------------------------------------------
-- Função: Atualizar quantidade entregue no contrato
-- Mantém o campo delivered_quantity sincronizado com os shipments
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_contract_delivered_quantity()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalcular a quantidade total entregue do contrato
  UPDATE contracts
  SET delivered_quantity = (
    SELECT COALESCE(SUM(
      CASE 
        WHEN weight_destination IS NOT NULL THEN weight_destination
        ELSE weight_origin
      END
    ), 0)
    FROM shipments
    WHERE contract_id = COALESCE(NEW.contract_id, OLD.contract_id)
      AND status NOT IN ('em_usina')  -- Considera a partir de em_transito
  )
  WHERE id = COALESCE(NEW.contract_id, OLD.contract_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_contract_delivery
  AFTER INSERT OR UPDATE OR DELETE ON shipments
  FOR EACH ROW EXECUTE FUNCTION update_contract_delivered_quantity();

COMMENT ON FUNCTION update_contract_delivered_quantity() IS 
  'Mantém a quantidade entregue do contrato sincronizada com as expedições';

-- -----------------------------------------------------------------------------
-- Função: Preencher valores automáticos do shipment baseado no contrato
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fill_shipment_from_contract()
RETURNS TRIGGER AS $$
DECLARE
  contract_price DECIMAL(15, 2);
  contract_payment_days INT;
BEGIN
  -- Buscar dados do contrato
  SELECT price_per_ton, payment_days 
  INTO contract_price, contract_payment_days
  FROM contracts 
  WHERE id = NEW.contract_id;
  
  -- Preencher preço unitário (snapshot do contrato)
  IF NEW.unit_price IS NULL THEN
    NEW.unit_price := contract_price;
  END IF;
  
  -- Calcular valor total da carga
  NEW.total_value := NEW.weight_origin * NEW.unit_price;
  
  -- Calcular data prevista de pagamento quando entregue
  IF NEW.delivery_date IS NOT NULL AND NEW.payment_due_date IS NULL THEN
    NEW.payment_due_date := (NEW.delivery_date::date + contract_payment_days);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_fill_shipment_values
  BEFORE INSERT OR UPDATE ON shipments
  FOR EACH ROW EXECUTE FUNCTION fill_shipment_from_contract();

-- -----------------------------------------------------------------------------
-- Função: Calcular ICMS na transação
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_transaction_icms()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.has_icms_credit = true AND NEW.icms_rate IS NOT NULL AND NEW.icms_rate > 0 THEN
    NEW.icms_value := ROUND(NEW.amount * (NEW.icms_rate / 100), 2);
  ELSE
    NEW.icms_value := 0;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_icms
  BEFORE INSERT OR UPDATE OF amount, has_icms_credit, icms_rate ON transactions
  FOR EACH ROW EXECUTE FUNCTION calculate_transaction_icms();

-- -----------------------------------------------------------------------------
-- Função: Atualizar estoque ao registrar transação de compra de insumos
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_stock_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Somente para transações de saída (compras) com material e peso vinculados
  IF NEW.type = 'saida' AND NEW.material_id IS NOT NULL AND NEW.weight_linked IS NOT NULL THEN
    -- Atualizar estoque do material
    UPDATE materials
    SET 
      current_stock = current_stock + NEW.weight_linked,
      -- Recalcular preço médio ponderado
      average_price = CASE 
        WHEN current_stock + NEW.weight_linked > 0 THEN
          ROUND(
            ((current_stock * average_price) + NEW.amount) / (current_stock + NEW.weight_linked),
            2
          )
        ELSE average_price
      END
    WHERE id = NEW.material_id;
    
    -- Registrar movimentação
    INSERT INTO inventory_movements (
      material_id, date, quantity, unit_price, total_value, movement_type, reference_id, notes
    ) VALUES (
      NEW.material_id,
      NEW.date,
      NEW.weight_linked,
      ROUND(NEW.amount / NULLIF(NEW.weight_linked, 0), 2),
      NEW.amount,
      'compra',
      NEW.id,
      NEW.description
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stock_on_transaction
  AFTER INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_stock_on_transaction();


-- =============================================================================
-- SEÇÃO 7: ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_cash_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE production ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

-- Política: Acesso total para usuários autenticados
-- (Sistema interno de gestão - todos os gestores têm acesso completo)

CREATE POLICY "Authenticated users have full access to materials"
  ON materials FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users have full access to cost_centers"
  ON cost_centers FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users have full access to transaction_categories"
  ON transaction_categories FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users have full access to transactions"
  ON transactions FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users have full access to daily_cash_closings"
  ON daily_cash_closings FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users have full access to production"
  ON production FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users have full access to inventory_movements"
  ON inventory_movements FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users have full access to settings"
  ON settings FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users have full access to customers"
  ON customers FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users have full access to contracts"
  ON contracts FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users have full access to shipments"
  ON shipments FOR ALL USING (auth.role() = 'authenticated');


-- =============================================================================
-- SEÇÃO 8: SEED DATA
-- Dados iniciais conforme PRD Seção 3.1
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Centros de Custo
-- -----------------------------------------------------------------------------
INSERT INTO cost_centers (code, name, type, affects_cpt, display_order, description) VALUES
  -- Operacional Direto (impacta CPT)
  ('OD', 'Operacional Direto (Insumos e Energia)', 'operacional_direto', true, 1, 'Itens que impactam diretamente o CPT'),
  
  -- Operacional Indireto
  ('OI', 'Operacional Indireto (Manutenção e Consumíveis)', 'operacional_indireto', false, 2, 'Gastos para manter a usina rodando'),
  
  -- Recursos Humanos
  ('RH', 'Recursos Humanos (Folha e Benefícios)', 'recursos_humanos', false, 3, 'Despesas com pessoal'),
  
  -- Administrativo
  ('AD', 'Administrativo e Apoio', 'administrativo', false, 4, 'Serviços terceirizados, taxas e TI'),
  
  -- Financeiro/Tributário
  ('FT', 'Financeiro e Tributário', 'financeiro_tributario', false, 5, 'Tarifas bancárias, impostos e juros'),
  
  -- Não Operacional
  ('NO', 'Não Operacional / Patrimonial', 'nao_operacional', false, 6, 'Itens que não refletem eficiência da usina');

-- -----------------------------------------------------------------------------
-- Materiais
-- -----------------------------------------------------------------------------
INSERT INTO materials (name, unit, default_icms_rate, description) VALUES
  ('Carvão Vegetal', 'm3', 12.00, 'Principal insumo do processo siderúrgico'),
  ('Minério de Ferro', 'tonelada', 12.00, 'Matéria-prima metálica'),
  ('Fundentes (Calcário)', 'tonelada', 0.00, 'Aditivos para o processo - Calcário'),
  ('Fundentes (Quartzito)', 'tonelada', 0.00, 'Aditivos para o processo - Quartzito'),
  ('Ferro-Gusa', 'tonelada', 12.00, 'Produto acabado');

-- -----------------------------------------------------------------------------
-- Categorias de Transação
-- (Vinculadas aos centros de custo conforme PRD)
-- -----------------------------------------------------------------------------

-- A. Operacional Direto
INSERT INTO transaction_categories (cost_center_id, name, description, examples, requires_weight, display_order)
SELECT 
  cc.id,
  cat.name,
  cat.description,
  cat.examples,
  cat.requires_weight,
  cat.display_order
FROM cost_centers cc
CROSS JOIN (VALUES
  ('Carvão Vegetal', 'Principal insumo do processo', 'Compra de carvão de fornecedores', true, 1),
  ('Minério de Ferro', 'Matéria-prima metálica', 'Minério e sínter', true, 2),
  ('Fundentes', 'Aditivos para o processo', 'Calcário, quartzito', true, 3),
  ('Energia Elétrica', 'Essencial para sopro e operação', 'CEMIG', false, 4),
  ('Fretes de Insumos', 'Transporte até a usina', 'Frete de carvão, minério', false, 5)
) AS cat(name, description, examples, requires_weight, display_order)
WHERE cc.code = 'OD';

-- B. Operacional Indireto
INSERT INTO transaction_categories (cost_center_id, name, description, examples, display_order)
SELECT 
  cc.id,
  cat.name,
  cat.description,
  cat.examples,
  cat.display_order
FROM cost_centers cc
CROSS JOIN (VALUES
  ('Manutenção Mecânica/Soldas', 'Reparos e peças', 'LG Soldas, usinagem', 1),
  ('Manutenção Elétrica', 'Materiais e reposição', 'O Ponto Elétrico', 2),
  ('Consumíveis de Operação', 'Itens de uso diário', 'EPIs, ferramentas, lubrificantes', 3),
  ('Combustíveis e Lubrificantes', 'Diesel e óleos', 'Pá carregadeira, veículos internos', 4)
) AS cat(name, description, examples, display_order)
WHERE cc.code = 'OI';

-- C. Recursos Humanos
INSERT INTO transaction_categories (cost_center_id, name, description, examples, display_order)
SELECT 
  cc.id,
  cat.name,
  cat.description,
  cat.examples,
  cat.display_order
FROM cost_centers cc
CROSS JOIN (VALUES
  ('Salários (Folha Líquida)', 'Pagamentos nominais', 'Funcionários da operação', 1),
  ('Encargos e Impostos S/ Folha', 'Obrigações trabalhistas', 'FGTS, INSS, PIS sobre folha', 2),
  ('Benefícios e Provisões', 'Benefícios dos funcionários', 'Vales (Assaí/BH), Cestas Básicas, Rescisões, Férias', 3)
) AS cat(name, description, examples, display_order)
WHERE cc.code = 'RH';

-- D. Administrativo
INSERT INTO transaction_categories (cost_center_id, name, description, examples, display_order)
SELECT 
  cc.id,
  cat.name,
  cat.description,
  cat.examples,
  cat.display_order
FROM cost_centers cc
CROSS JOIN (VALUES
  ('Serviços Terceirizados', 'Apoio externo', 'Contabilidade (Edicon), Jurídico, Segurança', 1),
  ('Taxas e Associações', 'Obrigações legais', 'Sindifer, taxas municipais, alvarás', 2),
  ('Tecnologia', 'Softwares e infraestrutura', 'Alteradata, Kinevo, Internet', 3)
) AS cat(name, description, examples, display_order)
WHERE cc.code = 'AD';

-- E. Financeiro e Tributário
INSERT INTO transaction_categories (cost_center_id, name, description, examples, display_order)
SELECT 
  cc.id,
  cat.name,
  cat.description,
  cat.examples,
  cat.display_order
FROM cost_centers cc
CROSS JOIN (VALUES
  ('Tarifas Bancárias', 'Custos de movimentação', 'Taxas de conta, boletos, custódia', 1),
  ('Impostos Governamentais', 'Tributos não creditados', 'ICMS, IRPJ, CSLL, DAEs', 2),
  ('Juros e Empréstimos', 'Custo de capital', 'Parcelas de financiamentos', 3)
) AS cat(name, description, examples, display_order)
WHERE cc.code = 'FT';

-- F. Não Operacional
INSERT INTO transaction_categories (cost_center_id, name, description, examples, display_order)
SELECT 
  cc.id,
  cat.name,
  cat.description,
  cat.examples,
  cat.display_order
FROM cost_centers cc
CROSS JOIN (VALUES
  ('Distribuição de Lucros', 'Retirada dos sócios', 'Pró-labore, dividendos', 1),
  ('Investimentos/Resgates', 'Movimentações patrimoniais', 'Aplicações financeiras, compra de máquinas', 2),
  ('Gastos Pessoais/Sócios', 'Não pertence à operação', 'Financiamento de carro pessoal', 3)
) AS cat(name, description, examples, display_order)
WHERE cc.code = 'NO';

-- Vincular categorias de insumos aos materiais
UPDATE transaction_categories tc
SET material_id = m.id
FROM materials m
WHERE tc.name = 'Carvão Vegetal' AND m.name = 'Carvão Vegetal';

UPDATE transaction_categories tc
SET material_id = m.id
FROM materials m
WHERE tc.name = 'Minério de Ferro' AND m.name = 'Minério de Ferro';


-- =============================================================================
-- SEÇÃO 9: VIEWS AUXILIARES PARA DASHBOARDS
-- =============================================================================

-- View: Resumo de caixa do dia atual
CREATE OR REPLACE VIEW v_current_day_cash AS
SELECT
  CURRENT_DATE AS date,
  COALESCE(
    (SELECT real_closing FROM daily_cash_closings 
     WHERE date = CURRENT_DATE - INTERVAL '1 day' AND is_closed = true),
    (SELECT (value->>'value')::decimal FROM settings WHERE key = 'initial_cash_balance'),
    0
  ) AS opening_balance,
  COALESCE(SUM(CASE WHEN type = 'entrada' THEN amount ELSE 0 END), 0) AS total_entries,
  COALESCE(SUM(CASE WHEN type = 'saida' THEN amount ELSE 0 END), 0) AS total_exits,
  COALESCE(
    (SELECT real_closing FROM daily_cash_closings 
     WHERE date = CURRENT_DATE - INTERVAL '1 day' AND is_closed = true),
    0
  ) + COALESCE(SUM(CASE WHEN type = 'entrada' THEN amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN type = 'saida' THEN amount ELSE 0 END), 0) AS projected_balance,
  EXISTS(
    SELECT 1 FROM daily_cash_closings 
    WHERE date = CURRENT_DATE - INTERVAL '1 day' AND is_closed = false
  ) AS yesterday_not_closed
FROM transactions
WHERE date = CURRENT_DATE AND status = 'pago';

-- View: KPIs de contratos
CREATE OR REPLACE VIEW v_contract_kpis AS
SELECT
  c.id,
  c.contract_number,
  cu.name AS customer_name,
  c.contracted_quantity,
  c.delivered_quantity,
  c.remaining_quantity,
  c.completion_percent,
  c.total_value,
  c.invoiced_value,
  c.pending_value,
  c.status,
  c.start_date,
  c.end_date,
  -- Valor em trânsito
  COALESCE((
    SELECT SUM(s.total_value) 
    FROM shipments s 
    WHERE s.contract_id = c.id AND s.status = 'em_transito'
  ), 0) AS value_in_transit,
  -- Contas a receber
  COALESCE((
    SELECT SUM(s.total_value) 
    FROM shipments s 
    WHERE s.contract_id = c.id AND s.status IN ('entregue', 'aguardando_pagamento')
  ), 0) AS receivables
FROM contracts c
JOIN customers cu ON c.customer_id = cu.id;

-- View: Quebra média de transporte por contrato
CREATE OR REPLACE VIEW v_transport_loss_by_contract AS
SELECT
  c.id AS contract_id,
  c.contract_number,
  cu.name AS customer_name,
  COUNT(s.id) AS total_shipments,
  AVG(s.transport_loss_percent) AS avg_loss_percent,
  SUM(s.transport_loss) AS total_loss_tons
FROM contracts c
JOIN customers cu ON c.customer_id = cu.id
LEFT JOIN shipments s ON s.contract_id = c.id 
  AND s.transport_loss_percent IS NOT NULL
GROUP BY c.id, c.contract_number, cu.name;


-- =============================================================================
-- FIM DO SCRIPT DE MIGRAÇÃO
-- =============================================================================
