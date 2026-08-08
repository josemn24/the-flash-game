# Desafío 04: Encuentros en el fin del mundo

## Estado

Este documento define la primera versión prevista del modo **Narrativa competitiva**. El desafío ocupa el cuarto puesto de la temporada mock (`tabarnia-challenge-04`), pero todavía no está implementado ni es jugable.

La referencia creativa es la Antártida de *Encounters at the End of the World*, de Werner Herzog. La película inspira el tono, el entorno y la atención a los científicos y personajes que habitan McMurdo; el desafío debe tener historia, textos, ilustraciones y datos propios, y no exige conocer el documental.

## Objetivo de la experiencia

El jugador llega por primera vez a la Antártida y pasa unas horas en una estación científica antes de acompañar a un equipo de investigación. Durante la jornada debe orientarse, ayudar con tareas corrientes, interpretar datos y observar fenómenos extraños.

La historia no debe limitarse a aparecer entre preguntas. Cada prueba tiene que ser una acción que el jugador realiza dentro de ese mundo: orientarse durante un whiteout, repartir suministros, recordar un almacén, interpretar una señal o calcular una trayectoria.

La partida debe durar aproximadamente **cuatro o cinco minutos**, con una secuencia lineal de ocho pruebas. Todos los jugadores reciben la misma misión, las mismas pruebas y los mismos datos, pero compiten individualmente por puntos y velocidad dentro de una ventana asíncrona.

## Estructura narrativa

### I. Llegada

El avión aterriza entre viento y blanco absoluto. Una introducción breve sitúa al jugador:

> Bienvenido a la Antártida. Durante los próximos minutos, todo lo que conozcas estará al norte.

Las dos primeras pruebas funcionan como aclimatación y tutorial integrado:

- localizar la estación o la Antártida en un mapa;
- determinar un rumbo, interpretar una temperatura o escoger el equipamiento adecuado.

Deben ser pruebas visuales y sencillas. Su función es enseñar el tono y los controles sin mostrar un tutorial separado.

### II. La estación

McMurdo aparece como una pequeña ciudad industrial: almacenes, vehículos, dormitorios, laboratorios y tuberías junto a un paisaje inmenso. Lo sublime convive con tareas muy mundanas.

Esta sección contiene tres pruebas:

- memorizar la posición de algunos objetos en un almacén;
- repartir suministros o calcular raciones;
- asociar varios investigadores con sus campos de estudio a partir de pistas.

La historia avanza a través de encargos de los habitantes de la estación. No hace falta presentar grandes exposiciones: una persona, una tarea y una consecuencia breve bastan para dar contexto.

### III. Más allá del hielo

El jugador sale de la estación con un equipo de investigación. El ambiente cambia: hielo, oscuridad, agua bajo la superficie, instrumentos y la presencia distante del Erebus.

Las tres últimas pruebas son:

- identificar progresivamente una criatura o una imagen científica bajo el hielo;
- interpretar una gráfica, ordenar una cadena alimentaria o detectar una anomalía en los datos;
- calcular una dirección, distancia o trayectoria cuando un pingüino se separa del grupo.

Después de la última respuesta, el pingüino continúa caminando hacia el interior. El jugador vuelve a la estación y la historia termina sin una victoria heroica ni una explicación innecesaria.

## El cuaderno de campo

Durante el desafío aparecen algunos datos que parecen secundarios: una coordenada, una temperatura, el nombre de una especie, un símbolo o una cifra. El juego los guarda automáticamente en un cuaderno visible.

La octava prueba utiliza parte de esa información como un pequeño metapuzle. De este modo, la narrativa se convierte en material jugable sin exigir que el jugador recuerde detalles arbitrarios.

El cuaderno debe:

- mostrar solo la información descubierta;
- permitir revisar los datos durante la partida;
- indicar qué elementos pueden ser relevantes sin revelar la solución;
- conservar su contenido en la revisión final;
- usar una solución única y comprobable.

## Pruebas y formatos de la primera versión

La primera versión debe reutilizar formatos ya disponibles:

| Momento | Prueba | Formato previsto |
| --- | --- | --- |
| Llegada | Orientación y localización | Elección múltiple o mapa de calor |
| Llegada | Frío y equipamiento | Elección múltiple o verdadero/falso |
| Estación | Almacén | Memoria relámpago |
| Estación | Suministros | Estimación o respuesta corta |
| Estación | Investigadores | Emparejar |
| Campo | Vida bajo el hielo | Imagen progresiva o pistas |
| Campo | Datos de investigación | Ordenar, clasificar o elección con gráfico |
| Final | Pingüino y cuaderno | Elección, estimación o metapuzle lineal |

El globo giratorio, el audio y las interacciones científicas complejas quedan fuera de esta primera versión. Podrán añadirse como formatos o medios posteriores si el modo demuestra interés.

## Reglas competitivas

- Puntuación máxima de 100 puntos.
- Cada prueba puntúa por acierto, precisión y velocidad cuando el formato lo permita.
- El tiempo de lectura de escenas, animaciones y transiciones no cuenta para la puntuación.
- Todos recorren la misma secuencia y no hay decisiones ramificadas que alteren las pruebas.
- Un fallo no bloquea el avance narrativo; reduce la puntuación y el jugador continúa.
- Las preguntas y el metapuzle deben poder resolverse sin conocimiento previo del documental.
- La revisión final muestra las respuestas, las explicaciones y los datos del cuaderno.

El peso exacto de cada prueba se cerrará al calibrar la dificultad. La prueba final puede tener un valor mayor por ser el cierre, pero no debe decidir por sí sola el ranking.

## Implementación prevista

La definición del desafío necesitará representar movimientos narrativos además de una lista plana de preguntas. Una forma inicial sería:

```ts
type NarrativeBeat = {
  id: string;
  title: string;
  intro: string;
  questionIds: QuestionId[];
};
```

La definición de `Encuentros en el fin del mundo` tendría `mode: "narrative"`, tres movimientos y ocho IDs de preguntas. El motor puede reutilizar la evaluación, puntuación, revisión y componentes de los formatos existentes. El trabajo específico del modo sería:

1. añadir el tipo de desafío narrativo y resolver sus movimientos;
2. mostrar escenas breves antes de cada movimiento;
3. mantener el estado del cuaderno durante la sesión;
4. añadir la prueba final que consume ese estado;
5. mostrar un epílogo fijo y los resultados competitivos.

No se implementarán en esta primera versión persistencia multijugador, ramas narrativas, audio, tiempo real ni formatos nuevos complejos.

## Criterios de aceptación

La primera versión estará lista para validación cuando:

- se pueda completar la jornada de principio a fin en una única sesión;
- la narración explique por qué aparece cada prueba;
- las escenas no interrumpan el ritmo ni consuman tiempo competitivo;
- el cuaderno participe realmente en la prueba final;
- la puntuación sea comparable con otros desafíos de 100 puntos;
- el desafío funcione sin conocer la película de Herzog;
- el final conserve el tono contemplativo y abierto del pingüino que continúa su camino.
