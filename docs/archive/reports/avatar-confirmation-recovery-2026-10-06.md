# Entrega de confirmación y limpieza segura de avatares

> Estado: histórico. Referencia conservada el 2026-10-24; sus cifras,
> propuestas y comandos describen el contexto original. No son instrucciones actuales de despliegue.
> Referencia vigente: [avatar-confirmation-recovery.md](../../current/avatar-confirmation-recovery.md).

Comprobado localmente el 2026-10-06:

- Vitest: 207 archivos, 1513 pruebas, con `--no-file-parallelism`. La ejecución paralela
  mostró interferencia entre el guard de estructura y una prueba de arquitectura que crea
  temporalmente un archivo en `components/`; la ejecución serial completa pasa.
- SQL: inventario de seguridad, suites pgTAP, 158 casos compartidos de formatos y
  concurrencia con conexiones independientes pasan, incluidas las carreras de avatar.
- Navegador: 5 E2E de portal/avatar pasan; los 2 casos de pérdida de confirmación se
  repitieron después del último ajuste de UI y pasan contra DB y Storage reales.
- Compatibilidad de migración: perfiles, archivos y comandos creados con las funciones
  anteriores quedan intactos y sus confirmaciones siguen recuperándose.
- Typecheck, lint, arquitectura de tipos, formato, documentación, revisión de esquema y
  tipos públicos generados de Supabase pasan.
- Migración aplicada en PostgreSQL local. El despliegue y la inyección de fallos en staging
  siguen pendientes antes de publicar.

La cobertura incluye cortes después del commit, fallos de lectura/caché/limpieza, conflictos
de identidad y clave, cancelación frente a confirmación en ambos órdenes, sustituciones
simultáneas y diez confirmaciones concurrentes. Los E2E ejecutan la petición real y descartan
su respuesta después del commit; verifican la referencia en PostgreSQL, los bytes en Storage,
el reintento sin nueva subida y la recarga.
