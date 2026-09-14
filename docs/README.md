# Documentación de The Flash

Este es el punto de entrada de la documentación del proyecto. La aplicación actual es un frontend
con datos mock normalizados; la documentación de producto futuro y la de persistencia no deben
interpretarse como funcionalidades ya disponibles.

## Dónde buscar

| Necesito saber...                             | Consulta                                                                                                   |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Qué está implementado ahora                   | [`current/status.md`](current/status.md)                                                                   |
| Cómo está organizado el dominio               | [`current/domain/README.md`](current/domain/README.md)                                                     |
| Cómo funcionan las fronteras servidor/cliente | [`current/architecture/server-client-architecture.md`](current/architecture/server-client-architecture.md) |
| Qué decisiones son normativas                 | [`decisions/README.md`](decisions/README.md)                                                               |
| Cómo se crean formatos y desafíos             | [`content/README.md`](content/README.md)                                                                   |
| Qué estrategia e hipótesis siguen activas     | [`product/README.md`](product/README.md)                                                                   |
| Qué documentos describen etapas anteriores    | [`archive/README.md`](archive/README.md)                                                                   |

## Secciones

- [`current/`](current/README.md): estado implementado, dominio, arquitectura, QA y glosario.
- [`product/`](product/README.md): visión, estrategia Lean y roadmap de producto.
- [`content/`](content/README.md): formatos, desafíos y guías editoriales.
- [`decisions/`](decisions/README.md): decisiones aprobadas, ADRs y cuestiones abiertas.
- [`archive/`](archive/README.md): documentación histórica que no debe usarse como fuente de verdad.

## Estados documentales

- **Vigente:** describe el comportamiento actual o una regla que debe guiar el trabajo nuevo.
- **Propuesta:** explora una dirección todavía no aprobada o no implementada.
- **Histórico:** conserva contexto de una etapa anterior; no prevalece sobre la documentación
  vigente.

## Jerarquía de fuentes de verdad

1. ADR aceptado más reciente.
2. [`decisions/decisions.md`](decisions/decisions.md), para reglas generales aprobadas.
3. Documentación vigente de [`current/domain/`](current/domain/), para el modelo y su estado
   técnico.
4. Documentación de [`content/`](content/), para reglas editoriales y contenido jugable.
5. [`archive/`](archive/), únicamente como contexto histórico.

Si una nueva decisión contradice una regla vigente, debe actualizarse primero la documentación de
decisiones y después los documentos afectados.

## Estado de la última revisión

- Fecha: 2026-09-14.
- 31 formatos de pregunta, cinco modos, siete desafíos definidos y seis publicaciones mock.
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run type-architecture` y
  `npm run style-architecture` completan correctamente.
- `npm run format:check` mantiene avisos preexistentes y Stylelint mantiene una incidencia
  preexistente; están registrados en [`current/qa.md`](current/qa.md).
