# 01. Visión de producto

## Resumen

The Flash funciona hoy como un sprint individual de preguntas con una dirección visual oscura, técnica y competitiva. Esa identidad comunica precisión y dificultad, pero no comunica con suficiente fuerza diversión, comunidad, recompensa ni variedad.

La evolución **Flash Pop** convierte el producto en un juego social asíncrono, táctil y expresivo. La interfaz debe invitar a jugar antes de explicar, mostrar personas antes que metadatos y celebrar el progreso antes de enseñar estadísticas.

## Diagnóstico actual

### Fortalezas que se conservan

- Loop de juego corto y fácil de entender.
- Veinticinco formatos ya modelados y varios modos de desafío.
- Puntuación que combina precisión y velocidad.
- Estados de introducción, juego, transición, resultado y revisión ya separados.
- Soporte responsive, teclado, reducción de movimiento y semántica accesible.
- Marca reconocible basada en el rayo y el amarillo eléctrico.
- Motion ya integrado para transiciones y microinteracciones.

### Fricciones observadas

- La portada se comporta como una landing editorial, no como un lobby de juego.
- El manifiesto ocupa el primer impacto mientras la acción principal queda más abajo.
- Se presentan nueve publicaciones con el mismo peso; muchas están cerradas o bloqueadas.
- El fondo oscuro, la cuadrícula y el texto condensado podrían pertenecer a deporte, tecnología, música o automoción.
- La mayoría de desafíos se representan solo mediante texto; cuesta anticipar cómo se sentirán.
- Los estados secundarios tienen contraste débil y pueden confundirse con contenido deshabilitado.
- La progresión se expresa mediante números y etiquetas, no mediante recompensas o deseo de avance.
- El feedback entre preguntas es funcional, pero breve y poco celebratorio.
- El resultado prioriza estadísticas individuales; no contextualiza la actuación frente a otras personas.
- El modelo social está documentado, pero todavía no aparece en la experiencia visible.

## Visión objetivo

The Flash será el lugar en el que un grupo de amigos entra cada día para resolver el mismo reto, comparar resultados y mantener viva una temporada. Cada visita debe responder inmediatamente a cuatro preguntas:

1. ¿Qué puedo jugar ahora?
2. ¿Quién de mi grupo ya ha jugado?
3. ¿Qué puedo ganar o desbloquear?
4. ¿Cómo voy respecto a los demás?

## Decisiones de producto aprobadas

### Un único intento oficial

- Cada jugador dispone de un solo intento por reto.
- El intento comienza al presentarse la primera pregunta, no al pulsar el CTA de preparación.
- Una interrupción recupera el mismo intento; nunca crea otro.
- Al completar el reto, el jugador puede consultar resultado, clasificación y revisión, pero no repetir ni practicar.
- Si el reto expira sin completarse, queda como `No completado`.
- Los resets solo existen como herramienta interna de desarrollo y QA.

### Rayos como progreso de temporada

- La puntuación representa el rendimiento en una partida.
- Los rayos representan XP y avance de temporada.
- Completar el intento oficial concede rayos una sola vez: una base por finalizar y un bonus por rendimiento y velocidad, hasta el máximo anunciado.
- Los rayos no se gastan, no son vidas y no limitan el acceso al reto diario.
- Sus hitos pueden desbloquear títulos, marcos, celebraciones y formatos bonus, pero no una economía artificial.

### Identidad, ilustración y validación

- Flash Pop debe reconocerse sin depender del logotipo mediante sus invariantes visuales.
- Los veinticinco formatos comparten seis familias visuales; no se producen veinticinco universos independientes.
- Los mocks sociales solo validan comprensión, jerarquía y percepción inicial.
- Retención, confianza, rivalidad y valor social requieren una prueba posterior con grupos y resultados reales.

## Promesa emocional

> Un reto rápido que compartes con tu gente y que siempre termina con algo que celebrar, comentar o recordar al día siguiente.

## Atributos de marca

| Atributo    | Debe sentirse como                    | No debe sentirse como   |
| ----------- | ------------------------------------- | ----------------------- |
| Alegre      | Color, sorpresa y reacciones          | Infantil o estridente   |
| Social      | Presencia humana y comparación amable | Red social genérica     |
| Casual      | Entrada inmediata y lenguaje sencillo | Experiencia superficial |
| Cercana     | Copys conversacionales y rostros      | Tono corporativo        |
| Rápida      | Decisiones claras y animación ágil    | Interfaz ansiosa        |
| Competitiva | Récords, posiciones y remontadas      | Castigo o humillación   |

## Principios de experiencia

### 1. Primero jugar, después explicar

La acción disponible debe aparecer en el primer viewport. Las reglas extensas se muestran bajo demanda o justo antes de ser necesarias.

### 2. Cada desafío tiene una fantasía

Una modalidad no es solo una etiqueta. Tiene imagen, color, personalidad y una expectativa jugable reconocible.

### 3. Siempre hay alguien más

Avatares, posiciones y actividad reciente hacen visible la sala incluso cuando el juego es asíncrono.

### 4. Cada acción responde

Pulsar, acertar, fallar, subir de nivel y terminar deben producir respuestas visuales claras. El feedback no puede depender solo del color.

### 5. El progreso debe generar deseo

La interfaz muestra el siguiente hito, su recompensa y la distancia restante. Un nivel bloqueado explica cómo se abre.

### 6. Profundidad con jerarquía

Las sombras y capas indican interacción y prioridad. No todos los elementos flotan ni compiten por estar delante.

### 7. Identidad antes que imitación

Se adopta la calidez y expresividad de los juegos casuales, pero se conserva el amarillo eléctrico, el rayo y la idea de velocidad como firma propia.

## Usuario y contexto principal

- Persona que juega desde móvil durante 2–5 minutos.
- Participa en una sala privada con amigos, familia o compañeros.
- Entra por una notificación o por hábito diario.
- Quiere entender el reto sin leer instrucciones largas.
- Valora ganar, pero también comentar el resultado y ver qué hicieron los demás.

## Loop objetivo

```text
Entrar al lobby
→ ver el reto destacado y la actividad del grupo
→ jugar
→ recibir feedback durante la partida
→ descubrir el resultado relativo
→ reaccionar, compartir o revisar
→ ver el próximo hito
→ volver al lobby
```

## Alcance del vertical slice

El primer corte debe demostrar el nuevo lenguaje con un recorrido completo:

1. Lobby con reto destacado, presencia social y progreso.
2. Introducción ligera integrada en la tarjeta del reto.
3. Una pregunta de elección o intruso.
4. Feedback correcto, incorrecto y timeout.
5. Resultado con puntuación, posición relativa y rayos de temporada.
6. Regreso al lobby con el estado actualizado en memoria.

### Fuera del primer corte

- Autenticación real.
- Backend o persistencia remota.
- Invitaciones funcionales.
- Chat o mensajería.
- Multijugador en tiempo real.
- Migración de los veinticinco formatos.
- Economía monetizada.
- Personalización completa del avatar.
- Repetición o modo práctica del reto completado.

## Hipótesis a validar

- Una tarjeta ilustrada consigue que el usuario entienda el reto sin abrir una explicación.
- Mostrar avatares y posición aumenta la percepción de que el producto es un juego social.
- Un resultado celebratorio mejora la intención de compartir, comparar o volver al siguiente reto.
- Una superficie clara y táctil sigue siendo reconocible como The Flash si el amarillo y el rayo mantienen roles consistentes.
- La nueva densidad cabe en 390 × 844 px sin ocultar la acción principal.

## Señales de éxito

En una prueba moderada, una persona que no conoce el producto debería poder:

- Identificar en menos de cinco segundos qué puede jugar.
- Describir el producto como juego o reto con amigos.
- Iniciar la partida sin ayuda.
- Reconocer si acertó, falló o se quedó sin tiempo sin depender del texto.
- Entender su posición respecto al grupo al terminar.
- Diferenciar puntuación de partida y rayos de temporada.
- Señalar qué ocurrirá si vuelve al lobby.
