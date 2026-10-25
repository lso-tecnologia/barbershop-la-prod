-- Migração segura para habilitar o gerenciamento de serviços no painel admin.
-- Execute no Supabase > SQL Editor > New query > Run.
-- Não apaga tabelas nem registros existentes.

alter table public.services
  add column if not exists data jsonb not null default '{}'::jsonb;

-- Preserva e aproveita dados já existentes em colunas separadas, quando houver.
update public.services s
set data = coalesce(s.data, '{}'::jsonb)
  || jsonb_strip_nulls(jsonb_build_object(
    'id', s.id,
    'name', coalesce(to_jsonb(s)->>'name', to_jsonb(s)->>'title'),
    'title', coalesce(to_jsonb(s)->>'title', to_jsonb(s)->>'name'),
    'description', to_jsonb(s)->>'description',
    'priceCents', coalesce(
      nullif(to_jsonb(s)->>'price_cents', '')::numeric,
      nullif(to_jsonb(s)->>'priceCents', '')::numeric,
      nullif(to_jsonb(s)->>'price', '')::numeric * 100
    ),
    'durationMinutes', coalesce(
      nullif(to_jsonb(s)->>'duration_minutes', '')::numeric,
      nullif(to_jsonb(s)->>'durationMinutes', '')::numeric,
      60
    ),
    'isPopular', coalesce(
      nullif(to_jsonb(s)->>'is_popular', '')::boolean,
      nullif(to_jsonb(s)->>'isPopular', '')::boolean,
      false
    )
  ));

notify pgrst, 'reload schema';
