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

El jugador llega por primera vez a la Antártida y acompaña a un equipo hasta C4 para observar una
señal registrada bajo el hielo que se repite cada cuarenta segundos. La señal justifica la
expedición, pero no se resuelve. Al regresar, un pingüino se separa de la colonia y camina hacia
el interior: otro fenómeno observable cuyo motivo tampoco puede afirmarse.

El jugador no es el especialista que resolverá el misterio. Es un recién llegado al que piden
acompañar al equipo como observador y mantener un cuaderno de campo. Cada prueba representa una
acción necesaria para llegar, permanecer fuera, seleccionar el equipo, registrar la señal y
describir el comportamiento del pingüino sin convertir una observación en una explicación.

La partida completa durará aproximadamente **seis o siete minutos**, de los cuales unos tres
corresponden al relato no competitivo. Todos los jugadores reciben las
mismas escenas, pruebas y datos. Un fallo reduce la puntuación, pero nunca bloquea el avance ni
vuelve irresoluble la prueba final.

## Reparto narrativo

La definición tendrá tres movimientos y ocho preguntas:

| Movimiento                         | Propósito                                                        | Preguntas |
| ---------------------------------- | ---------------------------------------------------------------- | --------- |
| I. Llegada a C4                    | Llegar a la estación y poder permanecer fuera                    | 1–2       |
| II. Preparar la observación        | Seleccionar recursos, autonomía y protocolo                      | 3–5       |
| III. Lo que queda sin explicación  | Observar, medir y registrar al pingüino sin cerrar el misterio   | 6–8       |

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

### Prólogo y movimiento I · Llegada a C4

#### `scene-prologue` · Prólogo · «El cuaderno»

Tras la ventanilla, la nieve convierte el mundo en una página en blanco. Al bajar, el frío encuentra
el hueco entre guante y manga.

Nora Valdés te entrega un cuaderno impermeable. En la primera página: **40 segundos**.

—Un instrumento bajo el hielo repite una señal con ese intervalo. Está registrada en C4. Iremos a
observarla; no a inventarle una respuesta.

#### `scene-arrival` · Movimiento I · Llegada a C4

El viento borra el avión y después el primer poste. La estación queda a tu espalda; delante, en
algún punto, está C4 y la ruta de observación.

Nora te entrega una brújula y una tarjeta. La aguja marca **090°**; una corrección convierte esa
lectura en rumbo de mapa hacia la estación y el punto C4.

—La estación no se ha movido. Corrige la lectura y elige por dónde seguimos.

#### `scene-after-q1` · Movimiento I · Llegada

Las luces aparecen detrás de la nieve. Al detenerte, el sudor empieza a enfriarse bajo el
cortavientos.

Nora abre tu chaqueta: llevas base seca y barrera exterior, pero nada que retenga aire caliente
entre ambas.

—Al frío le basta con una capa sin completar.

### Movimiento II · Preparar la observación

#### `scene-station` · Antes de la pregunta 3

McMurdo surge como una ciudad de almacenes, tuberías y motores. Dentro del depósito, Álex extiende
el plano de C4 y separa el equipo que puede viajar.

—El vehículo admite cuatro bultos científicos. Lo que no llevemos no podrá convertirse en dato.

#### `scene-after-q3` · Antes de la pregunta 4

Alba cuenta cuatro radios y te pasa la autonomía: seis horas fuera, tres por batería, más una
reserva por persona.

—Aquí una batería de menos es alguien que deja de poder llamar.

#### `scene-after-q4` · Antes de la pregunta 5

El equipo ya está cargado. Desde el banco de pruebas llega un pulso; luego, silencio. Nora abre una
hoja en blanco para el protocolo.

—Antes de interpretar, decidimos qué vamos a registrar y en qué orden —dice Nora.

#### `scene-departure` · Después de la pregunta 5

Alba guarda la cámara, Mara el sismómetro y Álex los dos hidrófonos. Nora marca **C4** en el mapa:
un lugar concreto para una pregunta que todavía no lo es.

Un pulso aparece en pantalla. Cuarenta segundos después llega otro. Todos miran el reloj antes de
partir.

### Movimiento III · Lo que queda sin explicación

#### `scene-field` · Antes de la pregunta 6

La estación desaparece en el retrovisor. En C4, el equipo abre un acceso y la cámara desciende bajo
el hielo. Primero ves burbujas; después, una sombra que gira lentamente mientras el cuaderno espera
una descripción.

—No decidas qué significa. Empieza por nombrar lo que ves.

#### `scene-after-q6` · Antes de la pregunta 7

Álex conecta los dos hidrófonos; Mara activa el sismómetro. El protocolo ya está escrito. En el
mismo minuto, dos líneas recogen pulsos a cero y cuarenta segundos; la tercera no.

—Dime hasta dónde llegan los datos.

#### `scene-return` · Después de la pregunta 7

La señal sigue sin nombre cuando desmontáis el equipo. El acceso vuelve a cubrirse hasta parecer
intacto y el vehículo emprende el regreso. Los datos tienen límites; el silencio de dentro no
necesita una hipótesis.

#### `scene-penguin` · Antes de la pregunta 8

Casi todos los pingüinos avanzan hacia el mar. Uno se separa y camina hacia una extensión sin agua
ni refugio. No hay señal en el cuaderno que explique ese desvío.

Nora escribe **270°** y te devuelve el cuaderno abierto por las notas marcadas: C4, la corrección y
los límites de lo que habéis medido.

—No sabemos por qué. Anota solo hacia dónde va.

#### `scene-resolution` · Después de la pregunta 8 · Desenlace

Nora registra la trayectoria: el pingüino sale de C4 y continúa hacia el interior hasta convertirse
en una mancha sobre el hielo. El equipo observa en silencio mientras la imagen se aleja. Nora deja
claro que lo observado queda registrado, pero que la causa sigue fuera del cuaderno.

#### `scene-epilogue` · Después del desenlace · Pantalla negra

La interfaz desaparece y, después de una pausa, aparece **BUT WHY?**. El jugador pulsa «Continuar al
resultado» para ver la puntuación.

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

| Prueba | Acierto                                                            | Fallo                                                             | Tiempo agotado                                                   |
| ------ | ------------------------------------------------------------------ | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1      | Nora te devuelve la brújula. —Bien. Podemos llegar a C4.          | Nora corrige la tarjeta y mantiene la ruta hacia la estación.     | El viento borra las huellas. Nora fija el rumbo: 060°.          |
| 2      | Nora cierra la chaqueta. —Ahora puedes permanecer fuera.          | Nora añade el aislamiento que falta antes de salir.               | Tus dedos se entumecen. El equipo te prepara para C4.             |
| 3      | Álex sella el kit. —Esto sí puede convertirse en dato.            | Álex retira lo redundante y revisa el espacio del vehículo.       | El motor arranca. Álex carga el kit mínimo para la observación.   |
| 4      | Alba cuenta doce baterías. —Autonomía y regreso cubiertos.        | Alba repasa contigo el cálculo antes de cerrar la carga.           | El vehículo parte y Alba completa la carga de comunicaciones.     |
| 5      | Mara copia el protocolo. —Primero registramos; después comparamos.| Mara reordena los pasos y separa dato de hipótesis.                | Un pulso interrumpe la salida; el orden queda marcado para C4.    |
| 6      | Alba sigue la silueta. —Foca de Weddell; nada más todavía.        | La imagen se enfoca: es una foca de Weddell.                       | La cámara corrige el enfoque: una foca de Weddell.                |
| 7      | Mara asiente. —Dos puntos de escucha; ningún origen demostrado.   | Mara subraya los pulsos. El origen continúa abierto.              | Llega otro pulso. Mara guarda los registros sin interpretarlo.    |
| 8      | Nora registra C4 y la Ruta B sin añadir un motivo.                | Nora separa la trayectoria de cualquier explicación causal.        | Nora registra C4, Ruta B hacia el interior.                      |

## Tabla maestra de pruebas

Los textos, valores, soluciones y opciones de esta tabla son definitivos para la primera
implementación. Los códigos `F1`–`F7` remiten al apéndice de fuentes. Cuando una cifra se marca
como ficticia, es un dato autocontenido de la misión y no una afirmación sobre McMurdo.

| # / ID                                   | Movimiento y necesidad narrativa                                                                   | Formato                        | Enunciado completo                                                                                                                                                                           | Datos u opciones                                                                                                                                                                                              | Solución y explicación                                                                                                                                                                                                                                                                                                |                               Tiempo | Puntos | Entrada del cuaderno                                                                                                                                                                 | Recurso visual                                                                                                               | Fuente factual                                                                                      |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -----------------------------------: | -----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1 · `antarctica-orientation-calibration` | I. Demostrar que el recién llegado puede orientarse durante el whiteout.                           | Elección múltiple con imagen   | **La brújula marca 090°. La tarjeta indica: «Rumbo de mapa = lectura de brújula − 30°». ¿Qué rumbo debes seguir hasta la estación?**                                                         | `060°`, `090°`, `120°`, `270°`                                                                                                                                                                                | **060°**. `090° − 30° = 060°`; en el mapa de misión esa es la ruta hacia la estación. La corrección de 30° pertenece al instrumento ficticio, no es una declinación real de McMurdo.                                                                                                                                  |                                 20 s |     12 | «Calibración: rumbo de mapa = lectura de brújula − 30°». Marcada como posible conexión.                                                                                              | Tarjeta de brújula y mapa local con los cuatro rumbos.                                                                       | F3; calibración ficticia.                                                                           |
| 2 · `antarctica-cold-layer`              | I. Completar el abrigo antes de salir.                                                             | Elección múltiple              | **Llevas una capa base seca y un cortavientos exterior. ¿Qué falta entre ambas para conservar mejor el calor?**                                                                              | `Una capa aislante de forro polar`, `Otra capa impermeable idéntica`, `Una camiseta de algodón mojada`, `Un chaleco reflectante sin aislamiento`                                                              | **Una capa aislante de forro polar**. La capa intermedia retiene aire caliente; la exterior reduce la pérdida por viento. El equipo concreto es ficticio, pero el principio de vestirse por capas procede del manual de campo.                                                                                        |                                 18 s |     12 | «Condiciones al aterrizar: −18 °C; sistema previsto: base + aislamiento + cortavientos».                                                                                             | Silueta original de tres capas, con la intermedia vacía.                                                                     | F1, F2.                                                                                             |
| 3 · `antarctica-field-kit-selection`     | II. Seleccionar el equipo científico que puede viajar a C4.                                           | Clasificación                    | **El vehículo solo admite cuatro bultos científicos. Clasifica qué debe viajar a C4 y qué puede quedarse en la estación.** | Cámara submarina, pareja de hidrófonos H-1 y H-2, sismómetro, kit de baterías de reserva, segunda cámara sin batería, juego de etiquetas de almacén. | Hay que llevar cámara, hidrófonos, sismómetro y baterías. La segunda cámara sin batería y las etiquetas no aportan una medición prioritaria. Cada elemento correcto concede crédito parcial. | 30 s | 12 | «Kit de C4: cámara submarina, H-1 y H-2, sismómetro y baterías de reserva». | Tarjetas de equipo con símbolos claros y etiquetas accesibles. | Datos ficticios; F4 y F5 para la función de los instrumentos. |
| 4 · `antarctica-radio-batteries`         | II. Garantizar la autonomía de comunicación del equipo.                                            | Estimación numérica            | **Salen cuatro personas durante seis horas. Cada batería alimenta una radio durante tres horas y cada persona debe llevar además una batería de reserva. ¿Cuántas baterías hay que cargar?** | Mínimo `4`, máximo `20`, paso `1`, valor inicial `8`, tolerancia de puntuación `4`.                                                                                                                           | **12 baterías**. Dos baterías por radio cubren seis horas: `4 × 2 = 8`. Una reserva adicional para cada persona suma `4`: total `12`. Las respuestas cercanas reciben crédito por proximidad.                                                                                                                         |                                 30 s |     12 | «Comunicaciones: 12 baterías para 4 radios; incluye una reserva por persona».                                                                                                        | Sin recurso obligatorio; se pueden usar cuatro pictogramas de radio y una ficha de autonomía.                                | Cálculo y valores ficticios; F2 respalda la importancia de comunicaciones y planificación de campo. |
| 5 · `antarctica-observation-protocol`    | II. Ordenar un protocolo que permita medir sin atribuir causas prematuras.                            | Ordenación                       | **Ordena el protocolo antes de afirmar que un animal produce la señal.** | Registrar H-1/H-2; registrar el sismómetro; comparar tiempos y variaciones; anotar límites de la evidencia. | El orden correcto registra primero, compara después y deja constancia de lo que sigue sin demostrarse. | 35 s | 12 | «Protocolo: registrar hidrófonos y sismómetro, comparar los tiempos y anotar los límites de la evidencia». | Tarjetas de procedimiento con estados temporales inequívocos. | F4 y F5; protocolo de misión ficticio. |
| 6 · `antarctica-weddell-seal`            | III. Nombrar lo observado antes de atribuirle la señal.                                            | Imagen progresiva              | **¿Qué animal aparece bajo el hielo?**                                                                                                                                                       | Respuesta principal `foca de Weddell`. Aceptadas: `foca`, `foca Weddell`, `foca de Weddell`. Revelado progresivo de 12 s; un único intento.                                                                   | **Foca de Weddell**. Reconocer una foca basta para acertar: la subespecie no debe convertirse en conocimiento previo obligatorio. Las focas de Weddell producen vocalizaciones submarinas, pero ver una cerca no demuestra que sea el origen de la señal.                                                             |                                 30 s |     12 | «Observación visual: foca de Weddell bajo el hielo».                                                                                                                                 | Fotografía submarina de dominio público, sin texto, con el cuerpo moteado, las aletas y la cara de una foca bajo una placa de hielo. | F6, F7.                                                                                             |
| 7 · `antarctica-sensor-reading`          | III. Separar observación e interpretación y descartar el fallo de un único receptor.               | Elección múltiple con gráfico  | **Durante el mismo minuto, H-1 y H-2 registran pulsos a los 0 y 40 segundos. El sismómetro no muestra una variación coincidente. ¿Qué conclusión permiten los datos?**                       | `El Erebus ha entrado en erupción`; `La señal aparece en dos puntos de escucha bajo el agua, pero su origen sigue sin determinarse`; `H-2 está averiado`; `La foca observada produce necesariamente la señal` | **La señal aparece en dos puntos de escucha bajo el agua, pero su origen sigue sin determinarse**. La coincidencia en dos hidrófonos debilita la hipótesis de un fallo aislado. La ausencia de una variación simultánea en este sismómetro no identifica el origen y tampoco permite atribuirlo a un animal concreto. |                                 35 s |     12 | «Registro: pulsos en H-1 y H-2 cada 40 s; sin variación simultánea en el sismómetro; origen no determinado».                                                                         | Gráfico original con tres bandas sincronizadas, ejes de 0–60 s y picos a 0 y 40 s solo en H-1/H-2.                           | F4, F5, F6; registros ficticios.                                                                    |
| 8 · `antarctica-penguin-trajectory`      | III. Cerrar el cuaderno con una observación objetiva, sin explicar el comportamiento del pingüino. | Elección múltiple con mapa A–D | **El pingüino parte de C4 y se aleja hacia el interior. Elige el registro que solo afirma lo observable.** | Una opción conserva C4, Ruta B y el motivo indeterminado; las demás cambian origen, rumbo o añaden una causa. | **C4 → Ruta B hacia el interior; el motivo de la trayectoria no está determinado**. La calibración se consulta, pero el foco final es separar trayectoria y explicación. | 40 s | 16 | «Observación final: lectura 270°» antes de la prueba y «Trayectoria registrada: C4, Ruta B hacia el interior. El motivo queda abierto» después. | Mapa original con rutas etiquetadas mediante letra, patrón y forma. | Datos de misión ficticios; F3 respalda el uso de puntos y rumbos. |

### Etiquetado previsto

Solo se usan IDs ya existentes en la taxonomía del proyecto.

| Pregunta | Dominios                         | Topics             | Habilidades cognitivas                      | Habilidades de formato          | Habilidades vitales         |
| -------- | -------------------------------- | ------------------ | ------------------------------------------- | ------------------------------- | --------------------------- |
| 1        | `geography`, `mathematics`       | `orientation`      | `logical_reasoning`, `problem_solving`      | `calculation`, `interpretation` | `adaptability`              |
| 2        | `natural_sciences`               | `weather`          | `decision_making`, `comprehension`          | `interpretation`                | `health_self_care`          |
| 3        | `natural_sciences`, `technology` | `sound_waves`     | `decision_making`, `classification`       | `classification`, `interpretation` | `organization_productivity`, `adaptability` |
| 4        | `mathematics`, `technology`      | `arithmetic`       | `quantitative_reasoning`, `problem_solving` | `calculation`, `estimation`     | `organization_productivity` |
| 5        | `natural_sciences`, `technology` | `sound_waves`      | `scientific_reasoning`, `critical_thinking` | `ordering`, `deduction`          | `environmental_awareness` |
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
| `note-kit`           | Después de la 3 | Kit de C4: cámara submarina, H-1 y H-2, sismómetro y baterías de reserva.                     | Marcada; necesaria. |
| `note-batteries`     | Después de la 4 | 12 baterías para 4 radios; incluye una reserva por persona.                                    | Contextual.         |
| `note-protocol`      | Después de la 5 | Protocolo: registrar hidrófonos y sismómetro, comparar tiempos y anotar límites.              | Marcada; necesaria. |
| `note-location`      | Después de la 5 | Punto de observación de la colonia: C4.                                                        | Marcada; necesaria. |
| `note-species`       | Después de la 6 | Observación visual: foca de Weddell bajo el hielo.                                             | Contextual.         |
| `note-signal`        | Después de la 7 | H-1 y H-2: pulsos cada 40 s. Sin variación simultánea en el sismómetro. Origen no determinado. | Contextual.         |
| `note-final-bearing` | Antes de la 8   | Observación final: lectura de brújula 270°.                                                    | Marcada; necesaria. |
| `note-final-route`   | Después de la 8 | Trayectoria registrada: C4, Ruta B hacia el interior. El motivo queda abierto.                 | Resultado final.    |

## Metapuzle final resuelto

La prueba final no pide resolver el misterio. Combina observaciones visibles en el cuaderno para
registrar correctamente la trayectoria:

1. El punto de partida es **C4**.
2. La lectura final de brújula es **270°**.
3. La calibración indica **restar 30°** para trasladar la lectura al mapa.
4. El motivo del comportamiento no está determinado.

Por tanto:

```text
270° − 30° = 240°
origen C4 + rumbo 240° = Ruta B
trayectoria observada ≠ causa demostrada
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

Después de la respuesta, la explicación muestra el cálculo en la revisión y registra el resultado.
Primero aparece `scene-resolution` como desenlace narrativo estándar; después, `scene-epilogue`
se convierte en la pantalla negra. **BUT WHY?** no es una pregunta, no
tiene solución, no concede puntos y no atribuye causas al comportamiento del pingüino.

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

### Kit de recursos para C4

- Seis tarjetas con silueta, etiqueta y símbolo: cuatro recursos prioritarios y dos elementos
  redundantes o no prioritarios.
- Las categorías visibles son `Llevar a C4` y `Dejar en la estación`.
- Las tarjetas deben poder clasificarse con teclado y no transmitir la respuesta solo mediante el
  color.

### Foca bajo el hielo

- Escena submarina oscura con la parte inferior del hielo visible y una foca de Weddell completa.
- El desenfoque inicial debe ocultar detalles sin confundirla deliberadamente con otro animal.
- Usar la fotografía local `public/visuals/antarctica/weddell-seal.jpg`, descargada desde Wikimedia
  Commons. Es una imagen de dominio público procedente de la National Science Foundation; autor:
  Steve Rupp. Fuente: [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Weddell_seal_swims_underwater_in_McMurdo_Sound_(Image_3).jpg).
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
- clasificar y ordenar: crédito parcial por elementos o posiciones correctas;
- estimación: proximidad al valor 12 y velocidad, con tolerancia 4;
- la pantalla de epílogo queda fuera del tiempo competitivo y continúa explícitamente al resultado.

La suma de límites puntuables es 238 segundos. La duración esperada de interacción es de unos 190
segundos; con 86 segundos de escenas y aproximadamente 5 segundos de transiciones, la sesión
objetivo dura alrededor de **4 min 41 s**. Una partida que agote todos los límites puede acercarse a
5 min 30 s y sigue avanzando automáticamente.

## Resolución en frío y casos de fallo

### Resolución sin conocimiento externo

1. La pregunta 1 entrega la fórmula necesaria.
2. La pregunta 2 describe las capas presentes y pregunta por la función ausente.
3. La pregunta 3 presenta las restricciones del vehículo y permite distinguir el equipo que produce
   datos de los elementos redundantes.
4. La pregunta 4 proporciona personas, duración, autonomía y reserva.
5. La pregunta 5 ofrece un protocolo completo y pide ordenar registro, comparación e interpretación.
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
- El epílogo «BUT WHY?» aparece en una pantalla negra después de la última respuesta y conserva un tono abierto.
