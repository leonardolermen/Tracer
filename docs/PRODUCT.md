# TraceFlow — Documento de Produto

## Visão

**Para** engenheiros que operam sistemas distribuídos ou assíncronos,
**que** perdem horas debugando falhas que envolvem múltiplos serviços,
**TraceFlow** é uma ferramenta de observabilidade focada em fluxo de requisições,
**que** transforma eventos de trace em um fluxograma visual navegável em tempo real,
**ao contrário de** Jaeger, Zipkin e Datadog, que exibem spans técnicos isolados ou exigem configuração complexa e custosa.

---

## O problema

Sistemas modernos são distribuídos por natureza: uma única ação do usuário pode passar por um API gateway, um serviço de autenticação, um serviço de domínio, uma fila de mensagens, um worker assíncrono e um serviço de notificação antes de concluir.

Quando algo falha nesse caminho, o dev enfrenta:

- Logs espalhados em múltiplos terminais, arquivos ou sistemas
- Ausência de correlação automática entre eventos de serviços diferentes
- Ferramentas de APM complexas e caras para times pequenos ou médios
- OpenTelemetry poderoso, mas com curva de configuração íngreme
- Visualizadores como Jaeger que mostram spans técnicos, não a "história" da requisição

O resultado é que um bug que levaria 5 minutos para encontrar com visibilidade adequada consome 45-90 minutos de investigação.

---

## Personas

### Persona 1 — Diego, Engenheiro Backend (principal)

- 4 anos de experiência, trabalha em startup de fintech com 8 devs
- Opera 6-12 microserviços em Node.js + um worker em Python
- Não tem time de DevOps dedicado; ele mesmo configura a infra
- Dor: "quando uma transação falha no final do fluxo, eu não sei em qual serviço o problema aconteceu sem abrir 4 abas de log"
- Não vai pagar $500/mês por Datadog para um time pequeno
- Já tentou OpenTelemetry, achou a configuração complicada demais para o retorno

### Persona 2 — Camila, Tech Lead (secundária)

- Lidera um time de 5 devs em uma empresa de médio porte
- Precisa de visibilidade para code reviews e postmortems
- Quer mostrar para o time onde estão os gargalos de performance
- Dor: "na hora do postmortem, ninguém consegue reconstituir exatamente o que aconteceu"

---

## Proposta de valor

| Para quem | Dor | Solução TraceFlow |
|---|---|---|
| Dev solo / time pequeno | OpenTelemetry é complexo demais | SDK de 3 linhas, zero configuração de collector externo |
| Backend Node.js / Elixir | Ferramentas APM são caras | Open-source, self-hosted gratuito |
| Qualquer dev debugando | Logs não contam a história | Fluxograma visual da requisição completa |
| Tech Lead | Postmortems sem evidência visual | Timeline exportável por trace-id |

---

## Funcionalidades

### MVP (v0.1)

Escopo mínimo para validar o produto com usuários reais.

- SDK Node.js com instrumentação automática de `express` e `http`
- Propagação automática de `trace-id` via headers (`x-trace-id`)
- Captura manual de spans com `startSpan` / `span.end()`
- Coletor Go recebendo eventos via HTTP (porta 4317)
- Correlação de spans por `trace-id`
- Dashboard mostrando o DAG (grafo acíclico) da requisição
- Destaque visual de spans com erro ou timeout
- Retenção de 24h em memória (sem banco de dados para simplificar o MVP)

### v0.2 — Persistência e alertas

- TimescaleDB para retenção histórica (7 dias free, 90 dias paid)
- Busca por `trace-id`, `service`, `status`, `timerange`
- Alertas via webhook (Slack, Discord) quando P95 latência ultrapassar threshold configurado
- SDK para Elixir / BEAM

### v0.3 — Inteligência

- Detecção automática de padrões de falha recorrentes
- Comparação de trace "saudável" vs trace com erro (diff visual)
- Agrupamento de traces por endpoint + análise de outliers
- Exportação de timeline para postmortem (PDF / Markdown)

### Roadmap (além do MVP)

- SDK para Python, Go, Java
- Integração com OpenTelemetry como fonte alternativa de dados
- SaaS gerenciado (sem infra própria)
- SSO / RBAC para times maiores

---

## Diferenciais competitivos

| Critério | TraceFlow | Jaeger/Zipkin | Datadog APM | OpenTelemetry |
|---|---|---|---|---|
| Setup time | < 5 min | 30-60 min | 60+ min | 2-4h |
| Custo (self-hosted) | Grátis | Grátis | N/A | Grátis |
| Visualização de fluxo | ✅ Fluxograma | ⚠️ Gantt de spans | ✅ Sim | ❌ Só coleta |
| Foco em sistemas async | ✅ Sim | ⚠️ Parcial | ⚠️ Parcial | ❌ Agnóstico |
| UX para dev individual | ✅ Sim | ❌ Complexo | ❌ Enterprise | ❌ Infra |

---

## Métricas de sucesso

### Validação (0-3 meses)

- 50 instalações do SDK npm
- 10 devs usando ativamente (> 5 traces/semana)
- NPS > 40 nos primeiros usuários
- Tempo médio de setup < 10 minutos

### Crescimento (3-12 meses)

- 500 repos com SDK instalado (rastreado via npm)
- 3 casos de uso documentados em postmortem público
- Comunidade Discord com > 200 membros
- 1 empresa pagando pelo plano SaaS (prova de willingness to pay)

---

## Riscos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| OpenTelemetry se torna simples o suficiente | Média | Alto | Focar em UX e visualização, que OTel não resolve |
| Custo de infra no SaaS inviabiliza o modelo | Média | Médio | Começar com retenção curta e compressão agressiva |
| Adoção lenta por falta de SDK para outras linguagens | Alta | Médio | Focar em Node primeiro, aceitar contribuições externas |
| Concorrente grande lança feature similar | Baixa | Alto | Velocidade de ship e foco em dev experience > enterprise |
