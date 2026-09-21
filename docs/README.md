# Documentación de The Flash

Este es el punto de entrada de la documentación del proyecto. La aplicación combina recorridos
mock/práctica con slices reales sobre Supabase local; la documentación de producto futuro y las
capacidades aún pendientes no deben interpretarse como funcionalidades ya disponibles.

## Dónde buscar

| Necesito saber...                               | Consulta                                                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Qué está implementado ahora                     | [`current/status.md`](current/status.md)                                                                   |
| Cómo está organizado el dominio                 | [`current/domain/README.md`](current/domain/README.md)                                                     |
| Qué casos de uso debe soportar                  | [`current/use-cases.md`](current/use-cases.md)                                                             |
| Qué arquitectura debe guiar la evolución        | [`current/architecture.md`](current/architecture.md)                                                       |
| En qué orden implementar backend y persistencia | [`implementation-plan.md`](implementation-plan.md)                                                         |
| Cómo organizar la persistencia futura           | [`current/data-model.md`](current/data-model.md)                                                           |
| Cómo funcionan las fronteras servidor/cliente   | [`current/architecture/server-client-architecture.md`](current/architecture/server-client-architecture.md) |
| Qué decisiones son normativas                   | [`decisions/README.md`](decisions/README.md)                                                               |
| Cómo se crean formatos y desafíos               | [`content/README.md`](content/README.md)                                                                   |
| Qué estrategia e hipótesis siguen activas       | [`product/README.md`](product/README.md)                                                                   |
| Qué documentos describen etapas anteriores      | [`archive/README.md`](archive/README.md)                                                                   |

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

- Fecha: 2026-09-21.
- 31 formatos de pregunta, cinco modos, desafíos editoriales y publicaciones mock; las slices persistidas
  actuales incluyen S01–S13, S17a, S18b parcial, D08a/D08b, S05-Alphabet, F01/F02/F03/F04/F06/F07/F12
  y E01–E05/E10 sobre Supabase local.
- La revisión declarativa canónica es `20260921073245_room_membership_commands`; la comprobación de
  esquema cubre 38 archivos declarativos, 29 tablas y 132 funciones públicas/privadas.
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run docs:check` y
  `npm run supabase:schema:test` se deben leer junto con el resultado vigente de `current/qa.md`;
  `npm run type-architecture` completa correctamente.
- `npm run format:check` mantiene avisos en 71 archivos; están registrados en [`current/qa.md`](current/qa.md).
- No hay proyecto remoto de Supabase vinculado desde este entorno.
