-- 044_bulk_merchant_votes.sql
-- Versão em lote do aprendizado: aplica vários votos fornecedor->categoria num único
-- statement (evita N round-trips na importação automática). Recebe um array JSON
-- [{merchant_key, category_slug, inc}].

create or replace function public.increment_merchant_votes_bulk(p jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.merchant_category_votes (merchant_key, category_slug, votes, updated_at)
  select x.merchant_key, x.category_slug, x.inc, now()
  from jsonb_to_recordset(p) as x(merchant_key text, category_slug text, inc int)
  on conflict (merchant_key, category_slug)
  do update set votes = merchant_category_votes.votes + excluded.votes, updated_at = now();
$$;

grant execute on function public.increment_merchant_votes_bulk(jsonb) to authenticated;
