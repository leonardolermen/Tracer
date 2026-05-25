# TraceFlow

> Observabilidade visual para sistemas concorrentes e distribuídos.

TraceFlow transforma logs caóticos de sistemas assíncronos em um fluxograma navegável da requisição — do ponto de entrada até a falha, em tempo real.

```
POST /checkout
  └─ ServiçoA (12ms) ✓
       └─ FilaRabbitMQ (enfileirado) ✓
            └─ WorkerB (executou) ✓
                 └─ ServiçoC ✗ timeout após 5s  ← aqui está o problema
```

## O problema

Debugar sistemas distribuídos e assíncronos é extremamente custoso. Ferramentas como Jaeger e Zipkin existem, mas exigem configuração complexa e apresentam spans técnicos isolados — não a história completa da requisição. Datadog e New Relic resolvem parcialmente, mas têm custo elevado e UX genérica.

TraceFlow foca em um único entregável: **mostrar o caminho completo de cada requisição como uma linha do tempo visual de causa e efeito**, com zero configuração além da instalação do SDK.

## Componentes

| Componente | Linguagem | Responsabilidade |
|---|---|---|
| `sdk-node` | TypeScript | Agente leve para serviços Node.js |
| `sdk-elixir` | Elixir | Agente para serviços na BEAM VM *(roadmap)* |
| `collector` | Go | Recebe e roteia eventos de trace |
| `processor` | Go | Correlaciona spans, detecta anomalias |
| `api` | TypeScript | REST + WebSocket para o dashboard |
| `dashboard` | React | Visualização do fluxo em tempo real |

## Quick start (desenvolvimento local)

```bash
# Pré-requisitos: Docker, Node.js 20+, Go 1.22+

git clone https://github.com/seu-user/traceflow
cd traceflow

# Sobe infraestrutura local (TimescaleDB + Redis)
docker compose up -d

# Instala dependências
npm install --workspaces

# Sobe coletor
cd collector && go run ./cmd/collector

# Sobe API + dashboard
npm run dev
```

## Instalação do SDK (Node.js)

```bash
npm install @traceflow/sdk
```

```typescript
import { TraceFlow } from '@traceflow/sdk';

TraceFlow.init({
  serviceName: 'checkout-service',
  collectorUrl: 'http://localhost:4317',
  environment: 'production',
});

// Instrumentação manual de uma operação
const span = TraceFlow.startSpan('process-payment');
try {
  await processPayment(order);
  span.ok();
} catch (err) {
  span.error(err);
} finally {
  span.end();
}
```

O SDK propaga automaticamente o `trace-id` via headers HTTP e contexto de mensagens de fila.

## Documentação

- [Visão do produto e roadmap](docs/PRODUCT.md)
- [Arquitetura técnica](docs/ARCHITECTURE.md)
- [Schema de eventos](docs/api/EVENT_SCHEMA.md)
- [Contrato da API REST](docs/api/REST_API.md)
- [Guia de contribuição](CONTRIBUTING.md)
- [ADRs (decisões de arquitetura)](docs/adr/)

## Modelo de distribuição

TraceFlow é open-source (MIT) para self-hosted. Um plano SaaS gerenciado está no roadmap para times que não querem operar a infraestrutura.

## Status

🚧 Em desenvolvimento ativo. Não use em produção ainda.

| Milestone | Status |
|---|---|
| Schema de eventos v1 | ✅ Definido |
| SDK Node.js (core) | 🔄 Em progresso |
| Coletor Go (MVP) | 🔲 Planejado |
| Correlação de spans | 🔲 Planejado |
| Dashboard (fluxograma) | 🔲 Planejado |
