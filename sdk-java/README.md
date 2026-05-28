# TraceFlow Spring Boot Starter

> SDK de observabilidade plug-and-play para qualquer API Spring Boot.

## Instalação em qualquer serviço

### 1. Adicionar dependência no `pom.xml`

```xml
<dependency>
    <groupId>com.payflow</groupId>
    <artifactId>traceflow-spring-boot-starter</artifactId>
    <version>${project.version}</version>
</dependency>
<!-- AOP necessário para os aspectos automáticos -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-aop</artifactId>
</dependency>
```

### 2. Adicionar no `application.yml`

```yaml
traceflow:
  collector-url: ${TRACEFLOW_COLLECTOR_URL:http://localhost:4317}
  workspace-id: ${TRACEFLOW_WORKSPACE_ID:ws_dev}
  capture-http-body: true      # captura bodies HTTP automaticamente
  redact-sensitive-fields: true # redact automático de password, cpf, token...
  enabled: true
```

**Pronto.** Nenhuma annotation, nenhum `@Bean`, nenhum código extra.

---

## O que acontece automaticamente

| Componente | O que faz |
|---|---|
| `TraceFlowFilter` | Captura HTTP request/response body em toda requisição |
| `TraceFlowFeignInterceptor` | Propaga `X-TraceFlow-Trace-Id` para serviços downstream |
| `@Aspect` (PaymentServiceAspect) | Loga eventos de negócio do PaymentService sem tocar no código |
| `@Aspect` (FraudAnalysisAspect) | Loga score, regras disparadas e decisão do fraud-service |

---

## API pública — logar eventos customizados

```java
import com.traceflow.sdk.TraceFlow;
import java.util.Map;

// INFO — evento de negócio
TraceFlow.log("kyc.verification.started", Map.of(
    "user_id",   userId.toString(),
    "level",     "ENHANCED"
));

// WARN — situação suspeita
TraceFlow.warn("fraud.score.elevated", Map.of(
    "score", "45",
    "rule",  "HIGH_VALUE"
));

// ERROR — falha
TraceFlow.error("payment.gateway.timeout", Map.of(
    "gateway",     "stripe",
    "timeout_ms",  "3000"
));

// Loga qualquer objeto com sanitização automática
TraceFlow.logObject("payment.created", paymentRequest);

// Obtém o trace_id para incluir na resposta
String traceId = TraceFlow.currentTraceId();
response.setHeader("X-Trace-Id", traceId);
```

---

## Fluxo de um pagamento no dashboard

Depois de fazer `POST /payments`, abra:
```
http://localhost:5173/traces/{trace_id}
```

Na aba **Logs** você verá toda a jornada em ordem cronológica:

```
core-service   INFO   http.request              method=POST, body={amount=100...}
core-service   INFO   payment.request.received  amount=100, payerId=..., payeeId=...
core-service   INFO   payment.persisted         uuid=..., status=PENDING
fraud-service  INFO   fraud.analysis.started    paymentId=..., amount=100
fraud-service  DEBUG  fraud.history.loaded      user_id=..., history_count=3
fraud-service  WARN   fraud.rule.triggered      rule=HIGH_VALUE_TRANSACTION, weight=30
fraud-service  INFO   fraud.rules.evaluated     risk_score=30, triggered_rules=[HIGH_VALUE_TRANSACTION]
fraud-service  WARN   fraud.analysis.decision   status=MANUAL_ANALYSIS, score=30, reason=Análise manual...
core-service   WARN   payment.strategy.manual_analysis  handler=ManualAnalysisHandler
core-service   INFO   http.response             status=200
```

---

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `TRACEFLOW_COLLECTOR_URL` | `http://localhost:4317` | URL do coletor TraceFlow |
| `TRACEFLOW_WORKSPACE_ID` | `ws_dev` | Workspace ID do TraceFlow |

---

## Adicionar a um novo serviço (qualquer Spring Boot)

1. Copiar o bloco `traceflow` do `application.yml`
2. Adicionar a dependência no `pom.xml`
3. (Opcional) Criar um `@Aspect` específico com `TraceFlow.log()` para seus eventos de negócio

Nenhuma outra configuração necessária. O starter detecta automaticamente se Feign está presente
e registra o interceptor. Se o serviço não usa Feign, esse bean simplesmente não é criado.
