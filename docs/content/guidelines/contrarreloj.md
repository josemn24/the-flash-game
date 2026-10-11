> Estado: propuesta. Guía editorial previa a la implementación de Contrarreloj; sus criterios de
> calibración deben validarse antes de publicar desafíos del modo.

# Guía editorial de Contrarreloj

Última actualización: 2026-10-11.

## Objetivo y fuentes

Preparar secuencias de pruebas que exijan pensar con un único presupuesto de tiempo y permitan
comparar cuántas resuelve cada jugador. La [especificación funcional](../../current/domain/contrarreloj.md)
y las [reglas acordadas](../../decisions/decisions.md#21-contrarreloj-reglas-acordadas) definen el modo.
Esta guía propone criterios para autoría y calibración; no habilita formatos ni fija tiempos o límites.

Cada desafío mantiene un solo formato, una secuencia finita y ordenada, y las mismas versiones para
todos los participantes. La dificultad debe crecer por razonamiento requerido, no solo por aumentar
el tablero. Las pruebas pueden reutilizar versiones de la biblioteca editorial cuando encajen en
la progresión y tengan soporte competitivo verificado para Contrarreloj.

## Preparación de una secuencia

1. Elegir un formato adecuado y comprobar su contrato competitivo: respuesta válida, oportunidades
   internas, fallo definitivo, feedback y recuperación. Las decisiones abiertas de CT-02 y CT-04
   deben cerrarse antes de habilitarlo.
2. Seleccionar pruebas accesibles al inicio que permitan entender la interacción. Explicar las reglas
   en la introducción; no hacer depender la primera prueba de descubrir controles bajo el reloj.
3. Ordenar el contenido por dificultad observada. Justificar qué añade cada paso: deducciones,
   restricciones, dependencias, alternativas o planificación. Dos tableros del mismo tamaño pueden
   tener complejidades diferentes.
4. Verificar las soluciones, las pistas y el material público. El contenido visible debe ser suficiente
   para resolver, sin filtrar la solución privada ni depender de información ambigua.
5. Probar la secuencia completa con jugadores y dispositivos representativos. Ajustar pruebas,
   orden y duración a partir de lo observado.
6. Publicar una versión que congele contenido, orden, duración y reglas de puntuación aprobadas.
   Corregir contenido después exige el proceso común de versionado.

La ficha editorial debe recoger el motivo del orden, la habilidad ejercitada, el tiempo observado
por prueba, las dificultades de interacción y las decisiones pendientes. Son evidencias de autoría;
su inclusión aquí no crea campos obligatorios en la base de datos.

## Criterios por formato

| Formato candidato   | Cómo graduar dificultad                                                                                                                   | Qué revisar antes de habilitarlo                                                                                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Queens              | Pistas fijas, forma de regiones, restricciones entre filas/columnas y profundidad de deducción; tamaño solo cuando añada dificultad real. | Tablero y solución válidos, pistas coherentes, validación completa y definición de fallo definitivo. El 5% de penalización y el límite de Pirámide no se trasladan automáticamente.                      |
| Escape              | Dependencias entre bloques, movimientos preparatorios, obstáculos y anticipación de consecuencias.                                        | Posición inicial resoluble, reglas de movimiento claras y evaluación del recorrido. Un movimiento reversible o una ruta larga no equivalen por sí solos a terminar la partida.                           |
| Conectar parejas    | Distribución de extremos, restricciones de cobertura y conflictos entre recorridos.                                                       | Reglas de conexión y tablero resoluble; distinguir exploración, borrado y respuesta terminal. Este formato es `connect-pairs`; no confundirlo con emparejar conceptos (`matching`).                      |
| Mini-Wordle         | Ambigüedad entre palabras posibles, información de cada intento y selección de soluciones dentro del vocabulario admitido.                | Palabra válida, diccionario y oportunidades permitidas, feedback coherente y agotamiento terminal de intentos. Una palabra incorrecta dentro de las oportunidades no termina automáticamente la partida. |
| Hashtag de palabras | Dependencias entre palabras cruzadas, letras compartidas y restricciones que exijan planificar swaps.                                     | Tablero resoluble, palabras privadas correctas y límites de movimientos según el contrato que se apruebe. Un swap exploratorio no debe confundirse con una evaluación terminal.                          |

La disponibilidad en práctica o en Flash no demuestra compatibilidad con este modo. Habilitar una
combinación requiere validar contenido, evaluación privada, eventos intermedios, cierre temporal,
recuperación, puntuación, editor y renderer competitivo. La terminación y las penalizaciones
existentes en otros modos deben revisarse frente a las reglas acordadas de Contrarreloj.

## Progresión y ejemplo de Queens

La progresión debe aumentar la exigencia sin saltos accidentales de dificultad. El objetivo es que
los primeros retos sean accesibles y que avanzar cada vez más requiera mayor razonamiento. Debe ser
posible completar toda la secuencia: la dificultad final no justifica publicar una prueba irresoluble.

Un orden ilustrativo sería:

| Paso | Descripción editorial                                                         |
| ---- | ----------------------------------------------------------------------------- |
| 1    | Queens 4×4 con pistas que faciliten deducciones directas.                     |
| 2    | Queens 5×5 que añada relaciones entre regiones.                               |
| 3    | Otro Queens 5×5 con menos pistas y deducciones encadenadas.                   |
| 4    | Queens 6×6 cuya mayor complejidad se haya confirmado con resoluciones reales. |

Este ejemplo no incluye tableros verificados ni fija cuatro pruebas o un tiempo concreto. La
admisión actual de Queens 4×4 a 8×8 tampoco aprueba extensiones de tamaño para el modo nuevo.

## Calibración del reloj global

Probar cada reto y después la secuencia completa. Registrar el tiempo de resolución hasta el último
acierto, cuántas pruebas se resuelven antes del límite, dónde aparecen fallos definitivos y cuándo
la interacción o la carga técnica consumen una parte relevante del presupuesto.

Elegir el tiempo total a partir de esas evidencias: debe ofrecer margen para pensar y generar
diferencias de progreso entre jugadores. La duración, el número máximo de pruebas y los umbrales de
calibración quedan pendientes en CT-03. Tampoco se fija un percentil de éxito obligatorio.

Revisar teclado, controles táctiles, legibilidad y disponibilidad de diccionario o assets. Preparar
recursos con antelación cuando el diseño técnico lo permita; las esperas y su posible compensación
deben seguir CT-04, sin introducir pausas o reinicios del reloj por decisión editorial.

## Puntuación y comparabilidad

Mantener el máximo común de 100 Flash Points. Completar la secuencia debe conceder los 100 y cada
acierto debe sumar puntos; el número de pruebas debe ser compatible con puntos enteros. La
[fórmula proporcional](../../current/domain/contrarreloj.md#puntuación-acuerdos-y-propuesta-pendiente)
es una propuesta CT-01, no una política ejecutable ni una distribución editorial ya aprobada.

Todos los participantes de una publicación deben jugar el mismo orden y contenido. La comparación
usa pruebas resueltas y después tiempo global hasta el último acierto. No introducir selección
aleatoria por jugador, rutas alternativas o dificultad adaptativa que alteren esa comparabilidad.
Los Flash Points se acumulan en el ranking de temporada de la sala.

## Revisión antes de publicar

- Un único formato en todas las pruebas y orden justificable por dificultad observada.
- Contenido y soluciones revisados; ninguna prueba irresoluble ni pista contradictoria.
- Introducción clara sobre reloj global, oportunidades internas y fallo definitivo.
- Duración calibrada con secuencias completas y controles cómodos en los dispositivos previstos.
- CT-01 a CT-05 cerradas para el alcance publicado y reflejadas en su contrato.
- Combinación modo/formato verificada desde el editor hasta la evaluación, recuperación y resultado.
- Versión inmutable con puntuación aprobada que alcance exactamente 100 al resolver todo.

Esta lista es un criterio para la publicación futura, no evidencia de que ya se haya publicado o
verificado un desafío de Contrarreloj. Las
[cuestiones abiertas](../../decisions/open-questions.md#contrarreloj-decisiones-pendientes)
conservan el estado de las decisiones necesarias.
