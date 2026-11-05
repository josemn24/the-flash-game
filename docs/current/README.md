> Estado: vigente. Índice de la realidad implementada y sus contratos técnicos.

# Estado actual

Esta sección describe la aplicación y los contratos técnicos vigentes. Es la primera referencia para
entender qué existe en el repositorio hoy.

Las capacidades por modo, las limitaciones y la revisión canónica están centralizadas en
[status.md](status.md). Las verificaciones locales se consultan desde [QA](qa.md); no acreditan
por sí mismas el estado de staging. Los resultados de entregas cerradas están en el
[archivo de informes](../archive/reports/README.md).

- [`status.md`](status.md): fotografía breve del producto y de sus limitaciones.
- [`product-measurement.md`](product-measurement.md): fuentes, definiciones y límites de la medición
  automática por temporada; distingue las métricas comunes del análisis de cada estudio.
- [`domain/README.md`](domain/README.md): modelo de dominio, tipos, fixtures y consultas.
- [`use-cases.md`](use-cases.md): casos de uso funcionales, prioridades, permisos y límites.
- [`architecture.md`](architecture.md): fronteras, dependencias y evolución del recorrido persistido.
- [`data-model.md`](data-model.md): modelo relacional vigente, integridad, transacciones y mapeo desde
  el dominio.
- [`architecture/server-client-architecture.md`](architecture/server-client-architecture.md): límites
  entre servidor y cliente.
- [`design-tokens.md`](design-tokens.md): roles de color, estados, contrastes y equivalencias de migración.
- [`design-system.md`](design-system.md): catálogo de desarrollo, componentes reales, demos y mantenimiento.
- [`qa.md`](qa.md): estado vigente de las comprobaciones automatizadas y sus limitaciones.
- [`supabase-clean-installation.md`](supabase-clean-installation.md): guía principal por tareas para
  preparar local y staging, con datasets, bootstrap y reinicio completo; enlaza los registros de ejecución.
- [`local-device-testing.md`](local-device-testing.md): pruebas desde un móvil u otro equipo de la
  red local, configuración de Supabase y resolución de problemas.
- [`competitive-read-performance.md`](competitive-read-performance.md): contratos de lectura,
  diagnóstico opcional y comparación local del camino competitivo.
- [`competitive-format-contracts.md`](competitive-format-contracts.md): representaciones,
  validación y registros por capa de los formatos competitivos.
- [`pyramid-session-contract.md`](pyramid-session-contract.md): contrato funcional de Pirámide,
  matriz de referencia y frontera compartida entre proveedores local y remoto.
- [`game-session-providers.md`](game-session-providers.md): contrato de sesión, composición
  de proveedores y regresiones de los seis modos; enlaza la evidencia histórica de la unificación.
- [`rehearsals.md`](rehearsals.md): banco de preguntas, generación dinámica, cobertura y pruebas locales antes de competir.
- [`local-pyramid-session.md`](local-pyramid-session.md): autoridad local en memoria,
  entrada canónica, reglas compartidas, ciclo de ejecución y conformidad HTTP con el remoto.
- [`avatar-confirmation-recovery.md`](avatar-confirmation-recovery.md): confirmación recuperable,
  autorización transaccional de limpieza y validación de avatares.
- [Práctica por formato](practice-format-contracts.md), [ciclo de vida](attempt-lifecycle.md) y
  [recuperación](competitive-command-recovery.md): contratos transversales. La
  [matriz de resiliencia](resilience-matrix.md) es una propuesta de riesgos y plan de QA.
- [Operación](s22-operacion.md), [comandos SQL](sql-attempt-command-handlers-refactor.md),
  [biblioteca editorial](sql-question-library-refactor.md) y [validación SQL](sql-question-validation-refactor.md):
  referencias específicas.
- [`glosario.md`](glosario.md): vocabulario del producto.

Las decisiones normativas están en [`../decisions/README.md`](../decisions/README.md), no duplicadas
en esta sección.
