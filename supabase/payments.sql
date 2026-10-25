-- ============================================================
-- BARBERSHOP L.A — Pagamentos online (Mercado Pago)
-- Rode DEPOIS do schema.sql e appointments.sql. Seguro: NÃO apaga nada.
-- ============================================================

alter table public.appointments add column if not exists mp_preference_id text;
alter table public.appointments add column if not exists mp_payment_id text;

create index if not exists appointments_mp_payment_idx on public.appointments (mp_payment_id);
