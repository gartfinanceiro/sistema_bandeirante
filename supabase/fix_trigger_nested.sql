-- =============================================================================
-- FIX DEFINITIVO: Trigger update_carvao_updated_at com IFs Aninhados
-- =============================================================================
-- PROBLEMA: PostgreSQL pode avaliar OLD.is_confirmed ANTES de TG_TABLE_NAME
-- SOLUÇÃO: Usar IFs aninhados para garantir ordem de avaliação
-- =============================================================================

CREATE OR REPLACE FUNCTION update_carvao_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar o nome da tabela PRIMEIRO, depois acessar campos específicos
  IF TG_TABLE_NAME = 'carvao_discharges' THEN
    -- Só acessa is_confirmed se for a tabela carvao_discharges
    IF OLD.is_confirmed = true THEN
      NEW.updated_at = OLD.updated_at;  -- Mantém timestamp para confirmados
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'carvao_monthly_consolidation' THEN
    -- Só acessa is_closed se for a tabela carvao_monthly_consolidation
    IF OLD.is_closed = true THEN
      NEW.updated_at = OLD.updated_at;  -- Mantém timestamp para fechados
      RETURN NEW;
    END IF;
  END IF;
  
  -- Para todas as outras tabelas ou registros não confirmados/fechados
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_carvao_updated_at() IS 
  'Atualiza updated_at automaticamente com IFs aninhados para evitar erros de campo inexistente';

-- =============================================================================
-- ✅ Execute este script agora
-- =============================================================================
-- Após executar, teste editar um fornecedor
-- O erro "record 'old' has no field 'is_confirmed'" NÃO deve mais aparecer
-- =============================================================================
