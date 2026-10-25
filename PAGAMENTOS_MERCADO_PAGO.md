# BARBERSHOP L.A — Pagamentos online (Pix e Cartão com Mercado Pago)

Documento de **passo a passo** + **registro de tudo que foi alterado** + **o que ainda falta**.
Serve para você seguir sozinho ou entregar a outra IA continuar de onde parei.

> ⚠️ **Honestidade técnica:** o código foi escrito e conferido (sintaxe e tipos), mas **não foi executado nem testado contra o Mercado Pago de verdade** (o ambiente onde foi feito não tem internet). Teste primeiro com credenciais de TESTE (passo 8) antes de cobrar clientes reais. Se algo falhar, mande o print/log da Vercel.

---

## 1. Como vai funcionar para o cliente

1. Cliente escolhe serviço, dia e horário → na etapa de pagamento escolhe **Pix** ou **Cartão**.
2. O app cria o agendamento como **"Aguardando pagamento"** (o horário fica **reservado por 15 minutos**) e leva o cliente para a página segura do **Mercado Pago**.
3. Cliente paga lá (Pix: QR/copia e cola; Cartão: digita os dados no site do Mercado Pago — **os dados do cartão nunca passam pelo seu app**).
4. O Mercado Pago avisa o seu servidor automaticamente (**webhook**) → o agendamento vira **Confirmado + Pago**. O cliente volta ao app e vê "Pagamento aprovado".
5. Se não pagar em 15 min, o horário é **liberado sozinho**. O cliente pode tentar de novo em *Meus Agendamentos → Pagar agora* enquanto estiver dentro dos 15 min.
6. "Pagar no local" continua funcionando como antes.

Decisão técnica: usei o **Checkout Pro** (página do Mercado Pago) para Pix e Cartão. É o caminho mais simples e seguro (sem CPF/cartão no seu sistema, sem exigências de PCI). O QR do Pix aparece na página do Mercado Pago, não dentro do seu app. (Mostrar o QR dentro do app é um upgrade futuro — ver seção 7.)

---

## 2. Passo a passo para VOCÊ fazer

### Passo 1 — Conta no Mercado Pago
- Use (ou crie) uma conta Mercado Pago **da barbearia/Leonardo**, com os dados verificados. É nela que o dinheiro cai.
- Se quiser receber Pix, cadastre/ative sua chave Pix na conta.

### Passo 2 — Criar a aplicação (para obter as chaves)
1. Acesse o painel de desenvolvedores do Mercado Pago (busque por **"Mercado Pago Developers"** → **Suas integrações**).
2. **Criar aplicação** → nome "BARBERSHOP L.A" → tipo de solução: **Pagamentos online** → produto: **Checkout Pro**.
3. Aceite os termos e conclua.
(Os nomes dos menus podem mudar um pouco; se não achar, procure "Credenciais" dentro da aplicação.)

### Passo 3 — Pegar as credenciais
Dentro da aplicação, em **Credenciais**:
- **Credenciais de teste** → copie o **Access Token de teste** (use primeiro para testar).
- **Credenciais de produção** → ficam disponíveis depois de preencher os dados do negócio (use no final).
O **Access Token é secreto**: nunca coloque no GitHub, nem em código do site, nem mande em print.

### Passo 4 — Rodar o SQL no Supabase
Supabase → **SQL Editor** → New query → cole o conteúdo de `supabase/payments.sql` → **Run**.
(Só adiciona 2 colunas na tabela `appointments`. Não apaga nada. Rode **antes** de subir o código novo.)

### Passo 5 — Variáveis na Vercel
Vercel → seu projeto → **Settings → Environment Variables** (marque Production, Preview e Development):

| Nome | Valor |
|---|---|
| `MP_ACCESS_TOKEN` | Access Token **de teste** (depois troque pelo de produção) |
| `SITE_URL` | endereço do site, **sem barra no final**, ex.: `https://barbershop-la.vercel.app` |
| `MP_WEBHOOK_SECRET` | deixe para o passo 7 |

### Passo 6 — Subir o código novo
Substitua os arquivos do repositório pelos do zip (ou faça upload) e faça commit. A Vercel faz o deploy sozinha. Se o deploy der erro, copie o log (Deployments → clique no deploy → Build Logs) e me envie.

### Passo 7 — Configurar o aviso automático (webhook)
1. No Mercado Pago Developers → sua aplicação → **Webhooks** (ou "Notificações").
2. URL de notificação: `https://SEU-SITE.vercel.app/api/payments/webhook`
3. Evento: marque **Pagamentos** (`payment`).
4. Salve. O Mercado Pago mostra uma **chave secreta (assinatura)** → copie.
5. Vercel → crie `MP_WEBHOOK_SECRET` com essa chave → **Redeploy**.
(Mesmo sem o webhook, o app consulta o Mercado Pago quando o cliente volta ao site — mas o webhook é o que garante a confirmação quando o cliente fecha a página antes.)

### Passo 8 — Testar (modo teste)
1. Com o Access Token **de teste**, faça um agendamento escolhendo **Pix** e outro com **Cartão**.
2. Use **contas/compradores de teste** e **cartões de teste** do Mercado Pago (veja na documentação deles: "Contas de teste" e "Cartões de teste"). Não use cartão real em teste.
3. Confira: o agendamento vira "Confirmado · Pago ✔" em *Meus Agendamentos* e na **Agenda do barbeiro**.
4. Teste também: desistir sem pagar → após 15 min o horário volta a ficar livre.

### Passo 9 — Ir para produção
1. No Mercado Pago, ative as **credenciais de produção** (pode exigir completar dados do negócio).
2. Vercel → troque `MP_ACCESS_TOKEN` pelo **de produção** → Redeploy. Atualize também o webhook em modo produção (URL + chave secreta) se o painel tiver configurações separadas para teste e produção.
3. Faça **uma compra real de valor baixo** e depois reembolse pelo painel do Mercado Pago, para validar tudo.

### Passo 10 — Dia a dia
- **Reembolso/cancelamento de horário já pago:** o cliente não consegue cancelar sozinho (o app manda falar no WhatsApp). Você cancela na Agenda e **faz o reembolso no painel do Mercado Pago** (não é automático).
- **Taxas:** o Mercado Pago cobra tarifa por transação (Pix e cartão têm taxas diferentes). Consulte os valores atuais no site deles antes de definir preços.

---

## 3. O que foi alterado no código

| Arquivo | Mudança |
|---|---|
| `supabase/payments.sql` (novo) | Colunas `mp_preference_id` e `mp_payment_id` em `appointments`. |
| `src/server/db.ts` | `expireUnpaid()` (libera reservas não pagas após 15 min); `findCatalogPrice()` (preço oficial do banco); `updateAppointment` aceita ids do Mercado Pago; `AppointmentRow.mpPaymentId`. |
| `src/server/app.ts` | **Preço agora vem do banco** (não do navegador) — obrigatório para pagar online. Agendamento online nasce `pending`. Novas rotas: `POST /api/payments/checkout` (cria link do Mercado Pago), `POST /api/payments/webhook` (recebe aviso, valida assinatura se `MP_WEBHOOK_SECRET` existir e **consulta o pagamento direto no Mercado Pago**), `GET /api/payments/status/:id` (tela de retorno). Cliente não cancela horário já pago online. |
| `src/services/api.ts` | `createCheckout`, `getPaymentStatus`. |
| `src/components/BookingModal.tsx` | Pix/Cartão redirecionam ao Mercado Pago; textos sem "Sandbox"; itens "à combinar" só pagam no local; botão "Pagar com Mercado Pago". |
| `src/components/MyAppointmentsModal.tsx` | Status "Aguardando pagamento", botão "Pagar agora", marca "Pago ✔". |
| `src/components/PaymentReturnModal.tsx` (novo) + `App.tsx` | Tela exibida na volta do Mercado Pago (aprovado / aguardando / não concluído). |
| `.env.example` | `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `SITE_URL`. |

### Decisões de segurança
- O valor cobrado é o **do catálogo no Supabase** (pelo nome do serviço/pacote). Cliente mal-intencionado não consegue pagar R$ 1 por um serviço de R$ 50.
- O webhook **não confia** no conteúdo recebido: sempre pergunta ao Mercado Pago o status real do pagamento. Também confere valor e moeda (BRL).
- Pagamento aprovado é aplicado **uma vez só** (idempotente).
- Access Token fica só no servidor (Vercel), nunca no navegador.

---

## 4. Situações especiais (para você saber)
- **Pagou depois dos 15 min e o horário já foi tomado por outra pessoa:** o pagamento fica marcado como Pago, o agendamento permanece Cancelado e é gravado no log (`PAYMENT_APPROVED_SLOT_LOST`). Na Agenda aparecerá "Cancelado" + "Pago" → **reembolse no Mercado Pago**.
- **Valor aprovado menor que o preço:** não confirma; fica no log (`PAYMENT_AMOUNT_MISMATCH`).
- **Nome do serviço editado:** o servidor acha o preço pelo nome atual no banco. Se o app estiver com lista antiga em cache, o pagamento online pode ser recusado até recarregar a página.
- Pacotes: o preço também vem da tabela `packages` (coluna `data`, campo `priceCents` ou `price`).

---

## 5. Lista de testes (marque ao validar)
- [ ] Pix de teste aprovado → agendamento Confirmado + Pago
- [ ] Cartão de teste aprovado → idem
- [ ] Cartão de teste recusado → mensagem "Pagamento não concluído" e botão "Pagar agora" funciona
- [ ] Fechar a página do Mercado Pago sem pagar → após 15 min horário liberado
- [ ] Webhook chegando (Vercel → Logs → `/api/payments/webhook` com status 200)
- [ ] "Pagar no local" continua igual
- [ ] Item "à combinar" não permite Pix/Cartão
- [ ] Agenda do barbeiro mostra "Pago"

## 6. Problemas comuns
| Sintoma | Causa provável |
|---|---|
| "Pagamento online indisponível no momento" | `MP_ACCESS_TOKEN` não está na Vercel (ou faltou redeploy) |
| "Mercado Pago recusou a requisição (401)" | Access Token errado/expirado |
| "(400) ... back_urls invalid" | `SITE_URL` errado ou com `http://`/barra no final |
| Pago mas continua "Aguardando" | Webhook não configurado/URL errada; ou `MP_WEBHOOK_SECRET` incorreto (veja Logs na Vercel: 401 = assinatura) |
| Erro de coluna `mp_payment_id` | Faltou rodar `supabase/payments.sql` |

## 7. O que ainda NÃO foi feito (próximos passos)
1. **Testar ponta a ponta** com credenciais de teste (principal pendência).
2. Botão de **reembolso** dentro da Agenda do barbeiro (chamar `POST /v1/payments/{id}/refunds`).
3. **Pix dentro do app** (QR + copia e cola sem sair do site) via `POST /v1/payments`; exige CPF do cliente.
4. Aviso para o barbeiro (e-mail/WhatsApp) quando um pagamento for aprovado ou quando houver `PAYMENT_APPROVED_SLOT_LOST`.
5. E-mail/WhatsApp de confirmação ao cliente (já existe `sendEmail` com Resend em `app.ts`).
6. Mostrar na Agenda um alerta visual para "Cancelado + Pago" (precisa reembolso).
7. Serviços/pacotes: o app busca `getPackages()` com colunas antigas (`title/price`) enquanto o banco guarda em `data` — revisar para os pacotes aparecerem corretos vindos do servidor (o preço de pagamento já lê o campo certo).

## 8. Prompt pronto para outra IA
> Projeto: PWA de barbearia (React 19 + Vite + Tailwind 4), backend Express exportado como função serverless da Vercel (`api/index.ts` → `src/server/app.ts`), banco Supabase via `@supabase/supabase-js` com service role (`src/server/db.ts`). Leia `PAGAMENTOS_MERCADO_PAGO.md`, `LEIA-ME_ALTERACOES.md` e `src/server/app.ts` (seção "PAGAMENTOS ONLINE"). Pagamento online usa Mercado Pago **Checkout Pro** (preferência em `POST /checkout/preferences`, confirmação por webhook `POST /api/payments/webhook` que consulta `GET /v1/payments/{id}`; reserva online fica `pending` por 15 min e expira em `db.expireUnpaid()`). Tarefas: (1) ajudar a testar com credenciais de teste e corrigir erros que aparecerem nos logs da Vercel; (2) implementar reembolso pelo painel do barbeiro; (3) opcional: Pix dentro do app; (4) notificações de pagamento aprovado.
