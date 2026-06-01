# TraceFlow — Arquitetura Técnica

## Visão Geral

TraceFlow é uma plataforma de observabilidade que captura o **contexto completo de cada requisição** — corpo HTTP, logs de negócio, propagação entre serviços — e apresenta tudo como uma linha do tempo visual navegável.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Serviços do Cliente                       │
│                                                                  │
│  [core-service]        [fraud-service]       [api-gateway]       │
│  SDK TraceFlow         SDK TraceFlow         SDK TraceFlow       │
│  (Node / Java / ...)   (Node / Java / ...)   (Node / Java / ...) │
└──────────┬─────────────────────-┬────────────────────-┬───────────┘
           │  HTTP /v1/spans      │  HTTP /v1/logs     │
           └──────────────────────┴────────────────────┘
                                  │
                           ┌──────▼──────┐
                           │  Coletor Go │  ← único ponto de entrada
                           │  porta 4317 │
                           └──────┬──────┘
                                  │ Redis Streams
                           ┌──────▼──────┐
                           │ Processador │  ← correlaciona spans
                           │     Go      │
                           └──────┬──────┘
                                  │ SQL
                           ┌──────▼──────┐
                           │ TimescaleDB │  ← storage principal
                           └──────┬──────┘
                                  │
                           ┌──────▼──────┐
                           │   API Node  │  ← REST + JWT
                           └──────┬──────┘
                                  │ HTTP
                           ┌──────▼──────┐
                           │  Dashboard  │  ← React SPA
                           └─────────────┘
```

---

## Princípios de Design

**Fire-and-forget no SDK.** O SDK nunca bloqueia a thread do serviço instrumentado. Spans são enviados de forma assíncrona. Se o coletor estiver indisponível, os eventos são descartados silenciosamente — observabilidade nunca pode derrubar a aplicação.

**Coletor quase stateless.** O coletor não persiste eventos localmente: valida, enfileira no Redis e retorna `202 Accepted` imediatamente. Mantém apenas um cache em memória de api-keys válidas (carregado da tabela `workspaces` e atualizado a cada `API_KEY_REFRESH_SECONDS`), então não há hit no banco por requisição. Pode rodar em múltiplas réplicas sem coordenação.

**Separação de ingestão e processamento.** O coletor e o processador são processos distintos comunicando via **Redis Streams** (`spans` e `logs`). O coletor faz `XADD` (com `MAXLEN ~1.000.000`) e o processador consome com um *consumer group* (`processors`) via `XREADGROUP` + `XACK`. Isso dá entrega durável e replayável: mensagens sobrevivem a reinicializações do processador e podem ser escaladas por múltiplos consumidores.

**Contexto de negócio, não só infraestrutura.** O diferencial do TraceFlow é capturar o *body* da requisição, logs de eventos de negócio (`fraud.analysis.decision`, `payment.created`) e correlacioná-los com os spans técnicos. OTEL captura infraestrutura; TraceFlow captura a história do negócio.

**Redação automática de dados sensíveis.** Campos como `password`, `token`, `cvv`, `cpf` são mascarados nos logs antes de sair do SDK — nunca chegam ao coletor.

---

## Componentes em Detalhe

### SDKs (agentes)

Bibliotecas leves instaladas nos serviços do cliente. Cada SDK é específico para uma linguagem/framework mas produz o mesmo formato de evento.

**Responsabilidades:**
- Gerar `trace_id` quando não existe no contexto de entrada
- Ler `trace_id` de headers de entrada (`x-traceflow-trace-id`) para propagar entre serviços
- Criar spans de entrada (HTTP server) e saída (HTTP client) automaticamente
- Capturar body de request/response com truncamento em 2KB
- Redação automática de campos sensíveis (regex sobre o JSON)
- Capturar logs de negócio via `span.log(message, attributes, level)`
- Enviar spans e logs ao coletor via HTTP POST assíncrono

**SDKs disponíveis:**

Legenda: ✅ produção · 🧪 beta · 🔲 planejado

| SDK | Framework | Mecanismo de interceptação | Status |
|---|---|---|---|
| `sdk-node` | Express.js | Middleware (`app.use`) | ✅ |
| `sdk-spring` (`sdk-java`) | Spring Boot | `OncePerRequestFilter` | ✅ |
| `sdk-go` | net/http | `Middleware(handler)` | 🧪 |
| `sdk-csharp` | ASP.NET Core | `app.UseTraceFlow()` | 🧪 |
| `sdk-ruby` | Rack | `use TraceFlow::Middleware` | 🧪 |

> **Nota sobre os SDKs beta (`sdk-go`, `sdk-csharp`, `sdk-ruby`):** capturam request/response body com truncamento, mas ainda **não** implementam propagação de `trace_id` entre serviços, redatam apenas `password`/`token`/`cvv` (não a lista completa abaixo) e enviam um payload ad-hoc próprio que ainda não está alinhado ao contrato nativo de span. Use em produção apenas `sdk-node` e `sdk-spring`.

**Campos sensíveis redatados automaticamente (sdk-node / sdk-spring):**
`password`, `confirmPassword`, `token`, `secret`, `apiKey`, `authorization`, `cvv`, `cardNumber`, `ssn`, `cpf`, `pin`, `refreshToken`, `accessToken`

---

### Coletor (`collector/`)

Processo Go de alta performance. Único ponto de entrada para todos os eventos.

**Endpoints:**

| Endpoint | Método | Formato | Descrição |
|---|---|---|---|
| `/spans` | POST | JSON (`SpanEvent`) | Recebe spans nativos dos SDKs (logs de negócio vão embutidos em `logs[]`) |
| `/v1/traces` | POST | OTLP/JSON e protobuf | Compatibilidade com OpenTelemetry (traces) |
| `/v1/logs` | POST | OTLP/JSON e protobuf | Compatibilidade com OpenTelemetry (logs) |
| `/health` | GET | JSON | Health check — retorna `{"status":"ok"}` (não exige auth) |
| `/metrics` | GET | Prometheus text | Contadores de ingestão: spans/logs recebidos e dropados, auth rejeitada, rate limited (não exige auth) |

> **Autenticação:** todas as rotas de ingestão exigem o header `x-api-key` (validado contra a tabela `workspaces`); o `workspace_id` é derivado da chave e sobrescreve qualquer valor enviado no body. Há rate limit por workspace (`RATE_LIMIT_PER_MIN`, padrão 10.000/min, token bucket em memória). Se `DATABASE_URL` não estiver setado, o coletor sobe em modo dev sem auth.

> O coletor também escuta UDP na porta `4318` (mesmo payload `SpanEvent` em JSON). Há um listener nativo de logs de negócio fora do padrão OTLP planejado, mas hoje os logs chegam embutidos no span via `/spans`.

**Fluxo interno:**
```
HTTP Request
    → Validação de schema (validator/span.go, validator/log.go)
    → Publicação no Redis (publisher/redis.go)
    → 202 Accepted
```

**Estrutura interna:**
```
collector/
  cmd/collector/       ← entry point
  internal/
    handler/
      server.go        ← roteamento HTTP + listener UDP, handler de /spans
      logs.go          ← handler OTLP de /v1/logs
      otlp.go          ← handler OTLP de /v1/traces
    validator/
      span.go          ← validação + struct SpanEvent
    queue/
      queue.go         ← canal Go em memória
    publisher/
      redis.go         ← publica no Redis Streams (XADD)
```

---

### Processador (`processor/`)

Processo Go que consome do Redis e persiste no TimescaleDB.

**Responsabilidades:**
- Consumir spans e logs do Redis Streams via consumer group (`XREADGROUP` + `XACK`)
- Persistir no TimescaleDB via `storage/timescale.go`
- Não faz correlação em tempo real — a correlação acontece em query time na API

**Estrutura:**
```
processor/
  cmd/processor/       ← entry point
  internal/
    model/span.go      ← struct de domínio
    storage/
      timescale.go     ← INSERT em spans e logs
    subscriber/
      redis.go         ← consume do Redis Streams (consumer group)
```

---

### API (`api/`)

Servidor Node.js/TypeScript com Express. Interface entre o storage e os consumidores.

**Endpoints principais:**

| Endpoint | Descrição |
|---|---|
| `POST /api/v1/auth/login` | Login com email/senha, retorna JWT |
| `GET /api/v1/auth/me` | Retorna workspace do usuário autenticado |
| `GET /api/v1/traces` | Lista traces com filtros (service, status, from, to) |
| `GET /api/v1/traces/:id` | Detalhe de um trace com todos os spans |
| `GET /api/v1/traces/:id/timeline` | Timeline dos spans com offset e profundidade |
| `GET /api/v1/traces/:id/logs` | Logs de negócio de um trace |
| `GET /api/v1/services` | Lista services com métricas de 24h |
| `GET /api/v1/services/:name/stats` | Série temporal de p50/p95/p99 por serviço |

**Autenticação:** JWT com expiração de 24h. Token enviado no header `Authorization: Bearer <token>`.

**Cálculo de duração:** Usa `MAX(ended_at) - MIN(started_at)` sobre todos os spans do trace (wall-clock time real), não `SUM(duration_ms)` que inflaria o tempo devido a spans paralelos.

**Seleção do span raiz:** `array_agg` com `ORDER BY parent_id IS NULL DESC, started_at ASC` — prioriza spans sem parent_id, com fallback cronológico.

---

### Dashboard (`dashboard/`)

SPA React + Vite. Sem estado próprio — todo dado vem da API.

**Páginas:**

| Rota | Descrição |
|---|---|
| `/` | Overview com métricas gerais e traces recentes |
| `/traces` | Lista de traces com filtros avançados |
| `/traces/:id` | Detalhe: Timeline + Request Body Card + Logs |
| `/services` | Lista de services com métricas |
| `/services/:name` | Gráficos de p50/p95/p99 por serviço |
| `/alerts` | Configuração de alertas |
| `/settings` | Workspace ID, API key, snippets de integração |

---

## Modelo de Dados

### Tabela `spans`

```sql
CREATE TABLE spans (
  id           TEXT NOT NULL,
  trace_id     TEXT NOT NULL,
  parent_id    TEXT,
  service_name TEXT NOT NULL,
  operation    TEXT NOT NULL,
  kind         TEXT NOT NULL,          -- server | client | internal | producer | consumer
  started_at   TIMESTAMPTZ NOT NULL,
  ended_at     TIMESTAMPTZ,
  duration_ms  INTEGER,
  status       TEXT NOT NULL DEFAULT 'in_progress',  -- ok | error | timeout
  error_type   TEXT,
  error_msg    TEXT,
  tags         JSONB NOT NULL DEFAULT '{}',
  workspace_id TEXT NOT NULL,
  PRIMARY KEY (id, started_at)
);
-- Hypertable TimescaleDB particionada por started_at
```

### Tabela `logs`

```sql
CREATE TABLE logs (
  id           TEXT NOT NULL DEFAULT 'log_' || gen_random_uuid()::text,
  trace_id     TEXT NOT NULL,
  service_name TEXT NOT NULL,
  level        TEXT NOT NULL,          -- DEBUG | INFO | WARN | ERROR
  message      TEXT NOT NULL,
  attributes   JSONB NOT NULL DEFAULT '{}',
  workspace_id TEXT NOT NULL,
  timestamp    TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (id, timestamp)
);
-- Hypertable TimescaleDB particionada por timestamp
```

### Formato de evento — Span (enviado pelo SDK)

```json
{
  "id": "span_abc123",
  "trace_id": "trace_xyz789",
  "parent_id": null,
  "service_name": "core-service",
  "operation_name": "POST /payments",
  "kind": "server",
  "started_at": "2026-05-27T16:01:04.000Z",
  "ended_at": "2026-05-27T16:01:04.566Z",
  "duration_ms": 566,
  "status": "ok",
  "tags": {
    "http.method": "POST",
    "http.url": "/payments",
    "http.status_code": "200"
  },
  "logs": [
    {
      "level": "INFO",
      "message": "http.request",
      "attributes": {
        "body.amount": "500.00",
        "body.password": "***REDACTED***"
      },
      "timestamp": "2026-05-27T16:01:04.001Z"
    }
  ],
  "workspace_id": "ws_dev"
}
```

---

## Fluxo Completo (Request → Dashboard)

```
1.  Requisição HTTP chega ao core-service
2.  SDK lê headers x-traceflow-trace-id (não existe → gera novo trace_id)
3.  SDK cria span "POST /payments" com started_at = now()
4.  SDK captura request body, redata campos sensíveis
5.  SDK chama span.log("http.request", { body... }, "INFO")
6.  core-service chama fraud-service via HTTP
7.  SDK injeta x-traceflow-trace-id no header outbound
8.  fraud-service recebe, SDK lê o trace_id do header
9.  SDK cria span filho "POST /api/fraud/analyze" com parent_id = span do core
10. fraud-service executa lógica, chama span.log("fraud.analysis.decision", {...})
11. Resposta retorna, SDK fecha ambos os spans com ended_at e status
12. SDK envia spans + logs ao coletor via HTTP POST assíncrono (fire-and-forget)
13. Coletor valida, faz XADD no Redis Stream
14. Processador consome via consumer group, persiste no TimescaleDB e dá XACK
15. Usuário abre o dashboard → GET /api/v1/traces
16. Dashboard renderiza timeline com offset proporcional de cada span
17. Request Body Card mostra POST /payments com body sanitizado
18. Aba Logs mostra fraud.analysis.decision com atributos de negócio
```

---

## Infraestrutura (docker-compose.yml)

```
┌─────────────────────────────────────────────────┐
│  traceflow-timescaledb-1   5432 (host: 5433)     │
│  traceflow-redis-1         porta 6379            │
│  traceflow-collector-1     porta 4317            │
│  traceflow-processor-1     (sem porta exposta)   │
│  traceflow-api-1           porta 3000            │
│  traceflow-dashboard-1     porta 5173            │
└─────────────────────────────────────────────────┘
```

**Dependências de startup:**
- `api` e `processor` aguardam `timescaledb` (healthcheck) e `redis`
- `collector` aguarda `timescaledb` (healthcheck) e `redis`
- `dashboard` aguarda `api`

---

## Segurança

- **SDK → Coletor:** autenticação por `x-api-key` (header HTTP, ou campo `api_key` no payload UDP). A chave é validada contra a tabela `workspaces` via cache em memória do coletor, e o `workspace_id` é derivado dela (o valor do body é ignorado). Rate limit por workspace via token bucket (`RATE_LIMIT_PER_MIN`). Modo dev (sem `DATABASE_URL`) desativa a auth.
- **Dashboard → API:** JWT (HS256) com 24h de expiração assinado com `JWT_SECRET`. Senhas são hasheadas com `bcrypt`. Cadastro via `POST /api/v1/auth/register` (cria workspace + usuário) e login via `POST /api/v1/auth/login`.
- **Dados sensíveis:** Redação aplicada no SDK antes do envio. Nunca chegam ao coletor.
- **Body truncado em 2KB** para evitar exfiltração acidental de payloads grandes.
- **TLS em produção:** Responsabilidade do operador (self-hosted) ou gerenciado (SaaS roadmap).
