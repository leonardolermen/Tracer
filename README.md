# TraceFlow

> Observabilidade visual para APIs e sistemas distribuídos.

TraceFlow captura automaticamente cada requisição HTTP — corpo, headers, logs de negócio e spans entre serviços — e exibe tudo como uma linha do tempo navegável no dashboard.

```
POST /payments
  └─ core-service  (12ms) ✓  → fraud-service
       └─ fraud-service (80ms) ✓
            └─ fraud.analysis.decision: APPROVED
```

---

## Quickstart — 2 minutos

### 1. Suba a infraestrutura

```bash
git clone https://github.com/seu-user/traceflow
cd traceflow
docker compose up -d
```

Dashboard disponível em **http://localhost:5173**  
Não há login padrão — crie uma conta via `POST /api/v1/auth/register` ou pelo script abaixo. As senhas são validadas com `bcrypt`.

### 2. Crie sua conta

```bash
node scripts/create-user.js --email dev@empresa.com --password senha123 --workspace "Minha Empresa"
```

### 3. Integre seu serviço

Acesse **Settings** no dashboard e copie o snippet para sua linguagem.
Sua `api-key` e a URL do coletor já estarão preenchidos.

## Integração

O TraceFlow suporta múltiplas linguagens e abordagens. Os SDKs de produção (✅) possuem:
- Captura automática de Request/Response Body
- Redação automática de campos sensíveis (`password`, `token`, etc)
- Propagação de Trace entre serviços

Os SDKs beta (🧪) capturam body com redação parcial, mas ainda não propagam o `trace_id` entre serviços.

### SDKs

Legenda: ✅ produção · 🧪 beta (body capture funciona, mas **sem** propagação de trace e com redação parcial)

| Linguagem / Plataforma | Pacote | Setup | Status |
|---|---|---|---|
| **Java (Spring Boot)** | `traceflow-spring-boot-starter` | Dependência Maven + `application.yml` | ✅ |
| **Node.js (Express)** | `@traceflow/sdk` | Middleware `app.use(traceflowMiddleware)` | ✅ |
| **.NET / C#** | `TraceFlow.Sdk` | `app.UseTraceFlow()` no `Program.cs` | 🧪 |
| **Go** | `github.com/traceflow/sdk-go` | Envolver handler: `traceflow.Middleware(h)` | 🧪 |
| **Ruby (Rack)** | `traceflow-sdk` | Middleware: `config.middleware.use TraceFlow::Middleware` | 🧪 |

Acesse a aba **Settings** no dashboard para ver os snippets completos de integração.

---

### Sidecar Proxy (Zero Código)

Se você tem um serviço legado ou em linguagem sem SDK oficial, pode usar o Sidecar. Ele senta na frente do seu serviço no `docker-compose` e proxeia o tráfego interceptando os bodies.

```yaml
# Apenas redirecione o tráfego para a imagem traceflow/sidecar:latest
my-service-sidecar:
  image: traceflow/sidecar:latest
  environment:
    TF_TARGET: "http://my-service:8080"
    TF_SERVICE_NAME: "my-service"
    TF_API_KEY: "tf_live_sua_chave"
  ports: ["8080:8080"]
```

✅ **Zero alteração de código** — o starter instrumenta todas as rotas automaticamente.

---

## Integração — Node.js / Express

```bash
npm install @traceflow/sdk
```

```typescript
import { TraceFlow, traceflowMiddleware } from '@traceflow/sdk'

TraceFlow.init({ serviceName: 'meu-servico', apiKey: 'tf_live_sua_chave' })
// apiKey e collectorUrl também podem vir das variáveis de ambiente automaticamente

app.use(traceflowMiddleware(TraceFlow.instance))
```

```bash
# .env
TRACEFLOW_API_KEY=tf_live_sua_chave
TRACEFLOW_COLLECTOR_URL=http://localhost:4317
```

---

## Variáveis de ambiente — SDK Node

| Variável | Padrão | Descrição |
|---|---|---|
| `TRACEFLOW_API_KEY` | — | Sua api-key (`tf_live_...`); o coletor deriva o workspace dela |
| `TRACEFLOW_COLLECTOR_URL` | `http://localhost:4317` | URL do coletor (HTTP) |
| `TRACEFLOW_COLLECTOR_HOST` | `localhost` | Host do coletor (UDP) |

---

## Endpoints do coletor

| Endpoint | Método | Descrição |
|---|---|---|
| `/spans` | POST | Envia spans nativos (logs de negócio embutidos em `logs[]`) |
| `/v1/traces` | POST | OTLP traces (Micrometer, OpenTelemetry) |
| `/v1/logs` | POST | OTLP logs (OpenTelemetry) |
| `/health` | GET | Health check |
| `/metrics` | GET | Métricas Prometheus de ingestão (recebidos/dropados, auth, rate limit) |

---

## Arquitetura

| Componente | Stack | Responsabilidade |
|---|---|---|
| `sdk-node` | TypeScript | Agente para APIs Node.js/Express |
| `sdk-spring` | Java / Spring Boot | Starter para APIs Java |
| `collector` | Go | Recebe spans e logs, publica no Redis |
| `processor` | Go | Correlaciona spans, persiste no TimescaleDB |
| `api` | Node.js + TypeScript | REST API para o dashboard |
| `dashboard` | React + Vite | Interface de observabilidade |

---

## O que o TraceFlow captura automaticamente

- ✅ **HTTP request/response** — método, URL, body (com redação de campos sensíveis), status
- ✅ **Propagação de trace** — o `trace_id` flui automaticamente entre serviços via headers
- ✅ **Spans hierárquicos** — timeline visual mostrando qual serviço chamou qual, e quanto tempo cada um levou
- ✅ **Logs de negócio** — eventos customizados (`fraud.analysis.decision`, `payment.created`, etc.) correlacionados ao trace
- ✅ **Dados sensíveis protegidos** — `password`, `token`, `cvv`, `cpf` e outros campos são mascarados por padrão

---

## Status

| Milestone | Status |
|---|---|
| Collector + Processor | ✅ Produção |
| SDK Node.js | ✅ Produção |
| SDK Spring Boot | ✅ Produção |
| Dashboard — Timeline | ✅ Produção |
| Dashboard — Logs correlacionados | ✅ Produção |
| Dashboard — Settings / Getting Started | ✅ Produção |
| SDK Go / C# / Ruby | 🧪 Beta (sem propagação de trace) |
| SDK Python | 🔲 Roadmap |
| Alertas em tempo real | 🔄 Em progresso |
