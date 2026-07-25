# Modos de juego futuros

## Propósito

Este documento recoge modos de juego candidatos para The Flash. No describe alcance comprometido ni sustituye al catálogo de formatos: un **formato** define el tipo de reto individual, mientras que un **modo** define el contexto de partida, el ritmo, la progresión, la presión y la motivación principal.

Este documento describe modos como plantillas de reglas para desafíos. La estructura de salas, temporadas, calendario de desafíos y rankings se documenta en `salas-y-temporadas.md`.

La intención es validar qué hace que distintos perfiles quieran repetir: velocidad, superación personal, riesgo, cooperación, estrategia, narrativa, conocimiento o juego social. La primera validación debería usar el contenido y los formatos ya disponibles antes de construir sistemas con backend, salas, persistencia o evaluación avanzada.

Un modo no pertenece necesariamente a una sola categoría social. Supervivencia puede ser individual o competitiva, Constructor puede ser cooperativo o competitivo, y Detective puede funcionar solo, en grupo o por equipos. Por eso conviene clasificarlos por dimensiones, no como una lista rígida.

La dirección principal para una primera versión multijugador es usar estos modos como desafíos asíncronos dentro de salas y temporadas. En ese contexto, **todos contra todos** debería ser la relación base; el duelo puede tratarse como una sala de dos jugadores, y equipos debería quedar como variante posterior porque exige repartir grupos de forma equilibrada.

## Criterios de validación

Un modo candidato debería evaluarse con estos criterios:

- **Repetición:** si invita a jugar otra partida inmediatamente.
- **Claridad:** si se entiende en menos de diez segundos.
- **Encaje móvil:** si funciona con interacciones breves y controles cómodos.
- **Reutilización:** si puede aprovechar preguntas, formatos y puntuación actuales.
- **Comparabilidad:** si produce resultados fáciles de explicar y comparar.
- **Potencial social:** si genera conversación, pique, cooperación o retos compartibles.
- **Alineación con salas:** si funciona con cualquier número razonable de jugadores sin exigir emparejamientos perfectos.
- **Coste v1:** si puede prototiparse sin rediseñar todo el producto.

## Encaje multijugador

La prioridad social para estos modos queda así:

1. **Todos contra todos:** base recomendada para salas y ranking individual.
2. **Uno contra uno:** caso particular de una sala con dos jugadores; no necesita reglas propias al principio.
3. **Equipo contra equipo:** variante posterior; exige equipos equilibrados o reglas para grupos impares.
4. **Cooperativo:** línea futura distinta, menos alineada con ranking individual como motivación principal.

La prioridad temporal queda así:

1. **Asíncrono:** modalidad inicial; cada jugador completa la sala cuando pueda dentro de una ventana o invitación.
2. **Tiempo real:** evolución posterior; añade sincronización, presencia, latencia, desconexiones y estado compartido en vivo.

Por tanto, `asíncrono` no debería tratarse como un modo de juego independiente. Es una modalidad temporal aplicable a Flash, Supervivencia, Cadena, La Pirámide, Alfabeto, Apuesta de confianza, Predicción, Narrativo y otros modos. La organización completa de salas, temporadas y rankings se mantiene en `salas-y-temporadas.md`.

## Dimensiones de clasificación

Cada modo debería describirse con tres dimensiones:

- **Finalidad principal:** qué motivación activa, como velocidad, superación, riesgo, cooperación, estrategia, narrativa, expresión, creación o socialización.
- **Relación entre jugadores:** cómo interactúan, como solo, todos contra todos, uno contra uno, equipos, cooperativo, asíncrono o comunidad.
- **Ritmo:** cuándo ocurre la partida, priorizando asíncrono y dejando tiempo real como evolución posterior.

La tabla siguiente es orientativa. Sirve para comparar modos y decidir qué validar primero, no para cerrar una taxonomía definitiva.

| Modo                 | Finalidad principal                       | Relación entre jugadores                | Ritmo                   |
| -------------------- | ----------------------------------------- | --------------------------------------- | ----------------------- |
| Flash / Contrarreloj | velocidad, competición, marca personal    | solo / todos contra todos               | asíncrono / tiempo real |
| Supervivencia        | superación, resistencia                   | solo / todos contra todos               | asíncrono / tiempo real |
| Cadena               | racha, riesgo, progresión                 | solo / todos contra todos               | asíncrono / tiempo real |
| La Pirámide          | progresión, dificultad, superación        | solo / todos contra todos               | asíncrono / tiempo real |
| Alfabeto             | precisión, recorrido, gestión del tiempo  | solo / todos contra todos               | asíncrono / tiempo real |
| Apuesta de confianza | estrategia, metacognición, riesgo         | solo / todos contra todos               | asíncrono / tiempo real |
| Duelo                | competición directa                       | uno contra uno                          | asíncrono / tiempo real |
| Cooperativo          | objetivo común                            | cooperativo                             | asíncrono / tiempo real |
| Equipos              | competición social, coordinación          | equipo contra equipo                    | tiempo real             |
| Narrativo            | inmersión, contexto, competición          | solo / todos contra todos / cooperativo | asíncrono / episódico   |
| Detective            | investigación, pensamiento crítico        | solo / cooperativo / equipos            | asíncrono / episódico   |
| Predicción           | anticipación, razonamiento causal         | solo / todos contra todos               | asíncrono / tiempo real |
| Respuesta rara       | estrategia social, conocimiento abierto   | todos contra todos / comunidad          | asíncrono / agregado    |
| Orden y conexión     | comprensión estructural                   | solo / todos contra todos / cooperativo | asíncrono / tiempo real |
| Conquista            | estrategia territorial                    | todos contra todos / equipos            | persistente             |
| Constructor          | progresión, estrategia                    | solo / cooperativo / competitivo        | persistente             |
| Creador de retos     | creatividad, socialización                | creador contra jugadores / comunidad    | asíncrono               |
| Debate               | argumentación, expresión                  | uno contra uno / equipos / grupo        | asíncrono / tiempo real |

## Shortlist recomendada

Los primeros modos a validar deberían ser:

1. **Flash / Contrarreloj**, como modo base y control.
2. **Supervivencia**, por superación personal y rejugabilidad.
3. **Cadena**, por rachas, tensión y riesgo con coste bajo.
4. **La Pirámide**, por convertir la dificultad creciente en una meta visible y compartible.
5. **Alfabeto**, por combinar conocimiento, memoria de pendientes y gestión del tiempo.
6. **Apuesta de confianza**, por añadir estrategia y metacognición.
7. **Predicción**, por funcionar bien como comparación todos contra todos.
8. **Narrativo competitivo**, por añadir contexto compartido sin perder ranking individual.

Todos deberían validarse primero en modalidad asíncrona. Estos modos pueden reutilizar las etapas, preguntas, formatos y reglas de puntuación actuales con cambios relativamente contenidos. Duelo encaja como caso particular cuando una sala tiene dos jugadores. Narrativo también puede alinearse con salas si todos juegan la misma misión y puntúan individualmente. Equipos, cooperación profunda, conquista o creación de retos tienen potencial, pero conviene validarlos cuando la sala todos contra todos y el ranking individual ya hayan demostrado tracción.

## Catálogo de modos

### Flash / Contrarreloj

Partida individual rápida con preguntas cronometradas, puntuación por acierto y bonus por velocidad. Es el modo actual y la referencia contra la que comparar cualquier alternativa.

- **Motivación principal:** velocidad, reflejos y repetición.
- **Relación entre jugadores:** solo / todos contra todos.
- **Ritmo:** asíncrono / tiempo real.
- **Cómo funciona:** el jugador completa una etapa con un límite por pregunta; responde, avanza y recibe resultado al final.
- **Encaje con The Flash:** concentra la identidad del producto en rondas breves, presión temporal y comparación clara.
- **V1 validable:** usarlo como modo base de sala asíncrona todos contra todos, con ranking individual por puntos, precisión y tiempo.
- **Riesgos:** puede percibirse como trivia rápida si no se combina con formatos visuales, memoria, lógica y retos especiales.

### Supervivencia

El jugador empieza con varias vidas. Cada fallo consume una vida y la partida continúa hasta perderlas todas o superar una cadena larga de retos.

- **Motivación principal:** superación personal y resistencia.
- **Relación entre jugadores:** solo / todos contra todos.
- **Ritmo:** asíncrono / tiempo real.
- **Cómo funciona:** cada acierto permite avanzar; los errores restan vidas; la dificultad puede subir por rondas, tiempo disponible o valor de las preguntas.
- **Encaje con The Flash:** usa la presión temporal actual y añade una meta muy fácil de entender: aguantar más que antes.
- **V1 validable:** sala asíncrona todos contra todos con tres vidas por jugador; gana mejor puntuación o quien sobreviva más tiempo.
- **Riesgos:** si los errores por desconocimiento eliminan demasiado rápido, puede frustrar; necesita calibrar dificultad y duración.

### Cadena

Los aciertos consecutivos aumentan un multiplicador, una recompensa o una barra de progreso. Un fallo rompe la racha o reduce el bonus acumulado.

- **Motivación principal:** tensión, progresión y riesgo.
- **Relación entre jugadores:** solo / todos contra todos.
- **Ritmo:** asíncrono / tiempo real.
- **Cómo funciona:** cada acierto suma racha; la puntuación crece con la cadena; el jugador intenta mantener precisión bajo presión.
- **Encaje con The Flash:** refuerza partidas cortas y convierte cada pregunta en parte de una progresión visible.
- **V1 validable:** aplicar multiplicador por racha en una sala asíncrona todos contra todos y reflejar la mejor cadena en el ranking.
- **Riesgos:** un multiplicador demasiado agresivo puede hacer que una sola pregunta pese más que toda la etapa.

### La Pirámide

La partida empieza con pruebas relativamente accesibles y asciende por niveles cada vez más exigentes. La cima queda reservada para preguntas que, en teoría, solo un porcentaje pequeño de jugadores puede resolver.

- **Motivación principal:** progresión, superación, dificultad creciente y logro visible.
- **Relación entre jugadores:** solo / todos contra todos.
- **Ritmo:** asíncrono / tiempo real.
- **Cómo funciona:** el jugador avanza por una escalera de niveles; cada nivel contiene una prueba calibrada para ser más difícil que la anterior; el resultado compara el nivel alcanzado, la precisión, los errores y el tiempo utilizado.
- **Encaje con The Flash:** da una fantasía muy clara de ascenso y crea una métrica fácil de compartir: hasta qué nivel llegó cada jugador. Se diferencia de Supervivencia porque no premia aguantar una secuencia larga, sino superar una ruta curada hacia una cima.
- **V1 validable:** pirámide corta de cinco a siete niveles en una sala asíncrona todos contra todos, con ranking por nivel máximo alcanzado, puntos, errores y tiempo.
- **Variantes:** una vida, margen de uno o dos fallos, rutas segura/difícil, pirámides temáticas, evento especial con pregunta final de élite o calibración por percentiles cuando haya datos suficientes.
- **Riesgos:** exige calibrar muy bien la dificultad; si la pendiente es irregular, el modo puede sentirse injusto o aleatorio. La pregunta final debe parecer exigente, no arbitraria.

### Alfabeto

El jugador recorre letras del alfabeto y responde una definición asociada a cada una. Puede contestar, pasar y volver más tarde a las letras pendientes mientras el tiempo sigue corriendo.

- **Motivación principal:** precisión, memoria de pendientes y gestión del tiempo.
- **Relación entre jugadores:** solo / todos contra todos.
- **Ritmo:** asíncrono / tiempo real.
- **Cómo funciona:** cada letra tiene una definición cuya respuesta empieza por esa letra, la contiene o se asocia editorialmente a ella; el jugador avanza por el alfabeto, marca letras resueltas, falla o pasa, y puede completar varias vueltas hasta agotar el tiempo o cerrar todas las letras.
- **Encaje con The Flash:** aporta un modo reconocible, estratégico y televisivo sin abandonar la presión temporal; obliga a decidir cuándo insistir, cuándo pasar y cómo administrar las letras pendientes.
- **V1 validable:** mini alfabeto temático de ocho a doce letras con respuesta corta, botón de pasar, estado por letra y ranking por aciertos, errores y tiempo utilizado.
- **Variantes:** rosco completo, mini rosco, alfabeto temático, letras con respuesta que empieza por la letra, letras con respuesta que contiene la letra, bloqueo por error o vueltas con dificultad creciente.
- **Riesgos:** requiere contenido editorial muy cuidado para evitar ambigüedades; un alfabeto completo puede ser demasiado largo para sesiones rápidas si no se ajusta el tiempo o el número de letras.

### Apuesta de confianza

Antes de responder, el jugador declara cuánto confía en su respuesta o cuántos puntos quiere arriesgar. Acertar con alta confianza premia más; fallar penaliza más.

- **Motivación principal:** estrategia personal, toma de decisiones y metacognición.
- **Relación entre jugadores:** solo / todos contra todos.
- **Ritmo:** asíncrono / tiempo real.
- **Cómo funciona:** cada pregunta ofrece niveles de confianza o una apuesta limitada; la respuesta se evalúa junto con el riesgo elegido.
- **Encaje con The Flash:** diferencia el juego de una trivia simple porque premia saber reconocer la propia incertidumbre.
- **V1 validable:** tres niveles de confianza aplicados a preguntas existentes, con puntuación individual comparable dentro de una sala asíncrona.
- **Riesgos:** si la apuesta ralentiza cada pregunta, puede romper el ritmo; la interfaz debe ser extremadamente rápida.

### Duelo

Dos jugadores reciben retos equivalentes y compiten por puntuación, precisión o velocidad. Puede ser en tiempo real o por turnos.

- **Motivación principal:** competición directa.
- **Relación entre jugadores:** uno contra uno.
- **Ritmo:** asíncrono / tiempo real.
- **Cómo funciona:** ambos jugadores completan la misma ronda o una ronda equivalente; gana quien obtenga mejor resultado total.
- **Encaje con The Flash:** puede aparecer sin sistema propio cuando una sala tiene exactamente dos jugadores.
- **V1 validable:** tratarlo como sala de dos participantes con el mismo ranking individual y sin reglas adicionales.
- **Riesgos:** si evoluciona a tiempo real exigirá sincronización, latencia y resolución de desconexiones.

### Cooperativo

Varios jugadores comparten un objetivo común, como desactivar una amenaza, resolver un caso o alcanzar una puntuación conjunta.

- **Motivación principal:** cooperación y objetivo compartido.
- **Relación entre jugadores:** cooperativo.
- **Ritmo:** asíncrono / tiempo real.
- **Cómo funciona:** el grupo progresa si suma aciertos, cubre categorías o resuelve piezas complementarias de una misión.
- **Encaje con The Flash:** puede transformar preguntas rápidas en presión de equipo, pero no es la línea más directa si el objetivo principal es ranking individual.
- **V1 validable:** objetivo conjunto local o asíncrono basado en puntuación acumulada y roles simples.
- **Riesgos:** la cooperación real requiere evitar que todos hagan lo mismo; si no hay información o funciones diferentes, se convierte en suma de partidas individuales.

### Equipos

Dos equipos compiten durante varias rondas. Algunas pruebas son individuales y otras requieren consenso o reparto de funciones.

- **Motivación principal:** competición social y coordinación.
- **Relación entre jugadores:** equipo contra equipo.
- **Ritmo:** tiempo real.
- **Cómo funciona:** cada equipo acumula puntos; puede alternar turnos, retos simultáneos y rondas de consenso.
- **Encaje con The Flash:** funciona bien en aulas, eventos, grupos familiares o reuniones.
- **V1 validable:** variante posterior sobre salas, con puntuación individual que también suma a un marcador de equipo.
- **Riesgos:** necesita equipos equilibrados o reglas para grupos impares; también debe evitar esperas largas, jugadores pasivos o discusiones que rompan el ritmo.

### Narrativo

Las preguntas forman parte de una misión, historia o escenario. El contexto da sentido a los retos y al progreso.

- **Motivación principal:** inmersión, contexto, aplicación y competición.
- **Relación entre jugadores:** solo / todos contra todos / cooperativo.
- **Ritmo:** asíncrono / episódico.
- **Cómo funciona:** cada ronda representa una escena, punto de control o decisión dentro de una historia; los aciertos desbloquean avances, pistas o desenlaces.
- **Encaje con The Flash:** puede funcionar como historia compartida competitiva: todos recorren la misma misión, pero puntúan individualmente por acierto, progreso y velocidad.
- **V1 validable:** sala asíncrona todos contra todos con una misión breve, cinco o seis puntos de control y ranking por pruebas resueltas, puntos y tiempo.
- **Riesgos:** requiere contenido editorial más cuidado; demasiado texto puede chocar con el ritmo rápido.

### Detective

Los jugadores analizan documentos, testimonios, mapas y datos para distinguir pistas relevantes, detectar contradicciones y formular una conclusión.

- **Motivación principal:** pensamiento crítico, investigación y comprensión profunda.
- **Relación entre jugadores:** solo / cooperativo / equipos.
- **Ritmo:** asíncrono / episódico.
- **Cómo funciona:** se presentan piezas de información; los retos piden identificar contradicciones, ordenar hechos, descartar pistas falsas o cerrar una hipótesis.
- **Encaje con The Flash:** aprovecha formatos como reconstrucción del error, clasificación, ordenación, mapa de calor y respuesta corta.
- **V1 validable:** caso breve de cinco a siete pruebas usando formatos existentes y una conclusión final.
- **Riesgos:** el contenido debe estar muy curado para evitar ambigüedad; puede necesitar más tiempo que una etapa normal.

### Predicción

Se muestra una situación, experimento, gráfico incompleto o acontecimiento histórico. El jugador predice qué ocurrirá antes de descubrir el resultado.

- **Motivación principal:** pensamiento causal, científico y estratégico.
- **Relación entre jugadores:** solo / todos contra todos.
- **Ritmo:** asíncrono / tiempo real.
- **Cómo funciona:** el jugador interpreta datos o contexto, elige una predicción y después ve el resultado real con explicación.
- **Encaje con The Flash:** convierte conocimiento en anticipación, no solo recuerdo.
- **V1 validable:** sala asíncrona todos contra todos con preguntas de elección múltiple o estimación formuladas como predicción, comparando acierto, proximidad y tiempo.
- **Riesgos:** debe evitar depender de adivinanza; cada predicción necesita evidencia suficiente en pantalla.

### Respuesta rara

El jugador debe dar una respuesta correcta que haya sido elegida por el menor número posible de participantes o que tenga baja frecuencia en una muestra de referencia. Las respuestas obvias conceden pocos puntos; las respuestas válidas pero poco frecuentes ofrecen mayor recompensa.

- **Motivación principal:** estrategia social, conocimiento abierto y lectura del comportamiento del grupo.
- **Relación entre jugadores:** todos contra todos / comunidad.
- **Ritmo:** asíncrono / agregado.
- **Cómo funciona:** se plantea una consigna con varias respuestas válidas; cada jugador responde intentando acertar y, a la vez, evitar la respuesta más evidente; la puntuación combina validez, rareza y penalización por respuestas incorrectas o no reconocidas.
- **Encaje con The Flash:** añade una capa distinta a la trivia rápida porque la pregunta no es solo "qué sé", sino "qué sé que otros no elegirán". Funciona especialmente bien en salas, eventos y temporadas con suficiente participación.
- **V1 validable:** variante cerrada con opciones válidas visibles u ocultas y rareza calculada contra una tabla editorial o contra las respuestas de la sala al cerrar el desafío.
- **Variantes:** contra la sala, contra histórico global, lista cerrada, respuesta abierta, cero absoluto si nadie más respondió lo mismo, rondas temáticas o penalización fuerte por respuesta inválida.
- **Riesgos:** requiere normalizar sinónimos, ortografía y variantes válidas; necesita masa crítica o datos de referencia para que la rareza sea justa; una validación abierta insuficiente puede hacer que el modo parezca arbitrario.

### Orden y conexión

Modo centrado en ordenar acontecimientos, pasos, magnitudes o conceptos, y en construir conexiones entre elementos.

- **Motivación principal:** comprensión, relaciones y estructura mental.
- **Relación entre jugadores:** solo / todos contra todos / cooperativo.
- **Ritmo:** asíncrono / tiempo real.
- **Cómo funciona:** la partida usa principalmente ordenar, emparejar, clasificar, conectar parejas, secuencias y patrones.
- **Encaje con The Flash:** reutiliza muchos formatos existentes y se siente menos trivia que una ronda de preguntas aisladas.
- **V1 validable:** etapa temática compuesta solo por formatos de relación, orden y conexión.
- **Riesgos:** puede sentirse como una categoría de contenido más que como modo si no tiene una regla propia de progresión.

### Conquista

Las categorías aparecen como territorios. Ganar retos permite conquistar, defender o expandirse por un mapa.

- **Motivación principal:** estrategia a medio plazo y control territorial.
- **Relación entre jugadores:** todos contra todos / equipos.
- **Ritmo:** persistente.
- **Cómo funciona:** cada territorio se asocia a un dominio o topic; ganar retos captura zonas y perder puede abrir defensas o contraataques.
- **Encaje con The Flash:** aprovecha el sistema de tags para convertir categorías en mapa estratégico.
- **V1 validable:** mapa simple de dominios donde superar una pregunta conquista una zona y el resultado final muestra territorio ganado.
- **Riesgos:** requiere diseño de mapa, balance, persistencia opcional y reglas que no oculten la claridad de las preguntas.

### Constructor

Los conocimientos ganados alimentan una ciudad, expedición, empresa, laboratorio o civilización que evoluciona entre rondas.

- **Motivación principal:** progresión, estrategia y construcción a largo plazo.
- **Relación entre jugadores:** solo / cooperativo / competitivo.
- **Ritmo:** persistente.
- **Cómo funciona:** las respuestas generan recursos o decisiones; esos recursos desbloquean mejoras, eventos o nuevas rutas.
- **Encaje con The Flash:** puede dar continuidad a sesiones cortas y conectar dominios de conocimiento con consecuencias visibles.
- **V1 validable:** meta-progreso muy simple con tres recursos y decisiones al final de cada etapa.
- **Riesgos:** puede convertirse en otro juego; exige economía, balance y persistencia para sostenerse.

### Creador de retos

Los usuarios crean preguntas o pequeños desafíos para amigos a partir de plantillas y una revisión automática de calidad.

- **Motivación principal:** creatividad, personalización y viralidad.
- **Relación entre jugadores:** creador contra jugadores / comunidad.
- **Ritmo:** asíncrono.
- **Cómo funciona:** el creador elige un formato, completa campos guiados, etiqueta el contenido y comparte el reto.
- **Encaje con The Flash:** aumenta contenido social y permite retos privados entre grupos.
- **V1 validable:** generador local o interno para crear una pregunta a partir de plantillas, sin publicación abierta.
- **Riesgos:** el contenido mediocre o incorrecto puede dañar la experiencia; necesita validación, moderación o uso restringido.

### Debate

Se plantea un dilema o una postura. Los jugadores argumentan, responden objeciones y consideran evidencias.

- **Motivación principal:** pensamiento crítico, comunicación y ciudadanía.
- **Relación entre jugadores:** uno contra uno / equipos / grupo.
- **Ritmo:** asíncrono / tiempo real.
- **Cómo funciona:** cada jugador elige postura, presenta argumentos y recibe evaluación por coherencia, evidencias o capacidad de responder contraargumentos.
- **Encaje con The Flash:** abre un área de habilidades menos cubierta por preguntas rápidas.
- **V1 validable:** modo editorial con rúbrica simple y revisión humana o semiautomática, no como competición de velocidad pura.
- **Riesgos:** la puntuación automática justa es difícil; puede alejarse mucho del ritmo actual.

## Priorización sugerida

| Modo                 | Coste v1   | Potencial    | Prioridad             |
| -------------------- | ---------- | ------------ | --------------------- |
| Flash                | Bajo       | Alto         | Mantener como control |
| Supervivencia        | Bajo/medio | Alto         | Alta                  |
| Cadena               | Bajo       | Alto         | Alta                  |
| La Pirámide          | Medio      | Alto         | Alta                  |
| Alfabeto             | Medio      | Alto         | Alta                  |
| Apuesta de confianza | Medio      | Muy alto     | Alta                  |
| Duelo                | Bajo       | Alto         | Media                 |
| Cooperativo          | Medio/alto | Alto         | Baja inicial          |
| Equipos              | Medio/alto | Alto         | Baja inicial          |
| Narrativo            | Medio      | Alto         | Media                 |
| Detective            | Alto       | Alto         | Media                 |
| Predicción           | Bajo/medio | Alto         | Media                 |
| Respuesta rara       | Alto       | Alto         | Baja inicial          |
| Orden y conexión     | Bajo       | Medio/alto   | Media                 |
| Conquista            | Alto       | Alto         | Baja inicial          |
| Constructor          | Alto       | Alto         | Baja inicial          |
| Creador de retos     | Alto       | Muy alto     | Baja inicial          |
| Debate               | Alto       | Experimental | Baja inicial          |

## Lectura recomendada

La primera validación no debería intentar construir todos los modos. Conviene partir de salas asíncronas todos contra todos con ranking individual y comparar el modo actual con varias variantes que reutilicen contenido existente:

- **Competición rápida en sala:** Flash, Cadena, La Pirámide, Alfabeto, Predicción y Narrativo competitivo.
- **Superación personal:** Supervivencia y Apuesta de confianza.
- **Caso especial de sala pequeña:** Duelo como sala de dos jugadores.
- **Social flexible posterior:** Creador de retos.
- **Variantes posteriores:** Equipos, Cooperativo, Constructor, Conquista, Detective, Respuesta rara y Debate.

Los modos que exigen cooperación profunda, equipos equilibrados, conquista, construcción, creación de retos, rareza basada en datos agregados o tiempo real deberían esperar hasta que esté validado el núcleo de sala asíncrona competitiva individual y ranking general.
