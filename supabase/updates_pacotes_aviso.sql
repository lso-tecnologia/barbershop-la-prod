-- ============================================================
-- BARBERSHOP L.A — Restaura os PACOTES e o AVISO (pop-up)
-- Rode UMA vez: Supabase > SQL Editor > New query > cole tudo > Run.
-- Seguro: não apaga agendamentos, usuários nem serviços. Pode rodar de novo sem problema.
-- ============================================================

-- 1) Pacotes com os valores corretos (Pacote 1 = R$ 130,00 | Pacote 2 = R$ 260,00)
insert into public.packages (id, data, is_active) values (
  'pkg-1',
  $j${"id":"pkg-1","title":"Pacote 1 — Estilo Semanal","description":"Plano perfeito para quem valoriza andar sempre no padrão da navalha.","priceCents":13000,"economyText":"Economize R$ 50/mês","benefits":["4 cortes de cabelo por mês (1 por semana)","Sobrancelha 1x por semana na navalha","Prioridade na escolha de horários","Acabamento e penteado inclusos"],"isActive":true,"isFeatured":false}$j$::jsonb,
  true
) on conflict (id) do update set data = excluded.data, is_active = true;

insert into public.packages (id, data, is_active) values (
  'pkg-2',
  $j${"id":"pkg-2","title":"Pacote 2 — Combo Completo","description":"Cuidado total de cabelo e barba semana a semana com o barbeiro.","priceCents":26000,"economyText":"Melhor Custo-Benefício","benefits":["4 cortes de cabelo por mês","4 barbas completas alinhadas na navalha por mês","Sobrancelha 1x por semana na navalha","Loção pós-barba e finalização inclusas","Reserva fixa do seu dia e horário preferido"],"isActive":true,"isFeatured":true}$j$::jsonb,
  true
) on conflict (id) do update set data = excluded.data, is_active = true;

-- 2) Aviso (pop-up) inicial — depois o barbeiro edita pelo app (Acesso do Barbeiro > Editar Pop-up de Aviso)
insert into public.notices (id, data, is_active) values (
  'main',
  $j${"id":"main","title":"Horário Estendido: Ter-Sáb até 19h e Dom até 14h!","message":"Agora você tem mais tempo para cuidar do seu visual! Atendemos de Terça a Sábado das 09h às 19h e aos Domingos das 09h às 14h (horários de 30 em 30 min). Agende seu horário com antecedência!","validUntil":"2026-10-31","isActive":true,"priority":"normal","version":"1","updatedAt":"2026-10-25T00:00:00.000Z"}$j$::jsonb,
  true
) on conflict (id) do update set data = excluded.data, is_active = true;

-- Desativa avisos antigos (só o "main" vale daqui para frente)
update public.notices set is_active = false where id <> 'main';
