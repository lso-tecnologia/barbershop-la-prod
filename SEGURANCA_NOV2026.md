# Segurança — correções de novembro/2026

## ⚠️ Ordem para subir (importante)

1. **Supabase → SQL Editor → New query:** cole o arquivo `supabase/security_2026_11.sql` e clique em **Run**.
   O código novo depende das colunas e da função `hit_counter`. Sem elas, login e cadastro dão erro.
2. Depois suba o código (GitHub → a Vercel faz o deploy sozinha).
3. Todo mundo que estava logado vai precisar **entrar de novo uma vez**, porque o formato da sessão mudou.

---

## O que foi corrigido e por quê

| # | Problema | Correção | Arquivos |
|---|---|---|---|
| 1 | **Força bruta:** o bloqueio era por IP e qualquer login certo zerava o contador. O atacante zerava entrando na própria conta e tentava senhas sem limite. | Três contadores separados: por **IP** (20 erros/15 min), por **conta** (10/15 min) e por **2FA** (5/15 min). Um login certo só zera o contador **daquela** conta. | `app.ts` (`isBlocked`, `recordFailure`) |
| 2 | **Agendamentos de outras pessoas:** bastava criar conta com o e-mail da vítima (sem confirmar) para ver e cancelar os horários dela. Isso valia até para o e-mail automático `telefone@barbershopla.com.br`. | Um agendamento só é "seu" se você agendou logado **ou** se o seu e-mail foi **comprovado**. Hoje isso acontece ao usar "esqueci a senha", porque o código chega no e-mail. Ninguém consegue se cadastrar com `@barbershopla.com.br`. | `app.ts`, `db.ts` |
| 3 | O código-fonte antigo estava **público** em `/assets/aistudio/barbershop-la-pagamentos_8d12feaf.zip`. | Arquivo apagado. | `public/` |
| 4 | **Sessões:** o token ficava no `localStorage` (um XSS podia roubar), sair ou trocar a senha não derrubava a sessão, e a rota `2fa-setup` entregava o segredo do 2FA para qualquer sessão de admin. | Sessão **só em cookie HttpOnly**. Cada usuário tem uma `token_version`: trocar senha ou 2FA, ou o admin clicar em **Sair**, invalida todas as sessões antigas. O papel (cliente/admin) vem do banco, não do token. A rota `2fa-setup` foi removida. | `app.ts`, `api.ts`, `App.tsx` |
| 5 | O limite de pedidos liberava tudo se o banco falhasse, e pedidos simultâneos "furavam" a contagem. | Contagem atômica no banco (função `hit_counter`). Se o banco falhar, o servidor responde **503** em vez de liberar. | `db.ts`, `security_2026_11.sql` |
| 6 | Webhook sem segredo era aceito. | Com Pix ligado em produção, sem `MP_WEBHOOK_SECRET` o webhook é recusado. | `app.ts` |
| 7 | Um mesmo código 2FA podia ser usado duas vezes. | Guardamos o último código aceito (`two_factor_last_counter`); um código repetido é recusado. | `totp.ts`, `db.ts` |
| 8 | O código de "esqueci a senha" ficava salvo em texto puro. | Agora é salvo só o **hash SHA-256**, e o código é apagado antes de trocar a senha (não dá para usar duas vezes). | `db.ts` |
| — | `ALLOW_PREVIEW_RESET_TOKEN=true` funcionava em produção. | Agora só funciona fora de produção. | `app.ts` |

## Novidade: vários administradores, cada um com o próprio Google Authenticator

No painel do barbeiro, botão **"Administradores e Segurança"**:

- **Admins:** lista quem tem acesso e permite **cadastrar** um novo admin (nome, e-mail e senha provisória) ou **remover** um.
  No primeiro login, o novo admin vê um **QR Code**, escaneia no celular **dele** e cria a **senha definitiva**.
- **Trocar celular:** passa o 2FA da sua conta para outro celular. Você confirma com o código do celular atual, escaneia o QR novo e confirma com o código do celular novo. Só então o antigo para de funcionar.
- **Minha senha:** troca a senha (pede a senha atual + o código do app).

Toda ação dessas pede o **código atual do Google Authenticator**. Assim, mesmo quem roubasse uma sessão aberta não conseguiria criar admins nem trocar o 2FA.

Se **todos** os admins perderem o celular, a recuperação é pelo Supabase (SQL Editor), limpando o 2FA do admin:
```sql
update public.users set two_factor_secret = null, two_factor_pending_secret = null, two_factor_last_counter = null,
  token_version = token_version + 1 where email = 'EMAIL-DO-ADMIN';
```
No próximo login com e-mail e senha, o próprio site mostra um QR Code novo.

## Ainda vale a pena (não é código)
- Repositório do GitHub **privado**; 2FA ligado no GitHub, na Vercel, no Supabase e no Mercado Pago.
- `SETUP_KEY` **apagada** da Vercel (o admin já existe).
- Supabase grátis **pausa** depois de 7 dias sem uso. Se o site ficar parado, reative no painel (ou considere o plano Pro).
