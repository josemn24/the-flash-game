# Documentación de The Flash

Este es el punto de entrada de la documentación del proyecto. La aplicación combina recorridos
mock/práctica con slices reales sobre Supabase local; la documentación de producto futuro y las
capacidades aún pendientes no deben interpretarse como funcionalidades ya disponibles.

## Dónde buscar

| Necesito saber...                               | Consulta                                                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Qué ha cambiado en cada versión                 | [`CHANGELOG.md`](../CHANGELOG.md)                                                                          |
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
| Cómo utilizar los colores y estados de la UI    | [`current/design-tokens.md`](current/design-tokens.md)                                                     |
| Cómo consultar y ampliar el design system       | [`current/design-system.md`](current/design-system.md)                                                     |
| Cómo probar desde un móvil u otro equipo        | [`current/local-device-testing.md`](current/local-device-testing.md)                                       |
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

- Revisión funcional general: 2026-09-30; actualización de Supabase local: 2026-10-11.
- 31 formatos de pregunta, cinco modos, desafíos editoriales y publicaciones mock; las slices persistidas
  actuales incluyen S01–S15, S17a, S18b parcial, D08a/D08b, S05-Alphabet, F01/F02/F03/F04/F06/F07/F08/F12/F16/F18/F19, los siete formatos competitivos S15
  y E01–E06/E10 sobre Supabase local.
- La revisión activa es `20261010214230_initial_schema`, un baseline generado desde 80 archivos
  declarativos de esquema, además de 31 tablas, una vista,
  funciones públicas/privadas y políticas RLS.
- El baseline local pasó `supabase:schema:test`, la validación por migraciones, reconciliación,
  `schema:revision:check`, `supabase:types:check`, `docs:check` y `verify:pilot`; el detalle y el
  estado limpio posterior al reset están en [`current/qa.md`](current/qa.md).
- La validación del baseline se limitó a Supabase local. No se ejecutaron operaciones remotas.
