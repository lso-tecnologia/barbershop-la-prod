-- ============================================================
-- BARBERSHOP L.A — Schema do Supabase
-- Como usar: Supabase > SQL Editor > New query > cole tudo > Run
-- ============================================================

-- ATENÇÃO: apaga e recria as tabelas abaixo (já existiam versões antigas com colunas diferentes).
-- Só rode se essas tabelas não tiverem dados que você queira manter.
drop table if exists public.login_attempts cascade;
drop table if exists public.password_resets cascade;
drop table if exists public.audit_logs cascade;
drop table if exists public.notices cascade;
drop table if exists public.packages cascade;
drop table if exists public.services cascade;
drop table if exists public.settings cascade;
drop table if exists public.users cascade;

create table if not exists public.users (
  id text primary key,
  role text not null check (role in ('client', 'barber_admin')),
  name text not null,
  phone text not null default '',
  email text not null unique,
  password_hash text not null,
  two_factor_secret text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.settings (
  id int primary key,
  data jsonb not null
);

create table if not exists public.services (
  id text primary key,
  data jsonb not null,
  is_active boolean not null default true,
  display_order int not null default 0
);

create table if not exists public.packages (
  id text primary key,
  data jsonb not null,
  is_active boolean not null default true
);

create table if not exists public.notices (
  id text primary key,
  data jsonb not null,
  is_active boolean not null default true
);

create table if not exists public.audit_logs (
  id bigserial primary key,
  user_id text,
  user_name text,
  action text not null,
  details text not null default '',
  ip_address text,
  created_at timestamptz not null default now()
);

create table if not exists public.password_resets (
  token text primary key,
  email text not null,
  expires_at timestamptz not null
);

create table if not exists public.login_attempts (
  ip text primary key,
  count int not null default 0,
  locked_until timestamptz
);

-- Segurança: RLS ligado e SEM policies = a chave pública (anon) não lê nada.
-- Só o backend (Vercel) acessa, usando a SERVICE ROLE KEY.
alter table public.users enable row level security;
alter table public.settings enable row level security;
alter table public.services enable row level security;
alter table public.packages enable row level security;
alter table public.notices enable row level security;
alter table public.audit_logs enable row level security;
alter table public.password_resets enable row level security;
alter table public.login_attempts enable row level security;

-- ============================================================
-- Dados iniciais (configurações, serviços, pacotes, aviso)
-- Os usuários NÃO são criados aqui: o admin é criado em /api/setup
-- ============================================================

insert into public.settings (id, data) values (1, $j${"id":1,"isOpenOverride":true,"barberName":"Leonardo Arruda","barberBio":"Há 8 anos transformo a autoestima dos meus clientes com a tesoura e a navalha na mão — uma paixão que só cresce com o tempo. Minha maior motivação para dar o meu melhor todos os dias é o meu filho, a razão de tudo o que construo. Nas horas vagas, meu refúgio é a garagem: apaixonado por carros, gosto de passar o tempo mexendo no meu projeto e montando som de qualidade. Seja bem-vindo à cadeira!","barberPhotoUrl":"/assets/aistudio/WhatsApp_Image_2026-10-24_at_16.19.02_2143161f.jpeg","operatingHours":[{"day":"Segunda-feira","hours":"Fechado","isOpen":false,"startHour":0,"endHour":0},{"day":"Terça-feira","hours":"09h às 19h","isOpen":true,"startHour":9,"endHour":19},{"day":"Quarta-feira","hours":"09h às 19h","isOpen":true,"startHour":9,"endHour":19},{"day":"Quinta-feira","hours":"09h às 19h","isOpen":true,"startHour":9,"endHour":19},{"day":"Sexta-feira","hours":"09h às 19h","isOpen":true,"startHour":9,"endHour":19},{"day":"Sábado","hours":"09h às 19h","isOpen":true,"startHour":9,"endHour":19},{"day":"Domingo","hours":"09h às 14h","isOpen":true,"startHour":9,"endHour":14}],"slotDurationMinutes":60,"cancellationLimitHours":2,"whatsappNumber":"5511981154340","updatedAt":"2026-10-24T21:09:38.030Z"}$j$::jsonb) on conflict (id) do nothing;

insert into public.services (id, data, is_active, display_order) values ('srv-corte', $j${"id":"srv-corte","name":"Corte Tradicional / Fade","description":"Corte moderno ou clássico com tesoura e máquina, degradê impecável e finalização.","priceCents":3500,"durationMinutes":60,"isActive":true,"displayOrder":1,"createdAt":"2026-10-24T21:09:38.030Z"}$j$::jsonb, true, 1) on conflict (id) do nothing;
insert into public.services (id, data, is_active, display_order) values ('srv-barba', $j${"id":"srv-barba","name":"Barba Tradicional na Navalha","description":"Alinhamento preciso com navalha, óleo hidratante e loção pós-barba.","priceCents":3500,"durationMinutes":60,"isActive":true,"displayOrder":2,"createdAt":"2026-10-24T21:09:38.030Z"}$j$::jsonb, true, 2) on conflict (id) do nothing;
insert into public.services (id, data, is_active, display_order) values ('srv-relaxamento', $j${"id":"srv-relaxamento","name":"Relaxamento Capilar","description":"Tratamento para soltura de cachos e controle de volume com produtos seguros e nutritivos.","priceCents":4000,"durationMinutes":60,"isActive":true,"displayOrder":3,"createdAt":"2026-10-24T21:09:38.030Z"}$j$::jsonb, true, 3) on conflict (id) do nothing;
insert into public.services (id, data, is_active, display_order) values ('srv-sobrancelha', $j${"id":"srv-sobrancelha","name":"Sobrancelha na Navalha","description":"Design masculino e limpeza milimétrica na navalha para realçar o olhar.","priceCents":1000,"durationMinutes":15,"isActive":true,"displayOrder":4,"createdAt":"2026-10-24T21:09:38.030Z"}$j$::jsonb, true, 4) on conflict (id) do nothing;
insert into public.services (id, data, is_active, display_order) values ('srv-pezinho', $j${"id":"srv-pezinho","name":"Pezinho / Acabamento","description":"Limpeza de contorno de nuca e costeletas na navalha para manter o corte em dia.","priceCents":1000,"durationMinutes":15,"isActive":true,"displayOrder":5,"createdAt":"2026-10-24T21:09:38.030Z"}$j$::jsonb, true, 5) on conflict (id) do nothing;
insert into public.services (id, data, is_active, display_order) values ('srv-pacote-custom', $j${"id":"srv-pacote-custom","name":"Pacote Personalizado","description":"Combinações sob medida para eventos ou atendimentos especiais.","priceCents":0,"durationMinutes":60,"isActive":true,"displayOrder":6,"createdAt":"2026-10-24T21:09:38.030Z"}$j$::jsonb, true, 6) on conflict (id) do nothing;

insert into public.packages (id, data, is_active) values ('pkg-1', $j${"id":"pkg-1","title":"Pacote 1 — Estilo Semanal","description":"Plano perfeito para quem valoriza andar sempre no padrão da navalha.","priceCents":13000,"economyText":"Economize R$ 50/mês","benefits":["4 cortes de cabelo por mês (1 por semana)","Sobrancelha 1x por semana na navalha","Prioridade na escolha de horários","Acabamento e penteado inclusos"],"isActive":true,"isFeatured":false,"createdAt":"2026-10-24T21:09:38.030Z"}$j$::jsonb, true) on conflict (id) do nothing;
insert into public.packages (id, data, is_active) values ('pkg-2', $j${"id":"pkg-2","title":"Pacote 2 — Combo Completo","description":"Cuidado total de cabelo e barba semana a semana com o barbeiro.","priceCents":26000,"economyText":"Melhor Custo-Benefício","benefits":["4 cortes de cabelo por mês","4 barbas completas alinhadas na navalha por mês","Sobrancelha 1x por semana na navalha","Loção pós-barba e finalização inclusas","Reserva fixa do seu dia e horário preferido"],"isActive":true,"isFeatured":true,"createdAt":"2026-10-24T21:09:38.030Z"}$j$::jsonb, true) on conflict (id) do nothing;

insert into public.notices (id, data, is_active) values ('notice-official-2026', $j${"id":"notice-official-2026","title":"Horário Estendido: Ter-Sáb até 19h e Dom até 14h!","message":"Agora você tem mais tempo para cuidar do seu visual na BARBERSHOP L.A! Atendemos de Terça a Sábado das 09h às 19h e aos Domingos das 09h às 14h (slots de 1h). Agende seu horário com antecedência!","isActive":true,"validUntil":"31/10/2026","priority":"normal","createdAt":"2026-10-24T21:09:38.030Z"}$j$::jsonb, true) on conflict (id) do nothing;
