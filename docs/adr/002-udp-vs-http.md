# ADR-002 — UDP vs HTTP para transporte SDK → Coletor

**Data:** 2024-11-15
**Status:** Aceito

## Contexto

O SDK precisa enviar eventos ao coletor sem impactar a performance da aplicação instrumentada. A escolha do protocolo de transporte afeta latência, confiabilidade e complexidade de implementação.

## Decisão

Suportar ambos, com HTTP como padrão e UDP como opção de alta performance.

## Justificativas

**HTTP (padrão):** mais simples de implementar, funciona atrás de proxies e load balancers, tem semântica de confirmação (response 202), e não requer configuração especial de firewall. Adequado para a maioria dos casos.

**UDP (opcional):** fire-and-forget verdadeiro — o SDK não espera resposta. Útil para serviços com requisitos de latência extremamente baixos onde mesmo o overhead de TCP handshake é relevante. Aceita perda de eventos em troca de zero impacto na aplicação.

A decisão de qual usar fica com quem instala o SDK via configuração:
```typescript
TraceFlow.init({
  transport: 'http',  // ou 'udp'
  collectorUrl: '...',
});
```

## Consequências

- Coletor precisa ouvir em duas portas (4317/HTTP, 4318/UDP)
- UDP requer serialização mais compacta (MessagePack ao invés de JSON)
- Documentação precisa deixar claro que UDP não garante entrega

## Estado da implementação (atualizado)

- HTTP (`POST /spans`) e o listener UDP na porta `4318` estão implementados (`collector/internal/handler/server.go`).
- **Pendente:** o UDP hoje usa **JSON**, não MessagePack. A serialização compacta ainda não foi implementada.
