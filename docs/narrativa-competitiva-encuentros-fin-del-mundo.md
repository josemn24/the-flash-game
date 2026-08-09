# Desafío 04: Encuentros en el fin del mundo

## Estado y alcance

Este documento es la **fuente de verdad editorial** de la primera versión del modo
**Narrativa competitiva**. El desafío ocupa el cuarto puesto de la temporada mock
(`tabarnia-challenge-04`). El prólogo, los tres movimientos, el epílogo y la revisión están
implementados como una misión completa.

La referencia creativa es la Antártida de _Encounters at the End of the World_, de Werner
Herzog. La película inspira el tono, el entorno y la atención a quienes habitan McMurdo, pero
el desafío usa personajes, textos, datos de misión e ilustraciones propios. No reutiliza
fotogramas, audio ni textos de la película y no exige conocerla.

Esta versión cierra el contenido de una misión lineal de ocho pruebas y 100 puntos. Quedan
fuera la persistencia, el ranking real, el multijugador, las ramas, el audio y los formatos
nuevos. La competición consiste, por ahora, en obtener una puntuación individual comparable
con otros desafíos.

## Objetivo de la experiencia

El jugador llega por primera vez a la Antártida y pasa unas horas en una estación científica
antes de acompañar a un equipo de investigación. Una señal registrada bajo el hielo se repite
cada cuarenta segundos. Puede ser un error técnico, una vibración del hielo, actividad
volcánica o algo vivo.

El jugador no es el especialista que resolverá el misterio. Es un recién llegado al que piden
acompañar al equipo como observador y mantener un cuaderno de campo. Cada prueba representa
una acción dentro de ese mundo: orientarse, completar el abrigo, localizar material, calcular
suministros, asignar instrumentos, observar una criatura o interpretar registros.

La partida completa durará aproximadamente **seis o siete minutos**, de los cuales unos tres
corresponden al relato no competitivo. Todos los jugadores reciben las
mismas escenas, pruebas y datos. Un fallo reduce la puntuación, pero nunca bloquea el avance ni
vuelve irresoluble la prueba final.

## Reparto narrativo

La definición tendrá tres movimientos y ocho preguntas:

| Movimiento              | Propósito                                                | Preguntas |
| ----------------------- | -------------------------------------------------------- | --------- |
| I. Llegada              | Aprender a orientarse y prepararse para el exterior      | 1–2       |
| II. La estación         | Preparar la salida y conocer al equipo por su trabajo    | 3–5       |
| III. Más allá del hielo | Observar, interpretar y registrar sin cerrar el misterio | 6–8       |

El cierre del pingüino forma parte del tercer movimiento, pero tiene una escena propia antes de
la pregunta 8. El epílogo aparece después de registrar la última respuesta.

## Guía de voz narrativa

- El relato está escrito en **segunda persona y presente**. El jugador observa y actúa, pero no
  recibe una biografía ni una personalidad cerrada.
- La voz es sobria y concreta. Cada escena combina una sensación física, una acción del equipo,
  una incertidumbre y un enlace causal con la prueba siguiente.
- Los diálogos se integran con raya en el flujo del cuento. No funcionan como titulares ni
  repiten literalmente el enunciado de la prueba.
- Nora coordina sin juzgar al jugador. Alba observa organismos, Álex trabaja con sonido y
  logística, y Mara separa los datos de las hipótesis.
- Un error cambia una reacción breve, nunca la ruta, los hechos registrados ni el desenlace.
- La señal permanece sin explicación. La ficción puede sugerir posibilidades, pero no confirma
  que proceda del Erebus, de una avería o de un animal.

## Guion de escenas

Las escenas avanzan manualmente con «Continuar». No tienen cuenta atrás y el reloj de la prueba
siguiente solo comienza cuando su interfaz está preparada. Los párrafos y diálogos siguientes son
texto definitivo; los tiempos son un presupuesto de lectura, no una animación obligatoria.

### Prólogo y movimiento I · Llegada

#### `scene-prologue` · Prólogo · «El cuaderno»

Tras la ventanilla, la nieve convierte el mundo en una página en blanco. Al bajar, el frío encuentra
el hueco entre guante y manga.

Nora Valdés te entrega un cuaderno impermeable. En la primera página: **40 segundos**.

—Un instrumento bajo el hielo repite una señal con ese intervalo. Esta tarde iremos a revisarlo.
Por ahora, observa.

#### `scene-arrival` · Movimiento I · Llegada

El viento borra el avión y después el primer poste. La estación debería estar delante, pero cada
dirección parece la misma.

Nora te entrega una brújula y una tarjeta. La aguja marca **090°**; una corrección convierte esa
lectura en rumbo de mapa.

—La estación no se ha movido. Corrige la lectura y elige por dónde seguimos.

#### `scene-after-q1` · Movimiento I · Llegada

Las luces aparecen detrás de la nieve. Al detenerte, el sudor empieza a enfriarse bajo el
cortavientos.

Nora abre tu chaqueta: llevas base seca y barrera exterior, pero nada que retenga aire caliente
entre ambas.

—Al frío le basta con una capa sin completar.

### Movimiento II · La estación

#### `scene-station` · Antes de la pregunta 3

McMurdo surge como una ciudad de almacenes, tuberías y motores. Dentro del depósito, Álex ilumina
cuatro huecos, tres cajas y demasiadas etiquetas.

—El generador está fallando. Mira ahora; cuando se apague, tendrás que recordar cada posición.

#### `scene-after-q3` · Antes de la pregunta 4

Alba cuenta cuatro radios y te pasa la autonomía: seis horas fuera, tres por batería, más una
reserva por persona.

—Aquí una batería de menos es alguien que deja de poder llamar.

#### `scene-after-q4` · Antes de la pregunta 5

Tres fichas se deslizan por la mesa: nombres separados de instrumentos. Desde el banco de pruebas
llega un pulso; luego, silencio.

—Antes de salir, cada pregunta necesita la herramienta adecuada —dice Nora.

#### `scene-departure` · Después de la pregunta 5

Alba guarda la cámara, Mara el sismómetro y Álex el hidrófono H-2. Antes de cerrar, marca **C4** en
el mapa.

Un pulso aparece en pantalla. Cuarenta segundos después llega otro. Todos miran el reloj antes de
partir.

### Movimiento III · Más allá del hielo

#### `scene-field` · Antes de la pregunta 6

La estación desaparece en el retrovisor. En C4, el equipo abre un acceso y la cámara desciende bajo
el hielo. Primero ves burbujas; después, una sombra que gira lentamente.

—No decidas qué significa. Empieza por nombrar lo que ves.

#### `scene-after-q6` · Antes de la pregunta 7

Álex conecta dos hidrófonos; Mara añade el sismómetro. En el mismo minuto, dos líneas recogen
pulsos a cero y cuarenta segundos; la tercera no.

—Dime hasta dónde llegan los datos.

#### `scene-return` · Después de la pregunta 7

La señal sigue sin nombre cuando desmontáis el equipo. El acceso vuelve a cubrirse hasta parecer
intacto y el vehículo emprende el regreso. Fuera, la luz ya no parece de mañana ni de tarde. Dentro,
nadie llena el silencio con una explicación que los registros no sostienen.

#### `scene-penguin` · Antes de la pregunta 8

Casi todos los pingüinos avanzan hacia el mar. Uno se separa, hacia una extensión sin agua ni
refugio.

Nora escribe **270°** y te devuelve el cuaderno abierto por las notas marcadas.

—No sabemos por qué. Anota solo hacia dónde va.

#### `scene-epilogue` · Después de la pregunta 8

La trayectoria queda registrada. El pingüino continúa hacia el interior hasta convertirse en una
mancha sobre el hielo.

Nadie formula una hipótesis ni abandona el vehículo. La imagen se aleja: solo quedan la figura, la
llanura y las montañas.

Pantalla negra: **But why?**

### Presupuesto editorial

| Tramo                    | Palabras visibles aproximadas | Lectura objetivo |
| ------------------------ | ----------------------------: | ---------------: |
| Prólogo y movimiento I   |                           180 |             60 s |
| Movimiento II            |                           160 |             50 s |
| Movimiento III y epílogo |                           220 |             70 s |
| **Total de una partida** |                       **560** |        **180 s** |

La estimación incluye una reacción por pregunta. Las transiciones visuales duran alrededor de
650 ms y no forman parte del tiempo puntuable.

## Reacciones a las pruebas

Las tres variantes de cada prueba desembocan en la misma escena y desbloquean las mismas entradas.
La reacción elegida se presenta como el primer bloque de la escena siguiente; tras la última
pregunta aparece antes del epílogo o del resultado provisional.

| Prueba | Acierto                                                         | Fallo                                                                    | Tiempo agotado                                                  |
| ------ | --------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| 1      | Nora te devuelve la brújula. —Bien. Podemos orientarnos.        | Nora enfrenta tarjeta y aguja. —El mapa necesita 060°. Lo anotamos.      | El viento borra las huellas. Nora fija el rumbo: 060°.          |
| 2      | Nora cierra la chaqueta. —Así conservas el aire caliente.       | Nora añade un forro polar. —Necesitamos aislamiento entre base y viento. | Tus dedos se entumecen. Nora te ayuda a añadir aislamiento.     |
| 3      | Álex apaga la linterna. —Exacto. Podemos cargar.                | Álex ilumina cada posición correcta. —Comparamos, anotamos y cargamos.   | La luz de emergencia se enciende. Álex localiza las tres cajas. |
| 4      | Alba cuenta doce baterías. —Autonomía y reservas cubiertas.     | Alba separa doce baterías y repasa el cálculo contigo.                   | El vehículo arranca. Alba completa la carga con doce baterías.  |
| 5      | Cada especialista recoge su instrumento. El equipo está listo.  | Nora corrige las fichas y cada especialista recoge su herramienta.       | Llega otro pulso. Nora reparte los instrumentos para partir.    |
| 6      | Alba sigue la silueta. —Foca de Weddell; nada más todavía.      | La imagen se enfoca: es una foca de Weddell.                             | La cámara corrige el enfoque: una foca de Weddell.              |
| 7      | Mara asiente. —Dos puntos de escucha; ningún origen demostrado. | Mara subraya los pulsos. El origen continúa abierto.                     | Llega otro pulso. Mara guarda los registros sin interpretarlo.  |
| 8      | Nora comprueba C4 y 240°. La trayectoria queda registrada.      | Nora resta la calibración. —C4, rumbo 240°. Eso registramos.             | Nora aplica la corrección y anota C4, rumbo 240°.               |

## Tabla maestra de pruebas

Los textos, valores, soluciones y opciones de esta tabla son definitivos para la primera
implementación. Los códigos `F1`–`F7` remiten al apéndice de fuentes. Cuando una cifra se marca
como ficticia, es un dato autocontenido de la misión y no una afirmación sobre McMurdo.

| # / ID                                   | Movimiento y necesidad narrativa                                                                   | Formato                        | Enunciado completo                                                                                                                                                                           | Datos u opciones                                                                                                                                                                                              | Solución y explicación                                                                                                                                                                                                                                                                                                |                               Tiempo | Puntos | Entrada del cuaderno                                                                                                                                                                 | Recurso visual                                                                                                               | Fuente factual                                                                                      |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -----------------------------------: | -----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1 · `antarctica-orientation-calibration` | I. Demostrar que el recién llegado puede orientarse durante el whiteout.                           | Elección múltiple con imagen   | **La brújula marca 090°. La tarjeta indica: «Rumbo de mapa = lectura de brújula − 30°». ¿Qué rumbo debes seguir hasta la estación?**                                                         | `060°`, `090°`, `120°`, `270°`                                                                                                                                                                                | **060°**. `090° − 30° = 060°`; en el mapa de misión esa es la ruta hacia la estación. La corrección de 30° pertenece al instrumento ficticio, no es una declinación real de McMurdo.                                                                                                                                  |                                 20 s |     12 | «Calibración: rumbo de mapa = lectura de brújula − 30°». Marcada como posible conexión.                                                                                              | Tarjeta de brújula y mapa local con los cuatro rumbos.                                                                       | F3; calibración ficticia.                                                                           |
| 2 · `antarctica-cold-layer`              | I. Completar el abrigo antes de salir.                                                             | Elección múltiple              | **Llevas una capa base seca y un cortavientos exterior. ¿Qué falta entre ambas para conservar mejor el calor?**                                                                              | `Una capa aislante de forro polar`, `Otra capa impermeable idéntica`, `Una camiseta de algodón mojada`, `Un chaleco reflectante sin aislamiento`                                                              | **Una capa aislante de forro polar**. La capa intermedia retiene aire caliente; la exterior reduce la pérdida por viento. El equipo concreto es ficticio, pero el principio de vestirse por capas procede del manual de campo.                                                                                        |                                 18 s |     12 | «Condiciones al aterrizar: −18 °C; sistema previsto: base + aislamiento + cortavientos».                                                                                             | Silueta original de tres capas, con la intermedia vacía.                                                                     | F1, F2.                                                                                             |
| 3 · `antarctica-warehouse-memory`        | II. Recuperar solo las cajas necesarias sin perder tiempo en el almacén.                           | Memoria relámpago 2×2          | **La luz se apaga en cuatro segundos. Reconstruye la posición de las tres cajas y del hueco libre.**                                                                                         | Exposición: arriba izquierda `Hidrófono H-2`; arriba derecha `Hueco libre`; abajo izquierda `Baterías`; abajo derecha `Cámara submarina`. Después se muestran las cuatro fichas desordenadas.                 | La reconstrucción exacta es la disposición de la exposición. Cada posición correcta recibe crédito parcial. La ficha «Hueco libre» ocupa la cuarta celda porque el formato actual exige completar la cuadrícula.                                                                                                      | 30 s; exposición de 4 s no puntuable |     12 | «Almacén: H-2 arriba izquierda; baterías abajo izquierda; cámara abajo derecha».                                                                                                     | Cuadrícula ortogonal con tres cajas de forma y símbolo distintos y un hueco rayado.                                          | Datos ficticios; F4 para la función del hidrófono.                                                  |
| 4 · `antarctica-radio-batteries`         | II. Garantizar la autonomía de comunicación del equipo.                                            | Estimación numérica            | **Salen cuatro personas durante seis horas. Cada batería alimenta una radio durante tres horas y cada persona debe llevar además una batería de reserva. ¿Cuántas baterías hay que cargar?** | Mínimo `4`, máximo `20`, paso `1`, valor inicial `8`, tolerancia de puntuación `4`.                                                                                                                           | **12 baterías**. Dos baterías por radio cubren seis horas: `4 × 2 = 8`. Una reserva adicional para cada persona suma `4`: total `12`. Las respuestas cercanas reciben crédito por proximidad.                                                                                                                         |                                 30 s |     12 | «Comunicaciones: 12 baterías para 4 radios; incluye una reserva por persona».                                                                                                        | Sin recurso obligatorio; se pueden usar cuatro pictogramas de radio y una ficha de autonomía.                                | Cálculo y valores ficticios; F2 respalda la importancia de comunicaciones y planificación de campo. |
| 5 · `antarctica-team-instruments`        | II. Entender quién persigue cada clase de observación y asignarle su instrumento.                  | Emparejar tres parejas         | **Asigna a cada miembro del equipo el instrumento que necesita para su tarea.**                                                                                                              | `Alba Ríos — observar animales bajo el hielo` ↔ `Cámara submarina`; `Álex Vega — escuchar la señal en el agua` ↔ `Hidrófono H-2`; `Mara Soler — comparar vibraciones del terreno` ↔ `Sismómetro`.             | Las tres parejas anteriores. Un hidrófono escucha sonido bajo el agua; un sismómetro registra movimiento del terreno. La cámara permite identificar visualmente organismos. Cada pareja correcta concede crédito parcial y los intentos fallidos aplican la penalización existente.                                   |                                 35 s |     12 | «Equipo: Alba—cámara; Álex—hidrófono H-2; Mara—sismómetro». Después de completar la prueba se añade también «Punto de observación de la colonia: C4», marcado como posible conexión. | Retratos ilustrados sencillos y siluetas inequívocas de los tres instrumentos.                                               | F4, F5. Personajes y coordenada ficticios.                                                          |
| 6 · `antarctica-weddell-seal`            | III. Nombrar lo observado antes de atribuirle la señal.                                            | Imagen progresiva              | **¿Qué animal aparece bajo el hielo?**                                                                                                                                                       | Respuesta principal `foca de Weddell`. Aceptadas: `foca`, `foca Weddell`, `foca de Weddell`. Revelado progresivo de 12 s; un único intento.                                                                   | **Foca de Weddell**. Reconocer una foca basta para acertar: la subespecie no debe convertirse en conocimiento previo obligatorio. Las focas de Weddell producen vocalizaciones submarinas, pero ver una cerca no demuestra que sea el origen de la señal.                                                             |                                 30 s |     12 | «Observación visual: foca de Weddell bajo el hielo».                                                                                                                                 | Ilustración original submarina, sin texto, que muestre cuerpo moteado, aletas y la cara de una foca bajo una placa de hielo. | F6, F7.                                                                                             |
| 7 · `antarctica-sensor-reading`          | III. Separar observación e interpretación y descartar el fallo de un único receptor.               | Elección múltiple con gráfico  | **Durante el mismo minuto, H-1 y H-2 registran pulsos a los 0 y 40 segundos. El sismómetro no muestra una variación coincidente. ¿Qué conclusión permiten los datos?**                       | `El Erebus ha entrado en erupción`; `La señal aparece en dos puntos de escucha bajo el agua, pero su origen sigue sin determinarse`; `H-2 está averiado`; `La foca observada produce necesariamente la señal` | **La señal aparece en dos puntos de escucha bajo el agua, pero su origen sigue sin determinarse**. La coincidencia en dos hidrófonos debilita la hipótesis de un fallo aislado. La ausencia de una variación simultánea en este sismómetro no identifica el origen y tampoco permite atribuirlo a un animal concreto. |                                 35 s |     12 | «Registro: pulsos en H-1 y H-2 cada 40 s; sin variación simultánea en el sismómetro; origen no determinado».                                                                         | Gráfico original con tres bandas sincronizadas, ejes de 0–60 s y picos a 0 y 40 s solo en H-1/H-2.                           | F4, F5, F6; registros ficticios.                                                                    |
| 8 · `antarctica-penguin-trajectory`      | III. Cerrar el cuaderno con una observación objetiva, sin explicar el comportamiento del pingüino. | Elección múltiple con mapa A–D | **El pingüino parte del punto C4. La brújula marca 270°. Consulta el cuaderno y elige la trayectoria que debes registrar.**                                                                  | `Ruta A`: desde C4 a 270°; `Ruta B`: desde C4 a 240°; `Ruta C`: desde C4 a 060°; `Ruta D`: desde B4 a 240°.                                                                                                   | **Ruta B**. El cuaderno indica restar 30°: `270° − 30° = 240°`. La ruta comienza en C4 y avanza al suroeste, hacia el interior. Los otros recorridos representan ignorar la corrección, invertir el rumbo o usar un origen incorrecto.                                                                                |                                 40 s |     16 | Antes de activar el reloj se añade «Observación final: lectura de brújula 270°», marcada como posible conexión. Al responder: «Trayectoria registrada: C4, rumbo de mapa 240°».      | Mapa original descrito en el brief final, con rutas etiquetadas mediante letra, patrón y forma.                              | Datos de misión ficticios; F3 respalda el uso de puntos y rumbos para navegación.                   |

### Etiquetado previsto

Solo se usan IDs ya existentes en la taxonomía del proyecto.

| Pregunta | Dominios                         | Topics             | Habilidades cognitivas                      | Habilidades de formato          | Habilidades vitales         |
| -------- | -------------------------------- | ------------------ | ------------------------------------------- | ------------------------------- | --------------------------- |
| 1        | `geography`, `mathematics`       | `orientation`      | `logical_reasoning`, `problem_solving`      | `calculation`, `interpretation` | `adaptability`              |
| 2        | `natural_sciences`               | `weather`          | `decision_making`, `comprehension`          | `interpretation`                | `health_self_care`          |
| 3        | `mathematics`                    | `memory_training`  | `memory`                                    | `recall`                        | `organization_productivity` |
| 4        | `mathematics`, `technology`      | `arithmetic`       | `quantitative_reasoning`, `problem_solving` | `calculation`, `estimation`     | `organization_productivity` |
| 5        | `natural_sciences`, `technology` | `scientists`       | `comprehension`, `scientific_reasoning`     | `classification`, `deduction`   | `organization_productivity` |
| 6        | `natural_sciences`               | `biology_taxonomy` | `pattern_recognition`, `memory`             | `recall`                        | `environmental_awareness`   |
| 7        | `natural_sciences`, `technology` | `sound_waves`      | `scientific_reasoning`, `critical_thinking` | `interpretation`, `deduction`   | `environmental_awareness`   |
| 8        | `geography`, `mathematics`       | `orientation`      | `logical_reasoning`, `problem_solving`      | `calculation`, `interpretation` | `adaptability`              |

## Cuaderno de campo

### Reglas

- El cuaderno comienza vacío y solo muestra entradas cuyo momento narrativo ya ha ocurrido.
- Cada entrada de las preguntas 1–7 se desbloquea al terminar la prueba, con independencia de
  que la respuesta sea correcta, parcial, incorrecta o quede sin responder.
- El cuaderno registra la lectura correcta producida por el equipo o el instrumento, no corrige
  retroactivamente la puntuación del jugador.
- La entrada final de 270° se añade durante `scene-penguin`, antes de iniciar la pregunta 8.
- Las entradas 1, 5 y final muestran un icono neutro de clip y el texto «Puede estar
  relacionado». El icono no explica la operación ni destaca la respuesta.
- El jugador puede abrir y cerrar el cuaderno durante cualquier prueba. El cronómetro sigue
  corriendo mientras lo consulta porque interpretar la información sí forma parte de la prueba.
- Las escenas pueden mostrar el cuaderno sin activar el cronómetro.
- La revisión conserva todas las entradas, incluida la trayectoria registrada después de la
  pregunta 8.

### Inventario de entradas

| ID                   | Se desbloquea   | Texto visible                                                                                  | Relevancia final    |
| -------------------- | --------------- | ---------------------------------------------------------------------------------------------- | ------------------- |
| `note-calibration`   | Después de la 1 | Calibración: rumbo de mapa = lectura de brújula − 30°.                                         | Marcada; necesaria. |
| `note-weather`       | Después de la 2 | Condiciones al aterrizar: −18 °C. Capas: base + aislamiento + cortavientos.                    | Ambiental.          |
| `note-storage`       | Después de la 3 | H-2: arriba izquierda. Baterías: abajo izquierda. Cámara: abajo derecha.                       | Contextual.         |
| `note-batteries`     | Después de la 4 | 12 baterías para 4 radios; incluye una reserva por persona.                                    | Contextual.         |
| `note-team`          | Después de la 5 | Alba—cámara. Álex—hidrófono H-2. Mara—sismómetro.                                              | Contextual.         |
| `note-location`      | Después de la 5 | Punto de observación de la colonia: C4.                                                        | Marcada; necesaria. |
| `note-species`       | Después de la 6 | Observación visual: foca de Weddell bajo el hielo.                                             | Contextual.         |
| `note-signal`        | Después de la 7 | H-1 y H-2: pulsos cada 40 s. Sin variación simultánea en el sismómetro. Origen no determinado. | Contextual.         |
| `note-final-bearing` | Antes de la 8   | Observación final: lectura de brújula 270°.                                                    | Marcada; necesaria. |
| `note-final-route`   | Después de la 8 | Trayectoria registrada: C4, rumbo de mapa 240°.                                                | Resultado final.    |

## Metapuzle final resuelto

El metapuzle no depende de recordar respuestas anteriores. Combina tres observaciones visibles en
el cuaderno:

1. El punto de partida es **C4**.
2. La lectura final de brújula es **270°**.
3. La calibración indica **restar 30°** para trasladar la lectura al mapa.

Por tanto:

```text
270° − 30° = 240°
origen C4 + rumbo 240° = Ruta B
```

### Especificación del mapa final

- Cuadrícula 5×5, columnas A–E de izquierda a derecha y filas 1–5 de arriba abajo.
- Norte de mapa arriba, indicado con flecha y palabra `NORTE`.
- Mar en el borde derecho; interior y silueta de montañas en el borde izquierdo.
- Colonia representada en C4 con un símbolo y la etiqueta textual `Colonia · C4`.
- Ruta A: sale de C4 hacia 270°, línea discontinua de trazos largos.
- Ruta B: sale de C4 hacia 240°, línea continua con marcas transversales; es la correcta.
- Ruta C: sale de C4 hacia 060°, línea de puntos.
- Ruta D: sale de B4 hacia 240°, línea de trazo y punto.
- Cada ruta lleva su letra en el inicio y en el extremo. Las letras, patrones y geometría permiten
  distinguirlas sin color.
- Texto alternativo: «Mapa de cuadrícula A–E por 1–5. La colonia está en C4. A sale de C4 al
  oeste; B sale de C4 al suroeste; C sale de C4 al nordeste; D sale de B4 al suroeste».

### Distractores

| Ruta | Error representado        | Por qué no es válida                             |
| ---- | ------------------------- | ------------------------------------------------ |
| A    | Ignorar la calibración    | Usa directamente 270° en vez de restar 30°.      |
| B    | Ninguno                   | Empieza en C4 y aplica la corrección hasta 240°. |
| C    | Invertir el rumbo         | Usa 060°, la dirección opuesta a 240°.           |
| D    | Usar un origen incorrecto | Aplica 240°, pero empieza en B4 en lugar de C4.  |

Después de la respuesta, la explicación muestra el cálculo y registra el resultado. Solo entonces
aparece `scene-epilogue`. «But why?» no es una pregunta, no tiene solución, no concede puntos y no
atribuye causas al comportamiento del pingüino.

## Briefs de recursos visuales

Todos los recursos serán ilustraciones originales o composiciones creadas expresamente para el
juego. Formato maestro recomendado: 1600×1000 px o SVG equivalente, composición segura para
móvil, contraste WCAG AA en textos y símbolos, y significado redundante mediante texto, forma o
patrón.

### Brújula y tarjeta de calibración

- Vista cenital de una brújula que marque 090° junto a una tarjeta con la fórmula visible.
- Mini mapa con cuatro flechas etiquetadas `060°`, `090°`, `120°` y `270°`.
- No representar la corrección de 30° como declinación geográfica real.
- Texto alternativo: «Brújula con lectura 090° y tarjeta que indica restar 30° para obtener el
  rumbo de mapa».

### Almacén 2×2

- Tres cajas con silueta, etiqueta y símbolo distintos: ondas para H-2, batería para suministros y
  cámara para imagen submarina.
- Cuarta celda claramente vacía mediante un contorno rayado y la etiqueta `Hueco libre`.
- Evitar detalles pequeños que conviertan la memoria en una prueba de agudeza visual.

### Foca bajo el hielo

- Escena submarina oscura con la parte inferior del hielo visible y una foca de Weddell completa.
- El desenfoque inicial debe ocultar detalles sin confundirla deliberadamente con otro animal.
- No usar una fotografía o fotograma del documental como base visible.
- La solución accesible acepta el nivel general «foca».

### Gráfico de sensores

- Tres bandas apiladas con la misma escala temporal de 0–60 s: `Hidrófono H-1`, `Hidrófono H-2`
  y `Sismómetro`.
- H-1 y H-2 muestran pulsos inequívocos en 0 y 40 s; el sismómetro mantiene ruido basal sin pico
  coincidente.
- Los pulsos se distinguen por posición y forma, no solo por color.
- Texto alternativo equivalente a todos los datos necesarios para responder.

### Mapa de trayectorias

- Seguir exactamente la cuadrícula, rutas, patrones y texto alternativo definidos en la sección
  del metapuzle.
- La ruta B no debe destacar visualmente sobre las demás.
- El pingüino y las montañas son ambientales; la solución depende solo de C4, la calibración y el
  rumbo.

## Puntuación y tiempo

Los máximos son `12 + 12 + 12 + 12 + 12 + 12 + 12 + 16 = 100`. La prueba final pesa más que
una prueba ordinaria, pero representa solo el 16 % del total y no decide por sí sola el resultado.

Se reutilizan las políticas actuales de cada formato:

- elección múltiple e imagen progresiva: resolución binaria ajustada por velocidad;
- memoria relámpago y emparejar: crédito parcial por elementos correctos y conservación del
  progreso compatible con el timeout;
- estimación: proximidad al valor 12 y velocidad, con tolerancia 4;
- emparejar: penalización existente por intentos incorrectos.

La suma de límites puntuables es 238 segundos. La duración esperada de interacción es de unos 190
segundos; con 86 segundos de escenas y aproximadamente 5 segundos de transiciones, la sesión
objetivo dura alrededor de **4 min 41 s**. Una partida que agote todos los límites puede acercarse a
5 min 30 s y sigue avanzando automáticamente.

## Resolución en frío y casos de fallo

### Resolución sin conocimiento externo

1. La pregunta 1 entrega la fórmula necesaria.
2. La pregunta 2 describe las capas presentes y pregunta por la función ausente.
3. La pregunta 3 muestra toda la disposición antes de pedir reconstruirla.
4. La pregunta 4 proporciona personas, duración, autonomía y reserva.
5. La pregunta 5 explica la tarea de cada persona y ofrece instrumentos con funciones
   reconocibles en el propio texto y las ilustraciones.
6. La pregunta 6 acepta «foca», visible en la imagen, sin exigir recordar la película ni dominar
   taxonomía.
7. La pregunta 7 incluye las tres series y limita la respuesta a lo que muestran.
8. La pregunta 8 puede resolverse consultando tres entradas marcadas del cuaderno.

### Simulación de errores

- Fallar o agotar el tiempo en las preguntas 1–7 no impide que el instrumento o el equipo añadan
  la observación correspondiente al cuaderno.
- La prueba 8 siempre recibe `note-calibration`, `note-location` y `note-final-bearing`.
- Fallar la pregunta 8 registra la respuesta enviada para la revisión, muestra después la
  trayectoria correcta y continúa al epílogo.
- Ningún error altera escenas, pruebas posteriores ni desenlace.

### Solución única

Solo la ruta B satisface simultáneamente los tres requisitos: origen C4, corrección de −30° y rumbo
240°. A comparte origen pero no corrección; C comparte origen pero invierte el rumbo; D comparte
rumbo pero no origen.

## Fuentes primarias y límites factuales

Consulta editorial realizada el 9 de agosto de 2026. Las fuentes respaldan el entorno y los
principios científicos; los nombres, coordenadas, temperaturas de la jornada, baterías, lecturas y
señal son datos ficticios de la misión.

| Código | Fuente institucional                                                                                                                                                                           | Qué respalda                                                                                                                                                                               | Aplicación y límite                                                                                                                                 |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1     | [NSF — McMurdo Station](https://www.nsf.gov/geo/opp/ail/mcmurdo-station)                                                                                                                       | McMurdo es una estación costera y centro logístico próximo al Erebus; alberga investigación de biología, geología, geofísica, hielo y océano. La página publica una media anual de −18 °C. | Justifica el entorno industrial, la variedad del equipo y una temperatura ficticia plausible. No convierte −18 °C en la temperatura de un día real. |
| F2     | [U.S. Antarctic Program — Continental Field Manual](https://www.usap.gov/travelanddeployment/540/) y [manual completo](https://www.usap.gov/travelAndDeployment/documents/USAPFieldManual.pdf) | Planificación, comunicaciones, meteorología antártica, whiteouts y vestimenta por capas para trabajo de campo.                                                                             | Sustenta las pruebas de abrigo y preparación. El equipo y la autonomía concretos son ficticios.                                                     |
| F3     | [Australian Antarctic Program — Navigation](https://www.antarctica.gov.au/antarctic-operations/travel-and-logistics/navigation/)                                                               | Uso de coordenadas, waypoints, mapas y navegación instrumental en desplazamientos antárticos.                                                                                              | Sustenta el lenguaje de rutas y puntos. La cuadrícula C4 y la corrección de 30° son convenciones internas.                                          |
| F4     | [U.S. Geological Survey — Hydrophone](https://www.usgs.gov/media/images/hydrophone-0)                                                                                                          | Un hidrófono es un micrófono empleado para escuchar sonidos bajo el agua.                                                                                                                  | Sustenta la función de H-1 y H-2; sus registros son ficticios.                                                                                      |
| F5     | [U.S. Geological Survey — Seismographs](https://www.usgs.gov/programs/earthquake-hazards/seismographs-keeping-track-earthquakes)                                                               | Los sismómetros registran ondas sísmicas y movimiento del terreno.                                                                                                                         | Sustenta la comparación instrumental; una banda plana ficticia no descarta universalmente toda causa geológica.                                     |
| F6     | [NOAA Fisheries — Sounds in the Ocean: Mammals](https://www.fisheries.noaa.gov/national/science-data/sounds-ocean-mammals)                                                                     | Las focas producen sonidos submarinos y NOAA incluye vocalizaciones y espectrogramas de foca de Weddell.                                                                                   | Sustenta que una foca sea una hipótesis plausible, nunca una conclusión derivada solo de verla.                                                     |
| F7     | [Australian Antarctic Program — Weddell seal](https://www.antarctica.gov.au/about-antarctica/animals/seals/weddell-seal/)                                                                      | Las focas de Weddell viven asociadas al hielo fijo, mantienen orificios para respirar y vocalizan bajo el agua.                                                                            | Sustenta la observación bajo el hielo y sus rasgos generales; la presencia concreta en la misión sigue siendo ficticia.                             |

## Contrato para la implementación posterior

La implementación debe conservar estos invariantes:

- `mode: "narrative"`, tres movimientos y ocho IDs en el orden fijado;
- escenas y epílogo fuera del tiempo competitivo;
- entradas del cuaderno desbloqueadas por progreso, no por acierto;
- pregunta 8 resuelta contra datos visibles del cuaderno;
- puntuación máxima exacta de 100;
- revisión con respuestas, explicaciones y cuaderno completo;
- recursos propios, accesibles y sin dependencia del documental.

Una estructura inicial compatible con este contrato sería:

```ts
type NarrativeBeat = {
  id: string;
  title: string;
  intro: string;
  questionIds: QuestionId[];
};
```

El modelo definitivo podrá separar escenas, notas y epílogo, pero no debe cambiar el orden ni las
reglas editoriales de este documento sin actualizar primero esta fuente de verdad.

## Criterios de aceptación del desafío implementado

- Se completa la jornada de principio a fin en una única sesión.
- La narración explica por qué aparece cada prueba.
- Las escenas no consumen tiempo puntuable.
- El cuaderno sigue siendo suficiente después de cualquier combinación de fallos.
- El metapuzle solo admite la ruta B y explica por qué se descartan A, C y D.
- La puntuación es comparable con otros desafíos de 100 puntos.
- Todo puede resolverse sin conocer la película de Herzog.
- Los recursos son legibles en móvil y no transmiten información solo mediante color.
- El epílogo «But why?» aparece después de la última respuesta y conserva un tono abierto.
