# Schema de Eventos — TraceFlow

> ⚠️ **Status:** O envelope versionado descrito abaixo (`schema_version` / `event_type` / `payload`) é o **alvo planejado** e ainda **não** é o formato aceito pelo coletor. Hoje o coletor recebe um **`SpanEvent` único** (objeto plano com `logs[]` embutidos) em `POST /spans`. Veja "Formato nativo implementado" logo abaixo.

## Formato nativo implementado (`POST /spans`)

O SDK envia um objeto JSON único por span. Logs de negócio vão embutidos no array `logs[]` — o coletor os extrai e roteia para a tabela `logs`.

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
  "error": { "type": "TimeoutError", "message": "...", "code": "ETIMEDOUT" },
  "tags": { "http.method": "POST" },
  "logs": [
    { "level": "INFO", "message": "http.request", "attributes": { "body.amount": "500.00" }, "timestamp": "2026-05-27T16:01:04.001Z" }
  ],
  "workspace_id": "ws_dev"
}
```

Validação do coletor (`collector/internal/validator/span.go`): `id`, `trace_id`, `service_name`, `operation_name`, `kind`, `started_at`, `status` e `workspace_id` são obrigatórios. `kind` ∈ {server, client, producer, consumer, internal}. `status` ∈ {ok, error, timeout, in_progress}. Logs embutidos exigem `level` ∈ {DEBUG, INFO, WARN, ERROR}.

---

## Envelope versionado (planejado)

O restante deste documento descreve o protocolo versionado planejado. O campo `schema_version` permitirá que o coletor aceite versões anteriores sem quebrar.

**Versão alvo:** `1`

---

## Envelope comum

Todo evento é um objeto JSON com este envelope:

```json
{
  "schema_version": 1,
  "event_type": "span.start" | "span.end" | "span.error" | "span.log",
  "sent_at": "2024-11-15T14:23:01.123Z",
  "sdk": {
    "name": "traceflow-node",
    "version": "0.1.0"
  },
  "payload": { ... }
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `schema_version` | `int` | ✅ | Versão do schema. Atual: `1` |
| `event_type` | `string` | ✅ | Tipo do evento (ver abaixo) |
| `sent_at` | `string (ISO 8601)` | ✅ | Timestamp de envio pelo SDK |
| `sdk.name` | `string` | ✅ | Identificador do SDK |
| `sdk.version` | `string` | ✅ | Versão semântica do SDK |
| `payload` | `object` | ✅ | Dados específicos do tipo de evento |

---

## Tipos de evento

### `span.start`

Emitido quando uma operação rastreada começa.

```json
{
  "schema_version": 1,
  "event_type": "span.start",
  "sent_at": "2024-11-15T14:23:01.100Z",
  "sdk": { "name": "traceflow-node", "version": "0.1.0" },
  "payload": {
    "span_id": "span_9f3a2c1b",
    "trace_id": "trace_4e8d1a9f2b3c5e7d",
    "parent_span_id": null,
    "service_name": "checkout-service",
    "operation_name": "http.server POST /checkout",
    "kind": "server",
    "started_at": "2024-11-15T14:23:01.095Z",
    "tags": {
      "http.method": "POST",
      "http.route": "/checkout",
      "http.host": "checkout-service",
      "user.id": "usr_123"
    }
  }
}
```

#### Campos do payload `span.start`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `span_id` | `string` | ✅ | ID único do span. Formato: `span_` + 8 chars hex |
| `trace_id` | `string` | ✅ | ID do trace raiz. Formato: `trace_` + 16 chars hex |
| `parent_span_id` | `string \| null` | ✅ | ID do span pai. `null` se for o span raiz |
| `service_name` | `string` | ✅ | Nome do serviço configurado no SDK |
| `operation_name` | `string` | ✅ | Nome da operação. Convenções abaixo |
| `kind` | `enum` | ✅ | `server`, `client`, `producer`, `consumer`, `internal` |
| `started_at` | `string (ISO 8601)` | ✅ | Timestamp de início da operação |
| `tags` | `Record<string, string>` | ✅ | Metadados adicionais. Máx 32 chaves, valores truncados em 256 chars |

#### Convenções para `operation_name`

| Contexto | Formato | Exemplo |
|---|---|---|
| HTTP server | `http.server {METHOD} {ROUTE}` | `http.server POST /checkout` |
| HTTP client | `http.client {METHOD} {HOST}{PATH}` | `http.client GET payments-svc/charge` |
| Producer de fila | `queue.publish {QUEUE_NAME}` | `queue.publish order.created` |
| Consumer de fila | `queue.consume {QUEUE_NAME}` | `queue.consume order.created` |
| Operação interna | `{DOMAIN}.{OPERACAO}` | `payment.validate`, `inventory.reserve` |
| Query de banco | `db.query {TABLE}` | `db.query orders` |

---

### `span.end`

Emitido quando a operação conclui com sucesso.

```json
{
  "schema_version": 1,
  "event_type": "span.end",
  "sent_at": "2024-11-15T14:23:01.210Z",
  "sdk": { "name": "traceflow-node", "version": "0.1.0" },
  "payload": {
    "span_id": "span_9f3a2c1b",
    "trace_id": "trace_4e8d1a9f2b3c5e7d",
    "ended_at": "2024-11-15T14:23:01.208Z",
    "duration_ms": 113,
    "status": "ok",
    "tags": {
      "http.status_code": "200"
    }
  }
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `span_id` | `string` | ✅ | ID do span correspondente ao `span.start` |
| `trace_id` | `string` | ✅ | ID do trace |
| `ended_at` | `string (ISO 8601)` | ✅ | Timestamp de fim |
| `duration_ms` | `int` | ✅ | Duração em milissegundos |
| `status` | `"ok"` | ✅ | Sempre `"ok"` neste evento |
| `tags` | `Record<string, string>` | ❌ | Metadados adicionais coletados ao final |

---

### `span.error`

Emitido quando a operação falha. Substitui `span.end`.

```json
{
  "schema_version": 1,
  "event_type": "span.error",
  "sent_at": "2024-11-15T14:23:06.215Z",
  "sdk": { "name": "traceflow-node", "version": "0.1.0" },
  "payload": {
    "span_id": "span_7c4b1d9e",
    "trace_id": "trace_4e8d1a9f2b3c5e7d",
    "ended_at": "2024-11-15T14:23:06.210Z",
    "duration_ms": 5115,
    "status": "error",
    "error": {
      "type": "TimeoutError",
      "message": "Request to inventory-svc timed out after 5000ms",
      "stack": "TimeoutError: Request to inventory-svc...\n  at Timeout._onTimeout (/app/src/http.ts:42:11)\n  at ...",
      "code": "ETIMEDOUT"
    },
    "tags": {
      "http.status_code": "504",
      "http.target_service": "inventory-svc"
    }
  }
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `span_id` | `string` | ✅ | ID do span |
| `trace_id` | `string` | ✅ | ID do trace |
| `ended_at` | `string (ISO 8601)` | ✅ | Timestamp do erro |
| `duration_ms` | `int` | ✅ | Duração até o erro |
| `status` | `"error" \| "timeout"` | ✅ | `"timeout"` quando a causa for expiração de prazo |
| `error.type` | `string` | ✅ | Tipo/classe do erro |
| `error.message` | `string` | ✅ | Mensagem. Truncada em 1024 chars |
| `error.stack` | `string \| null` | ❌ | Stack trace. Truncado em 4096 chars |
| `error.code` | `string \| null` | ❌ | Código de erro (ex: `ECONNREFUSED`) |
| `tags` | `Record<string, string>` | ❌ | Contexto adicional |

---

### `span.log`

Emitido para registrar eventos dentro de um span em andamento (sem encerrar o span).

```json
{
  "schema_version": 1,
  "event_type": "span.log",
  "sent_at": "2024-11-15T14:23:01.150Z",
  "sdk": { "name": "traceflow-node", "version": "0.1.0" },
  "payload": {
    "span_id": "span_9f3a2c1b",
    "trace_id": "trace_4e8d1a9f2b3c5e7d",
    "logged_at": "2024-11-15T14:23:01.148Z",
    "level": "info",
    "message": "Payment provider selected: stripe",
    "fields": {
      "provider": "stripe",
      "retry_count": "0"
    }
  }
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `span_id` | `string` | ✅ | ID do span em andamento |
| `trace_id` | `string` | ✅ | ID do trace |
| `logged_at` | `string (ISO 8601)` | ✅ | Timestamp do log |
| `level` | `"debug" \| "info" \| "warn" \| "error"` | ✅ | Nível de severidade |
| `message` | `string` | ✅ | Mensagem. Truncada em 512 chars |
| `fields` | `Record<string, string>` | ❌ | Campos estruturados adicionais |

---

## Tags semânticas (convenções)

O SDK preenche automaticamente estas tags quando disponíveis:

### HTTP

| Tag | Tipo | Exemplo |
|---|---|---|
| `http.method` | string | `"POST"` |
| `http.route` | string | `"/checkout/:id"` |
| `http.url` | string | `"https://api.example.com/checkout/123"` |
| `http.host` | string | `"checkout-service"` |
| `http.status_code` | string | `"200"` |
| `http.target_service` | string | `"payments-svc"` |

### Filas

| Tag | Tipo | Exemplo |
|---|---|---|
| `messaging.system` | string | `"rabbitmq"`, `"sqs"`, `"kafka"` |
| `messaging.destination` | string | `"order.created"` |
| `messaging.message_id` | string | `"msg_abc123"` |

### Banco de dados

| Tag | Tipo | Exemplo |
|---|---|---|
| `db.system` | string | `"postgresql"`, `"redis"` |
| `db.name` | string | `"orders"` |
| `db.operation` | string | `"SELECT"`, `"INSERT"` |
| `db.table` | string | `"orders"` |

---

## Limites e rejeições

O coletor rejeita eventos que violem estes limites:

| Limite | Valor |
|---|---|
| Tamanho máximo do evento (JSON) | 32 KB |
| Número máximo de tags por span | 32 |
| Tamanho máximo de valor de tag | 256 chars |
| Tamanho máximo de `error.message` | 1024 chars |
| Tamanho máximo de `error.stack` | 4096 chars |
| Rate limit por `api-key` | 10.000 eventos/minuto (token bucket por workspace; configurável via `RATE_LIMIT_PER_MIN`) |

Eventos rejeitados retornam `400 Bad Request` com corpo:
```json
{ "error": "schema_violation", "detail": "tags exceeded 32 keys limit" }
```
