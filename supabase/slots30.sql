-- ============================================================
-- BARBERSHOP L.A — Horários de 30 em 30 min
-- Rode ANTES de subir o código novo. Seguro: NÃO apaga nada.
-- Agendamentos que já existem ficam com 60 min (como eram antes).
-- ============================================================
alter table public.appointments
  add column if not exists duration_minutes int not null default 60;
