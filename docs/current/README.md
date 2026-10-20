> Estado: vigente. Índice de la realidad implementada y sus contratos técnicos.

# Estado actual

Esta sección describe la aplicación y los contratos técnicos vigentes. Es la primera referencia para
entender qué existe en el repositorio hoy.

En la rama actual, S01–S14, S17a, S18b parcial, D08a, D08b, S05-Alphabet, F01/F02/F03/F04/F06/F07/F08/F12/F16/F18/F19,
E01–E06 y E10 están implementadas y verificadas contra el stack local de Supabase. El resto de capacidades se mantiene explícitamente en mock o pendiente de su propia vertical slice.
La beta cerrada se provisionará y operará desde un portal privado de superadmin: la UI pública no
crea salas ni gestiona invitaciones. El portal privado también prepara y activa temporadas, publica
contenido Flash/Supervivencia y programa su calendario local.

La unificación de Pirámide está completada desde el 2026-10-19: competición y ensayo local
comparten controlador y vista. La [matriz de cierre de la fase 6](qa.md#cierre-de-la-fase-6--2026-10-19)
recoge el cumplimiento de los criterios y las verificaciones de la entrega.

- [`status.md`](status.md): fotografía breve del producto y de sus limitaciones.
- [`domain/README.md`](domain/README.md): modelo de dominio, tipos, fixtures y consultas.
- [`use-cases.md`](use-cases.md): casos de uso funcionales, prioridades, permisos y límites.
- [`architecture.md`](architecture.md): fronteras, dependencias y evolución del recorrido persistido.
- [`data-model.md`](data-model.md): propuesta relacional, integridad, transacciones y mapeo desde
  el dominio.
- [`architecture/server-client-architecture.md`](architecture/server-client-architecture.md): límites
  entre servidor y cliente.
- [`design-tokens.md`](design-tokens.md): roles de color, estados, contrastes y equivalencias de migración.
- [`design-system.md`](design-system.md): catálogo de desarrollo, componentes reales, demos y mantenimiento.
- [`qa.md`](qa.md): estado vigente de las comprobaciones automatizadas y sus limitaciones.
- [`supabase-clean-installation.md`](supabase-clean-installation.md): guía principal por tareas para
  preparar local y staging, con datasets, bootstrap, reinicio completo y registros de ejecución.
- [`local-device-testing.md`](local-device-testing.md): pruebas desde un móvil u otro equipo de la
  red local, configuración de Supabase y resolución de problemas.
- [`competitive-read-performance.md`](competitive-read-performance.md): contratos de lectura,
  diagnóstico opcional y comparación local del camino competitivo.
- [`competitive-format-contracts.md`](competitive-format-contracts.md): representaciones,
  validación y registros por capa de los formatos competitivos.
- [`pyramid-session-contract.md`](pyramid-session-contract.md): contrato funcional de Pirámide,
  matriz de referencia y frontera compartida entre proveedores local y remoto.
- [`game-session-providers.md`](game-session-providers.md): contrato de sesión, composición
  de proveedores y regresiones de los seis modos; incluye el cierre de la fase 6 de Pirámide.
- [`rehearsals.md`](rehearsals.md): catálogo versionado, asociación editorial y pruebas locales antes de competir.
- [`local-pyramid-session.md`](local-pyramid-session.md): autoridad local en memoria,
  entrada canónica, reglas compartidas, ciclo de ejecución y conformidad HTTP con el remoto.
- [`avatar-confirmation-recovery.md`](avatar-confirmation-recovery.md): confirmación recuperable,
  autorización transaccional de limpieza y validación de avatares.
- [`glosario.md`](glosario.md): vocabulario del producto.

Las decisiones normativas están en [`../decisions/README.md`](../decisions/README.md), no duplicadas
en esta sección.
