# Consumindo o TraceFlow Java SDK

O SDK do TraceFlow é distribuído publicamente usando o GitHub Pages. **Nenhuma autenticação é necessária** para consumi-lo no seu projeto.

## 1. Adicione o repositório no seu projeto

No seu **`pom.xml` raiz**, adicione o repositório do GitHub Pages:

```xml
<repositories>
  <repository>
    <id>traceflow-pages</id>
    <name>TraceFlow GitHub Pages</name>
    <url>https://leonardolermen.github.io/Tracer/</url>
    <releases><enabled>true</enabled></releases>
    <snapshots><enabled>false</enabled></snapshots>
  </repository>
</repositories>
```

## 2. Adicione a dependência

No `pom.xml` do seu serviço, adicione a dependência do starter:

```xml
<dependency>
    <groupId>com.traceflow</groupId>
    <artifactId>traceflow-spring-boot-starter</artifactId>
    <version>1.0.0</version>
</dependency>
```

## 3. Configure o `application.yml`

O SDK já irá capturar e instrumentar tudo, mas precisa saber para qual servidor do TraceFlow ele deve enviar os dados:

```yaml
traceflow:
  collector-url: http://seu-collector:4317
  workspace-id: ws_seu_workspace
  capture-http-body: true
  redact-sensitive-fields: true
  enabled: true
```

Pronto! O SDK auto-configura o filtro HTTP, o interceptor Feign e a propagação de eventos no Kafka automaticamente.
