> 🔄 **ATUALIZAÇÃO MAIS RECENTE (cache do PWA, Pix com QR Code dentro do app, pacotes e pop-up editável):** veja `ALTERACOES_CACHE_PIX_PACOTES_AVISO.md`. Onde este documento falar em redirecionar ao Mercado Pago/Checkout Pro, vale o novo documento.

# BARBERSHOP L.A — Alterações: só Pix, horários de 30 em 30 min e melhorias no celular

Documento com **tudo que foi modificado** e **todos os passos até concluir**. Serve para você ou para outra IA continuar.

> ⚠️ O código foi conferido (sintaxe e tipos), mas **não foi executado** de ponta a ponta (sem internet no ambiente onde foi escrito). Teste depois do deploy (seção 4). Se algo falhar, envie o print/log da Vercel.

---

## 1. O que mudou

### 1.1 Pagamento: só Pix (cartão removido)
- A opção "Cartão de Crédito / Débito" **saiu da tela de pagamento**. Ficam **Pagar no local** e **Pix (Mercado Pago)**.
- No servidor, o Mercado Pago agora só oferece Pix (cartões, boleto e caixa eletrônico bloqueados no checkout). Pedido de pagamento por cartão é recusado.
- Botão agora diz **"Pagar com Pix"**.
- "Pagar no local" continua aceitando dinheiro, Pix ou cartão na maquininha.
- Agendamentos antigos pagos com cartão (se existirem) continuam sendo exibidos normalmente.

### 1.2 Agenda de 30 em 30 minutos
- Horários de início: **Ter–Sáb 09:00 às 18:30** (fecha 19h) e **Dom 09:00 às 13:30** (fecha 14h). Segunda fechada.
- **Cada serviço ocupa o tempo que dura.** Ex.: serviço de 60 min às 09:00 ocupa 09:00 e 09:30; o próximo livre é 10:00. Serviço de 30 min ocupa só uma fatia.
- O app mostra "Este atendimento dura X min" e marca como **Ocupado** ou **Não cabe** (quando passaria do fechamento) os horários que não servem.
- O servidor valida tudo de novo (não dá para furar mexendo no celular).
- Agendamentos já existentes ficam com 60 min (como eram).
- Pacotes e serviços sem duração cadastrada: 60 min.

### 1.3 Celular
Problema: no celular o cabeçalho ficava largo demais, empurrando o botão de menu e o de agendamentos para fora da tela.
- **Nova barra fixa embaixo da tela (só no celular):** `Meus horários` · `Agendar` · `Entrar/Seu nome`. Dali você vê e cancela seus agendamentos.
- Cabeçalho do celular enxuto: logo + botão de menu (☰). O botão "Instalar app" foi para dentro do menu.
- O botão do WhatsApp e o aviso "offline" foram levantados para não ficarem atrás da barra.
- No computador/tablet o cabeçalho continua como antes.

### 1.4 Arquivos
| Arquivo | Mudança |
|---|---|
| `src/server/slots.ts` (novo) | Regras de horário (30 min), duração e fatias ocupadas |
| `src/server/db.ts` | Duração do atendimento, horários ocupados por fatias, `findCatalogItem` (preço + duração do catálogo) |
| `src/server/app.ts` | Só Pix; valida duração/sobreposição; checkout só Pix |
| `src/components/BookingModal.tsx` | Horários de 30 min, considera duração, remove opção cartão |
| `src/components/Header.tsx` | Cabeçalho compacto no celular |
| `src/components/MobileBottomNav.tsx` (novo) | Barra inferior do celular |
| `src/App.tsx`, `WhatsAppFloatingButton.tsx`, `OfflineIndicator.tsx` | Encaixe da barra inferior; texto "30 em 30 min" |
| `src/components/HoursAndLocation.tsx` | Nota "Horários de 30 em 30 min" |
| `supabase/slots30.sql` (novo) | Coluna `duration_minutes` |

---

## 2. Passos para colocar no ar (nesta ordem)
1. **Supabase → SQL Editor → New query** → cole `supabase/slots30.sql` → **Run**. (Só adiciona uma coluna; não apaga nada.) ⚠️ Faça **antes** de subir o código, senão novos agendamentos darão erro.
2. Substitua os arquivos do repositório pelos do zip `barbershop-la-pix-30min.zip` e faça commit. A Vercel faz o deploy.
3. Aguarde o deploy ficar "Ready" e **recarregue o app** no celular (se instalado como app, feche e abra; pode precisar recarregar 2 vezes por causa do cache do PWA).
4. Nenhuma variável nova na Vercel. As do Mercado Pago (`MP_ACCESS_TOKEN`, `SITE_URL`, `MP_WEBHOOK_SECRET`) continuam como já configuradas — veja `PAGAMENTOS_MERCADO_PAGO.md`.

## 3. Se você quiser mudar depois
- **Horário de funcionamento:** altere em **dois lugares** que precisam ficar iguais: `src/server/slots.ts` (função `daySlots`) e `src/components/BookingModal.tsx` (`buildSlots(9, 19)` para Ter–Sáb e `buildSlots(9, 14)` para domingo; o 1º número é a hora de abrir, o 2º a de fechar). Textos exibidos: `HoursAndLocation.tsx`, `Footer.tsx`, aviso em `App.tsx`.
- **Duração de cada serviço:** vem do cadastro do serviço (campo `durationMinutes`, em minutos; 30, 60, 90…). Se um serviço estiver com 60 e na prática leva 30, mude o cadastro e ele passará a ocupar só uma fatia.
- **Voltar a aceitar cartão:** exigiria reverter `excluded_payment_types` no checkout (`app.ts`) e recolocar a opção no `BookingModal`.

## 4. Lista de testes
- [ ] No celular aparece a barra inferior com "Meus horários / Agendar / Entrar".
- [ ] Em "Meus horários" (logado) aparecem e cancelam os agendamentos.
- [ ] Cabeçalho do celular mostra logo + ☰ sem cortar.
- [ ] Horários aparecem de 30 em 30 (09:00, 09:30, 10:00…).
- [ ] Serviço de 60 min às 09:00 → 09:30 aparece "Ocupado" para o próximo cliente.
- [ ] Último horário Ter–Sáb de um serviço de 60 min é 18:00 (às 18:30 aparece "Não cabe"); domingo 13:00 (13:30 "Não cabe").
- [ ] Só aparecem "Pagar no local" e "Pix". Pix leva ao Mercado Pago só com Pix.
- [ ] Agenda do barbeiro continua mostrando os horários.

## 5. Limitações conhecidas / próximos passos
1. **Conflito simultâneo:** a checagem de horário sobreposto é feita no servidor, mas se duas pessoas confirmarem **no mesmo segundo** horários que se sobrepõem (início diferente), o banco só bloqueia início idêntico. Para uma barbearia de uma pessoa o risco é mínimo; solução definitiva seria uma restrição de exclusão no Postgres.
2. Durações vêm do cadastro: se o nome do serviço for editado e o app tiver lista antiga em cache, recarregue a página.
3. Pendências do Pix (teste de ponta a ponta, reembolso pelo painel, notificações): veja `PAGAMENTOS_MERCADO_PAGO.md`, seções 5 a 7.
4. Aviso de "PWA instalado": usuários do app instalado podem ver a versão antiga até o cache atualizar.

## 6. Prompt pronto para outra IA
> Projeto: PWA de barbearia (React 19 + Vite + Tailwind 4), backend Express como função serverless da Vercel (`api/index.ts` → `src/server/app.ts`), Supabase via `@supabase/supabase-js`. Leia `ALTERACOES_PIX_30MIN_CELULAR.md`, `PAGAMENTOS_MERCADO_PAGO.md` e `LEIA-ME_ALTERACOES.md`. Estado: pagamento online só via Pix (Mercado Pago Checkout Pro), agenda em fatias de 30 min com duração por serviço (`src/server/slots.ts`), barra de navegação inferior no celular (`MobileBottomNav.tsx`). Tarefas: (1) validar o deploy e corrigir erros dos logs; (2) testar Pix com credenciais de teste; (3) botão de reembolso na agenda do barbeiro; (4) restrição de exclusão no Postgres para impedir sobreposição simultânea.
