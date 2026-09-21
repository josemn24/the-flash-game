# 08. Decisión tipográfica

## Estado

- Fecha de decisión: 29 de agosto de 2026.
- Ruta de revisión: `/flash-pop-typography`.
- Dirección visual de referencia: **Soft Diorama**.
- Sistema seleccionado: **Manrope + Fredoka + IBM Plex Mono**.
- Alternativa descartada como display principal: Bricolage Grotesque.

## Método

La comparación utiliza dos copias del mismo lobby de 390 × 844 px. Contenido, arte, viewport, tamaños, peso 700, tracking, composición y espaciado son idénticos. Solo cambia la familia display entre Bricolage Grotesque y Fredoka.

Manrope y IBM Plex Mono permanecen fijas en ambas variantes para evitar atribuir a la fuente display diferencias creadas por el resto del sistema.

## Decisión

### Manrope · interfaz principal

Es la tipografía funcional de Flash Pop. Se usa en navegación, botones, instrucciones, tarjetas, perfiles, actividad social, ajustes, formularios y textos de lectura.

Se selecciona porque mantiene claridad, madurez y consistencia cuando la interfaz acumula información. Debe representar aproximadamente el 70–80 % del texto visible.

### Fredoka · voz de marca

Se utiliza en nombres de retos, presentación de juegos, titulares protagonistas, resultados, hitos, desbloqueos y mensajes celebratorios.

Se selecciona frente a Bricolage Grotesque porque su construcción redondeada acompaña mejor Soft Diorama y hace que el producto se perciba como juego casual, social y cercano. No sustituye a Manrope: aporta reconocimiento y emoción en momentos seleccionados sin convertir toda la interfaz en infantil.

Reglas obligatorias:

1. Textos breves, normalmente de menos de 35 caracteres.
2. Tamaño habitual desde 24 px.
3. Peso entre 650 y 700; 700 es el valor de referencia.
4. Máximo uno o dos elementos Fredoka por pantalla.
5. Sentence case por defecto; se evitan párrafos y bloques completos en mayúsculas.
6. No se usa en navegación, formularios, texto explicativo ni datos cambiantes.

### IBM Plex Mono · dato competitivo

Se reserva para temporizadores, puntuaciones, posiciones, niveles, progreso cuantificado y metadatos de sistema que se beneficien de anchura estable.

Se usa en peso 600–700 y con números tabulares cuando el valor cambia durante la partida. No debe extenderse a etiquetas ordinarias para simular una estética técnica.

## Por qué no Bricolage Grotesque

Bricolage ofrece más tensión editorial y conserva mejor la dureza competitiva del The Flash actual. Sin embargo, su personalidad se solapa con la dirección anterior y acompaña peor la suavidad, calidez y sociabilidad buscadas en Flash Pop.

Se conserva únicamente como referencia de exploración; no forma parte del sistema de producción aprobado.

## Implementación

- Las tres familias se incorporarán mediante `next/font` para servirlas localmente desde la aplicación.
- Los componentes consumirán roles semánticos —UI, display y mono— en lugar de nombres de familia directos.
- La carga y el fallback deben evitar layout shift relevante.
- La interfaz debe continuar siendo legible si Fredoka no está disponible; Manrope actúa como fallback funcional.

## Consecuencia para el roadmap

La decisión tipográfica requerida por la fase 0 queda cerrada. El baseline móvil y de escritorio está archivado y `/flash-pop` actúa como ruta aislada del vertical slice. El siguiente hito es la fase 1: consolidar tokens Flash Pop y primitivas de interfaz.
