# Arquitetura Técnica — TraceFlow

## Visão geral

TraceFlow é composto por quatro camadas independentes que se comunicam via contratos bem definidos:

```
[SDK (agente)]  →  [Coletor]  →  [Processador]  →  [API]  →  [Dashboard]
```

Cada camada pode ser escalada, substituída ou testada de forma isolada.

---

## Princípios de design

**Zero overhead na aplicação.** O SDK não pode impactar a latência do serviço instrumentado. Todos os eventos são enviados de forma assíncrona (fire-and-forget via UDP ou HTTP non-blocking). Em caso de falha do coletor, o SDK descarta silenciosamente — observabilidade não pode derrubar a aplicação.

**Schema explícito e versionado.** Todos os eventos trafegam com um campo `schema_version`. Mudanças de schema são aditivas (nunca removem campos). O coletor aceita versões N e N-1.

**Correlação por propagação de contexto.** O `trace-id` é gerado na borda (primeiro serviço a receber a requisição) e propagado por todos os serviços via headers HTTP e metadados de mensagens de fila. Nenhuma correlação é feita por heurística.

**Imutabilidade dos eventos.** Eventos armazenados nunca são modificados. Aggregações e correlações são computadas em query time ou em tabelas derivadas separadas.

---

## Componentes

### SDK (agente)

Biblioteca leve instalada em cada serviço. Responsabilidades:

- Gerar `trace-id` único quando não existe no contexto de entrada
- Propagar `trace-id` em chamadas HTTP outbound (via interceptor automático)
- Propagar `trace-id` em publicações de fila (metadado da mensagem)
- Capturar eventos de span: início, fim, status, metadados
- Enviar eventos ao coletor de forma assíncrona e não-bloqueante
- Buffer local com descarte silencioso quando coletor indisponível

**Node.js:** intercepta automaticamente `http`, `https` e `fetch` nativos. Middleware Express disponível para captura automática de rotas.

**Elixir (roadmap):** usa `:telemetry` da BEAM para interceptar Phoenix, Ecto e `Task` sem monkey-patching.

### Coletor

Processo Go de alta performance. Único ponto de entrada para eventos.

Responsabilidades:
- Receber eventos via HTTP POST (JSON) e UDP (MessagePack)
- Validar schema e versão
- Autenticar via `x-api-key` no header
- Publicar eventos validados em fila interna (channel Go) para o processador
- Retornar `202 Accepted` imediatamente (sem esperar processamento)
- Métricas próprias: eventos/segundo, taxa de rejeição, latência de ingestão

O coletor é stateless — pode rodar em múltiplas réplicas sem coordenação.

### Processador

Processo Go que consome a fila interna do coletor.

Responsabilidades:
- Agrupar spans por `trace-id`
- Construir o DAG (grafo acíclico dirigido) da requisição
- Detectar anomalias: timeout (span > threshold configurado), erro (`status = error`), spans órfãos (sem parent)
- Persistir trace completo no TimescaleDB
- Publicar atualizações via Redis Pub/Sub para a API (WebSocket push)
- Acionar webhooks de alerta quando regras configuradas disparam

### API

Servidor Node.js/TypeScript. Interface entre o processador/storage e os consumidores (dashboard, integrações externas).

Responsabilidades:
- REST para busca e consulta de traces históricos
- WebSocket para push de novos traces em tempo real
- Autenticação via JWT (gerado no login do dashboard)
- Rate limiting por workspace

### Dashboard

SPA React. Sem estado próprio — todo dado vem da API.

Responsabilidades:
- Renderizar o DAG de cada trace como fluxograma (D3.js)
- Lista de traces recentes com filtros (serviço, status, timerange)
- Detalhe de span: payload de entrada/saída, stack trace, duração
- Configuração de alertas e thresholds

---

## Fluxo de dados (caminho feliz)

```
1. Requisição entra no Serviço A
2. SDK detecta ausência de trace-id, gera um novo (UUID v4)
3. SDK inicia span "http.server POST /checkout" com timestamp
4. Serviço A chama Serviço B via HTTP
5. SDK injeta "x-trace-id" e "x-parent-span-id" nos headers outbound
6. SDK inicia span "http.client → ServiçoB"
7. Serviço B recebe a chamada
8. SDK do Serviço B lê trace-id do header, inicia span filho
9. ... (repete para cada hop)
10. Todos os serviços enviam seus spans ao coletor (assíncrono)
11. Coletor valida e enfileira
12. Processador agrupa por trace-id, monta o DAG
13. Processador persiste no TimescaleDB
14. Processador publica no Redis Pub/Sub
15. API recebe via Redis e faz push via WebSocket
16. Dashboard atualiza o fluxograma em tempo real
```

---

## Modelo de dados

### Evento de span (enviado pelo SDK)

Ver [EVENT_SCHEMA.md](api/EVENT_SCHEMA.md) para o schema completo e versionado.

### Trace (computado pelo processador)

```
Trace
  id: string (= trace-id do span raiz)
  started_at: timestamp
  ended_at: timestamp | null
  status: "in_progress" | "ok" | "error" | "timeout"
  root_service: string
  root_operation: string
  span_count: int
  error_count: int
  duration_ms: int | null
  spans: Span[]
```

### Span (persistido)

```
Span
  id: string
  trace_id: string
  parent_span_id: string | null
  service_name: string
  operation_name: string
  kind: "server" | "client" | "producer" | "consumer" | "internal"
  started_at: timestamp
  ended_at: timestamp | null
  duration_ms: int | null
  status: "ok" | "error" | "timeout"
  error_message: string | null
  tags: Record<string, string>
  schema_version: int
```

---

## Decisões de arquitetura (ADRs)

- [ADR-001](adr/001-go-para-coletor.md) — Por que Go para o coletor
- [ADR-002](adr/002-udp-vs-http.md) — UDP vs HTTP para transporte de eventos
- [ADR-003](adr/003-timescaledb.md) — TimescaleDB como storage principal
- [ADR-004](adr/004-propagacao-de-contexto.md) — Estratégia de propagação de trace-id

---

## Infraestrutura local (desenvolvimento)

```yaml
# docker-compose.yml (resumo)
services:
  timescaledb:
    image: timescale/timescaledb:latest-pg15
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  collector:
    build: ./collector
    ports: ["4317:4317"]
    environment:
      - REDIS_URL=redis://redis:6379
      - DB_URL=postgres://...

  api:
    build: ./api
    ports: ["3000:3000"]
    depends_on: [timescaledb, redis, collector]

  dashboard:
    build: ./dashboard
    ports: ["5173:5173"]
    depends_on: [api]
```

---

## Considerações de segurança

- Toda comunicação SDK → Coletor usa `x-api-key` por workspace
- API usa JWT com expiração de 24h
- Payloads de span são truncados em 4KB para evitar exfiltração acidental de dados sensíveis
- Campo `tags` suporta lista de chaves para redação automática (ex: `redact: ["authorization", "password"]`)
- TLS obrigatório em produção (self-hosted: responsabilidade do operador; SaaS: gerenciado)
