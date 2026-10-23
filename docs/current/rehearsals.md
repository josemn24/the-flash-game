> Estado: generación dinámica para cinco modos. Narrativa queda fuera.

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

El tiempo de referencia permite validar la pregunta aisladamente: al generar se aplican los tiempos
y pesos de la posición oficial y se comprueba otra vez su validez. Los recursos están versionados
bajo `public/rehearsals/`. Se preparan imágenes y diccionarios antes de iniciar cualquier reloj.

La dificultad oficial pertenece a `question_versions`, fuera del payload y de la puntuación.
La migración asigna `medium` a las versiones existentes sin modificar contenido ni resultados.
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
El banco inicial contiene 143 preguntas, incluidas las 78 originales con contenido e identidades
conservados. Las variantes equivalentes comparten familia y no cuentan como alternativas
independientes para este mínimo. El informe se escribe en `output/rehearsal-coverage.json`.

## Generación y cobertura

La disponibilidad se consulta sin consumir azar. El generador usa exactamente las mismas reglas de
candidatos: formato, modo, contrato soportado, letra y validación con tiempos y pesos oficiales.
Los candidatos se eligen sin repetir identidad mientras queden alternativas. Después se prioriza
la dificultad oficial o la más próxima (inferior en empate), las familias no utilizadas y una
selección aleatoria ponderada por semejanza mecánica. Todo candidato del grupo final conserva una
probabilidad positiva. La semejanza solo utiliza propiedades públicas; nunca enunciados o soluciones.

Los parámetros internos de cada ejercicio se conservan. No se reescriben tableros ni soluciones para
encajar. Cero candidatos en cualquier posición impide ofrecer la prueba; pocas alternativas,
repeticiones o diferencias de dificultad producen avisos editoriales. Un fallo de prueba no bloquea
la competición.

Cada selección produce una receta con sesión, semilla, versión del generador, revisión del banco,
huella de estructura y referencias exactas de preguntas. Un render o reintento de recursos conserva
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

La migración [dinámica](../../supabase/migrations/20261020210000_dynamic_rehearsals.sql) retira las
asociaciones rígidas, sus comandos y triggers. Conserva migraciones históricas, auditoría e historial
de comandos. Las lecturas nuevas solo proyectan estructura autorizada y no leen soluciones oficiales.
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
`npm run supabase:schema:test -- --migrations`. La actualización incremental se verifica mediante
`node scripts/test-rehearsals-upgrade.mjs`. `npm run test:e2e:rehearsals` usa un stack aislado.
El despliegue de aplicación y esquema es coordinado; las comprobaciones locales no aplican cambios
a la base habitual ni a entornos remotos.
Antes de actualizar un entorno compartido, conservar su respaldo habitual y verificar la actualización
completa desde el esquema anterior en un stack desechable. Aplicar la migración y la aplicación en
la misma ventana y comprobar la revisión esperada mediante el healthcheck privado.
