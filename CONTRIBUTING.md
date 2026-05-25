# Guia de Contribuição

## Pré-requisitos

- Node.js 20+
- Go 1.22+
- Docker Desktop
- Git

## Setup inicial

```bash
git clone https://github.com/seu-user/traceflow
cd traceflow

# Sobe banco e cache
docker compose up -d timescaledb redis

# Instala dependências Node.js
npm install --workspaces

# Verifica setup do Go
cd collector && go mod tidy
```

## Estrutura do repositório

```
traceflow/
├── sdk-node/          # SDK TypeScript para Node.js
│   ├── src/
│   │   ├── index.ts       # Ponto de entrada público
│   │   ├── tracer.ts      # Core de geração de spans
│   │   ├── propagation.ts # Injeção/extração de trace-id
│   │   ├── transport/     # HTTP e UDP senders
│   │   └── integrations/  # Express, fetch, http automáticos
│   └── package.json
│
├── collector/         # Coletor Go
│   ├── cmd/collector/     # main.go
│   ├── internal/
│   │   ├── handler/       # HTTP e UDP handlers
│   │   ├── validator/     # Validação de schema
│   │   └── queue/         # Fila interna (channels)
│   └── go.mod
│
├── processor/         # Processador Go
│   ├── cmd/processor/
│   ├── internal/
│   │   ├── correlator/    # Agrupamento de spans por trace-id
│   │   ├── detector/      # Detecção de anomalias
│   │   └── storage/       # TimescaleDB repository
│   └── go.mod
│
├── api/               # API Node.js/TypeScript
│   ├── src/
│   │   ├── routes/        # REST endpoints
│   │   ├── ws/            # WebSocket server
│   │   ├── services/      # Lógica de negócio
│   │   └── db/            # Queries TimescaleDB
│   └── package.json
│
├── dashboard/         # React SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── TraceDAG/  # Fluxograma D3
│   │   │   ├── TraceList/ # Lista de traces
│   │   │   └── SpanDetail/
│   │   └── pages/
│   └── package.json
│
├── docs/              # Documentação
│   ├── PRODUCT.md
│   ├── ARCHITECTURE.md
│   ├── api/
│   │   ├── EVENT_SCHEMA.md
│   │   └── REST_API.md
│   └── adr/
│
├── docker-compose.yml
└── README.md
```

## Fluxo de desenvolvimento

### Rodando tudo junto

```bash
# Terminal 1: infra
docker compose up -d

# Terminal 2: coletor
cd collector && go run ./cmd/collector

# Terminal 3: processador
cd processor && go run ./cmd/processor

# Terminal 4: API
cd api && npm run dev

# Terminal 5: dashboard
cd dashboard && npm run dev
```

### Rodando apenas o SDK (para desenvolver integrações)

```bash
cd sdk-node
npm run dev       # watch mode
npm test          # testes unitários
npm run test:e2e  # testes com coletor real (requer Docker)
```

## Convenções

### Commits

Seguimos Conventional Commits:

```
feat(sdk-node): adiciona instrumentação automática para fetch
fix(collector): corrige race condition no shutdown graceful
docs(api): atualiza schema de span.error com campo code
test(processor): adiciona teste de correlação com spans órfãos
```

Tipos: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`

### Branches

```
main          # sempre deployável, protegida
develop       # integração contínua
feat/nome     # novas funcionalidades
fix/nome      # correções
docs/nome     # apenas documentação
```

### Pull Requests

- Título no formato Conventional Commits
- Descrição: o quê, por quê, como testar
- Todos os testes passando
- Sem warnings de lint

## Testes

### SDK Node.js

```bash
cd sdk-node
npm test                    # Jest unitário
npm run test:integration    # com coletor mock
```

### Coletor / Processador (Go)

```bash
cd collector
go test ./...               # todos os testes
go test -race ./...         # com detector de race condition
```

### API

```bash
cd api
npm test                    # Jest + supertest
```

## Variáveis de ambiente

Copie `.env.example` para `.env` em cada componente:

```bash
cp collector/.env.example collector/.env
cp api/.env.example api/.env
cp dashboard/.env.example dashboard/.env
```

### Collector (`collector/.env`)

```env
PORT=4317
UDP_PORT=4318
REDIS_URL=redis://localhost:6379
LOG_LEVEL=debug
```

### API (`api/.env`)

```env
PORT=3000
DATABASE_URL=postgres://traceflow:traceflow@localhost:5432/traceflow
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-change-in-production
```

### Dashboard (`dashboard/.env`)

```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```
