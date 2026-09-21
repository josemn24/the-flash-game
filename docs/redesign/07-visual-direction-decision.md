# 07. Decisión de dirección visual

## Estado

- Fecha de decisión: 29 de agosto de 2026.
- Pantalla comparada: lobby móvil de 390 × 844 px.
- Ruta de revisión: `/flash-pop-concepts`.
- Dirección seleccionada: **B · Soft Diorama**.

## Método

Las tres propuestas utilizan exactamente el mismo contenido, jerarquía y dimensiones. Solo cambian arte hero, geometría, profundidad e intensidad visual. Esto permite evaluar la dirección artística sin atribuir a una variante ventajas producidas por otro copy o layout.

## Propuestas

### A · Graphic Voltage

- Diorama 2.5D de formas geométricas con contornos Ink.
- Fondo cálido y composición gráfica limpia.
- Rayo como gesto estructural, no como decoración secundaria.
- Bordes más presentes, sombras físicas cortas y cortes diagonales localizados.
- Mantiene la energía competitiva de The Flash dentro de una interfaz clara y casual.

Ofrece el mayor reconocimiento gráfico de marca, pero no se selecciona como dirección principal porque mantiene demasiada rigidez editorial y transmite menos calidez social. Se conserva como referencia para contornos, iconografía competitiva y composiciones de información más densas.

### B · Soft Diorama — seleccionada

- Mayor volumen, suavidad y profundidad atmosférica.
- Sensación más social, amable y próxima a Playus.
- Excelente lectura inmediata del objeto hero.
- Materiales suaves, geometría redondeada y energía Flash claramente visible.

Es la dirección que mejor expresa el cambio buscado: el producto se reconoce como juego casual y deseable desde el primer segundo, resulta más cercano a Playus y genera mayor contraste emocional con la interfaz anterior. La identidad propia se protege mediante el amarillo eléctrico, el rayo, Ink como ancla, la tipografía competitiva localizada y una geometría diagonal consistente.

### C · Electric Arena

- Mayor contraste, dramatismo y sensación competitiva.
- Conserva con fuerza el Ink, el rayo y el carácter arcade.
- Ofrece una expresión útil para boss, final de temporada y eventos especiales.

No se selecciona como base porque el arte vuelve a dominar la experiencia y acerca el producto a la dirección oscura anterior. Se reserva como variante de intensidad para momentos excepcionales.

## Contrato visual resultante

La implementación del lobby usa Soft Diorama con estas reglas:

1. Canvas crema, Surface blanco, Ink estructural y Flash como acción y progreso.
2. Diorama 2.5D de volúmenes redondeados, materiales satinados controlados, luz suave y un único recorrido de energía Flash.
3. Borde fuerte en CTA y controles competitivos; hero y superficies sociales usan bordes sutiles para conservar suavidad.
4. Sombras suaves y amplias en hero; sombras físicas cortas en controles táctiles.
5. El corte diagonal aparece en energía, progreso o CTA como firma secundaria, sin endurecer todas las tarjetas.
6. Violeta para presencia social y navegación; Gold para hitos; ninguno compite con el CTA Flash.
7. Ink aparece en texto, bases, iconos y pequeños anclajes para evitar una estética pastel genérica.
8. No se añaden caras a los objetos, mascotas infantiles, brillo plástico excesivo ni fondos violetas universales.
9. Los momentos especiales pueden adoptar la intensidad de Electric Arena sin cambiar la arquitectura general.

## Activos de formatos

- `public/flash-pop/concepts/flash-floating-cards.webp`
- `public/flash-pop/concepts/alphabet-letter-path.webp`
- `public/flash-pop/concepts/survival-last-beacon.webp`
- `public/flash-pop/concepts/narrative-story-trail.webp`
- `public/flash-pop/concepts/pyramid-soft-diorama.webp`

Cada formato tiene un único arte reutilizable en tarjetas y pantallas del lobby. La Pirámide conserva exclusivamente `pyramid-soft-diorama.webp`; el resto de variantes de exploración se retiraron del directorio.

## Consecuencia para el roadmap

La decisión de ilustración requerida por la fase 0 queda cerrada. El siguiente hito es aplicar Soft Diorama al tema Flash Pop y construir el lobby estático responsive con datos demo, sin modificar todavía el flujo real de preguntas.
