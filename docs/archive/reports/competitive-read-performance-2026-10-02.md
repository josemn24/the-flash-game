# Medición local de lecturas competitivas

> Estado: histórico. Referencia conservada el 2026-10-24; sus cifras,
> propuestas y comandos describen el contexto original. No son instrucciones actuales de despliegue.
> Referencia vigente: [competitive-read-performance.md](../../current/competitive-read-performance.md).

### Resultado del 2 de octubre de 2026

Las dos ejecuciones estables aprobaron los mismos 14 E2E. La ejecución final añadió paridad
PostgREST para los cinco modos y recuperación. Pasan también 1044 unitarias, las 29 comprobaciones
SQL nuevas y el resto de la suite SQL/concurrencia, tipos, lint, arquitectura, revisión de esquema,
tipos generados, documentación, formato y build. El stack temporal se eliminó al terminar.

Lectura del desafío (`challenge.read`, duración total en ms, incluido enriquecimiento cuando
corresponde). Las muestras indicadas corresponden a cada ejecución:

| Modo          | Muestras | RPC iniciales antes → después | p50 antes | p50 después | p95 antes | p95 después |
| ------------- | -------- | ----------------------------- | --------- | ----------- | --------- | ----------- |
| Flash         | 8        | 1 → 1                         | 15.91     | 20.28       | 53.39     | 49.42       |
| Alfabeto      | 7        | 2 → 1                         | 39.98     | 29.83       | 91.95     | 44.48       |
| Supervivencia | 3        | 3 → 1                         | 57.04     | 25.80       | 65.33     | 44.50       |
| Pirámide      | 7        | 4 → 1                         | 70.59     | 28.87       | 153.33    | 106.82      |
| Narrativa     | 4        | 5 → 1                         | 90.53     | 13.15       | 164.55    | 53.52       |

Prelectura de una respuesta genérica (`attempt.submitAnswer`, fase `attempt.context`, ms):

| Modo          | Muestras | p50 antes | p50 después | p95 antes | p95 después |
| ------------- | -------- | --------- | ----------- | --------- | ----------- |
| Flash         | 8        | 6.14      | 3.47        | 28.46     | 27.01       |
| Alfabeto      | 9        | 7.15      | 5.13        | 29.08     | 24.79       |
| Supervivencia | 1        | 5.54      | 5.96        | 5.54      | 5.96        |
| Pirámide      | 8        | 3.91      | 3.57        | 15.65     | 7.47        |
| Narrativa     | 4        | 8.20      | 6.43        | 46.48     | 22.93       |

Los contadores confirman cuatro transacciones por respuesta genérica en ambos recorridos. Las
unitarias verifican exactamente un RPC inicial y un constructor por modo; las operaciones indicadas
ya no leen el snapshot de recuperación.

La latencia total observada baja en Alfabeto, Supervivencia, Pirámide y Narrativa. En Flash el p50
sube, aunque el p95 baja; la única muestra de contexto de Supervivencia tampoco mejora. Estos
resultados describen esta ejecución local, sin atribuir causalidad ni garantizar una mejora
universal. La aceptación se basa en los cambios estructurales, sin un porcentaje mínimo.

Los logs y resúmenes completos están en `output/performance/before.log`, `before-summary.json`,
`after-stable.log` y `after-stable-summary.json`. El resumidor conserva el desglose por todas las
operaciones y fases. En la referencia, `challenge.initial` suma los tiempos RPC de los lectores
probados; en el refactor también incluye la preparación del cliente de la única lectura. La tabla
anterior usa el total por operación, cuya frontera de medición es la misma.
