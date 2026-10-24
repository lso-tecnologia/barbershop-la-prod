# PLANO DE ARQUITETURA E ENGENHARIA — BARBERSHOP L.A (PWA)

## 1. Visão Geral do Sistema
O PWA da **BARBERSHOP L.A** é uma aplicação completa de agendamento e vitrine comercial desenvolvida para proporcionar uma experiência mobile-first de alto padrão (tema preto e dourado), com carregamento instantâneo, total conformidade com a LGPD e segurança rigorosa (OWASP Top 10).

---

## 2. Confirmação e Especificação da Stack

| Componente | Escolha Técnica | Racional Técnico |
|---|---|---|
| **Frontend** | React 19 + TypeScript + Tailwind CSS v4 + Motion | Alta performance mobile, animações fluidas na seleção de serviços e horários, design responsivo rigoroso. |
| **PWA** | Web App Manifest + Service Worker + Cache offline | Permite instalação na tela inicial (Android/iOS) sem passar por lojas de aplicativos, tela cheia nativa e fallback para quando a internet cair. |
| **Backend & API** | Node.js + Express (Full-stack) | Validação centralizada de preços e disponibilidade, controle de sessão segura, processamento de webhooks e transações de banco. |
| **Banco de Dados** | SQLite / PostgreSQL com Drizzle ORM | Modelo relacional com suporte a chaves estrangeiras, índices e restrições atômicas (`UNIQUE`) para prevenção total de agendamentos simultâneos no mesmo horário. |
| **Gateway de Pagamento** | Mercado Pago (v1 API / Checkout Transparente) | Melhor compatibilidade no Brasil para Pix com QR Code dinâmico e código "Copia e Cola", baixa latência de confirmação via Webhook e checkout de cartão sem armazenar dados sensíveis. |

---

## 3. Modelo de Dados Detalhado (Schema SQL)

```sql
-- 1. Usuários e Perfis
CREATE TABLE users (
    id TEXT PRIMARY KEY, -- UUID v4
    role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'barber_admin')),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    two_factor_secret TEXT, -- Segredo Base32 para TOTP (barbeiro)
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Configurações Globais da Barbearia
CREATE TABLE barbershop_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    is_open_override BOOLEAN NOT NULL DEFAULT TRUE, -- Controle manual "Aberta/Fechada"
    barber_name TEXT NOT NULL DEFAULT 'Leonardo Arruda',
    barber_bio TEXT NOT NULL,
    barber_photo_url TEXT,
    operating_hours_json TEXT NOT NULL, -- Configuração dos dias e horários (Ter-Sáb 9-18, Dom 9-13)
    slot_duration_minutes INTEGER NOT NULL DEFAULT 60,
    cancellation_limit_hours INTEGER NOT NULL DEFAULT 2,
    whatsapp_number TEXT NOT NULL DEFAULT '5511981154340',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Serviços Individuais
CREATE TABLE services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL, -- Valores em centavos (ex: 3500 para R$ 35,00)
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Pacotes Promocionais
CREATE TABLE packages (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    price_cents INTEGER NOT NULL, -- ex: 13000 para R$ 130,00
    validity_days INTEGER NOT NULL DEFAULT 30,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Agendamentos
CREATE TABLE appointments (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id TEXT REFERENCES services(id),
    package_id TEXT REFERENCES packages(id),
    item_type TEXT NOT NULL CHECK (item_type IN ('service', 'package')),
    item_name TEXT NOT NULL,
    price_cents INTEGER NOT NULL,
    appointment_date DATE NOT NULL, -- Formato YYYY-MM-DD
    slot_time TEXT NOT NULL,        -- Formato HH:MM:SS (ex: '09:00:00')
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'card', 'in_person')),
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'cancelled', 'refunded')),
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Restrição de integridade: Não permite 2 agendamentos ativos no mesmo dia e horário
    CONSTRAINT unique_active_booking UNIQUE (appointment_date, slot_time)
);

-- 6. Transações e Pagamentos
CREATE TABLE payments (
    id TEXT PRIMARY KEY,
    appointment_id TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    gateway TEXT NOT NULL DEFAULT 'mercadopago',
    gateway_payment_id TEXT UNIQUE,
    amount_cents INTEGER NOT NULL,
    method TEXT NOT NULL, -- 'pix', 'card', 'in_person'
    pix_qr_code TEXT,
    pix_copy_paste TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    webhook_payload_log TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Bloqueios Manuais de Horário (Folgas/Feriados)
CREATE TABLE schedule_blocks (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL,
    slot_time TEXT, -- Se NULL, bloqueia o dia inteiro
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Avisos e Comunicados (Pop-up/Banner na tela inicial)
CREATE TABLE notices (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    valid_from TIMESTAMP,
    valid_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Logs de Auditoria
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. Fluxos de Autenticação e Autorização

### Fluxo do Cliente
1. **Cadastro**: Nome, Telefone com DDD (validação de formato brasileiro `(11) 9XXXX-XXXX`), e-mail válido e senha com requisitos mínimos (mínimo 8 caracteres, maiúscula, número e símbolo).
2. **Armazenamento de Senhas**: Hash criptográfico com `bcrypt` (12 rounds) ou `argon2id`.
3. **Sessão**: Token JWT assinado armazenado em cookie `HttpOnly`, `Secure` e `SameSite=Strict` ou Authorization Bearer validado em cada requisição.
4. **Recuperação de Senha**: Token temporário com hash, expiração de 15 minutos e invalidação pós-uso.

### Fluxo do Barbeiro (Área Administrativa)
1. **Credenciais Fortes**: E-mail exclusivo do administrador e senha complexa.
2. **2FA Obrigatório**: Segundo fator de autenticação via aplicativo autenticador (TOTP) ou código de uso único via e-mail.
3. **Bloqueio Progressivo**: 5 tentativas incorretas bloqueiam novas tentativas por 15 minutos para impedir ataques de força bruta.
4. **RBAC**: Middleware server-side verifica a flag `role === 'barber_admin'` em todas as rotas `/api/admin/*`.

---

## 5. Algoritmo de Agendamento e Concorrência Atômica

### Geração de Horários Disponíveis:
1. O backend consulta o dia da semana solicitado no fuso horário `America/Sao_Paulo`.
2. Se for **Segunda-feira**, retorna que a barbearia está fechada.
3. Se for **Terça a Sábado**, gera slots de 60 minutos das **09:00 às 18:00** (último atendimento às 17:00).
4. Se for **Domingo**, gera slots de 60 minutos das **09:00 às 13:00** (último atendimento às 12:00).
5. Desconta:
   - Horários que já estão no passado no dia de hoje;
   - Agendamentos existentes ativos (`status IN ('pending', 'confirmed')`);
   - Bloqueios manuais definidos pelo barbeiro em `schedule_blocks`.

### Prevenção contra Dois Clientes no Mesmo Horário (Race Condition):
- A reserva é executada em uma transação atômica no banco de dados.
- O banco possui a constraint rígida `UNIQUE(appointment_date, slot_time)`.
- Se o Cliente A e o Cliente B submeterem a reserva simultaneamente para o mesmo slot:
  - O banco grava o primeiro cliente com sucesso.
  - A tentativa do segundo cliente falha imediatamente com erro de violação de constraint (`SQLITE_CONSTRAINT_UNIQUE` ou código SQL correspondente).
  - O backend captura o erro e retorna HTTP 409 Conflict com a mensagem amigável: *"Este horário acabou de ser reservado por outro cliente. Por favor, selecione outro horário disponível."*

### Regra de Cancelamento e Remarcação:
- O cliente pode cancelar ou remarcar diretamente no app se faltar **mais de 2 horas** para o início do atendimento.
- Se faltar menos de 2 horas, o botão de cancelamento fica desabilitado e um aviso orienta o cliente a entrar em contato diretamente com o Leonardo pelo WhatsApp.

---

## 6. Estratégia de Segurança (OWASP Top 10)

1. **A01: Quebra de Controle de Acesso (Broken Access Control)**:
   - Todas as rotas de cancelamento e listagem de agendamentos validam que o `client_id` pertence ao usuário logado (anti-IDOR).
   - O barbeiro tem permissão total apenas com verificação de role e 2FA ativo.
2. **A02: Falhas Criptográficas**:
   - Comunicação 100% via HTTPS/TLS.
   - Nenhuma informação sensível de cartão é armazenada no banco de dados (o pagamento é processado via token/iframe seguro do Mercado Pago).
3. **A03: Injeção de Código**:
   - Queries 100% parametrizadas via Drizzle ORM (prevenção contra SQL Injection).
   - Validação e sanitização de schemas de entrada usando `Zod`.
4. **A04: Design Inseguro**:
   - O valor a pagar é calculado e validado **sempre no backend**, lendo a tabela de preços do banco, impedindo que requisições adulteradas enviem preços modificados pelo front-end.
5. **A05: Configuração Incorreta de Segurança**:
   - Headers de segurança HTTP (`Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`).
6. **A06: Componentes Desatualizados e Vulneráveis**:
   - Auditoria via `npm audit` mantendo dependências limpas.
7. **A07: Falhas de Identificação e Autenticação**:
   - Rate limiting via `express-rate-limit` nas rotas de login, cadastro e agendamento.
8. **A08: Falhas de Integridade de Software e Dados**:
   - Assinatura criptográfica dos Webhooks do Mercado Pago verificada antes de alterar qualquer status de agendamento para `paid`.
9. **A09: Falhas de Monitoramento e Registro**:
   - Tabela `audit_logs` para registrar alterações sensíveis do barbeiro (alteração de preços, cancelamento de agendamentos, abertura/fechamento).
10. **A10: Falsificação de Requisição do Lado do Servidor (SSRF)**:
    - O servidor não faz requisições a URLs arbitrárias fornecidas pelo usuário.

---

## 7. Mapeamento das Fotos Reais Enviadas pelo Usuário

As fotos fornecidas pelo Leonardo Arruda serão integradas nos seguintes pontos:
1. **Banner e Identidade Principal**: A imagem oficial do pôster com a cadeira de couro caramelo, iluminação dourada e letreiro *"BARBEARIA ABERTA! ESTILO NÃO TIRA FÉRIAS!"* (`WhatsApp_Image_2026-10-24_at_16.19.02_2143161f.jpeg`).
2. **Perfil do Barbeiro**: A foto do Leonardo com seu filho sorrindo (`WhatsApp_Image_2026-10-24_at_16.18.59_0a69f0f9.jpeg`), que ilustra perfeitamente o texto da bio: *"Minha maior motivação para dar o meu melhor todos os dias é o meu filho..."*.
3. **Sessão História e Garagem**: A foto do Leonardo mexendo no carro rebaixado na chuva (`WhatsApp_Image_2026-10-24_at_16.18.59__1__7126c5b1.jpeg`), ilustrando a paixão por projetos automotivos e som.
4. **Galeria de Cortes e Estilos**:
   - O corte com acabamento artístico grego (`WhatsApp_Image_2026-10-12_at_15.44.43_30bb7746.jpeg`).
   - Os cortes infantis com degradê e finalização de cachos (`WhatsApp_Image_2026-10-24_at_16.18.57_3c2b7564.jpeg` e `WhatsApp_Image_2026-10-24_at_16.18.59__2__e1070cd6.jpeg`).
