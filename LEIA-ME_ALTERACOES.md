# BARBERSHOP L.A — Relatório de correção e próximos passos

(Documento feito para você seguir sozinho **ou entregar para outra IA** continuar de onde parei.)

## 1. Qual era o erro

Mensagem na tela: `Unexpected token 'T', "The page c"... is not valid JSON`.

**Causa:** o projeto exportado do Stitch/AI Studio tem um servidor **Express** (`server.ts`) com um "banco" em arquivo (`barbershop_db.json`). A Vercel só publicou a parte visual (Vite). Não existe servidor Express rodando lá, então toda chamada `/api/...` voltava a página de erro da Vercel ("The page could not be found" — um HTML). O front tentava ler como JSON e quebrava.

Além disso, **o código não usava Supabase em nenhum lugar** (nenhuma referência a `supabase`). Ou seja: Supabase estava criado, mas não ligado ao app.

## 2. O que foi alterado

| Arquivo | Mudança |
|---|---|
| `api/index.ts` (novo) | Entrada da função serverless da Vercel. |
| `vercel.json` (novo) | Redireciona `/api/*` para a função. |
| `src/server/app.ts` (novo) | Todas as rotas do Express (login cliente, login barbeiro 2 etapas, recuperação de senha, settings…) agora `async` e usando Supabase. Sempre responde JSON, inclusive em erro/404. |
| `src/server/db.ts` (reescrito) | Em vez de arquivo JSON, usa Supabase (`@supabase/supabase-js`, service role). Bloqueio de força bruta agora salvo no banco (em serverless a memória não persiste). |
| `server.ts` | Virou só o servidor **local** de desenvolvimento. |
| `supabase/schema.sql` (novo) | Cria as tabelas + dados iniciais (serviços, pacotes, aviso, horários). RLS ligado. |
| `src/services/api.ts` | Se o servidor devolver HTML, mostra mensagem clara em vez do erro de JSON. |
| `vite.config.ts` | PWA não intercepta `/api`; service worker de dev desligado. |
| `package.json` | Adicionado `@supabase/supabase-js`. |
| `.env.example`, `.gitignore` | Variáveis necessárias; `barbershop_db.json` removido/ignorado. |
| `BarberAdminAuthModal.tsx`, `ClientAuthModal.tsx` | Removidos a dica do código mestre `777888` e a conta demo com senha. |

### Correções de segurança (importantes)
1. **Código 2FA "mestre" (`777888` / `123456`) removido.** Antes qualquer pessoa entrava como admin só com a senha + esse código.
2. **QR Code/chave do 2FA era público** (qualquer um abrindo o modal recebia). Agora só o admin já logado vê.
3. **Recuperação de senha devolvia o código na resposta da API** → qualquer um poderia trocar a senha de qualquer conta, inclusive do admin. Agora o código só é devolvido se `ALLOW_PREVIEW_RESET_TOKEN=true` (só para teste) e **admin não usa esse fluxo**.
4. `JWT_SECRET` não tem mais valor padrão em produção.
5. Admin é criado por uma página única protegida por chave (`/api/setup`), com senha e segredo 2FA **novos**.

## 3. O que VOCÊ precisa fazer (nesta ordem)

### Passo A — Supabase
1. Supabase → **SQL Editor** → New query → cole todo o `supabase/schema.sql` → **Run**.
2. Supabase → **Project Settings → API**: copie a **Project URL** e a chave **service_role** (secreta, não é a `anon`).

### Passo B — Vercel (Settings → Environment Variables)
Crie (para Production, Preview e Development):

| Nome | Valor |
|---|---|
| `SUPABASE_URL` | URL do projeto |
| `SUPABASE_SERVICE_ROLE_KEY` | chave service_role |
| `JWT_SECRET` | texto longo e aleatório (ex.: 64+ caracteres) |
| `SETUP_KEY` | chave temporária forte |
| `ADMIN_EMAIL` | (opcional) e-mail do admin; padrão `leo.arruda226@gmail.com` |

### Passo C — Código no GitHub
1. Substitua os arquivos do repositório pelos desta pasta (ou faça upload do zip).
2. **Apague `barbershop_db.json` do repositório** (`git rm barbershop_db.json`).
3. Rode `npm install` (ou `bun install`) para atualizar o lockfile e faça commit.
4. A Vercel faz o deploy sozinha. Confirme em **Deployments → Functions** que existe `/api`.

### Passo D — Criar o administrador (uma vez)
1. Abra `https://SEU-SITE.vercel.app/api/setup`.
2. Informe a `SETUP_KEY` e uma **senha master nova** (mín. 10 caracteres).
3. Escaneie o QR no Google Authenticator/Authy. A tela não aparece de novo.
4. **Apague `SETUP_KEY` na Vercel** e faça redeploy.

### Passo E — Testar
- Cliente: aba "Criar conta" → cadastrar → entrar.
- Barbeiro: e-mail admin + senha nova → código de 6 dígitos do autenticador.
- Teste rápido da API: abrir `https://SEU-SITE.vercel.app/api/settings` deve mostrar um JSON (não HTML).

## 4. ⚠️ Segurança: o que já vazou
O repositório continha a senha antiga do admin (`Leonardo@2026`, escrita em comentário e no seed), o segredo 2FA antigo, o hash das senhas e o JWT secret padrão. **Considere todos comprometidos**: por isso o Passo D cria senha e 2FA novos. Se o repositório for público, deixe-o **privado**. Se usa essa mesma senha em outro lugar, troque.

## 5. Pendências (não feitas)
- **Não consegui rodar `npm install`/build aqui (sem internet)**: o código passou em checagem de sintaxe, mas **não foi testado em execução**. Se o deploy falhar, copie o log do erro da Vercel (Deployments → build/Function logs) e envie.
- **Agendamentos ainda ficam no `localStorage` do celular** (`BookingModal.tsx`, `MyAppointmentsModal.tsx`): não vão para o Supabase, o barbeiro não os vê. Próxima etapa: criar tabela `appointments` + rotas `/api/appointments` com validação de horário duplicado.
- **Recuperação de senha de cliente não envia e-mail.** Integrar Resend/SendGrid e enviar o código; até lá use o WhatsApp do barbeiro para casos de senha perdida.
- Serviços/pacotes no front estão fixos em `App.tsx`; existe `/api/services` e `/api/packages` prontos para o front passar a consumir.
- Pagamentos (Pix/cartão) aparecem no plano, mas não estão implementados.
- Possíveis problemas de build para checar: se a Vercel reclamar de import em `api/index.ts`, os imports internos usam `.js` (padrão ESM); me envie o log.

## 6. Prompt pronto para outra IA
> Tenho um PWA de barbearia (React 19 + Vite + Tailwind 4) deployado na Vercel com Supabase. O backend é um Express em `src/server/app.ts` exportado como função serverless em `api/index.ts` (rewrite em `vercel.json`), e acessa o Supabase em `src/server/db.ts` com a service role key. Auth própria: bcrypt + JWT + TOTP (otplib). Leia `LEIA-ME_ALTERACOES.md`. Próximas tarefas: (1) validar o build/deploy na Vercel; (2) migrar agendamentos do localStorage para uma tabela `appointments` com constraint UNIQUE (data+horário) e rotas protegidas; (3) enviar e-mail de recuperação de senha; (4) painel do barbeiro para ver/confirmar/cancelar agendamentos.
