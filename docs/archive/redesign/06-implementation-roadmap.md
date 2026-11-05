# 06. Resumen del rediseño Flash Pop

> Estado: histórico. Resumen del roadmap de implementación ya integrado. Los criterios y
> experimentos siguientes conservan su contexto original; no acreditan nuevas verificaciones.
> Las capacidades actuales están en [estado actual](../../current/status.md).

## Resultado integrado y referencias

La entrega incorporó Flash Pop al lobby, preguntas, feedback, resultados y revisión, y a los
31 formatos de la biblioteca. Narrativa conservó su presentación inmersiva y compartió las
superficies y estados comunes. La migración visual mantuvo los contratos de sesión y scoring;
no demuestra por sí misma comprensión, retención ni valor social.

El [design system vigente](../../current/design-system.md) y los
[tokens](../../current/design-tokens.md) describen componentes, accesibilidad y mantenimiento.
Las decisiones de [dirección visual](07-visual-direction-decision.md),
[tipografía](08-typography-decision.md) y las [capturas anteriores](baseline/README.md)
conservan el contexto del rediseño. El [informe de Fase 4](qa-fase-4.md) registra su ejecución
histórica; [QA actual](../../current/qa.md) define las comprobaciones para nuevas entregas.

## Criterios técnicos y de accesibilidad

El roadmap exigía comprobar:

- Lobby, pregunta, feedback y resultado legibles en 320 × 568, 390 × 844, 768 × 1024 y 1440 × 900.
- Navegación completa por teclado, foco visible, lectura de estados con VoiceOver o lector equivalente
  y objetivos táctiles adecuados; la matriz de QA histórica utiliza 44 × 44 px.
- Contraste AA, información independiente del color y alternativas con `prefers-reduced-motion`.
- Ausencia de overflow horizontal y de cambios de layout al cargar arte o medios.
- Animaciones y celebraciones que no bloqueen acciones, navegación ni lectura del resultado.
- Continuidad del intento único: volver al lobby refleja el resultado y reabrir conserva el intento.
- Flash Points entendidos como puntuación y total de temporada, sin presentarlos como moneda o energía.
- Regresión de sesión y scoring, controles automatizados y comparación visual antes/después.

Son criterios del diseño original. El informe de Fase 4 dejó fuera la interacción exhaustiva de
todos los formatos, VoiceOver completo y la activación forzada de movimiento reducido; este
resumen no los da por verificados.

## Propuestas históricas de validación

Estas propuestas no tienen aquí resultados que acrediten su realización ni sustituyen el
[ciclo Lean activo](../../product/strategy/lean-startup/STATE.md).

### Comprensión y dirección visual

Se propuso observar a cinco a ocho participantes que no hubieran visto el rediseño: explicar qué
es la aplicación, encontrar y jugar el reto, interpretar acierto/fallo/timeout, explicar resultado
y posición, y elegir qué hacer después. Podían usarse datos simulados para estudiar jerarquía,
comprensión, accesibilidad, dirección artística y percepción inicial. Esa prueba no medía retención
ni valor social real.

### Valor social real

Se propuso que grupos reales de tres a cinco personas usaran el reto durante siete días, con
nombres, intentos, puntuaciones y posiciones de personas reales. Las observaciones previstas eran
retorno al siguiente reto, confianza en la clasificación de intento único, reacción a superar o
ser superado, utilidad de la actividad del grupo, comparación o compartición y comprensión del
total de Flash Points.

Las preguntas de decisión incluían reconocimiento de The Flash, utilidad de la capa social,
aportación de la ilustración, claridad de los puntos, ritmo y justicia del intento único.
Las salidas propuestas eran aprobar la extensión tras superar ambas pruebas, ajustar y repetir,
o conservar la experiencia visual retirando módulos sociales sin valor. La integración técnica
posterior no acredita que esas condiciones experimentales se cumplieran.
