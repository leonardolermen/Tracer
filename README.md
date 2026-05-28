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
Login padrão: qualquer e-mail/senha (ou crie via script abaixo)

### 2. Crie sua conta

```bash
node scripts/create-user.js --email dev@empresa.com --password senha123 --workspace "Minha Empresa"
```

### 3. Integre seu serviço

Acesse **Settings** no dashboard e copie o snippet para sua linguagem.
Seu `workspaceId` e a URL do coletor já estarão preenchidos.

## Integração

O TraceFlow suporta múltiplas linguagens e abordagens. Todos os SDKs listados abaixo possuem:
- Captura automática de Request/Response Body
- Redação automática de campos sensíveis (`password`, `token`, etc)
- Propagação de Trace entre serviços

### SDKs Oficiais

| Linguagem / Plataforma | Pacote | Setup |
|---|---|---|
| **Java (Spring Boot)** | `traceflow-spring-boot-starter` | Dependência Maven + `application.yml` |
| **Node.js (Express)** | `@traceflow/sdk` | Middleware `app.use(traceflowMiddleware)` |
| **.NET / C#** | `TraceFlow.Sdk` | `app.UseTraceFlow()` no `Program.cs` |
| **Go** | `github.com/traceflow/sdk-go` | Envolver handler: `traceflow.Middleware(h)` |
| **Ruby (Rack)** | `traceflow-sdk` | Middleware: `config.middleware.use TraceFlow::Middleware` |

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
    TF_WORKSPACE_ID: "ws_seu_workspace_id"
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

TraceFlow.init({ serviceName: 'meu-servico' })
// workspaceId e collectorUrl lidos das variáveis de ambiente automaticamente

app.use(traceflowMiddleware(TraceFlow.instance))
```

```bash
# .env
TRACEFLOW_WORKSPACE_ID=ws_seu_workspace_id
TRACEFLOW_COLLECTOR_URL=http://localhost:4317
```

---

## Variáveis de ambiente — SDK Node

| Variável | Padrão | Descrição |
|---|---|---|
| `TRACEFLOW_WORKSPACE_ID` | `ws_dev` | ID do seu workspace |
| `TRACEFLOW_COLLECTOR_URL` | `http://localhost:4317` | URL do coletor (HTTP) |
| `TRACEFLOW_COLLECTOR_HOST` | `localhost` | Host do coletor (UDP) |

---

## Endpoints do coletor

| Endpoint | Método | Descrição |
|---|---|---|
| `/v1/spans` | POST | Envia spans de trace |
| `/v1/logs` | POST | Envia logs de negócio |
| `/v1/traces` | POST | OTLP traces (Micrometer, OpenTelemetry) |
| `/health` | GET | Health check |

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
| SDK Python | 🔲 Roadmap |
| SDK Go | 🔲 Roadmap |
| Alertas em tempo real | 🔄 Em progresso |
