# TraceFlow — Documento de Produto

## Visão

**Para** engenheiros que operam APIs e sistemas distribuídos,  
**que** perdem tempo debugando falhas que passam por múltiplos serviços,  
**TraceFlow** é uma plataforma de observabilidade focada em contexto de negócio,  
**que** captura automaticamente o corpo de cada requisição, os eventos de negócio e o caminho completo entre serviços,  
**ao contrário de** OpenTelemetry/Jaeger que capturam spans técnicos, e Datadog/New Relic que são caros e genéricos.

---

## O Problema

Uma transação de pagamento passa por 4 serviços em 566ms e falha no último. O dev precisa saber:

- Qual serviço falhou?
- Com quais dados de entrada?
- O fraud-service aprovou? Com qual score?
- O erro foi timeout, validação ou exceção?

**Sem TraceFlow:** abre 4 abas de log, tenta correlacionar timestamps manualmente, 45-90 minutos de investigação.

**Com TraceFlow:** abre o trace no dashboard, vê a timeline completa com body da request, score de fraude e o span exato que falhou, em 2 minutos.

---

## O que o TraceFlow captura (que o OTEL não captura por padrão)

| Dado | OTEL puro | TraceFlow SDK |
|---|---|---|
| Duração, status HTTP, URL | ✅ | ✅ |
| Body da request/response | ❌ | ✅ |
| Redação automática de campos sensíveis | ❌ configuração manual | ✅ automático |
| Logs de negócio correlacionados ao trace | ❌ | ✅ |
| Timeline visual proporcional | ❌ só coleta | ✅ |
| Setup em < 5 minutos | ❌ | ✅ |

---

## Status Atual

### ✅ Produção

**Infraestrutura:**
- Coletor Go (porta 4317) — recebe spans e logs via HTTP
- Processador Go — persiste no TimescaleDB
- API Node.js — REST com autenticação JWT
- Dashboard React — timeline, logs, filtros, settings

**SDKs:**
- `sdk-node` — Express.js middleware, captura automática de body + logs de negócio
- `traceflow-spring-boot-starter` — Spring Boot `OncePerRequestFilter`, zero código no controller

**Features do Dashboard:**
- Timeline visual proporcional dos spans por serviço
- Request Body Card — mostra o body da requisição raiz com pretty-print JSON
- Aba de Logs correlacionados ao trace (com filtro por nível e busca)
- Filtros avançados: service, status, date range, hour range
- Settings page com workspace ID, API key e snippets de integração por linguagem
- Skeleton loading

---

## Roadmap

### v1.1 — Mais SDKs
Expandir cobertura de linguagens para reduzir fricção de adoção:

- [ ] SDK Python (FastAPI + Django)
- [ ] SDK Ruby (Rails + Sinatra via Rack)
- [ ] SDK C# (ASP.NET Core)
- [ ] SDK Go (Gin + Echo)
- [ ] SDK Java Quarkus (extensão Quarkus)

### v1.2 — Qualidade de Dados
- [ ] OTLP completo (logs + métricas, hoje só traces parcial)
- [ ] Ingestão via Fluent Bit / Logstash (aceitar qualquer log shipper)
- [ ] Retention policies configuráveis por workspace

### v1.3 — Inteligência
- [ ] Detecção automática de anomalias (P95 fora do baseline)
- [ ] Comparação de trace saudável vs trace com erro (diff visual)
- [ ] Agrupamento de traces por endpoint + análise de outliers
- [ ] Alertas em tempo real via webhook (Slack, Discord, PagerDuty)

### v2.0 — SaaS
- [ ] Multi-tenant gerenciado (sem infra própria para o cliente)
- [ ] SSO / RBAC para times
- [ ] Planos: Free (7 dias retenção) / Pro (90 dias) / Enterprise (custom)

---

## Diferenciais Competitivos

| Critério | TraceFlow | Jaeger/Zipkin | Datadog APM | OTEL + Grafana |
|---|---|---|---|---|
| Setup time | **< 5 min** | 30-60 min | 60+ min | 2-4h |
| Custo self-hosted | **Grátis** | Grátis | N/A | Grátis (infra paga) |
| Body da requisição | **✅** | ❌ | ✅ pago | ❌ |
| Redação de sensíveis automática | **✅** | ❌ | ❌ manual | ❌ manual |
| Logs de negócio correlacionados | **✅** | ❌ | ✅ pago | ❌ |
| UX para dev individual | **✅** | ❌ complexo | ❌ enterprise | ❌ infra |
| Open source | **✅** | ✅ | ❌ | ✅ |

---

## Personas

### Diego — Engenheiro Backend em Fintech (principal)
- Opera 6-12 microserviços (Node.js + Java)
- Não tem DevOps dedicado
- **Dor:** "quando uma transação falha, não sei em qual serviço sem abrir 4 abas de log"
- **Não vai** pagar $500/mês por Datadog para time de 8 pessoas
- **Já tentou** OTEL, achou configuração complexa demais

### Camila — Tech Lead (secundária)
- Lidera time de 5 devs
- Precisa de visibilidade para postmortems e code reviews
- **Dor:** "na hora do postmortem, ninguém consegue reconstituir o que aconteceu"

---

## Métricas de Sucesso

### Validação (0-3 meses)
- 50 instalações do SDK
- 10 devs usando ativamente (> 5 traces/semana)
- Tempo médio de setup < 10 minutos (medido em onboarding)
- NPS > 40

### Crescimento (3-12 meses)
- 500 repos com SDK instalado
- 5 linguagens com SDK disponível
- 1 empresa pagando pelo plano SaaS

---

## Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| OTEL se torna simples o suficiente | Média | Focar em body capture e logs de negócio — o que OTEL não faz |
| Adoção lenta por falta de SDK para outras linguagens | Alta | Priorizar Python e C# que têm maior mercado após Node/Java |
| Concorrente grande lança feature similar | Baixa | Velocidade de ship e DX superior ao enterprise |
