> Estado: vigente. Ensayos locales asociados a versiones competitivas; Narrativa queda fuera.

# Pruebas antes del intento competitivo

La introducción de un desafío con ensayo ofrece **Probar primero**, con un icono de matraz. Se mantienen modo,
orden de formatos, reglas, tiempos y puntos con contenido alternativo. El ensayo comparte los
controladores, vistas y `GameSessionProvider` de Flash, Pirámide, Supervivencia, Alfabeto y
Contrarreloj, incluidos Queens y Conectar parejas. La biblioteca didáctica de formatos y las
antiguas demos siguen separadas.

El contenido reside en [`data/rehearsals/`](../../data/rehearsals/). PostgreSQL conserva únicamente
la asociación privada de `ChallengeVersion` con `{id, version, contentHash}`, la huella del
contenido competitivo y sus metadatos de auditoría. La sesión, respuestas y puntuación de la
prueba permanecen en memoria; no se crean intentos, respuestas, entradas de puntos ni historial.

## Catálogo y preparación editorial

[`catalog.v1.json`](../../data/rehearsals/catalog.v1.json) contiene preguntas con identidad y versión,
y ensayos que referencian versiones concretas. El catálogo inicial tiene siete artefactos: las seis
estructuras del setup BetaVIP (ambas Pirámides y ambas variantes de Contrarreloj) y el Flash de
referencia de Tabarnia. No se importan preguntas competitivas para construir el banco.
Los SVG propios viven en `public/rehearsals/v1/`; Mini-Wordle usa los diccionarios públicos existentes.

Para añadir o corregir contenido:

1. Crear otra versión de la pregunta y del ensayo, conservando los artefactos publicados.
2. Usar los contratos canónicos de payload y solución. Cada item declara formato, versión,
   tiempo, puntos y configuración del modo.
3. Revisar las diferencias estructurales con el desafío seleccionado. El registro exhaustivo
   [`structure-core.mjs`](../../lib/rehearsals/structure-core.mjs) compara las mecánicas de los 21
   formatos competitivos. El portal informa de incompatibilidades y permite jugar una preview.
4. Revisar editorialmente dificultad, claridad y similitudes con las preguntas oficiales.
   El validador estructural no determina dificultad ni equivalencia semántica.
5. Registrar la nueva huella en [`manifest.v1.json`](../../data/rehearsals/manifest.v1.json),
   añadir el perfil mecánico a `profiles.v1.json` y ejecutar `npm run rehearsals:check` y las
   pruebas del catálogo. Estas pruebas resuelven todos los ensayos con los proveedores reales.
6. Desplegar el catálogo antes de asociarlo desde el portal. Conservar las versiones antiguas
   mientras alguna versión competitiva las referencie.

El identificador no es una ruta ni depende de un entorno. El hash SHA-256 cubre el ensayo y
sus versiones de preguntas; cambiar un artefacto existente sin actualizar su referencia se
rechaza. Las rutas de recursos deben estar versionadas y no sobrescribirse con otro contenido.

## Asociación desde el portal

En el detalle de un desafío, **Pruebas sin competir** muestra cada versión, los artefactos
compatibles y sus previews. Un superadmin puede asociar o retirar un ensayo de un borrador,
indicando el motivo. La edición de contenido ocurre en el repositorio.

La acción verifica la identidad en el servidor, resuelve el artefacto desplegado y ejecuta el
comando privado transaccional con idempotencia, `expectedUpdatedAt` y huella del contenido.
No se admiten referencias arbitrarias del navegador. Cambiar el borrador invalida la asociación.
Publicar congela una asociación existente; publicar sin ensayo sigue permitido.
Una versión ya publicada sin ensayo admite una primera asociación expresa y auditada.
Una asociación publicada no se reemplaza ni se retira: la corrección exige nuevas versiones.

La migración [`20261020140000_challenge_rehearsals.sql`](../../supabase/migrations/20261020140000_challenge_rehearsals.sql)
crea la tabla privada, RLS, comandos, permisos y triggers. La clave primaria garantiza una
asociación por versión. Los setups locales de BetaVIP y Tabarnia asocian sus ensayos
explícitamente con el mismo validador; la migración general no modifica publicaciones existentes.

## Acceso y ciclo de ejecución

`/desafios/[challengeId]/prueba?roomId=[slug]` autoriza la lectura sin iniciar ni recuperar
intentos oficiales. El ensayo se ofrece a miembros activos que pueden jugar, con sala activa,
publicación futura o abierta, referencia válida y ningún intento competitivo previo.
Espectadores, usuarios sin permiso, publicaciones cerradas o canceladas e intentos existentes
(incluidos terminales) no pueden abrirlo mediante la interfaz ni mediante una URL directa.

La introducción oficial solo recibe un enlace con precarga desactivada. La definición privada
del ensayo se entrega después de autorizar su ruta. Una referencia ausente o incompatible
suprime la opción sin bloquear la competición. Los fallos temporales de carga ofrecen reintento
y retorno; el servidor registra fallos de resolución sin respuestas ni puntuaciones de prueba.

Los recursos y diccionarios se preparan antes de crear el proveedor y de iniciar cualquier reloj.
Se muestran carga, error y reintento, y se ignoran respuestas de carga posteriores al desmontaje
o al cambio de artefacto. Un render ordinario conserva la autoridad local; otra referencia,
recarga o nueva apertura crea una sesión nueva. Volver a entrar desde **Probar primero** vuelve
a autorizar el acceso y utiliza el mismo contenido; no existe selección aleatoria.

Al pulsar **Probar primero**, se preparan los recursos y comienza el flujo de juego compartido,
sin repetir la ficha del desafío ni requerir otro botón de inicio. Se conservan la cuenta atrás
y las presentaciones de nivel propias de cada modo. Los resultados indican
**Puntos de prueba** y avisan de que la partida ha sido de prueba, no consume el intento competitivo
ni cuenta para el ranking. **Volver al desafío** es la acción principal y **Ver respuestas** la
secundaria; no se ofrece repetición en los resultados ni en la revisión. Volver desmonta la sesión
y obtiene una lectura actualizada del desafío; nunca comienza automáticamente la partida oficial.
Una prueba ya cargada puede terminar aunque cierre la publicación o se inicie el intento oficial
en otra pestaña. Abrir otra exige una autorización nueva.

Recargar pierde el progreso. No hay persistencia entre dispositivos ni garantía de funcionamiento
sin conexión. Las ventanas de publicación autorizan la entrada y no actúan como deadline local.

## Comprobación y despliegue

- Catálogo: `npm run rehearsals:check` y
  `npx vitest run infrastructure/rehearsals/catalog.test.ts`.
- Casos de uso y preparación: `npx vitest run application/use-cases/rehearsals.test.ts components/game/shells/RehearsalGameApp.test.tsx`.
- SQL: `npm run supabase:schema:test`, historial con
  `node scripts/check-supabase-schema.mjs --migrations`, y actualización con
  `node scripts/test-rehearsals-upgrade.mjs`. Admiten `SUPABASE_DB_CONTAINER` para una base desechable.
- Navegador: `npm run test:e2e:rehearsals` crea y elimina un stack aislado, preservando los
  fixtures y la base local habitual. Cubre las siete entradas, partidas, revisión, retorno al desafío,
  recarga, salida, errores de recursos y denegación tras comenzar el intento oficial.

Desplegar primero el esquema compatible, después la aplicación con el catálogo y finalmente
activar asociaciones desde el portal. Verificar las referencias seleccionadas mediante preview
antes de habilitarlas. La actualización del esquema conserva intentos activos, respuestas,
resultados y ledger, y permite mantener publicaciones sin ensayo.
