# Galeria de Estilos gerenciável

## Para subir
1. **Supabase → SQL Editor:** rode `supabase/gallery.sql`. Ele cria a tabela `gallery_photos` com as 6 fotos atuais.
2. Faça o merge do PR (primeiro o de segurança, depois este).

Se o passo 1 não for feito, o site continua mostrando as 6 fotos de reserva, mas o painel não consegue salvar.

## Como o barbeiro usa
Painel → **Fotos da Galeria**:
- Mostra as fotos atuais e o contador (ex.: 6/6).
- **Lixeira** apaga uma foto.
- **Escolher foto do corte** → título → **Publicar**. Só aparece quando há espaço livre.
- A galeria tem no máximo **6 fotos** (`GALLERY_MAX` em `src/server/app.ts`). Cheia = apaga uma antes de colocar outra.

## Detalhes técnicos
- A foto é reduzida (máx. 1200×1600) e convertida em JPEG **no próprio celular**, o que também tira o GPS e os outros metadados (EXIF). Chega ao servidor com ~200 KB.
- O servidor confere se o arquivo é mesmo uma imagem (bytes iniciais de JPG/PNG/WEBP), limita o tamanho (900 KB) e exige sessão de admin.
- A foto fica no banco (`image_data`, base64) e é servida por `/api/gallery/photo/:id`, com cache longo no navegador.
- As fotos que vieram com o site ficam em `public/` (`image_url`). Apagar no painel só tira da galeria; o arquivo continua no projeto.
