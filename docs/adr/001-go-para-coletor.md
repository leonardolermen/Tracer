# ADR-001 — Go para o coletor e processador

**Data:** 2024-11-15
**Status:** Aceito

## Contexto

O coletor precisa receber eventos de trace de múltiplos serviços simultaneamente com latência mínima. Em pico, um sistema com 10 serviços e 100 req/s pode gerar 1.000-5.000 eventos/segundo. O processador precisa correlacionar spans por `trace-id` e persistir no banco sem atrasar a ingestão.

## Decisão

Usar Go para o coletor e o processador.

## Justificativas

**Performance nativa.** Go compila para binário sem runtime pesado. A goroutine scheduler lida bem com I/O concorrente (receber eventos de múltiplas fontes) sem o overhead de threads do sistema operacional.

**Simplicidade de deploy.** Um binário estático sem dependências de runtime. Facilita o self-hosted: o usuário baixa um executável e roda.

**Concorrência idiomática.** O modelo de channels e goroutines é natural para o padrão coletor → fila interna → processador. Não há necessidade de biblioteca de filas externa para o MVP.

**Ecossistema maduro para networking.** A stdlib do Go para HTTP, UDP e WebSocket é robusta e bem testada.

## Alternativas consideradas

**Node.js/TypeScript:** já usamos para a API, o que reduziria o número de linguagens. Rejeitado porque o event loop single-threaded do Node é menos adequado para ingestion de alta concorrência sem workers adicionais.

**Rust:** performance superior ao Go, mas curva de aprendizado significativa e ecossistema menos maduro para HTTP servers. O ganho de performance não justifica a complexidade para o MVP.

**Elixir:** a BEAM seria excelente para concorrência e tolerância a falhas. Rejeitado porque já planejamos usar Elixir para o SDK — misturar Elixir no backend core aumentaria a barreira de contribuição.

## Consequências

- Time precisa conhecer Go para contribuir no coletor/processador
- Build do coletor separado do monorepo Node.js (Docker multi-stage resolve)
- Cross-compilation facilita distribuição de binários para múltiplas plataformas
