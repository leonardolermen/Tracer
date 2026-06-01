# API REST — TraceFlow

Base URL: `http://localhost:3000/api/v1` (desenvolvimento)

Todas as rotas requerem header `Authorization: Bearer {jwt}`, exceto `/auth/*`.

---

## Autenticação

### `POST /auth/register`

Cria um workspace e o primeiro usuário. Senha hasheada com `bcrypt`.

```json
// Request
{ "email": "dev@example.com", "password": "...", "workspaceName": "Minha Empresa" }

// Response 200 — mesmo formato do login
```

### `POST /auth/login`

```json
// Request
{ "email": "dev@example.com", "password": "..." }

// Response 200
{
  "token": "eyJhbGci...",
  "expires_at": "2024-11-16T14:00:00Z",
  "workspace": {
    "id": "ws_abc123",
    "name": "Minha Empresa",
    "api_key": "tf_live_9f3a2c1b...",
    "plan": "free",
    "created_at": "2024-11-15T14:00:00Z"
  }
}
```

### `GET /auth/me`

Retorna o workspace do usuário autenticado.

```json
// Response 200
{ "workspace": { "id": "ws_abc123", "name": "Minha Empresa", "api_key": "tf_live_...", "plan": "free", "created_at": "..." }, "email": "dev@example.com" }
```

---

## Traces

### `GET /traces`

Lista traces com suporte a filtros e paginação.

**Query params:**

| Parâmetro | Tipo | Default | Descrição |
|---|---|---|---|
| `service` | string | — | Filtra por serviço de origem |
| `status` | `ok \| error \| timeout \| in_progress` | — | Filtra por status |
| `from` | ISO 8601 | últimas 1h | Início do intervalo |
| `to` | ISO 8601 | agora | Fim do intervalo |
| `min_duration_ms` | int | — | Filtra traces mais lentos que N ms |
| `limit` | int | 50 | Máx 200 |
| `cursor` | string | — | Cursor de paginação (retornado na resposta) |

**Response 200:**

```json
{
  "traces": [
    {
      "id": "trace_4e8d1a9f2b3c5e7d",
      "started_at": "2024-11-15T14:23:01.095Z",
      "ended_at": "2024-11-15T14:23:06.210Z",
      "duration_ms": 5115,
      "status": "error",
      "root_service": "checkout-service",
      "root_operation": "http.server POST /checkout",
      "span_count": 7,
      "error_count": 1,
      "services": ["checkout-service", "payments-svc", "inventory-svc"]
    }
  ],
  "total": 142,
  "next_cursor": "cur_9f3a2c..."
}
```

---

### `GET /traces/:trace_id`

Retorna o trace completo com todos os spans e o DAG computado.

**Response 200:**

```json
{
  "id": "trace_4e8d1a9f2b3c5e7d",
  "started_at": "2024-11-15T14:23:01.095Z",
  "ended_at": "2024-11-15T14:23:06.210Z",
  "duration_ms": 5115,
  "status": "error",
  "root_service": "checkout-service",
  "root_operation": "http.server POST /checkout",
  "span_count": 7,
  "error_count": 1,
  "spans": [
    {
      "id": "span_9f3a2c1b",
      "parent_span_id": null,
      "service_name": "checkout-service",
      "operation_name": "http.server POST /checkout",
      "kind": "server",
      "started_at": "2024-11-15T14:23:01.095Z",
      "ended_at": "2024-11-15T14:23:06.210Z",
      "duration_ms": 5115,
      "status": "error",
      "error": null,
      "tags": { "http.method": "POST", "http.route": "/checkout" },
      "logs": [],
      "children": ["span_2a1b3c4d", "span_5e6f7a8b"]
    },
    {
      "id": "span_7c4b1d9e",
      "parent_span_id": "span_5e6f7a8b",
      "service_name": "inventory-svc",
      "operation_name": "http.server GET /reserve",
      "kind": "server",
      "started_at": "2024-11-15T14:23:01.095Z",
      "ended_at": "2024-11-15T14:23:06.210Z",
      "duration_ms": 5115,
      "status": "timeout",
      "error": {
        "type": "TimeoutError",
        "message": "Request to inventory-svc timed out after 5000ms",
        "code": "ETIMEDOUT"
      },
      "tags": { "http.status_code": "504" },
      "logs": [],
      "children": []
    }
  ],
  "dag": {
    "nodes": [
      { "id": "span_9f3a2c1b", "service": "checkout-service", "operation": "POST /checkout", "status": "error", "duration_ms": 5115 }
    ],
    "edges": [
      { "from": "span_9f3a2c1b", "to": "span_2a1b3c4d", "label": "http.client" }
    ]
  }
}
```

---

### `GET /traces/:trace_id/logs`

Retorna os logs de negócio correlacionados ao trace, ordenados por `timestamp`.

**Response 200:**

```json
{
  "logs": [
    { "id": "log_abc", "service_name": "fraud-service", "level": "INFO", "message": "fraud.analysis.decision", "attributes": { "score": "0.12" }, "timestamp": "2024-11-15T14:23:01.5Z" }
  ]
}
```

---

### `GET /traces/:trace_id/timeline`

Retorna os spans em formato de timeline (ordenados por `started_at`), ideal para renderização em Gantt.

**Response 200:**

```json
{
  "trace_id": "trace_4e8d1a9f2b3c5e7d",
  "total_duration_ms": 5115,
  "timeline": [
    {
      "span_id": "span_9f3a2c1b",
      "service_name": "checkout-service",
      "operation_name": "http.server POST /checkout",
      "offset_ms": 0,
      "duration_ms": 5115,
      "status": "error",
      "depth": 0
    },
    {
      "span_id": "span_2a1b3c4d",
      "service_name": "payments-svc",
      "operation_name": "http.server POST /charge",
      "offset_ms": 12,
      "duration_ms": 98,
      "status": "ok",
      "depth": 1
    }
  ]
}
```

---

## Serviços

### `GET /services`

Lista todos os serviços que já enviaram eventos para este workspace.

**Response 200:**

```json
{
  "services": [
    {
      "name": "checkout-service",
      "last_seen_at": "2024-11-15T14:23:06Z",
      "trace_count_24h": 1423,
      "error_rate_24h": 0.032,
      "p95_duration_ms": 312
    }
  ]
}
```

---

### `GET /services/:service_name/stats`

Retorna métricas agregadas de um serviço.

**Query params:** `from`, `to`, `interval` (`1m`, `5m`, `1h`, `1d`)

**Response 200:**

```json
{
  "service_name": "checkout-service",
  "from": "2024-11-15T13:00:00Z",
  "to": "2024-11-15T14:00:00Z",
  "interval": "5m",
  "series": [
    {
      "timestamp": "2024-11-15T13:00:00Z",
      "request_count": 142,
      "error_count": 4,
      "error_rate": 0.028,
      "p50_ms": 87,
      "p95_ms": 312,
      "p99_ms": 891
    }
  ]
}
```

---

## Alertas

### `GET /alerts`

Lista alertas configurados no workspace.

### `POST /alerts`

Cria um novo alerta.

```json
// Request
{
  "name": "Checkout lento",
  "condition": {
    "type": "latency_p95",
    "service": "checkout-service",
    "operation": "http.server POST /checkout",
    "threshold_ms": 1000,
    "window_minutes": 5
  },
  "channels": [
    { "type": "slack", "webhook_url": "https://hooks.slack.com/..." },
    { "type": "webhook", "url": "https://meu-sistema.com/alerta" }
  ]
}

// Response 201
{ "id": "alert_abc123", "created_at": "2024-11-15T14:00:00Z" }
```

### `DELETE /alerts/:alert_id`

Remove um alerta.

---

## WebSocket

### `ws://localhost:3000/ws`

Conexão para receber spans em tempo real.

**Autenticação:** envie o JWT como primeiro frame após conectar:
```json
{ "type": "auth", "token": "eyJhbGci..." }
```

Resposta do servidor: `{ "type": "auth.ok" }` em sucesso, ou `{ "type": "auth.error", "message": "Invalid token" }` (a conexão é fechada).

**Inscrição em um trace específico:**
```json
{ "type": "subscribe", "trace_id": "trace_4e8d1a9f2b3c5e7d" }
```

**Inscrição em novos traces de um serviço:**
```json
{ "type": "subscribe_service", "service": "checkout-service" }
```

**Eventos recebidos pelo cliente:**

```json
// Novo span chegou (implementado)
{
  "type": "span.received",
  "trace_id": "trace_4e8d1a9f2b3c5e7d",
  "span": { ... }
}
```

> **Planejado (ainda não emitido):** `trace.complete` (trace totalmente correlacionado) e `alert.fired` (alerta disparado). Hoje o servidor só repassa `span.received` para clientes inscritos via `subscribe` (por `trace_id`) ou `subscribe_service` (por `service`).

---

## Códigos de erro

| HTTP | Código | Descrição |
|---|---|---|
| 400 | `validation_error` | Parâmetros inválidos |
| 401 | `unauthorized` | Token ausente ou expirado |
| 403 | `forbidden` | Sem permissão para o recurso |
| 404 | `not_found` | Recurso não encontrado |
| 429 | `rate_limited` | Limite de requisições excedido |
| 500 | `internal_error` | Erro interno |

```json
// Formato padrão de erro
{
  "error": "not_found",
  "message": "Trace 'trace_xyz' not found",
  "request_id": "req_9f3a2c1b"
}
```
