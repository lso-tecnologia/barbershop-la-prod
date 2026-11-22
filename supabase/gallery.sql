-- ============================================================
-- BARBERSHOP L.A — Galeria de Estilos gerenciável pelo barbeiro
-- Rode ANTES de subir o código. Seguro: NÃO apaga nada. Pode rodar de novo.
-- ============================================================
-- Cada foto é UMA linha:
--   image_url  -> foto que já vem com o site (pasta public/)
--   image_data -> foto enviada pelo painel (guardada no banco em base64, já comprimida no celular)
-- O limite de fotos fica no código (GALLERY_MAX em src/server/app.ts).

create table if not exists public.gallery_photos (
  id text primary key,
  position int not null default 0,
  title text not null default '',
  subtitle text not null default '',
  category text not null default '',
  image_url text,
  image_data text,
  mime text,
  created_at timestamptz not null default now(),
  constraint gallery_photo_source check (image_url is not null or image_data is not null)
);

-- RLS ligado e SEM policies: só o backend (service_role) lê/escreve
alter table public.gallery_photos enable row level security;

-- Fotos iniciais (as 4 que já estavam no site + as 2 novas)
insert into public.gallery_photos (id, position, title, subtitle, category, image_url) values
  ('gal-ambiente',  1, 'Ambiente & Tradição', 'Cadeira clássica de couro e iluminação premium', 'Estrutura', '/assets/aistudio/WhatsApp_Image_2026-10-24_at_16.19.02_2143161f.jpeg'),
  ('gal-grego',     2, 'Freestyle Grego Navalhado', 'Precisão milimétrica e geometria na navalha', 'Arte & Freestyle', '/assets/aistudio/WhatsApp_Image_2026-10-12_at_15.44.43_30bb7746.jpeg'),
  ('gal-cachos',    3, 'Cachos Definidos & Risquinho', 'Degradê limpo com finalização profissional de cachos', 'Corte & Textura', '/assets/aistudio/WhatsApp_Image_2026-10-24_at_16.18.57_3c2b7564.jpeg'),
  ('gal-infantil',  4, 'Perfil & Acabamento Infantil', 'Atenção e carinho para os pequenos clientes', 'Infantil', '/assets/aistudio/WhatsApp_Image_2026-10-24_at_16.18.59__2__e1070cd6.jpeg'),
  ('gal-skin-fade', 5, 'Skin Fade & Barba', 'Degradê na navalha com transição perfeita para a barba', 'Degradê', '/assets/galeria/skin-fade-barba.jpg'),
  ('gal-risco',     6, 'Degradê com Risco', 'Desenho na navalha e topo penteado', 'Arte & Freestyle', '/assets/galeria/degrade-infantil-risco.jpg')
on conflict (id) do nothing;

notify pgrst, 'reload schema';
