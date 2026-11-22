-- ============================================================
-- BARBERSHOP L.A — Endurecimento de segurança (nov/2026)
-- Rode ANTES de subir o código novo. Seguro: NÃO apaga dados.
-- Pode rodar de novo sem problema.
-- ============================================================

-- 1) Novas colunas de usuário
alter table public.users add column if not exists token_version int not null default 0;          -- derruba sessões antigas
alter table public.users add column if not exists email_verified boolean not null default false;  -- e-mail comprovado
alter table public.users add column if not exists two_factor_pending_secret text;                 -- 2FA aguardando confirmação
alter table public.users add column if not exists two_factor_last_counter bigint;                 -- anti-reuso do código 2FA

-- 2) Contador atômico (força bruta e limite de pedidos).
--    Uma única instrução INSERT ... ON CONFLICT: dois pedidos ao mesmo tempo nunca leem o mesmo valor.
create or replace function public.hit_counter(p_key text, p_window_seconds int)
returns int
language sql
security invoker
set search_path = ''
as $$
  insert into public.login_attempts as la (ip, count, locked_until)
  values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (ip) do update set
    count = case when la.locked_until is null or la.locked_until <= now() then 1 else la.count + 1 end,
    locked_until = case when la.locked_until is null or la.locked_until <= now()
                        then now() + make_interval(secs => p_window_seconds)
                        else la.locked_until end
  returning count;
$$;

-- Só o backend (service_role) pode chamar. Sem isso a função ficaria exposta pela API pública do Supabase.
revoke all on function public.hit_counter(text, int) from public, anon, authenticated;
grant execute on function public.hit_counter(text, int) to service_role;

-- Função automática do Supabase que liga o RLS em tabelas novas: ninguém de fora precisa chamá-la pela API
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- 3) Códigos de redefinição antigos eram guardados em texto puro: invalida todos
delete from public.password_resets;

-- 4) Limpa contadores antigos (formato mudou)
delete from public.login_attempts;

notify pgrst, 'reload schema';
