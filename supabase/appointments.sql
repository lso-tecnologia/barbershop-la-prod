-- ============================================================
-- BARBERSHOP L.A — Agendamentos (rode DEPOIS do schema.sql)
-- Seguro para rodar: NÃO apaga nada.
-- ============================================================

create table if not exists public.appointments (
  id text primary key,
  user_id text references public.users(id) on delete set null,
  client_name text not null,
  client_phone text not null,
  client_email text not null,
  item_name text not null,
  item_type text not null check (item_type in ('service', 'package')),
  price numeric not null default 0,
  date date not null,
  time text not null,
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  payment_method text not null default 'in_person' check (payment_method in ('pix', 'card', 'in_person')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid')),
  created_at timestamptz not null default now()
);

-- Impede dois agendamentos ativos no mesmo dia/horário (anti "overbooking")
create unique index if not exists appointments_unique_active_slot
  on public.appointments (date, time)
  where status in ('pending', 'confirmed');

create index if not exists appointments_user_idx on public.appointments (user_id);
create index if not exists appointments_email_idx on public.appointments (client_email);

alter table public.appointments enable row level security;
