> Estado: vigente. Índice de la realidad implementada y sus contratos técnicos.

# Estado actual

Esta sección describe la aplicación y los contratos técnicos vigentes. Es la primera referencia para
entender qué existe en el repositorio hoy.

En la rama actual, S01–S06 están implementadas y verificadas contra el stack local de Supabase. El
resto de capacidades se mantiene explícitamente en mock o pendiente de su propia vertical slice.

- [`status.md`](status.md): fotografía breve del producto y de sus limitaciones.
- [`domain/README.md`](domain/README.md): modelo de dominio, tipos, fixtures y consultas.
- [`use-cases.md`](use-cases.md): casos de uso funcionales, prioridades, permisos y límites.
- [`architecture.md`](architecture.md): fronteras, dependencias y evolución hacia producción.
- [`data-model.md`](data-model.md): propuesta relacional, integridad, transacciones y mapeo desde
  el dominio.
- [`architecture/server-client-architecture.md`](architecture/server-client-architecture.md): límites
  entre servidor y cliente.
- [`qa.md`](qa.md): estado vigente de las comprobaciones automatizadas y sus limitaciones.
- [`glosario.md`](glosario.md): vocabulario del producto.

Las decisiones normativas están en [`../decisions/README.md`](../decisions/README.md), no duplicadas
en esta sección.
