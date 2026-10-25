# 💈 BARBERSHOP L.A — Relatório Completo de Alterações e Guia de Uso

Este documento detalha **todas as alterações implementadas** no projeto com base na solicitação do cliente:

1. **Remoção da opção de pagamento por cartão**, mantendo exclusivamente **Pix (Mercado Pago)** e **Pagar no Local**.
2. **Fracionamento de todos os horários da agenda de 30 em 30 minutos** (Terça a Sábado das 09h às 18h30; Domingo das 09h às 13h30).
3. **Melhoria profunda da visualização no celular (Mobile View)** para que o cliente localize com extrema facilidade o botão de checar ou cancelar seus agendamentos, corrigindo o problema de corte visual no cabeçalho do celular.

---

## 1. O que foi modificado

### 💳 1.1 Pagamento: Apenas Pix (Mercado Pago) e Pagar no Local
- **Remoção do Cartão**:
  - No frontend (`src/components/BookingModal.tsx`), a opção "Cartão de Crédito / Débito" foi totalmente removida do Passo 4 de pagamento.
  - A opção **Pix (Mercado Pago)** foi colocada como o método online principal com badge de destaque (*Recomendado*), com geração de QR Code e código Copia e Cola via Mercado Pago com confirmação instantânea.
  - A opção **Pagar no Local (Cadeira da Barbearia)** foi mantida para clientes que preferem acertar em dinheiro ou Pix direto com o Leonardo Arruda ao finalizar o corte.
- **Segurança no Backend**:
  - Em `src/server/app.ts`, a rota de agendamento (`POST /api/appointments`) valida estritamente a forma de pagamento: qualquer método que não seja `pix` passa a ser `in_person`.
  - Na rota de criação de checkout no Mercado Pago (`POST /api/payments/checkout`), foi configurado o parâmetro `excluded_payment_types` para excluir explicitamente:
    `credit_card`, `debit_card`, `prepaid_card`, `ticket` e `atm`.
    Isso garante que o checkout do Mercado Pago abra **exclusivamente a tela de Pix**, sem opção de cartão.

---

### ⏰ 1.2 Horários Fracionados de 30 em 30 Minutos
- **Terça-feira a Sábado (09h às 19h)**:
  - Antes: 10 horários de 1h em 1h (09:00 até 18:00).
  - **Agora (20 horários de 30 em 30 min)**:
    `09:00`, `09:30`, `10:00`, `10:30`, `11:00`, `11:30`, `12:00`, `12:30`, `13:00`, `13:30`, `14:00`, `14:30`, `15:00`, `15:30`, `16:00`, `16:30`, `17:00`, `17:30`, `18:00`, `18:30`.
- **Domingo (09h às 14h)**:
  - Antes: 5 horários de 1h em 1h (09:00 até 13:00).
  - **Agora (10 horários de 30 em 30 min)**:
    `09:00`, `09:30`, `10:00`, `10:30`, `11:00`, `11:30`, `12:00`, `12:30`, `13:00`, `13:30`.
- **Segunda-feira**:
  - Continua fechada para descanso semanal do barbeiro.
- **Arquivos atualizados**:
  - `src/components/BookingModal.tsx`: cálculo de slots disponíveis, labels e grid responsivo (`grid-cols-3 sm:grid-cols-4 md:grid-cols-5`) com barra de rolagem suave.
  - `src/server/app.ts`: função `validSlotsFor(date)` atualizada para validar os slots de 30 minutos em nível de servidor.
  - `src/components/HoursAndLocation.tsx`: textos informativos atualizados para "Slots de 30 min" e "Atendimentos fracionados de 30 em 30 minutos".

---

### 📱 1.3 Melhoria da Visualização no Celular (Mobile View)
Na captura de tela enviada pelo cliente, o cabeçalho no celular estava sofrendo estouro de largura (overflow horizontal): o logotipo e múltiplos botões empurravam o botão "AGENDAR" para fora da tela, o botão de "Meus Agendamentos" estava oculto (`hidden sm:inline-flex`), e o menu hambúrguer sumia.

Para solucionar isso de forma definitiva:
1. **Novo Cabeçalho Mobile Responsivo (`src/components/Header.tsx`)**:
   - O logo foi ajustado para não quebrar em telas estreitas (`min-w-0`, `truncate`).
   - O botão **"Agenda" / "Agendamentos"** agora fica **sempre visível** no topo do celular, com ícone dourado e fundo escuro destacado.
   - O botão "Agendar" e o botão de menu hambúrguer ficam perfeitamente alinhados e nunca são empurrados para fora da tela.
   - No menu gaveta do celular, foi adicionado um **Card de Destaque Superior**: *"Meus Agendamentos — Consultar ou cancelar seus horários"*.
2. **Nova Barra de Navegação Inferior Fixa para Celular (`src/components/MobileBottomNav.tsx`)**:
   - Criação de uma barra fixa inferior no rodapé do celular (estilo app nativo PWA), com 4 atalhos ao alcance do polegar:
     1. **Agendar**: Abre o modal de agendamento imediatamente.
     2. **Agendados**: Abre direto a lista de agendamentos para checar ou cancelar.
     3. **Serviços**: Rola suavemente até a tabela de preços.
     4. **Conta**: Acesso ao login/perfil do cliente.
3. **Novo Botão Direto na Seção Principal (`src/components/HeroSection.tsx`)**:
   - Logo abaixo de "Agendar Horário Agora" e "Ver Tabela de Preços", foi adicionado um botão dedicado:
     `[ 🔖 Meus Agendamentos (Checar / Cancelar) ]`.
4. **Consulta e Cancelamento Simplificados (`src/components/MyAppointmentsModal.tsx`)**:
   - Quem agendou pelo celular mas não criou conta com senha agora pode:
     - Ver os agendamentos gravados automaticamente no navegador do celular (`localStorage`).
     - **Buscar por WhatsApp/Telefone**: digita o número no topo do modal e o sistema busca os horários ativos.
     - **Cancelar pelo Celular**: se faltar mais de 2 horas para o atendimento, cancela com um clique. Se faltar menos de 2h ou já tiver sido pago online, exibe o link direto para falar com o Leonardo no WhatsApp.
5. **Botão Flutuante do WhatsApp (`src/components/WhatsAppFloatingButton.tsx`)**:
   - Reposicionado no celular (`bottom-20`) para não sobrepor a barra de navegação inferior.

---

## 2. Relação de Arquivos Modificados / Criados

| Arquivo | Tipo | Descrição das Modificações |
|---|---|---|
| `src/server/app.ts` | Backend | Slots de 30 em 30 min, exclusão de cartão no Mercado Pago, endpoints `/api/appointments/by-phone` e `/api/appointments/:id/cancel-public`. |
| `src/server/db.ts` | Backend | Adicionado método `getAppointmentsByPhone(phone)` para permitir consulta pelo WhatsApp. |
| `src/services/api.ts` | Serviço Frontend | Adicionados métodos `getAppointmentsByPhone` e `cancelAppointmentPublic`. |
| `src/components/BookingModal.tsx` | Componente | Fracionamento de 30 em 30 min, remoção do cartão, Pix como método online único e salvamento local de agendamentos. |
| `src/components/Header.tsx` | Componente | Correção de overflow mobile, botão "Agenda" visível no celular e destaque no menu mobile. |
| `src/components/MobileBottomNav.tsx` | Novo Componente | Barra de navegação inferior fixa para celular com acesso rápido a "Agendados". |
| `src/components/HeroSection.tsx` | Componente | Botão de acesso direto "Meus Agendamentos (Checar / Cancelar)". |
| `src/components/MyAppointmentsModal.tsx` | Componente | Consulta por telefone/WhatsApp, leitura de agendamentos locais e cancelamento público com validação de 2h. |
| `src/components/HoursAndLocation.tsx` | Componente | Textos de expediente atualizados para 30 minutos. |
| `src/components/WhatsAppFloatingButton.tsx` | Componente | Ajuste de espaçamento inferior no mobile para convívio com a bottom nav. |
| `src/App.tsx` | Raiz | Integração da `MobileBottomNav`, passagem da prop `onOpenMyAppointments` ao Hero e padding inferior para mobile. |

---

## 3. Passo a Passo para Testar e Executar

1. **Instalar Dependências** (caso esteja em nova máquina):
   ```bash
   npm install
   ```
2. **Iniciar o Servidor de Desenvolvimento**:
   ```bash
   npm run dev
   ```
   O app estará disponível em `http://localhost:3000`.

3. **Verificar os Horários de 30 em 30 minutos**:
   - Abra o app e clique em **Agendar**.
   - Escolha qualquer serviço (ex.: *Corte Tradicional / Fade*).
   - Escolha uma data (ex.: terça a sábado): observe a grade com horários a cada 30 minutos (`09:00`, `09:30`, `10:00`, etc. até `18:30`).
   - Escolha um domingo: observe os horários das `09:00` até `13:30`.

4. **Verificar a Opção de Pagamento Apenas Pix**:
   - No modal de agendamento, selecione data e hora, preencha os dados e avance para o **Passo 4 (Pagamento)**.
   - Note que o cartão de crédito não existe mais. As opções disponíveis são apenas **Pix (Mercado Pago)** e **Pagar no Local**.

5. **Verificar a Visualização no Celular**:
   - Abra o navegador no modo de inspeção móvel (largura de 360px a 390px, como um iPhone ou smartphone Android).
   - Observe que o cabeçalho não estoura nem corta o botão de agendamento.
   - O botão dourado **"Agenda"** está no cabeçalho.
   - Na parte inferior da tela, a barra fixa do celular exibe o ícone **"Agendados"**.
   - No Hero, há o botão **"Meus Agendamentos (Checar / Cancelar)"**.
   - Ao clicar, o modal abre permitindo checar os horários ou buscar pelo número de WhatsApp.

6. **Compilação de Produção**:
   ```bash
   npm run build
   ```
   O build Vite é executado e gera a pasta `dist` pronta para deploy na Vercel ou Cloud Run.
