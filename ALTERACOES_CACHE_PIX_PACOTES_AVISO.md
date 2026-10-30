# BARBERSHOP L.A — Cache do PWA, Pix com QR Code, Pacotes, Pop-up editável, Faturamento, Calendário, Botão "Baixar agora" e Segurança

Documento com **o que o cliente pediu**, **o diagnóstico**, **tudo que foi alterado**, **o que você precisa fazer** e **o que ainda falta**.
Serve para você seguir sozinho ou **entregar para outra IA** continuar (há um prompt pronto na seção 10).

Data: 25–26/10/2026 (2 rodadas de trabalho; a 2ª está na seção 11) · Projeto: PWA de barbearia (React 19 + Vite + Tailwind 4) · Backend: Express como função serverless da Vercel (`api/index.ts` → `src/server/app.ts`) · Banco: Supabase.

---

## 1. Pedidos e situação

| # | Pedido | Situação |
|---|---|---|
| 1 | PWA guarda cache demais nos navegadores — resolver e otimizar | ✅ Feito e testado em navegador headless (seção 4) |
| 2 | Pagamento: abrir QR Code Pix **dentro do app** com "copia e cola", em vez de redirecionar ao Mercado Pago | ✅ Feito. Testado com Mercado Pago **simulado**; falta teste com o Mercado Pago real (seção 7) |
| 3 | Pacotes estão zerados — recolocar os valores | ✅ Causa corrigida no código + SQL de restauração (R$ 130 e R$ 260) |
| 4 | Campo para o barbeiro escrever o texto do pop-up de aviso | ✅ Feito (Acesso do Barbeiro → "Editar Pop-up de Aviso") |
| 5 | Passo a passo de tudo para entregar a outra IA | ✅ Este documento (atualizado na 2ª rodada) |
| 6 | Calendário do agendamento invisível no celular (ícone escuro no fundo escuro) | ✅ Ícone branco e campo todo clicável (seção 11) |
| 7 | Campo para saber quanto já faturou por dia/mês | ✅ "Faturamento (dia / mês)" no painel do barbeiro (seção 11) |
| 8 | Botão "Instalar no iPhone/Android" → só "Baixar agora" | ✅ (seção 11) |
| 9 | Checar a segurança do site | ✅ Auditoria + correções (seção 12) |

---

## 2. Diagnóstico (causa raiz de cada problema)

### 2.1 Cache do PWA
1. `registerType: 'autoUpdate'` + registro automático do plugin: a versão nova do service worker assumia, mas **a página já aberta continuava com o JavaScript antigo** até o cliente recarregar. Por isso era preciso "abrir 2 vezes" (já citado em `ALTERACOES_PIX_30MIN_CELULAR.md`).
2. O service worker **pré-carregava todas as fotos .jpeg** (≈1,2 MB) e o `index.html`, sem limite nem validade.
3. Não havia cabeçalhos de cache para `sw.js` e `manifest.webmanifest` na Vercel.
4. Não existia nenhuma forma de o cliente "forçar" a atualização.

### 2.2 Pacotes zerados
`db.getPackages()` lia colunas que **não existem** (`r.title`, `r.price`, `r.economy`, `r.is_featured`). No Supabase os dados do pacote ficam dentro da coluna `data` (jsonb) como `title`, `priceCents`, `economyText`, `benefits`, `isFeatured`. Resultado: título "Pacote", preço 0 e benefícios vazios. (Era a pendência nº 7 em `PAGAMENTOS_MERCADO_PAGO.md`.) O preço **cobrado** sempre foi correto porque `findCatalogItem` já lia `data.priceCents`.

### 2.3 Pagamento redirecionava ao Mercado Pago
Usava o **Checkout Pro** (`POST /checkout/preferences`) e `window.location.href = initPoint`.

### 2.4 Pop-up fixo no código
O texto estava escrito direto em `src/App.tsx` (`activeNotice`). A tabela `notices` e a rota `GET /api/notices/active` existiam, mas o app **não usava**.

---

## 3. O que foi alterado (por arquivo)

### Servidor
| Arquivo | Mudança |
|---|---|
| `src/server/db.ts` | `getPackages()` agora lê o jsonb `data` (preço = `priceCents/100`, `economyText`, `benefits`, `isFeatured`), só pacotes ativos, ordenados por id. Novos: `getNoticeForAdmin()`, `getActiveNotice()` (ativo + dentro da validade), `saveNotice()`. Tipo `NoticeRow`. Aceita validade nos formatos `AAAA-MM-DD` e antigo `DD/MM/AAAA`. |
| `src/server/app.ts` | **Removida** a rota `POST /api/payments/checkout`. **Nova** `POST /api/payments/pix`: cria o pagamento Pix em `POST /v1/payments` (valor do banco, `external_reference` = id do agendamento, `notification_url`, validade 30 min) e devolve `qrCode` (copia e cola), `qrCodeImage` e `secondsLeft`. Reaproveita o Pix já criado (não duplica cobrança). `mp()` aceita cabeçalhos extras. Ao cancelar um agendamento com Pix pendente, o Pix é cancelado no Mercado Pago (`cancelPendingPix`). **Novas rotas** de aviso: `GET /api/admin/notice` e `PUT /api/admin/notice` (só admin; título ≤ 80, mensagem ≤ 600, data válida). O webhook e `GET /api/payments/status/:id` continuam iguais. |

### Front-end
| Arquivo | Mudança |
|---|---|
| `src/components/PixPaymentPanel.tsx` (novo) | Tela do Pix: QR Code, campo "Pix copia e cola", botão **Copiar código Pix** (com plano B para navegadores sem a API de área de transferência), contagem regressiva da reserva, consulta automática do pagamento a cada 4 s e ao voltar do app do banco, botões "Já paguei" e "Pagar depois". |
| `src/components/BookingModal.tsx` | Escolher Pix → **Gerar Pix** → mostra `PixPaymentPanel` dentro do modal → ao pagar vai para o comprovante ("PIX · PAGO ✔"). Textos sem "Mercado Pago". |
| `src/components/MyAppointmentsModal.tsx` | "Pagar agora com Pix" abre o mesmo painel em uma janela por cima da lista. |
| `src/components/PaymentReturnModal.tsx` | **Apagado** (era a tela de retorno do Mercado Pago; não é mais necessária). |
| `src/components/NoticeModal.tsx` | Separado em `NoticeCard` (aparência) e `NoticeModal` (pop-up). Texto vem do servidor; respeita quebras de linha; esconde "Válido até" se vazio; `localStorage` protegido com try/catch. |
| `src/components/NoticeEditor.tsx` (novo) | Formulário do barbeiro: título, mensagem, "válido até" (opcional), "Mostrar o pop-up" (liga/desliga) e **pré-visualização** igual ao pop-up do cliente. |
| `src/components/BarberAdminAuthModal.tsx` | Novo botão **Editar Pop-up de Aviso** (abre o `NoticeEditor`). |
| `src/App.tsx` | Busca o aviso em `/api/notices/active` (sem cache); removido o texto fixo e o `PaymentReturnModal`; normaliza os pacotes recebidos (preço numérico, benefícios em lista). |
| `src/components/ServicesTable.tsx` | Pacote com preço 0 mostra "À combinar" (nunca "R$ 0,00"). |
| `src/services/api.ts` / `src/types/barbershop.ts` | `createPix`, `getActiveNotice`, `adminGetNotice`, `adminSaveNotice`; tipos `PixPayment` e `NoticeData` atualizado. Removido `createCheckout`. |

### Cache / PWA
| Arquivo | Mudança |
|---|---|
| `vite.config.ts` | `injectRegister: false` (o registro é nosso). Workbox: pré-carrega só HTML/JS/CSS/ícones (≈575 KB, sem fotos); `cleanupOutdatedCaches`; `skipWaiting` + `clientsClaim`; `/api/*` sempre **NetworkOnly**; fotos em cache `StaleWhileRevalidate` com limite (40 itens / 30 dias); fontes do Google em cache longo. |
| `src/lib/appUpdate.ts` (novo) | Registra `/sw.js` com `updateViaCache: 'none'`; procura versão nova ao abrir, ao voltar para o app, ao reconectar e a cada 15 min; quando a versão nova assume, **recarrega sozinho** (na hora se o app acabou de abrir; senão só quando o cliente sai da tela, para não interromper agendamento/pagamento). `forceRefreshApp()` apaga service workers e caches e recarrega. Rota de emergência: `https://SEU-SITE/?limpar-cache`. |
| `src/main.tsx` | Chama `setupAppUpdates()`. |
| `src/components/Footer.tsx` | Link **Atualizar app** (chama `forceRefreshApp`). |
| `vercel.json` | Cabeçalhos: `/sw.js` e `/manifest.webmanifest` sempre revalidados. (Mantido simples de propósito: regra inválida no `vercel.json` derruba o deploy.) |

### Banco / documentação
| Arquivo | Mudança |
|---|---|
| `supabase/updates_pacotes_aviso.sql` (novo) | Restaura Pacote 1 = **R$ 130,00** e Pacote 2 = **R$ 260,00**; cria o aviso inicial (`id = 'main'`) com o texto atual e desativa avisos antigos. Idempotente. |
| `.env.example` | Comentário do Mercado Pago atualizado (só Pix). **Nenhuma variável nova.** |
| `LEIA-ME_ALTERACOES.md`, `PAGAMENTOS_MERCADO_PAGO.md`, `ALTERACOES_PIX_30MIN_CELULAR.md` | Faixa no topo apontando para este documento. |

---

## 4. Como o Pix funciona agora

1. Cliente escolhe serviço, dia e horário → **Pix** → **Gerar Pix**.
2. `POST /api/appointments` cria a reserva como `pending` (segura o horário por **15 min**).
3. `POST /api/payments/pix` cria o pagamento no Mercado Pago e devolve QR + copia e cola. O QR é exibido **dentro do app**.
4. Cliente copia o código (ou lê o QR) e paga no app do banco.
5. O Mercado Pago avisa o servidor pelo **webhook** (`/api/payments/webhook`); a tela também consulta `GET /api/payments/status/:id` a cada 4 s. Pago → agendamento vira **Confirmado + Pago** e o app mostra o comprovante.
6. Sem pagar em 15 min a reserva é liberada (`db.expireUnpaid`). Fechar a janela mantém a reserva: o cliente logado paga depois em **Meus horários → Pagar agora com Pix**.

Decisões e limites que a outra IA precisa saber:
- Usa a API `POST /v1/payments` (a mesma família do webhook já existente). **O Mercado Pago está lançando a API Orders (`/v1/orders`) como evolução**; se um dia a `/v1/payments` for descontinuada, migrar significa trocar a criação do Pix e o tópico do webhook (`order` em vez de `payment`).
- O Mercado Pago exige validade **mínima de 30 min** para Pix. A reserva do horário continua valendo 15 min. Se o cliente pagar entre 15 e 30 min: se o horário ainda está livre, `applyMpPayment` o confirma; se outra pessoa já pegou, grava `PAYMENT_APPROVED_SLOT_LOST` no log e é preciso **reembolsar manualmente** no painel do Mercado Pago.
- CPF **não** é enviado (a documentação mostra só valor, método e e-mail do pagador como obrigatórios). Se o Mercado Pago passar a exigir, incluir `payer.identification` em `POST /api/payments/pix`.
- Cliente sem conta (visitante) que fechar a janela do Pix não tem como reabrir; precisa esperar os 15 min e agendar de novo.
- No modo de teste do Mercado Pago, o e-mail do pagador **não pode ser o mesmo e-mail da conta vendedora**.

---

## 5. O que VOCÊ precisa fazer (nesta ordem)

1. **Supabase → SQL Editor → New query** → cole `supabase/updates_pacotes_aviso.sql` → **Run**. (Restaura os pacotes e o aviso. Não apaga nada.)
   - Se ainda não rodou antes, rode também `supabase/payments.sql` e `supabase/slots30.sql` (idempotentes).
2. Substitua os arquivos do repositório pelos do zip e faça commit. A Vercel faz o deploy. **Não precisa de variável nova.**
3. Confirme na Vercel: `MP_ACCESS_TOKEN` (para cobrar de verdade, o de **produção**), `SITE_URL` (começando com `https://`, sem barra no final) e `MP_WEBHOOK_SECRET`. O webhook no painel do Mercado Pago continua `https://SEU-SITE/api/payments/webhook`, evento **Pagamentos**.
4. Depois do deploy, abra o site **duas vezes** (uma vez só para quem já tinha o app instalado: o service worker antigo ainda serve a versão antiga na primeira abertura). Se algum cliente continuar com versão velha: peça para abrir `https://SEU-SITE/?limpar-cache` ou tocar em **Atualizar app** no rodapé. **Daqui para frente as atualizações chegam sozinhas.**
5. Teste: um agendamento com Pix de valor baixo (seção 8) e confira o pop-up em **Acesso do Barbeiro (2FA) → Editar Pop-up de Aviso**.

### Como o barbeiro edita o pop-up
Rodapé → **Acesso do Barbeiro (2FA)** → login + código → **Editar Pop-up de Aviso**. Escreva título e mensagem (a pré-visualização mostra como o cliente verá), escolha "Válido até" se quiser e **Salvar aviso**. Cada vez que salvar, o pop-up aparece de novo para todos, mesmo para quem já tinha fechado o anterior. Para parar de mostrar, desmarque **Mostrar o pop-up** e salve. O pop-up aparece **uma vez por aparelho** até o barbeiro salvar um novo texto.

---

## 6. Testes já executados (ambiente de desenvolvimento, Supabase e Mercado Pago simulados)

Servidor (34 verificações, todas OK): pacotes (R$ 130/260, ordem, economia, destaque, benefícios); aviso (formato antigo `DD/MM/AAAA`, proteção sem login = 401, validações de título/mensagem/data, nova versão reabre o pop-up, vencido e desativado não aparecem); Pix (payload enviado ao Mercado Pago, formato de `date_of_expiration`, chave de idempotência, reaproveitamento sem duplicar, recusa de pago/pagar no local/reserva vencida, webhook aprovado confirma o agendamento, rota antiga `/checkout` devolve 404 em JSON).

Navegador (Chromium headless, celular 390 px): pop-up com o texto do servidor e validade `dd/mm/aaaa`; não reaparece após fechar; pacotes mostram R$ 130,00 e R$ 260,00; fluxo completo de agendamento → Pix → QR e código na tela → copiar (conferido na área de transferência) → pagamento simulado → comprovante "PIX · PAGO ✔" **sem redirecionar**; service worker registrado; `?limpar-cache` limpa e remove o parâmetro; editor do barbeiro (carregar, pré-visualizar, salvar, cliente novo vê, quem já fechou vê de novo, desativar). Nenhum erro de JavaScript no console.

`npx vite build` passou. `tsc --noEmit` mostra 2 erros **antigos** em `Header.tsx` (`boolean | null`), que já existiam e não afetam o build.

## 7. NÃO foi testado (precisa de você)
- **Pix real no Mercado Pago**: o ambiente não tem acesso à API. Teste com credenciais de teste e depois uma cobrança real de valor baixo.
- Webhook real chegando (Vercel → Logs → `/api/payments/webhook` com status 200).
- Comportamento do service worker em iPhone/Safari e nos navegadores embutidos (Instagram/WhatsApp) — a lógica é padrão, mas só dá para confirmar no aparelho.
- `npm install` falha por conflito de dependências (`esbuild ^0.25` × `vite 8` pede `^0.27 || ^0.28`); funciona com `npm install --legacy-peer-deps`. O projeto já tem `bun.lock`, então a Vercel provavelmente usa bun. Ajustar `esbuild` no `package.json` resolve de vez (não mexi para não alterar o deploy atual).

## 8. Lista de testes para você (marque ao validar)
- [ ] Depois do deploy e de abrir 2 vezes, o app instalado mostra a versão nova.
- [ ] Publicar uma alteração qualquer: o app aberto atualiza sozinho (no máximo uns minutos / ao reabrir).
- [ ] Pacotes: R$ 130,00 e R$ 260,00 na tela inicial e na lista do agendamento.
- [ ] Agendar com Pix: aparece QR Code + "Pix copia e cola"; **Copiar código Pix** funciona; pagar no app do banco; a tela vira "Agendamento Confirmado" sozinha.
- [ ] Agenda do barbeiro mostra o agendamento como **Pago**.
- [ ] Fechar a janela do Pix e reabrir em **Meus horários → Pagar agora com Pix** mostra o **mesmo** QR.
- [ ] Cancelar um agendamento com Pix pendente: o Pix deixa de poder ser pago.
- [ ] Editor de aviso: salvar texto novo → abrir o site em aba anônima → pop-up novo aparece.
- [ ] Desmarcar "Mostrar o pop-up" → aba anônima não mostra nada.

## 9. Próximos passos sugeridos (não feitos)
1. Teste ponta a ponta com Pix real e ajustes que surgirem nos logs da Vercel.
2. Botão de **reembolso** na Agenda do barbeiro (`POST /v1/payments/{id}/refunds`) e alerta visual para "Cancelado + Pago".
3. Painel para o barbeiro **editar pacotes** (título, preço, benefícios) como já existe para serviços — hoje só por SQL.
4. Aviso ao barbeiro (WhatsApp/e-mail) quando um Pix for aprovado ou houver `PAYMENT_APPROVED_SLOT_LOST`.
5. Migrar para a API Orders do Mercado Pago quando for conveniente.
6. Restrição de exclusão no Postgres para impedir sobreposição simultânea de horários (pendência antiga).
7. Cabeçalho `immutable` para `/assets/*` na Vercel (otimização opcional; a regra tem que ser testada com cuidado para não quebrar o deploy).

---

## 10. Prompt pronto para outra IA (versão da 1ª rodada — a versão atual está na seção 14)

> Projeto: PWA de barbearia (React 19 + Vite 8 + Tailwind 4 + vite-plugin-pwa), backend Express exportado como função serverless da Vercel (`api/index.ts` → `src/server/app.ts`), banco Supabase via `@supabase/supabase-js` com service role (`src/server/db.ts`). Leia `ALTERACOES_CACHE_PIX_PACOTES_AVISO.md` primeiro, depois `PAGAMENTOS_MERCADO_PAGO.md` e `LEIA-ME_ALTERACOES.md`.
> Estado: (1) atualização do PWA: `vite.config.ts` (workbox sem fotos no precache, `/api` NetworkOnly, `skipWaiting`/`clientsClaim`) + `src/lib/appUpdate.ts` (registra `/sw.js`, checa atualização ao abrir/voltar/reconectar/15 min e recarrega na hora certa; `/?limpar-cache` e botão "Atualizar app" limpam tudo); (2) Pix dentro do app: `POST /api/payments/pix` cria pagamento em `POST /v1/payments` do Mercado Pago e devolve QR + copia e cola, exibidos por `PixPaymentPanel.tsx` (usado em `BookingModal` e `MyAppointmentsModal`); confirmação por webhook `POST /api/payments/webhook` + polling em `GET /api/payments/status/:id`; reserva `pending` expira em 15 min (`db.expireUnpaid`); (3) pacotes lidos do jsonb `data` em `db.getPackages()` (R$ 130 e R$ 260; SQL em `supabase/updates_pacotes_aviso.sql`); (4) pop-up de aviso editável: `GET /api/notices/active`, `GET/PUT /api/admin/notice`, `NoticeEditor.tsx` no painel do barbeiro.
> Tarefas: (a) validar o deploy e o Pix real com credenciais de teste e depois produção, corrigindo erros dos logs; (b) botão de reembolso na agenda do barbeiro; (c) painel para editar pacotes; (d) notificar o barbeiro quando um Pix for aprovado ou houver `PAYMENT_APPROVED_SLOT_LOST`; (e) corrigir o conflito de `esbuild` no `package.json` e os 2 erros de tipo em `Header.tsx`. Não quebrar: sempre responder JSON em `/api`, preço sempre vindo do banco, `vercel.json` com poucas regras (regra inválida derruba o deploy).


---

## 11. 2ª rodada (26/10/2026) — o que mudou

| Pedido | Solução | Arquivos |
|---|---|---|
| Calendário não aparecia no celular | O ícone nativo do `<input type="date">` é escuro; no fundo preto sumia. Agora ele é **branco** (CSS `filter: invert`) e maior, e **tocar em qualquer parte do campo abre o calendário** (`showPicker()`). Vale para todos os campos de data (agendamento e "Válido até" do aviso). | `src/index.css`, `src/components/BookingModal.tsx` |
| Pix QR Code / copia e cola sem redirecionar | **Já estava pronto na 1ª rodada** (seção 4). O Mercado Pago continua gerando o código nos bastidores (é isso que permite a confirmação automática), mas o cliente nunca sai do app. Sem `MP_ACCESS_TOKEN` na Vercel o Pix fica indisponível e só "pagar no local" funciona. | `PixPaymentPanel.tsx`, `POST /api/payments/pix` |
| Mensagem do pop-up escrita pelo barbeiro | **Já estava pronto na 1ª rodada** (Acesso do Barbeiro → Editar Pop-up de Aviso, com pré-visualização). | `NoticeEditor.tsx`, `/api/admin/notice` |
| Faturamento dia/mês | Botão verde **Faturamento (dia / mês)** no painel do barbeiro: faturado **hoje**, faturado **no mês** (com nº de atendimentos e média), total por **Pix** / **no local**, **a receber**, gráfico dia a dia e navegação mês a mês. Regra: conta só agendamento **pago** e **não cancelado**, no **dia do atendimento**. Pix online vira "pago" sozinho; pagamento no local vira "pago" quando o barbeiro marca na Agenda. Cancelado já pago aparece como **alerta de reembolso** e não entra no total. | `src/server/revenue.ts`, `GET /api/admin/revenue?month=AAAA-MM`, `src/components/RevenuePanel.tsx`, `BarberAdminAuthModal.tsx` |
| Botão "Instalar no iPhone/Android" | Agora o botão se chama só **Baixar agora** (Android e iPhone). No iPhone, como o Safari não permite instalar com um toque, o botão abre um guia de 2 passos (Compartilhar → Adicionar à Tela de Início). Some sozinho se o app já está instalado. | `src/components/PWAInstallButton.tsx` |
| Erro de tipo antigo | Corrigido `showAdminToggle={!!isAdmin}` (`tsc --noEmit` agora passa limpo). | `src/components/Header.tsx` |

Testes da 2ª rodada: servidor 43 verificações OK (inclui faturamento e segurança); navegador (com os cabeçalhos de segurança/CSP ativos, sem erros no console): fluxo completo de Pix, editor de aviso, painel de faturamento (R$ 75,00 hoje com cancelado-pago excluído e alerta de reembolso), calendário com ícone branco.

---

### 11.1 3ª rodada (29/10/2026) — Pix com erro 401 e botão "Baixar agora" no Android

**Pix: "Mercado Pago recusou a requisição (401). Unauthorized use of live credentials".**
Não é bug do código. Segundo a documentação do Mercado Pago (código `unauthorized_use_of_live_credentials`), significa que **as credenciais de produção da conta ainda não estão ativadas**. O que fazer (no painel do Mercado Pago, que a IA não consegue acessar):
1. Mercado Pago Developers → **Suas integrações** → sua aplicação → **Credenciais de produção** → **Ativar credenciais** (pede dados do negócio, site e aceite dos termos).
2. Copie o **Access Token de produção** e coloque em `MP_ACCESS_TOKEN` na Vercel (Settings → Environment Variables) → **Redeploy**.
3. Confira `SITE_URL` (`https://...`, sem barra no final) e o webhook (`/api/payments/webhook`, evento Pagamentos).
4. Se quiser testar antes de ativar produção, use as credenciais/usuários de TESTE do Mercado Pago (não misture token de teste com comprador real).
No código: o cliente agora vê só "O pagamento por Pix está indisponível no momento. Escolha pagar no local ou fale com o barbeiro" (nada técnico); o motivo real vai para o log da Vercel e para a tabela `audit_logs` (ação `PIX_CREATE_FAILED`).

**Botão "Baixar agora" não aparecia no Android.** Causa: na 2ª rodada só troquei o texto. O botão só existia quando o Chrome disparava o evento `beforeinstallprompt` (e ficava escondido no menu ☰). Agora:
- Há um botão grande **BAIXAR AGORA** na tela inicial do celular (`HeroSection.tsx`) e no menu ☰.
- Android/Chrome com instalação disponível → 1 toque abre o instalador do Chrome.
- Android sem esse aviso → abre um guia (⋮ → Instalar app / Adicionar à tela inicial). iPhone → guia do Safari (Compartilhar → Adicionar à Tela de Início).
- Computador → só aparece se o navegador permitir instalar. App já instalado → não aparece.
- Arquivos: `PWAInstallButton.tsx` (reescrito), `usePWAInstall.ts` (detecta Android), `HeroSection.tsx`.
Testado no Chromium emulando Android, Android com instalação nativa, iPhone e computador.

**Importante para quem já tem o app instalado:** o aplicativo instalado só mostra a versão nova depois do deploy e de abrir o app 2 vezes (ou abrir `/?limpar-cache`). O botão "Baixar agora" nunca aparece dentro do app já instalado.

---

## 12. Auditoria de segurança (26/10/2026)

### 12.1 Estado geral
Base já era boa: senhas com bcrypt, login do barbeiro com 2FA (TOTP) e bloqueio por IP após 5 falhas, preço sempre vindo do banco, RLS ligado no Supabase **sem policies** (a chave pública não lê nada; só o backend com a service role), webhook do Mercado Pago confirmado consultando a API do Mercado Pago, JSON sempre nos erros, sem `dangerouslySetInnerHTML`/`eval` no código, e `npm audit --omit=dev` = **0 vulnerabilidades** (nesta data).

### 12.2 Problemas encontrados e CORRIGIDOS
| # | Problema | Correção |
|---|---|---|
| 1 | Sem **CSP** e sem cabeçalhos de segurança nas páginas do site (só na API) | `vercel.json`: Content-Security-Policy (só carrega código/dados do próprio site; fontes do Google permitidas), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`. API: `Referrer-Policy`, `Permissions-Policy`, `COOP`; `x-powered-by` desligado. Testado no navegador: app funciona sem violações. |
| 2 | Cadastro, "esqueci a senha", redefinição, agendamento e Pix **sem limite de tentativas** (spam e adivinhar o código de 8 caracteres de redefinição) | Limite por IP: cadastro 10/h, esqueci a senha 5/h, redefinir 10/15 min, agendar 20/h, Pix 30/h, setup 10/h (`db.hitRateLimit`, usa a tabela `login_attempts`; se o banco falhar, não derruba o site). |
| 3 | Agendamento com nome de serviço **fora do catálogo** aceitava o **preço enviado pelo navegador** (até R$ 2.000) — agora que existe faturamento, isso poderia sujar os números | Item fora do catálogo é recusado; o preço é **sempre** o do banco. |
| 4 | IDs de agendamento/usuário previsíveis (`apt_<hora>_<4 letras>`) e a tela de status do pagamento é pública por id | IDs novos usam 9 bytes aleatórios (`crypto`). Os antigos continuam existindo, mas expiram na prática. |
| 5 | Erros 500 devolviam texto interno (ex.: "Erro no banco ...") ao navegador | Detalhes de banco/configuração só vão para o log da Vercel; o cliente vê mensagem genérica. JSON quebrado → 400 limpo; corpo limitado a 50 KB. |
| 6 | Senha mínima de 6 caracteres | Mínimo **8** (cadastro e redefinição; máx. 100). Contas antigas continuam entrando. |
| 7 | Sessão do barbeiro durava 7 dias | **3 dias** (precisa refazer login + 2FA). |
| 8 | E-mail de visitante sem validação de formato | Validado; se inválido usa o e-mail técnico do telefone. |
| 9 | Erro de tipo `Header.tsx` | Corrigido. |

### 12.3 Riscos que continuam (decisão sua / próxima IA)
1. **Token de login fica no `localStorage`** (e também em cookie `HttpOnly`). Se um dia houver XSS, o token poderia ser lido. Mitigado por CSP + ausência de HTML dinâmico. Solução futura: usar só o cookie `HttpOnly` e remover o `Authorization` no navegador.
2. **Senhas e 2FA antigos vazaram** em versões anteriores do repositório (já documentado em `LEIA-ME_ALTERACOES.md` §4). Confirme que: o repositório está **privado**; você trocou a senha master e refez o 2FA pelo `/api/setup`; **`SETUP_KEY` foi apagada da Vercel**.
3. **`MP_WEBHOOK_SECRET`**: sem ele o webhook é aceito de qualquer origem (o app reconfere o pagamento no Mercado Pago, então não dá para falsificar um pagamento, mas configure o segredo mesmo assim).
4. **`ALLOW_PREVIEW_RESET_TOKEN` não pode ser `true`** na Vercel.
5. Ative **verificação em duas etapas** nas contas que controlam o negócio: GitHub, Vercel, Supabase e Mercado Pago. A `SUPABASE_SERVICE_ROLE_KEY` e o `MP_ACCESS_TOKEN` só podem existir na Vercel — nunca no código, no GitHub ou em print.
6. Sem CAPTCHA: o limite por IP segura abuso simples, não ataques distribuídos. Se aparecer spam de cadastros, adicionar Cloudflare Turnstile/hCaptcha.
7. O limite de requisições depende do banco; se `login_attempts` não existir (rode `supabase/schema.sql` original), ele não bloqueia nada (mas o site funciona).
8. Visitantes (sem conta) podem agendar informando telefone; o limite é 3 agendamentos ativos por telefone e 20 por hora por IP.
9. Para a CSP: se um dia adicionar scripts de terceiros (Google Analytics, Pixel etc.) é preciso liberar o domínio em `vercel.json`; caso contrário ficam bloqueados (de propósito).
10. `vercel.json` com regra inválida derruba o deploy — o arquivo atual foi validado como JSON, mas **a Vercel não foi testada daqui**: se o deploy falhar, a primeira coisa a conferir é esse arquivo.

---

## 13. Plano até o final (o que falta, em ordem)
1. **Você**: rodar `supabase/updates_pacotes_aviso.sql`; subir o zip; conferir variáveis da Vercel (seção 5); abrir o site 2 vezes.
2. **Você**: testar Pix real de valor baixo (seção 8) e olhar **Vercel → Logs** se algo falhar. Enviar print/log para a próxima IA.
3. **Você**: aplicar os itens 2–5 de 12.3 (privado, SETUP_KEY, webhook secret, 2FA nas contas).
4. **IA**: corrigir o que aparecer no teste real do Pix (campos exigidos pelo Mercado Pago, formato da validade, e-mail do pagador).
5. **IA**: botão de **reembolso** na Agenda (`POST /v1/payments/{id}/refunds`) e alerta "Cancelado + Pago".
6. **IA**: painel para **editar pacotes** (hoje só por SQL).
7. **IA**: aviso ao barbeiro (WhatsApp/e-mail) quando um Pix for aprovado ou houver `PAYMENT_APPROVED_SLOT_LOST`.
8. **IA**: remover o token do `localStorage` (item 12.3-1) e, se necessário, CAPTCHA.
9. **IA**: migrar para a API Orders do Mercado Pago quando conveniente; corrigir conflito de `esbuild` no `package.json` (`npm install` exige `--legacy-peer-deps`).
10. **IA**: lembretes automáticos de horário e restrição de exclusão no Postgres contra sobreposição simultânea.

## 14. Prompt pronto para outra IA (versão atual)

> Projeto: PWA de barbearia (React 19 + Vite 8 + Tailwind 4 + vite-plugin-pwa), backend Express como função serverless da Vercel (`api/index.ts` → `src/server/app.ts`), banco Supabase via `@supabase/supabase-js` com service role (`src/server/db.ts`). Leia **`ALTERACOES_CACHE_PIX_PACOTES_AVISO.md` inteiro primeiro** (seções 3, 4, 11, 12, 13), depois `PAGAMENTOS_MERCADO_PAGO.md` e `LEIA-ME_ALTERACOES.md`.
> Já feito: atualização automática do PWA (`src/lib/appUpdate.ts`, workbox em `vite.config.ts`); Pix dentro do app (`POST /api/payments/pix`, `PixPaymentPanel.tsx`, webhook + polling); pacotes lidos do jsonb `data`; pop-up de aviso editável (`NoticeEditor.tsx`, `/api/admin/notice`); faturamento (`src/server/revenue.ts`, `GET /api/admin/revenue`, `RevenuePanel.tsx`); calendário com ícone branco; botão "Baixar agora"; endurecimento de segurança (CSP em `vercel.json`, `db.hitRateLimit`, catálogo obrigatório no agendamento, senha ≥ 8, ids aleatórios, erros sem detalhes).
> Tarefas, nesta ordem: seção 13 itens 4 a 10. Regras: `/api` sempre responde JSON; preço sempre do banco; não relaxar a CSP sem necessidade; `vercel.json` com poucas regras (regra inválida derruba o deploy); rodar `npx tsc --noEmit` e `npx vite build` antes de entregar; testar pagamentos com credenciais de teste do Mercado Pago antes de produção.
