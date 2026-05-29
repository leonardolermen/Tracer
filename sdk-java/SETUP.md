# Consumindo o TraceFlow Java SDK

## 1. Gere um Personal Access Token no GitHub

Settings → Developer settings → Personal access tokens → **Tokens (classic)**

Permissão necessária: `read:packages`

> Guarde o token — você vai precisar dele no próximo passo.

## 2. Configure o `~/.m2/settings.xml`

Adicione o servidor ao seu `settings.xml` local (crie o arquivo se não existir):

```xml
<settings>
  <servers>
    <server>
      <id>github-traceflow</id>
      <username>SEU_USUARIO_GITHUB</username>
      <password>ghp_SEU_TOKEN_AQUI</password>
    </server>
  </servers>
</settings>
```

> O `id` deve ser exatamente `github-traceflow` — é o mesmo definido no `pom.xml` do projeto cliente.

## 3. Adicione a dependência no seu projeto

**`pom.xml` raiz** — adicione o repositório:

```xml
<repositories>
  <repository>
    <id>github-traceflow</id>
    <name>TraceFlow GitHub Packages</name>
    <url>https://maven.pkg.github.com/leonardolermen/Tracer</url>
    <releases><enabled>true</enabled></releases>
    <snapshots><enabled>false</enabled></snapshots>
  </repository>
</repositories>
```

**`pom.xml` do serviço** — adicione a dependência:

```xml
<dependency>
    <groupId>com.traceflow</groupId>
    <artifactId>traceflow-spring-boot-starter</artifactId>
    <version>1.0.0</version>
</dependency>
```

## 4. Configure o `application.yml`

```yaml
traceflow:
  collector-url: http://seu-collector:4317
  workspace-id: ws_seu_workspace
  capture-http-body: true
  redact-sensitive-fields: true
  enabled: true
```

Pronto. O SDK auto-configura o filtro HTTP, o interceptor Feign e a propagação Kafka automaticamente.

---

## Publicando uma nova versão (TraceFlow team)

```bash
# No projeto traceflow/sdk-java — atualize a versão no pom.xml e rode:
export GITHUB_TOKEN=ghp_seu_token_com_write_packages
mvn deploy
```

Ou simplesmente faça push na branch `main` — o GitHub Actions publica automaticamente.
