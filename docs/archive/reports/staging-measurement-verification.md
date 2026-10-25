> Estado: archivado. Evidencia de la implementación experimental retirada; no acredita el modelo vigente ni su despliegue.

# Verificación de experimentos en staging

Fecha: 2026-10-24. Aplicación: [staging](https://the-flash-game.vercel.app).
Proyecto Supabase: `bebmthwwyiyobaiertsm`.
Revisión: `20261024160000_configurable_experiments`.
Versión desplegada: `staging-20261024-e825c146e424`.

## Actualización y preservación

Se aplicaron las 16 migraciones pendientes desde la instalación anterior de octubre 11,
incluidas las tres de medición. El historial remoto contiene ahora 17 migraciones.
No se ejecutó un reset ni el bootstrap de staging. Se desplegó la aplicación compatible
con la nueva revisión, manteniendo sus secretos operativos existentes.

Antes de migrar se registraron recuentos y hashes de las 33 relaciones de aplicación
existentes, incluidas dos vistas. Tras migrar y retirar las pruebas sintéticas, coinciden
los recuentos y los hashes de sus columnas originales. La columna nueva
`private.question_versions.difficulty` recibe el valor predeterminado de la migración.

Se conservan los siete jugadores, la sala BetaVIP, su temporada, sus cinco publicaciones,
los 16 intentos, las 159 respuestas y recepciones, las 16 sesiones y entradas de puntos,
los 596 comandos, las 607 entradas de auditoría y las 11.207 palabras del diccionario.
Las protecciones de historial e integridad quedan habilitadas.

## Comprobación en la aplicación desplegada

Se crearon dos salas y 14 cuentas sintéticas sin enviar correos. Los experimentos
se configuraron y congelaron mediante el contrato administrativo autenticado;
las partidas, valoraciones y correcciones del registro se probaron en el navegador.

| Ejecución sintética           | Cohorte × publicaciones | Métrica principal | Valoración guardada |
| ----------------------------- | ----------------------- | ----------------- | ------------------- |
| Plantilla `tabarnia-daily-v2` | 14 × 9                  | Recurrencia       | 5, escala 1–5       |
| Independiente A               | 2 × 2                   | Activación        | 4, escala 1–5       |
| Independiente B               | 3 × 3                   | Finalización      | 7, escala 1–7       |

Resultados comprobados:

- Las tres definiciones congeladas conservan una huella válida y llegan al estado `running`.
- Se completan dos partidas Flash reales: una en la sala de Tabarnia y otra en la sala
  compartida por A y B. El portal calcula activación 1/2 para A y finalización 1/9 para B.
  Tabarnia mantiene su denominador de 14 personas y su regla de recurrencia.
- Una misma visita y partida se atribuyen a ambos experimentos independientes. Sus
  instrumentos de valoración muestran las escalas respectivas y guardan valores separados.
- Los CSV de participación contienen 126, cuatro y nueve oportunidades, respectivamente.
  Participación, eventos, valoraciones y manifiesto responden con HTTP 200,
  `Cache-Control: no-store` e identificadores exclusivos de la ejecución solicitada.
- Los eventos identifican la versión desplegada. El participante recibe HTTP 403
  al intentar descargar identidades privadas.
- Guardar una observación y corregirla actualiza inmediatamente el portal de revisión
  7 a 8 y a 9. La entrada pasa a revisión dos y la auditoría privada conserva el texto anterior.
- Health devuelve HTTP 200, `status: ok` y comprobaciones positivas de Auth, base y esquema.
  El acceso del superadmin y los RPC del portal funcionan tras la limpieza.

Se retiraron los tres experimentos, las dos salas y temporadas, sus publicaciones y contenido,
las dos partidas y todos sus datos asociados, y las 14 cuentas sintéticas de PostgreSQL y Auth.
Las ocho tablas de medición quedan vacías, igual que antes de las pruebas. La limpieza se limitó
a los identificadores del manifiesto de esta ejecución, dentro de una transacción con claves
foráneas activas; las protecciones que impedían borrar el historial sintético se restauraron
antes de confirmar. La comprobación final no encuentra triggers deshabilitados.

## Incidencia del ensayo y copia disponible

La comprobación prevista como reversible encontró tres migraciones históricas con su propio
`COMMIT`. Esos límites de transacción hicieron que las migraciones pendientes quedaran aplicadas
durante el ensayo. La copia se generó después: **esta operación no produjo una copia previa
a la migración**. La preservación de los datos originales se acredita con los hashes registrados
antes y contrastados después, también tras retirar las pruebas.

La copia posterior, anterior a los datos sintéticos, está en el directorio local privado
`output/staging/measurement-upgrade/`, junto con los informes de migración, comprobación
y limpieza. El dump tiene 1.545.293 bytes y SHA-256
`3878c11a458af631ae69563ae10c7e957f143500086409b6513e1d28fdc0689b`.
No se ha ensayado su restauración. El ejecutor temporal se corrigió para retirar los límites
de transacción internos cuando controla la transacción exterior. `.vercelignore` excluye
credenciales, informes privados, copias y artefactos locales del despliegue.

## Alcance pendiente

La sala existente de staging era BetaVIP; no había una sala real de Tabarnia. Esta prueba
verifica su plantilla mediante datos sintéticos y no abre la alpha ni acredita nueve días
de recurrencia, disfrute o comportamiento de beta testers. Siguen pendientes sus contenidos,
lista nominal, calendario absoluto y control operativo de apertura. La ejecución automática
de cron y la validación en varios dispositivos requieren evidencia propia.

La [guía de medición](../../current/product-measurement.md) describe el módulo; el
[informe local anterior](tabarnia-measurement-verification.md) conserva las pruebas de contratos,
snapshots, conservación y mantenimiento realizadas en bases desechables.
