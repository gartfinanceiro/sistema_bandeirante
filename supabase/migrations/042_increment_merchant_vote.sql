-- 042_increment_merchant_vote.sql
-- Função de aprendizado: a cada importação confirmada, reforça (ou cria) o voto
-- fornecedor -> categoria escolhida. Incremento atômico via upsert.

create or replace function public.increment_merchant_vote(p_merchant_key text, p_category_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.merchant_category_votes (merchant_key, category_slug, votes, updated_at)
  values (p_merchant_key, p_category_slug, 1, now())
  on conflict (merchant_key, category_slug)
  do update set votes = merchant_category_votes.votes + 1, updated_at = now();
$$;

grant execute on function public.increment_merchant_vote(text, text) to authenticated;
