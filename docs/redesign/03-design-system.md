# 03. Sistema de diseño

## Objetivo

Este documento traduce Flash Pop a reglas implementables. Los nombres propuestos son conceptuales; la implementación puede adaptarlos a las convenciones existentes siempre que conserve sus roles.

## Tokens de color

```css
[data-theme="flash-pop"] {
  --color-canvas: #f4f1ea;
  --color-surface: #ffffff;
  --color-surface-raised: #fbfaf6;
  --color-surface-soft: #eae7ff;
  --color-ink: #171720;
  --color-ink-muted: #686872;
  --color-ink-faint: #94949c;

  --color-brand: #d7ff19;
  --color-social: #6957e8;
  --color-success: #0f766e;
  --color-danger: #ff7276;
  --color-info: #74a7f5;
  --color-reward: #ffd85a;

  --border-subtle: 1px solid rgb(23 23 32 / 12%);
  --border-flash: 1.5px solid rgb(23 23 32 / 36%);
  --border-action: 2px solid rgb(23 23 32 / 78%);
  --color-focus: #4d3bd1;
}
```

Los tokens están implementados bajo `data-theme="flash-pop"` y el layout de `/flash-pop`. En los formatos de preguntas, los overrides claros se activan de forma localizada mediante `data-variant="flash-pop"`; no sustituyen los estilos de `default` ni las variables globales. Esto permite migrar los 31 renderers sin alterar la apariencia legacy ni la lógica de juego.

### Contrato de variante en los formatos

`QuestionVariant` es el contrato opcional compartido por `QuestionInput` y todos los renderers:

```ts
type QuestionVariant = "default" | "flash-pop";
```

Cada root visual expone `data-variant`, con `default` como fallback cuando no se proporciona
la prop. La variante solo controla presentación: modelos de pregunta, callbacks, scoring,
respuestas parciales, bloqueo y timeouts deben permanecer iguales. Los overrides Flash Pop deben
estar siempre scoped bajo `[data-variant="flash-pop"]` y los colores propios de una mecánica
deben conservarse cuando tengan significado funcional.

## Economía visual: puntos y rayos

Los dos valores no son intercambiables:

| Valor      | Significado                    | Dónde aparece                            |
| ---------- | ------------------------------ | ---------------------------------------- |
| Puntos     | Rendimiento del intento actual | Juego, resultado y clasificación         |
| Rayos `⚡` | XP acumulada de la temporada   | Lobby, resultado y progreso de temporada |

- El intento oficial concede una base de 40 rayos por finalizar, hasta 60 por rendimiento y hasta 20 por velocidad.
- El máximo orientativo anunciado es `Hasta +120 ⚡`; el valor definitivo lo calcula un adaptador de presentación a partir del resultado canónico.
- Los rayos se conceden una sola vez y no se gastan.
- No se usa un contador como `⚡ 4`, porque puede interpretarse como energía o número de intentos.
- Durante las preguntas se muestran puntos o tiempo, nunca el saldo de rayos.

## Espaciado

Escala base de 4 px:

| Token      | Valor | Uso frecuente             |
| ---------- | ----: | ------------------------- |
| `space-1`  |  4 px | Separación interna mínima |
| `space-2`  |  8 px | Icono y etiqueta          |
| `space-3`  | 12 px | Elementos relacionados    |
| `space-4`  | 16 px | Padding compacto          |
| `space-5`  | 20 px | Padding móvil estándar    |
| `space-6`  | 24 px | Secciones internas        |
| `space-8`  | 32 px | Separación de bloques     |
| `space-10` | 40 px | Secciones principales     |
| `space-12` | 48 px | Ritmo de escritorio       |

Reglas:

- Gutters móviles: 16 px hasta 374 px y 20 px desde 375 px.
- Gutters tablet: 32 px.
- Ancho de lectura: máximo 680 px.
- Ancho del lobby: máximo 1120 px.
- Separación vertical entre tarjetas de feed: 16 px.
- Área táctil mínima: 44 × 44 px; objetivo preferido: 52 px.

## Radios

```text
radius-sm        8 px   teclas y detalles compactos
radius-control  10 px   inputs y botones
radius-card     14 px   tarjetas estándar
radius-hero      0 px   superficies principales y retos destacados
radius-pill     999 px  chips, contadores y avatares
```

La jerarquía visual es deliberadamente angular: las superficies principales no tienen radio, las
tarjetas usan un radio pequeño y las cápsulas quedan reservadas para estados compactos.

## Bordes y elevación

```text
border-subtle  1 px / 12 % ink
border-flash   1.5 px / 36 % ink
border-action  2 px / 78 % ink
border-state   2 px / color semántico

shadow-control  0 3px 0 rgb(23 23 32 / 0.18)
shadow-card     0 8px 22px rgb(35 30 70 / 0.12)
shadow-hero     0 18px 48px rgb(35 30 70 / 0.18)
shadow-dialog   0 28px 80px rgb(23 23 32 / 0.28)
```

Un control pulsado reduce su sombra y se desplaza verticalmente. La animación no puede provocar cambios de layout.

## Sistema tipográfico

| Familia       | Responsabilidad                                   | Uso aproximado |
| ------------- | ------------------------------------------------- | -------------: |
| Manrope       | Interfaz funcional, navegación y lectura          |        70–80 % |
| Fredoka       | Voz de marca, titulares y momentos emocionales    |        15–20 % |
| IBM Plex Mono | Tiempo, score, posición, nivel y datos de sistema |         5–10 % |

### Escala

| Rol              | Familia       | Móvil | Escritorio | Peso | Línea |
| ---------------- | ------------- | ----: | ---------: | ---: | ----: |
| Brand Display XL | Fredoka       | 48 px |      68 px |  700 |  0.95 |
| Brand Display    | Fredoka       | 36 px |      48 px |  700 |   1.0 |
| Screen H1        | Manrope       | 30 px |      40 px |  800 |  1.05 |
| H2               | Manrope       | 24 px |      30 px |  800 |   1.1 |
| H3               | Manrope       | 20 px |      24 px |  800 |  1.15 |
| Body             | Manrope       | 16 px |      17 px |  500 |   1.5 |
| Body strong      | Manrope       | 16 px |      17 px |  700 |   1.4 |
| Label            | Manrope       | 14 px |      14 px |  700 |  1.25 |
| Meta             | Manrope       | 13 px |      13 px |  650 |   1.3 |
| Timer / score    | IBM Plex Mono | 20 px |      22 px |  700 |     1 |

Fredoka se reserva para textos breves de alto impacto: nombres de retos, presentación de juegos, resultados, hitos y desbloqueos. Se usa normalmente desde 24 px, en peso 650–700 y con un máximo de uno o dos elementos por pantalla. No se usa en párrafos, navegación, formularios ni bloques densos.

IBM Plex Mono usa números tabulares cuando el dato cambia durante el juego. No se utiliza como recurso decorativo para sustituir a Manrope en etiquetas ordinarias.

No se usa `Arial Narrow` para cuerpo ni títulos principales del vertical slice. La decisión completa y su comparativa están registradas en `08-typography-decision.md`.

## Componentes base

Las primitivas de fundamentos se exportan desde `components/ui/index.ts`. Su documentación viva se encuentra en `/flash-pop/ui-kit`, una ruta de desarrollo que no aparece en la navegación pública.

| Primitiva      | Contrato público principal                                                               |
| -------------- | ---------------------------------------------------------------------------------------- |
| `Canvas`       | canvas claro, patrón, safe areas y ancho `wide \| content \| none`                       |
| `Button`       | `primary \| secondary`, `default \| hero`, iconos, ancho completo, loading y disabled    |
| `ButtonLink`   | mismo lenguaje visual para navegación                                                    |
| `IconButton`   | 48 × 48 px, etiqueta accesible obligatoria y superficie `surface \| social`              |
| `Chip`         | unión tipada para estados semánticos, datos y recompensa                                 |
| `Avatar`       | imagen o iniciales, tamaños `sm \| md \| lg` y tonos controlados                         |
| `AvatarStack`  | máximo visible configurable, overflow `+N` y etiqueta textual                            |
| `Card`         | elemento semántico, superficies `surface \| soft`, tres elevaciones y tres densidades    |
| `TimerDisplay` | representación determinista normal, urgente y finalizada                                 |
| `Timer`        | API temporal compatible con el timer existente y urgencia por defecto en los últimos 5 s |

El timer oscuro y `Timer` comparten `useCountdown`. El timer oscuro conserva su API, markup y apariencia; el hook centraliza deadline, clamping a cero, reset y disparo único de `onTimeUp`.

### App shell

- Fondo claro con patrón decorativo.
- Safe areas respetadas en iOS.
- Cabecera compacta con identidad del jugador, nivel de temporada y notificaciones.
- Navegación inferior posterior al vertical slice; durante la validación puede existir solo inicio y perfil sin rutas reales.

### Botón primario

- Fondo Flash.
- Texto e icono Ink.
- Borde Ink suave al 36 % de 1,5 px; conserva definición sin enmarcar el CTA en negro.
- La marca sobre fondo Flash reutiliza el mismo borde; el rayo interior permanece en Ink sólido.
- Altura mínima 56 px; 64 px en CTA hero.
- Radio control.
- Sombra física corta.
- Copy con verbo: `Jugar ahora`, `Empezar intento`, `Ver resultado`, `Ver clasificación`, `Volver al lobby`.

Estados obligatorios: default, hover, pressed, focus, disabled y loading.

### Botón secundario

- Fondo Surface.
- Texto Ink.
- Borde subtle o strong según prioridad.
- Nunca compite en color con el primario.

### Icon button

- 48 × 48 px.
- Fondo Surface o color semántico.
- Icono mínimo de 22 px.
- Etiqueta accesible obligatoria.

### Challenge hero card

Estructura:

1. Arte del desafío.
2. Chip de estado y tiempo restante.
3. Nombre y descripción de una línea.
4. Avatares de participantes.
5. Recompensa o progreso.
6. CTA.

Estados:

| Estado      | Apariencia                    | Acción              |
| ----------- | ----------------------------- | ------------------- |
| Nuevo       | Badge Sky y arte completo     | Jugar ahora         |
| Disponible  | Tiempo y participantes        | Jugar ahora         |
| En progreso | Barra y nivel actual          | Continuar           |
| Completado  | Score, posición y check       | Ver resultado       |
| Próximo     | Arte atenuado, fecha visible  | Avisarme, posterior |
| Bloqueado   | Candado y condición explícita | Sin CTA primario    |
| Cerrado     | Resultado propio si existe    | Ver clasificación   |

`Bloqueado` y `Cerrado` no son equivalentes.

### Mini challenge card

- Horizontal en móvil.
- Miniatura 96–112 px.
- Título de máximo dos líneas.
- Un solo dato secundario.
- Sin párrafos descriptivos largos.

### Answer tile

- Superficie blanca, borde y sombra de control.
- Altura mínima 72 px para texto corto.
- Tipografía de 18–22 px según contenido.
- Variante numérica centrada.
- Soporta una o dos columnas; cinco opciones usan `2 + 2 + 1 ancho completo`.

Estados:

| Estado    | Señales                                         |
| --------- | ----------------------------------------------- |
| Default   | Surface, Ink, sombra corta                      |
| Hover     | Elevación +1 y borde social                     |
| Pressed   | Desplazamiento 3 px y sombra reducida           |
| Selected  | Borde Violet, relleno Violet al 8 %, check      |
| Correct   | Aqua, check, copy y pulso                       |
| Incorrect | Coral, cruz, copy y movimiento corto            |
| Disabled  | Opacidad 55 %, sin sombra, conserva legibilidad |

### Timer

- Cápsula visible de al menos 48 px.
- Número tabular.
- De normal a urgencia por defecto solo en los últimos 5 s.
- La urgencia admite excepciones explícitas por segundos o ratio; en timers de 5 s o menos sin configuración se usa el 25 %.
- La urgencia usa Coral, escala ligera y háptica opcional.
- Nunca depende solo de un aro fino.

### Progress rail

- Indica pregunta actual y total.
- Permite hitos y recompensa final.
- En Pirámide se sustituye por un mini mapa persistente, no por una lista completa encima de cada pregunta.

### Avatar stack

- Hasta cuatro avatares y `+N`.
- Etiqueta textual asociada: `6 ya jugaron`.
- Las fotografías nunca son el único modo de identificar posición o estado.

### Reward chip

- Fondo Reward.
- Icono propio, no emoji del sistema.
- Valor corto: `+120`, `Cofre`, `x2`.
- Se usa una sola recompensa protagonista por tarjeta.

Cuando representa rayos, el chip usa el copy `Hasta +120 ⚡` antes de jugar y `+N ⚡ de temporada` en el resultado. No se presenta como moneda ni se mezcla con el score.

### Result hero

- Mensaje de desempeño.
- Puntuación animada.
- Posición relativa.
- Rayos obtenidos y, si corresponde, hito de temporada.
- Una comparación social significativa.
- CTA primario y secundario.

Las estadísticas detalladas permanecen disponibles debajo o en revisión, pero no dominan el primer viewport.

Acciones tras completar:

1. `Ver clasificación`.
2. `Revisar respuestas`.
3. `Volver al lobby`.

No existe CTA de repetición o práctica.

## Semántica del intento único

- `Disponible`: todavía no se ha presentado la primera pregunta.
- `En progreso`: existe un intento oficial recuperable.
- `Completado`: resultado inmutable para clasificación y rayos.
- `No completado`: el reto expiró antes de terminar.
- Abrir un reto `En progreso` siempre continúa el mismo intento.
- Reiniciar el intento solo es posible mediante una herramienta interna de desarrollo o QA, nunca desde la interfaz de producción.

## Estados y semántica

| Significado | Color  | Icono        | Ejemplo de copy    |
| ----------- | ------ | ------------ | ------------------ |
| Correcto    | Aqua   | Check        | ¡Bien visto!       |
| Parcial     | Sky    | Aproximación | Muy cerca          |
| Incorrecto  | Coral  | Cruz         | Casi. Era 27       |
| Timeout     | Coral  | Reloj        | Se escapó por poco |
| Nuevo       | Sky    | Destello     | Nuevo reto         |
| Hito        | Gold   | Corona       | Nivel de temporada |
| Progreso    | Flash  | Rayo         | 4 de 7             |
| Social      | Violet | Personas     | 6 ya jugaron       |

## Responsive

### Móvil

- Una columna.
- CTA hero a ancho completo.
- Pregunta y respuestas caben sin scroll siempre que el formato lo permita.
- Cabecera muestra solo datos imprescindibles.
- El resultado revela detalle mediante scroll después de la celebración.

### Tablet y escritorio

- Lobby con hero a dos columnas: contenido y arte.
- Feed secundario en grid de dos o tres columnas.
- Pregunta centrada con ancho máximo de 760 px.
- Resultado en dos columnas: celebración y detalle social.
- No se escala la interfaz móvil de forma uniforme; se recomponen las regiones.

## Accesibilidad obligatoria

- WCAG 2.2 AA como referencia.
- Contraste mínimo de 4.5:1 para texto normal y 3:1 para texto grande.
- Foco visible de al menos 2 px y separado del borde.
- Orden de foco idéntico al orden visual.
- Resultados anunciados mediante `aria-live` sin interrumpir lectura.
- Estados correctos e incorrectos con icono y texto además del color.
- Soporte para `prefers-reduced-motion`.
- Animaciones decorativas ocultas a lectores de pantalla.
- Sonido nunca necesario para comprender el estado.
- Objetivos táctiles de 44 × 44 px como mínimo.
- El tiempo límite mantiene las opciones de accesibilidad existentes y debe poder configurarse en una fase posterior.

## Estrategia de migración

- No reescribir los estilos globales de una vez.
- Crear tema Flash Pop aislado.
- Migrar primero primitivas compartidas del vertical slice.
- Adaptar `StartScreen`, `QuestionScreen`, `QuestionTransition` y `ResultScreen` mediante nuevas variantes o componentes de presentación.
- Mantener intacta la lógica de `useGameSession`, scoring y formatos durante la validación.
- Eliminar tokens oscuros antiguos solo cuando no existan consumidores.
