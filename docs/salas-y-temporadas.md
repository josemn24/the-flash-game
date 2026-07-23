# Salas y temporadas

## Propósito

Este documento describe el loop social y competitivo principal previsto para The Flash. La idea base es que un usuario cree una sala privada, invite a sus amigos y todos compitan durante una temporada mediante desafíos periódicos jugados de forma asíncrona.

No describe alcance comprometido ni sustituye al catálogo de modos. Los modos definen las reglas de cada desafío; este documento define cómo se organizan esos desafíos dentro de una sala a lo largo del tiempo.

## Modelo principal

```text
Sala -> Temporada -> Desafío periódico -> Modo de juego -> Ranking del desafío -> Ranking de temporada
```

La sala es el grupo social. La temporada es el ciclo competitivo. Cada desafío es un juego concreto publicado en la sala cada día o cada X días. Cada desafío usa un modo de juego, genera un ranking puntual y suma puntos al ranking acumulado de temporada.

## Conceptos

- **Sala:** grupo privado creado por un usuario para competir con amigos invitados.
- **Jugador:** usuario que pertenece a una sala y participa en sus desafíos.
- **Temporada:** ciclo competitivo con inicio, fin y ranking acumulado.
- **Desafío:** juego periódico publicado dentro de una temporada.
- **Modo:** reglas del desafío concreto, como Flash, Cadena, Supervivencia, Predicción o Narrativo competitivo.
- **Ranking del desafío:** clasificación puntual de un desafío concreto.
- **Ranking de temporada:** suma acumulada de puntos obtenidos en los desafíos de la temporada.

## Flujo previsto

```text
Crear sala
-> Invitar amigos
-> Iniciar temporada
-> Publicar desafío periódico
-> Cada jugador juega cuando pueda
-> Calcular ranking del desafío
-> Sumar puntos al ranking de temporada
-> Cerrar temporada
-> Declarar ganador
```

El ranking importante es el de temporada, porque da continuidad a la sala. El ranking de cada desafío sirve para comparar un juego concreto y para alimentar la puntuación acumulada.

## Ejemplo

```text
Sala: Amigos de la uni
Temporada: Julio

Día 1: Flash - Cultura general
Día 2: Cadena - Matemáticas rápidas
Día 3: Narrativo competitivo - Apagón en la ciudad
Día 4: Supervivencia - Ciencia
Día 5: Predicción - Datos y tendencias

Ranking de temporada:
1. Ana - 8.420 puntos
2. Luis - 7.980 puntos
3. Marta - 7.510 puntos
```

En este ejemplo, cada día publica un desafío diferente. Todos los jugadores reciben el mismo reto o uno equivalente, lo completan cuando pueden y sus puntos se suman al total de la temporada.

## Decisiones de producto

- **Prioridad inicial: asíncrono.** Los jugadores no necesitan coincidir en tiempo real.
- **Tiempo real queda para más adelante.** Requiere sincronización, presencia, latencia, desconexiones y estado compartido en vivo.
- **Base social: todos contra todos.** Cada jugador compite individualmente contra los demás miembros de la sala.
- **Duelo es una sala de dos jugadores.** No necesita reglas propias al principio.
- **Equipos queda como variante posterior.** Requiere grupos equilibrados o reglas para salas con número impar de jugadores.
- **Ranking principal: temporada.** Los desafíos tienen ranking propio, pero la competición de fondo es el acumulado de temporada.

## Modos más alineados

Estos modos encajan bien como desafíos periódicos asíncronos dentro de una temporada:

- Flash / Contrarreloj.
- Supervivencia.
- Cadena.
- Apuesta de confianza.
- Predicción.
- Narrativo competitivo.
- Orden y conexión.

Todos ellos permiten comparar jugadores de forma individual sin exigir turnos, equipos o presencia simultánea.

## Líneas posteriores

Estas líneas pueden tener valor, pero deberían esperar hasta validar el loop básico de sala, desafío periódico y temporada:

- Equipos.
- Cooperativo.
- Constructor.
- Conquista.
- Creador de retos.
- Debate.
- Tiempo real.

Estas variantes añaden complejidad de coordinación, contenido, persistencia, moderación, balance o sincronización. Conviene incorporarlas solo cuando el modelo asíncrono todos contra todos tenga señales claras de repetición y participación.
