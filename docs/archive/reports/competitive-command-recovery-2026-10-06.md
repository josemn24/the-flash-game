# Entrega de recuperación de operaciones competitivas

> Estado: histórico. Referencia conservada el 2026-10-24; sus cifras,
> propuestas y comandos describen el contexto original. No son instrucciones actuales de despliegue.
> Referencia vigente: [competitive-command-recovery.md](../../current/competitive-command-recovery.md).

Verificación local completada el 2026-10-06:

- 1.489 pruebas unitarias en 206 archivos.
- 32 pruebas de navegador en 13 suites: cinco modos, seis formatos, Narrativa interactiva y
  recuperación/abandono. Todas pasan, sin casos omitidos ni resultados inestables.
- 51 suites pgTAP, 158 casos compartidos de conformidad y concurrencia con conexiones PostgreSQL
  independientes. La suite nueva de confirmaciones perdidas verifica 25 condiciones.
- Tipos, lint, arquitectura de tipos/estilos, Stylelint, enlaces documentales, revisión de esquema,
  tipos generados y formato correctos. Las 16 funciones de la migración coinciden con sus
  definiciones finales del esquema declarativo, incluidas las variantes actuales de Queens.

Las fixtures de pruebas respetan los relojes inmutables. La expiración se provoca cerrando una
publicación y simulando falta de actividad; se confirma desde otra conexión después del error HTTP.
El abandono explícito pierde la respuesta real tras el commit y recupera el mismo resultado
con la cookie ya eliminada, sin acreditación ni controlador activo.
