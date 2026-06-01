# ADR-003 — TimescaleDB como storage principal

**Data:** 2024-11-15
**Status:** Aceito

## Contexto

Spans são dados de série temporal: sempre têm `started_at`, e as queries mais comuns são por intervalo de tempo ("traces das últimas 2 horas"). Precisamos de queries rápidas por `trace_id`, `service_name`, `status` e `started_at`.

## Decisão

Usar TimescaleDB (extensão do PostgreSQL) como storage principal.

## Justificativas

**PostgreSQL como base.** A maioria dos devs já conhece SQL e PostgreSQL. Self-hosted é trivial via Docker. Sem curva de aprendizado para contribuidores.

**Hypertables para séries temporais.** TimescaleDB particiona automaticamente a tabela `spans` por tempo, tornando queries de intervalo (WHERE started_at BETWEEN ...) muito mais rápidas sem indexação manual.

**Retenção automática.** Políticas de compressão e descarte automático por tempo são built-in, essenciais para o modelo free/paid (7 dias vs 90 dias).

**JSON nativo.** O campo `tags` é armazenado como `jsonb`, permitindo queries em metadados sem schema fixo.

## Alternativas consideradas

**ClickHouse:** excelente para analytics, mas mais complexo de operar e com suporte a transações limitado. Seria overkill para o MVP.

**Elasticsearch:** bom para busca full-text em logs, mas desnecessariamente pesado para spans estruturados.

**SQLite:** perfeito para desenvolvimento local, mas não escala para multi-tenant no SaaS.

## Consequências

- TimescaleDB requer extensão no PostgreSQL (disponível na imagem oficial Docker)
- Migrations gerenciadas com `golang-migrate`
- Schema principal:

```sql
CREATE TABLE spans (
  id           TEXT NOT NULL,
  trace_id     TEXT NOT NULL,
  parent_id    TEXT,
  service_name TEXT NOT NULL,
  operation    TEXT NOT NULL,
  kind         TEXT NOT NULL,
  started_at   TIMESTAMPTZ NOT NULL,
  ended_at     TIMESTAMPTZ,
  duration_ms  INTEGER,
  status       TEXT NOT NULL DEFAULT 'in_progress',
  error_type   TEXT,
  error_msg    TEXT,
  tags         JSONB NOT NULL DEFAULT '{}',
  workspace_id TEXT NOT NULL
);

SELECT create_hypertable('spans', 'started_at');
CREATE INDEX ON spans (trace_id, started_at DESC);
CREATE INDEX ON spans (workspace_id, service_name, started_at DESC);
```

## Retenção e compressão (implementado)

A migration `003_retention_compression.sql` ativa compressão (`compress_segmentby = workspace_id`) com política de compressão para chunks com mais de 7 dias e política de retenção descartando chunks com mais de 90 dias, tanto em `spans` quanto em `logs`.

As políticas do Timescale são globais por hypertable. A diferenciação por plano (free 7d vs paid 90d) é aplicada na camada de aplicação sobre esse teto global de 90 dias, garantindo que dados de planos pagos nunca sejam descartados prematuramente.

---

# ADR-004 — Estratégia de propagação de trace-id

**Data:** 2024-11-15
**Status:** Aceito

## Contexto

Para correlacionar spans de diferentes serviços em um mesmo trace, o `trace-id` precisa ser propagado por toda a cadeia de chamadas. Existem padrões abertos (W3C Trace Context, B3) e podemos definir um formato próprio.

## Decisão

Adotar o padrão W3C Trace Context (RFC) como protocolo de propagação, com header próprio como fallback.

## Justificativas

**Interoperabilidade.** W3C Trace Context é o padrão adotado pelo OpenTelemetry. Serviços que já usam OTel propagarão o trace-id automaticamente sem configuração adicional — o SDK TraceFlow lerá e respeitará o `traceparent` existente.

**Adoção crescente.** Frameworks como Express, Fastify e Spring Boot já têm suporte nativo ou via middleware.

**Formato do header W3C:**
```
traceparent: 00-{trace-id-128bit}-{parent-span-id-64bit}-{flags}
```

**Header próprio como fallback:**
```
x-traceflow-trace-id: trace_4e8d1a9f2b3c5e7d
x-traceflow-span-id: span_9f3a2c1b
```

O SDK lê nesta ordem: `traceparent` → `x-traceflow-trace-id` → gera novo.

## Propagação em filas

Para mensagens de fila (RabbitMQ, SQS, Kafka), o `trace-id` é propagado nos metadados/headers da mensagem:

```json
// Mensagem RabbitMQ
{
  "properties": {
    "headers": {
      "x-traceflow-trace-id": "trace_4e8d1a9f2b3c5e7d",
      "x-traceflow-span-id": "span_9f3a2c1b"
    }
  },
  "content": { ... }
}
```

## Consequências

- SDK precisa implementar extração e injeção do header `traceparent`
- Documentação precisa explicar como configurar serviços sem SDK (ex: adicionar header manualmente em um curl)
- Compatibilidade com Jaeger/Zipkin via `traceparent` é bonus não planejado, mas bem-vindo
