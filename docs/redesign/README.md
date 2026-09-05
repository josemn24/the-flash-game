# Rediseño Flash Pop

Esta carpeta define la evolución de The Flash hacia una experiencia más alegre, social, casual y cercana. El objetivo no es replicar Playus, sino conservar la velocidad, el rayo y la competición de The Flash dentro de un producto que se reconozca como juego desde el primer segundo.

## Estado

- Estado de la especificación: fases 0 y 1 cerradas; dirección visual, tipografía, baseline, tema aislado, primitivas y laboratorio vivo aprobados. El vertical slice de la Fase 2 incluye el lobby y las dos previews de La Pirámide.
- Alcance de validación: lobby, pregunta, feedback, resultado y persistencia de intento único.
- Plataforma inicial: web responsive, con prioridad móvil.
- Resolución de referencia móvil: 390 × 844 px.
- Resolución de referencia de escritorio: 1440 × 900 px.

## Documentos

1. [`01-product-vision.md`](01-product-vision.md): problema, visión, principios y alcance.
2. [`02-art-direction.md`](02-art-direction.md): lenguaje visual Flash Pop.
3. [`03-design-system.md`](03-design-system.md): tokens, componentes y reglas de accesibilidad.
4. [`04-screen-blueprints.md`](04-screen-blueprints.md): arquitectura y especificación del vertical slice.
5. [`05-game-feel.md`](05-game-feel.md): movimiento, feedback, sonido y háptica.
6. [`06-implementation-roadmap.md`](06-implementation-roadmap.md): fases, impacto técnico y criterios de aceptación.
7. [`07-visual-direction-decision.md`](07-visual-direction-decision.md): propuestas comparadas y dirección visual seleccionada.
8. [`08-typography-decision.md`](08-typography-decision.md): familias aprobadas, responsabilidades y reglas de uso.
9. [`baseline/README.md`](baseline/README.md): capturas reproducibles del producto anterior a Flash Pop.

## Implementación disponible

- `/flash-pop`: shell responsive aislado, ya construido con las primitivas públicas.
- `/flash-pop/desafios/tabarnia-challenge-05`: preview principal de La Pirámide.
- `/flash-pop/desafios/tabarnia-challenge-06`: preview secundaria de La Pirámide: Biblia y religiones abrahámicas, con los siete formatos adaptados a Flash Pop.
- `/flash-pop/ui-kit`: documentación viva de tokens, variantes, estados y comportamiento responsive; no está enlazada desde la navegación de producto.
- `components/ui/index.ts`: única entrada pública del sistema.
- `features/game/useCountdown.ts`: lógica temporal compartida por el timer oscuro y `Timer`.

## Decisión central

> The Flash debe dejar de presentar una colección de pruebas y empezar a presentar un mundo habitado al que apetece volver.

El contrato aprobado para Flash Pop añade cinco decisiones:

- Cada reto concede un único intento oficial. No existe repetición ni modo práctica para el jugador.
- Los rayos son progreso de temporada, no moneda, energía ni puntuación de partida.
- La identidad se apoya en color Flash, geometría diagonal, tipografía competitiva localizada, movimiento direccional y dioramas 2.5D eléctricos.
- Los veinticinco formatos se agrupan en seis familias visuales para compartir un sistema de ilustración escalable.
- Los datos simulados validan comprensión y dirección visual; el valor social solo se valida con grupos y resultados reales.

El rediseño conserva el motor actual de desafíos y formatos. La primera entrega usa datos sociales simulados porque el producto sigue siendo frontend, sin usuarios, persistencia ni backend. La arquitectura visual no debe prometer interacciones sociales que todavía no existen: los elementos simulados estarán identificados como demo durante desarrollo. Superar la prueba del vertical slice no valida por sí solo retención, rivalidad o deseo de volver; esas hipótesis requieren una prueba posterior con personas y resultados reales.

## Cómo usar esta especificación

- Las decisiones marcadas como **obligatorias** forman el contrato del vertical slice.
- Las marcadas como **posteriores** no bloquean la primera validación.
- Si una decisión de implementación contradice esta documentación, debe registrarse y actualizarse aquí.
- El vertical slice se valida antes de migrar la biblioteca de formatos y el resto de modos.
