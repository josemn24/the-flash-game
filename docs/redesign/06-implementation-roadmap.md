# 06. Roadmap de implementación

## Estrategia

Se construirá primero un vertical slice aislado y reversible. La migración de los 31 formatos se
realiza después por variante y sin sustituir el tema global, una vez validada la nueva dirección.

El motor de sesión, scoring, validación, datos de preguntas y rutas actuales se consideran infraestructura estable. La primera intervención se concentra en presentación y datos mock sociales.

Las decisiones de producto aprobadas son: un único intento oficial sin práctica, rayos como XP de temporada, cinco invariantes de marca, seis familias de ilustración y validación social real separada de la prueba visual.

## Mapa actual relevante

| Responsabilidad | Implementación actual                    | Decisión                        |
| --------------- | ---------------------------------------- | ------------------------------- |
| Portada         | `app/page.tsx`, `StartScreen`            | Rediseñar como lobby            |
| Fondo           | `SpeedBackground`                        | Sustituir en tema Pop           |
| Introducción    | `ChallengeIntro` y variantes de modo     | Compactar y reutilizar lógica   |
| Juego           | `QuestionScreen`, `QuestionInput`        | Nueva composición, misma lógica |
| Respuestas      | `AnswerOption` y formatos especializados | Migrar primero elección/intruso |
| Feedback        | `QuestionTransition`                     | Hacer contextual para slice     |
| Resultado       | `ResultScreen`                           | Nueva jerarquía social          |
| Sesión          | `useGameSession`                         | Conservar                       |
| Puntuación      | `challengeScoring` y scoring por formato | Conservar                       |
| Movimiento      | Motion                                   | Conservar y normalizar          |
| Datos sociales  | No existen                               | Mock mediante adaptador         |

## Fase 0: baseline y contrato

Estado: **fase completada**. Soft Diorama es la base aprobada, el sistema tipográfico es Manrope + Fredoka + IBM Plex Mono, el baseline está archivado en `baseline/` y `/flash-pop` es la ruta aislada del vertical slice.

### Trabajo

- Aprobar esta documentación. **Completado.**
- Mantener archivadas las tres direcciones comparables y la justificación de Soft Diorama. **Completado.**
- Seleccionar tipografía con licencia. **Completado.**
- Capturar baseline móvil y escritorio de lobby, pregunta y resultado. **Completado.**
- Definir una ruta o flag de preview para Flash Pop. **Completado con `/flash-pop`.**

### Salida

- Decisiones visuales cerradas.
- Reglas de intento único y progreso de temporada reflejadas en flujo y copys.
- Comparativa before/after reproducible.
- Tema nuevo aislado del producto actual.

### Criterio de cierre

No quedan decisiones abiertas que cambien estructura, paleta o estilo de ilustración durante la implementación del slice.

## Fase 1: fundamentos

Estado: **fase completada**. El tema aislado, las primitivas públicas, el lobby consumidor y el laboratorio `/flash-pop/ui-kit` constituyen la base integrada de Flash Pop. El tema oscuro, scoring, sesiones y datos no se han migrado.

### Trabajo

- Añadir tokens Flash Pop. **Completado.**
- Crear canvas y patrón claro. **Completado.**
- Incorporar tipografía aprobada. **Completado.**
- Crear primitivas de botón, chip, avatar, card y timer. **Completado.**
- Crear documentación de estados en una página de desarrollo. **Completado con `/flash-pop/ui-kit`.**
- Migrar el lobby aislado para consumir exclusivamente las primitivas públicas. **Completado.**
- Compartir la lógica de cuenta atrás sin alterar el timer oscuro existente. **Completado.**

### Verificación

- Contraste automatizado y manual. **Completado para ocho combinaciones aprobadas.**
- Foco visible, hover, pressed, loading y disabled. **Completado.**
- 320, 390, 768 y 1440 px sin overflow horizontal. **Completado en lobby y laboratorio.**
- Reducción de movimiento. **Completado.**
- Regresión visual de `/` y una pregunta oscura. **Completado contra el baseline.**

### Criterio de cierre

Cumplido: las primitivas cubren sus estados sin depender de una pantalla concreta y el lobby no conserva implementaciones locales equivalentes.

## Fase 2: lobby

### Trabajo

- Crear adaptador social demo.
- Convertir la portada en lobby.
- Implementar hero challenge card.
- Agrupar desafíos cerrados en historial.
- Añadir progreso de temporada y actividad mock no interactiva.
- Representar los estados disponible, en progreso, completado y no completado sin ofrecer repetición.
- Mantener acceso a la biblioteca de formatos como enlace secundario.

### Impacto probable

- `app/page.tsx`.
- `components/game/shared/StartScreen/StartScreen.tsx` o nuevo `LobbyScreen`.
- Nuevos componentes visuales compartidos.
- Datos mock adyacentes a `demoRoom` o en un módulo de presentación separado.

### Criterio de cierre

- `Jugar ahora` aparece en el primer viewport móvil.
- El producto se entiende como juego social en una prueba rápida.
- El estado disponible, completado y cerrado funciona con datos mock.

## Fase 3: pregunta y feedback

### Trabajo

- Aplicar shell claro a una pregunta de Pirámide.
- Crear answer tiles físicos.
- Reorganizar cinco opciones como `2 + 2 + 1`.
- Sustituir transición global por feedback contextual.
- Añadir explicación correcta/incorrecta.
- Normalizar timer y progress rail.

### Impacto probable

- `QuestionScreen`.
- `AnswerOption`.
- Input de `OddOneOut` o elección múltiple.
- `QuestionTransition`.
- Estado de sesión si se necesita conservar feedback visible; cualquier cambio debe ser mínimo y cubierto por test.

### Criterio de cierre

- Correcta, incorrecta y timeout están implementados.
- La lógica de scoring produce los mismos resultados que antes.
- Teclado, lector de pantalla y reducción de movimiento siguen funcionando.

## Fase 4: resultado social

### Trabajo

- Crear result hero celebratorio.
- Añadir posición simulada y comparación humana.
- Añadir rayos de temporada y, si corresponde, un hito local de demo.
- Mantener precisión, tiempo y revisión debajo.
- Reflejar el estado completado al volver al lobby durante la misma sesión.

### Impacto probable

- `ResultScreen`.
- Adaptador social demo.
- Estado de presentación en memoria o `sessionStorage`, solo si se aprueba para el prototipo.

### Criterio de cierre

- Score, posición y rayos de temporada aparecen sin scroll.
- El jugador puede abrir clasificación, revisar respuestas o volver al lobby, pero no repetir.
- La celebración no bloquea la navegación.

## Fase 5: prueba y decisión

### Prueba A: comprensión y dirección visual

Cinco a ocho participantes que no hayan visto el rediseño. Tareas:

1. Explicar qué creen que es la aplicación.
2. Encontrar y jugar el reto disponible.
3. Interpretar un acierto, un fallo y un timeout.
4. Explicar su resultado y posición.
5. Elegir qué harían después.

Esta prueba puede usar datos simulados y valida jerarquía, comprensión, accesibilidad, dirección artística y percepción inicial de juego social. No valida retención ni valor social.

### Prueba B: valor social real

Antes de extender Flash Pop a todos los formatos, grupos reales de tres a cinco personas usan el reto durante siete días. Nombres, intentos, puntuaciones y posiciones deben corresponder a personas reales, aunque el prototipo se opere con infraestructura temporal o controlada.

Se observa:

- Retorno al siguiente reto.
- Confianza en la clasificación de intento único.
- Efecto emocional de superar o ser superado por una persona conocida.
- Utilidad de la actividad del grupo.
- Deseo de comparar o compartir.
- Comprensión y valor de los rayos de temporada.

### Preguntas de decisión

- ¿La nueva estética sigue pareciendo The Flash?
- ¿La capa social resulta útil o decorativa?
- ¿La ilustración mejora comprensión o solo ocupa espacio?
- ¿Los rayos se entienden como progreso de temporada y motivan sin parecer moneda o energía?
- ¿El ritmo sigue siendo rápido?
- ¿El intento único se percibe como claro y justo?

### Salidas posibles

- Aprobar y extender solo cuando la prueba visual y la prueba social real hayan superado sus criterios.
- Ajustar dirección y repetir slice.
- Mantener el loop visual pero retirar módulos sociales que no aporten.

## Fase 6: extensión posterior

Orden recomendado si se aprueba el slice:

1. Flash clásico y Supervivencia.
2. Mapa completo de Pirámide.
3. Alfabeto y Narrativa.
4. Revisión de respuestas.
5. Biblioteca de formatos — consolidada en `QuestionInput` con Flash Pop como presentación única;
   pendiente de QA manual exhaustivo.
6. Estados vacíos, errores y not-found.
7. Tema oscuro especial.
8. Backend social de producción cuando exista alcance de producto; la prueba social controlada ocurre antes de la extensión completa.

## Orden de componentes

```text
Button / IconButton
→ Avatar / AvatarStack
→ StatusChip / RewardChip
→ ChallengeHeroCard
→ Timer / ProgressRail
→ AnswerTile
→ FeedbackBanner
→ ResultHero
→ LobbyScreen
```

No se debe crear una abstracción universal antes de tener dos consumidores reales con estructura y comportamiento compartidos, siguiendo las convenciones existentes del repositorio.

## Riesgos y mitigaciones

| Riesgo                               | Mitigación                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| Parecer una copia de Playus          | Aplicar las cinco invariantes de marca y comprobar reconocimiento sin logotipo |
| Romper los formatos existentes       | Tema y componentes aislados; migración por formato                             |
| Prometer social sin backend          | Datos marcados como demo y módulos sin falsa interactividad                    |
| Confundir rayos con moneda o energía | Separar score y XP, mostrar progreso de nivel y evitar saldos ambiguos         |
| Explotar o reiniciar el intento      | Persistir y recuperar el mismo intento; reset exclusivo para desarrollo y QA   |
| Exceso de ruido                      | Un hero, un CTA y una recompensa principal por viewport                        |
| Contraste insuficiente del amarillo  | Amarillo como fondo con Ink, nunca texto pequeño sobre blanco                  |
| Animación lenta                      | Presupuesto de duración y acciones habilitadas antes de terminar partículas    |
| Aumentar bundle con arte             | Assets optimizados, carga diferida y placeholders                              |
| Duplicar componentes                 | Extraer solo tras dos usos equivalentes                                        |

## Quality gates

Antes de considerar terminado el slice:

- `npm run lint` sin errores.
- `npm test` sin regresiones.
- `npm run build` completado.
- Revisión visual en 320 × 568, 390 × 844, 768 × 1024 y 1440 × 900.
- Navegación completa por teclado.
- Lectura de estados con VoiceOver o lector equivalente.
- `prefers-reduced-motion` verificado.
- Sin overflow horizontal.
- Sin layout shift relevante al cargar arte.
- Contraste AA en texto y controles.
- Comparativa visual antes/después archivada.

## Definition of done del vertical slice

El vertical slice está terminado cuando:

1. El lobby presenta un reto jugable, progreso y presencia social demo.
2. El jugador completa al menos una pregunta con feedback contextual.
3. El resultado muestra score, posición y rayos de temporada como valores distintos.
4. Regresar al lobby refleja el reto completado durante la sesión.
5. Reabrir el reto continúa el intento o muestra su resultado; nunca crea un segundo intento.
6. Toda la lógica de juego y puntuación sigue siendo correcta.
7. Accesibilidad, responsive y reducción de movimiento pasan sus quality gates.
8. Una prueba cualitativa confirma que el producto se percibe como juego social y no como landing o examen.

La extensión a todos los formatos requiere además la prueba social real; no forma parte de la Definition of done técnica del primer slice.

## Estado del primer corte Flash Pop

El primer corte se integra sin feature flag en `/` y en el desafío Flash piloto
`/desafios/tabarnia-flash-01`. El lobby consume los resúmenes de `demoRoom`,
mantiene la disponibilidad de temporada y expone el piloto mediante `openable`.
La sesión, el scoring, la persistencia, el feedback, el resultado y la revisión
siguen siendo los contratos existentes.

Todos los modos publicados ya enrutan sus desafíos por shells Flash Pop. Narrativa
conserva una presentación inmersiva propia para escenas, imágenes y capítulos,
pero comparte con Flash Pop el chrome, las superficies, los estados de interacción,
el feedback, los resultados y la revisión; no incluye cuaderno interactivo. Los 31
formatos de la biblioteca también disponen de presentación `flash-pop`; esta
migración no implica que todos formen parte de los desafíos publicados ni del
shell social completo.

## Próximo hito ejecutable

La migración de los 31 formatos ya está integrada en `QuestionInput` con Flash Pop como sistema
visual único. El siguiente hito es cerrar la revisión manual de la Fase 4 —interacción exhaustiva,
VoiceOver y `prefers-reduced-motion`— y resolver o aceptar explícitamente las incidencias
registradas en [`../qa-fase-4.md`](../qa-fase-4.md).
