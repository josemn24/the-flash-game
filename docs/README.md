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

- Fecha: 2026-09-25.
- 31 formatos de pregunta, cinco modos, desafíos editoriales y publicaciones mock; las slices persistidas
  actuales incluyen S01–S15, S17a, S18b parcial, D08a/D08b, S05-Alphabet, F01/F02/F03/F04/F06/F07/F08/F12/F16/F18/F19, los siete formatos competitivos S15
  y E01–E06/E10 sobre Supabase local.
- La revisión declarativa canónica es `20260924120000_s18_superadmin_user_commands`; la comprobación de
  esquema cubre 47 archivos declarativos, además de tablas, funciones públicas/privadas y políticas RLS.
- `npm run typecheck`, `npm run docs:check` y `npm run schema:revision:check` pasan en la comprobación
  actual. `npm test` tiene un fallo unitario pendiente y `npm run lint` conserva dos warnings; el
  detalle vigente está en [`current/qa.md`](current/qa.md).
- `npm run format:check` mantiene avisos en 151 archivos en la comprobación actual.
- `npm run supabase:schema:test` no se pudo repetir en esta sesión porque Docker no está accesible;
  la última validación local registrada y sus límites están documentados en [`supabase/schemas/README.md`](../supabase/schemas/README.md).
- No hay proyecto remoto de Supabase vinculado desde este entorno.
