# 05. Game feel

## Propósito

El game feel convierte cambios de estado en sensaciones. El vertical slice debe demostrar que The Flash es más juguetón sin ralentizar un producto basado en velocidad.

## Principios

- Respuesta inmediata al contacto: menos de 100 ms.
- Animación corta durante el juego y más generosa en hitos.
- Una acción produce una reacción principal, no cinco efectos simultáneos.
- Movimiento, sonido y háptica cuentan la misma historia.
- Toda información sobrevive sin movimiento ni sonido.
- El error informa; no castiga visualmente al jugador.

## Escala de intensidad

| Nivel | Uso             | Duración orientativa | Recursos                        |
| ----- | --------------- | -------------------: | ------------------------------- |
| 0     | Estado estático |                 0 ms | Color, icono, copy              |
| 1     | Hover o press   |            80–160 ms | Desplazamiento, sombra          |
| 2     | Respuesta       |          450–1200 ms | Pulso, puntos, sonido corto     |
| 3     | Hito            |         1000–1800 ms | Partículas, escala, háptica     |
| 4     | Final o récord  |         1600–2500 ms | Secuencia celebratoria completa |

## Curvas y duraciones

```text
press-in       90 ms    ease-out
press-out      140 ms   spring suave
card-enter     320 ms   cubic-bezier(.22, 1, .36, 1)
feedback       900 ms   por etapas
screen-exit    180 ms   ease-in
screen-enter   280 ms   ease-out
score-count    900 ms   ease-out
celebration    1800 ms  secuencia no bloqueante
```

Las springs no deben producir rebotes repetidos en texto o zonas de lectura.

## Interacciones base

### Press

- El control baja 3 px.
- La sombra se reduce.
- El borde mantiene posición para evitar layout shift.
- Háptica ligera en dispositivos compatibles, posterior al slice web inicial.

### Entrada de tarjeta

- Opacidad y desplazamiento vertical de 12 px.
- Las tarjetas secundarias entran con stagger máximo de 45 ms.
- El contenido no espera a que termine la animación para ser interactivo.

### Navegación

- Lobby → juego: la tarjeta hero crece o comparte color con el tablero.
- Pregunta → pregunta: el contenido se desplaza, pero cabecera y progreso permanecen estables.
- Juego → resultado: destello corto seguido de expansión del score.
- Resultado → lobby: la tarjeta hero muestra inmediatamente el estado completado.

## Feedback de respuesta

### Correcta

Secuencia:

1. Tile presionado.
2. Relleno Aqua y check.
3. Pulso de escala máximo 1.03.
4. Etiqueta `+N` viaja al contador.
5. Copy `¡Bien visto!`.
6. Continúa la partida.

Sonido sugerido: ataque corto, tonal y ascendente.

### Incorrecta

Secuencia:

1. Tile presionado.
2. Movimiento horizontal de 4–6 px, una sola vez.
3. Coral y cruz.
4. Respuesta correcta aparece en Aqua.
5. Explicación específica.
6. Continúa la partida.

Sonido sugerido: golpe suave descendente, sin buzzer agresivo.

### Timeout

Secuencia:

1. Timer pulsa en Coral durante los últimos 5 s por defecto.
2. Al llegar a cero, se congela.
3. Se revela la respuesta.
4. Copy `¡Se escapó por poco!`.
5. Continúa la partida.

No se oscurece toda la pantalla ni se introduce vibración prolongada.

### Parcial

- Sky como tono.
- Símbolo de aproximación.
- Puntos obtenidos visibles.
- Copy explica qué parte fue válida.

## Progreso y recompensas

### Rayos de temporada

- Se conceden una sola vez al terminar el intento oficial.
- El resultado separa visualmente score y rayos.
- El valor obtenido avanza la barra de temporada y muestra el siguiente hito.
- Los rayos no se gastan y nunca se representan como energía, vidas o intentos.
- No existe animación de recompensa asociada a repetir o practicar.

### Subida de nivel

- El nodo nuevo se ilumina.
- El avatar o rayo avanza hasta él.
- El mapa no ocupa toda la pantalla salvo en hitos.

### Recompensa

- El objeto aparece desde el centro con escala.
- El valor cuenta hacia arriba.
- Se muestra dónde se almacena o qué desbloquea.
- Si la recompensa es demo, no se simula una economía completa.

### Hito de temporada

- Corona, marco o rayo dorado según el hito.
- Confeti limitado a la zona superior.
- Comparación explícita entre el progreso anterior y el nuevo.
- La animación no se repite al volver desde revisión o clasificación.

## Resultado

Secuencia recomendada:

```text
0–250 ms      entrada del panel
250–1150 ms   score cuenta hasta el total
650–1350 ms   posición se actualiza
950–1700 ms   rayos e hito de temporada
1200 ms       acciones ya habilitadas
1700–2300 ms  partículas terminan
```

El usuario puede tocar las acciones desde 1200 ms; no debe esperar al final de las partículas.

Las acciones disponibles son clasificación, revisión y regreso al lobby. La celebración nunca termina en un CTA de repetición.

## Sonido

El vertical slice puede comenzar sin audio si no hay activos aprobados. Cuando se añada:

- Control global visible.
- Estado recordado localmente.
- Categorías: UI, respuesta, progreso y celebración.
- Sonidos de menos de 800 ms para acciones frecuentes.
- Mezcla sin picos molestos con auriculares.
- Ningún loop permanente en el lobby inicial.

## Háptica

Posterior para web, pero documentada para una futura envoltura móvil:

| Evento           | Patrón                       |
| ---------------- | ---------------------------- |
| Press primario   | Ligero                       |
| Correcta         | Éxito corto                  |
| Incorrecta       | Advertencia corta            |
| Últimos segundos | Un pulso, no uno por segundo |
| Hito temporada   | Éxito medio                  |

## Reducción de movimiento

Con `prefers-reduced-motion: reduce`:

- No hay desplazamientos entre pantallas.
- No hay puntos voladores ni confeti.
- Los contadores aparecen en su valor final.
- Press conserva cambio de color y sombra, sin traslación.
- El feedback mantiene icono, copy y duración suficiente.
- El timer no pulsa; cambia de icono y color.

## Rendimiento

- Animar preferentemente `transform` y `opacity`.
- Evitar blur animado de gran superficie.
- Partículas limitadas y desmontadas al terminar.
- Ilustraciones con dimensiones declaradas para evitar layout shift.
- Assets hero optimizados por densidad y formato.
- Objetivo: interacción disponible aunque la ilustración tarde en cargar; usar placeholder cromático coherente.

## Checklist del slice

- [ ] Todos los botones tienen press visible.
- [ ] Correcta, incorrecta y timeout se distinguen sin audio.
- [ ] El feedback no se pierde por avanzar demasiado rápido.
- [ ] Las acciones del resultado no quedan bloqueadas por la celebración.
- [ ] La reducción de movimiento conserva toda la información.
- [ ] No existe layout shift en respuestas o score.
- [ ] Las animaciones mantienen 60 fps en un móvil medio de referencia.
- [ ] Completar o reabrir un reto nunca ofrece repetir, practicar o reiniciar.
