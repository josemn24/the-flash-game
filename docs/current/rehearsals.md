> Estado: banco v1 ampliado para cinco modos. Narrativa queda fuera.

# Pruebas antes del intento competitivo

**Probar primero** genera una partida local con la estructura del desafío competitivo y ejercicios
alternativos del [banco](../../data/rehearsals/README.md). Conserva modo, cantidad y orden de formatos,
puntos, tiempos, vidas, reloj global y progresión. La dificultad es orientativa. Flash, Pirámide,
Supervivencia, Alfabeto y Contrarreloj comparten sus vistas, controladores y proveedores de sesión.
La biblioteca didáctica y las demos permanecen separadas.

## Banco y dificultad

Los archivos `data/rehearsals/bank/*.json` contienen preguntas versionadas con modos admitidos,
dificultad `easy | medium | hard`, tiempo de referencia y los contratos canónicos de contenido y
solución. La letra es explícita para Alfabeto. Las familias permiten evitar variantes muy parecidas.
Las dimensiones y parámetros mecánicos se derivan del contenido.

El banco actual contiene 373 preguntas activas. Las 243 de Alfabeto ofrecen tres familias por
letra y dificultad; la ampliación incorpora 130 ejercicios sin modificar las preguntas ni recetas
históricas. La prueba conserva las letras y su orden oficial, y cada entrada recibe una nueva
semilla. La variedad se aplica entre alternativas de la dificultad solicitada; no hay exclusión
de preguntas vistas en sesiones anteriores.

Elección múltiple dispone de 22 preguntas: nueve fáciles, diez medias y tres difíciles, con
respectivamente tres, diez y tres familias independientes. Se han añadido nueve medias y dos
difíciles. Las estructuras de referencia con hasta ocho elecciones múltiples medias pueden
completarlas con ejercicios distintos sin sustituir esa dificultad; varias semillas también
comprueban que cambia el conjunto elegido y que las recetas siguen siendo reproducibles.

El tiempo de referencia permite validar la pregunta aisladamente: al generar se aplican los tiempos
y pesos de la posición oficial y se comprueba otra vez su validez. Los recursos están versionados
bajo `public/rehearsals/`. Se preparan imágenes y diccionarios antes de iniciar cualquier reloj.

La dificultad oficial pertenece a `question_versions`, fuera del payload y de la puntuación.
Las versiones nuevas usan `medium` por defecto; el relleno de versiones antiguas pertenece al historial retirado.
El editor y la biblioteca muestran Fácil, Media o Difícil. Las referencias heredan la dificultad de
su versión publicada; cambiarla requiere otra versión. Los documentos antiguos sin campo se
normalizan a `medium`.

Para añadir contenido: incorporar una pregunta válida en su archivo de formato, declarar solo modos
comprobados y revisar su dificultad y explicación. Corregir contenido exige otra versión. Se
conservan las anteriores para reproducción. No hay manifiestos ni perfiles que editar: huellas,
revisión e índices son automáticos.

`npm run rehearsals:check` valida el banco y resuelve las preguntas con los proveedores locales reales.
Exige tres candidatos independientes por posición de las estructuras de BetaVIP y Tabarnia,
incluidas sus letras. Otros desafíos pueden funcionar con menos variedad; el portal lo advierte.
La base inicial contiene 232 preguntas activas, todas en versión editorial 1, sin identidades
retiradas ni versiones de desarrollo anteriores. El generador admite exclusivamente el contrato
consolidado v1. Se han regenerado las huellas y recetas de referencia; las recetas anteriores a
esta consolidación no son compatibles, incluidas las de la antigua v1. El historial previo queda
conservado en Git. Este corte no cambia Supabase ni los `payloadSchemaVersion` requeridos por formato.

Desde esta base, las correcciones y retiradas añaden versiones. La última versión de cada ID
determina su `generationStatus` (`active` por defecto o `retired`); una retirada no permite rescatar
una anterior para nuevas partidas. Las versiones editoriales publicadas desde la base se conservan
para reproducir recetas de este generador mientras sus referencias y huellas sigan disponibles.
Las variantes de una familia no cuentan como alternativas independientes para el mínimo editorial.
El chequeo exige una familia por formato/modo/dificultad y tres por letra/dificultad para las 27 letras
españolas de Alfabeto, incluida Ñ. Deriva formatos y modos del registro de capacidades.

Las correcciones sustituyen las explicaciones de plantilla por cálculos, relaciones o pasos
verificables. La [rúbrica editorial](../content/guidelines/rehearsal-bank.md) define criterios por
formato. CI detecta explicaciones vacías y las plantillas conocidas; la justificación semántica y la
calibración siguen requiriendo revisión editorial. El informe `output/rehearsal-coverage.json` separa
versiones históricas, identidades activas/retiradas, familias, calidad, combinaciones y sustituciones.

## Generación y cobertura

La disponibilidad se consulta sin consumir azar. El generador usa exactamente las mismas reglas de
candidatos: formato, modo, contrato soportado, letra y validación con tiempos y pesos oficiales.
Una asignación bipartita de coste mínimo comprueba toda la partida y prohíbe repetir ejercicio,
incluso bajo IDs diferentes. La huella del ejercicio usa formato, contenido público y solución con
JSON canónico y texto NFC; excluye explicación y metadatos editoriales. La huella completa de versión
usada por las recetas cubre todos sus campos, sin normalización adicional.

La selección minimiza la suma de distancias entre dificultad solicitada y elegida (fácil 0, media 1,
difícil 2), y en empate favorece la inferior. Solo considera elecciones que permitan completar una
asignación óptima de las posiciones restantes: no consume la única pregunta válida de otra posición.
Entre alternativas equivalentes favorece familias nuevas; elige primero familia, con peso igual a
la media de semejanzas de sus miembros, y después pregunta. Añadir variantes no multiplica el peso
de la familia. La selección es determinista para banco, plantilla y semilla; no mantiene historial
entre partidas. La semejanza solo usa propiedades mecánicas públicas, nunca enunciados o soluciones.

Los parámetros internos se conservan; la sopa de letras rellena los marcadores X fuera de las
palabras con letras españolas deterministas para la semilla. `coverage.ready` exige una asignación completa sin contenido repetido;
candidatos en cada posición por separado no bastan. `exactDifficultyReady` indica si puede respetar
todas las dificultades. La escasez de variedad y las sustituciones generan avisos editoriales; el
preview lista las posiciones con dificultad solicitada y elegida en `difficultyFallbacks`. Si no
queda una asignación distinta compatible, no se ofrece la prueba. Un fallo de prueba no bloquea
la competición.

Cada selección produce una receta con sesión, semilla, versión del generador, revisión del banco,
huella de estructura y referencias exactas de preguntas. Su identidad incluye explícitamente la
versión del generador; la reproducción aplica siempre las mismas reglas de unicidad y relleno.
Un render o reintento de recursos conserva
receta y proveedor. Una nueva entrada o recarga genera otra partida. La receta disponible como
metadato de diagnóstico contiene referencias alternativas, sin respuestas oficiales ni el banco.

## Autorización y administración

`/desafios/[challengeId]/prueba?roomId=[slug]` vuelve a autorizar sin iniciar ni recuperar intentos
oficiales. Requiere miembro activo con permiso para jugar, sala activa, publicación futura o abierta
y ausencia de cualquier intento competitivo previo. Espectadores, publicaciones cerradas o canceladas
e intentos existentes, incluidos terminales, reciben 404. Una prueba cargada puede terminar aunque
posteriormente cierre la publicación o comience el intento oficial en otra pestaña.

La ausencia de política significa habilitada. Un superadmin puede habilitar o deshabilitar cada
publicación desde el detalle administrativo; el comando exige motivo, idempotencia y control de
concurrencia y queda auditado. El portal muestra cobertura, dificultad y avisos por versión, y
permite generar previews, introducir semillas y reproducir recetas exactas. Una referencia ausente,
una huella cambiada o una estructura incompatible impiden la reproducción con un error explícito.
La publicación competitiva no queda bloqueada por una cobertura incompleta.

La [migración inicial](../../supabase/migrations/20261103090247_initial_schema.sql) crea directamente el modelo
de ensayos dinámicos, sin asociaciones rígidas ni sus comandos o triggers retirados. Las migraciones
anteriores se conservan en Git. Las lecturas solo proyectan estructura autorizada y no leen soluciones oficiales.
El banco se comparte en memoria; autorización y sesiones nunca se cachean globalmente.

## Experiencia y comprobación

Se mantienen cuenta atrás y presentaciones de nivel. Resultados muestra **Puntos de prueba** y el
aviso de que no consume el intento ni cuenta para ranking. **Volver al desafío** es principal y
**Ver respuestas** secundaria. No hay repetición directa desde resultados o revisión: otra entrada
vuelve a autorizar. Recargar pierde el progreso; no se persisten respuestas ni puntuación de práctica.
Los fallos de preparación ofrecen reintento; una prueba desactivada o sin cobertura ofrece retorno.

Comprobar con `npm run rehearsals:check`, `npm test`, `npm run typecheck`,
`npm run type-architecture`, `npm run schema:revision:check` y `npm run docs:check`.
Las suites SQL se ejecutan desde esquema y migraciones con `npm run supabase:schema:test` y
`npm run supabase:schema:test -- --migrations`. La equivalencia estructural se verifica con
`npm run supabase:schema:equivalence:test`. `npm run test:e2e:rehearsals` usa un stack aislado.
El despliegue de aplicación y esquema es coordinado; las comprobaciones locales no aplican cambios
a la base habitual ni a entornos remotos.
Para adoptar la nueva inicial en un entorno existente, seguir la reinstalación o reconciliación
documentada en la [guía de entornos](supabase-clean-installation.md#adoptar-el-historial-consolidado).
Los cambios posteriores requieren verificar sus migraciones incrementales antes del despliegue.
