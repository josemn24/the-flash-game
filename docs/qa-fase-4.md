# Informe de QA — Fase 4

## Alcance

Validación de los 31 formatos de la biblioteca en la variante `default` y en la variante
`flash-pop`. La revisión cubre la ficha `/formatos/[slug]`, el ejemplo jugable y los estados
preparado, jugable, feedback y bloqueado.

## Quality gates automatizados

Ejecutar desde la raíz del proyecto y registrar aquí la fecha y el commit revisado:

```bash
npm run format:check
npm run dictionary:check
npm run lint
npm test
npm run build
```

- [x] `npm run format:check`
- [x] `npm run dictionary:check`
- [x] `npm run lint`
- [x] `npm test`
- [x] `npm run build`

La suite debe incluir la cobertura de variantes, el guard de tokens, catálogo, scoring,
timeouts, respuestas parciales y algoritmos de tableros.

### Registro automatizado

| Fecha      | Resultado | Evidencia                                 |
| ---------- | --------- | ----------------------------------------- |
| 2026-09-05 | OK        | 35 archivos, 359 tests; build estático OK |

## Matriz manual

Revisar en Chromium con VoiceOver en los siguientes viewports:

| Viewport   | Preparado | Jugable | Feedback | Teclado/foco | Overflow |
| ---------- | --------- | ------- | -------- | ------------ | -------- |
| 320 × 568  | [ ]       | [ ]     | [ ]      | [ ]          | [x]      |
| 390 × 844  | [ ]       | [ ]     | [ ]      | [ ]          | [x]      |
| 768 × 1024 | [ ]       | [ ]     | [ ]      | [ ]          | [x]      |
| 1440 × 900 | [x]       | [ ]     | [ ]      | [ ]          | [x]      |

En cada viewport comprobar también reducción de movimiento, objetivos táctiles de 44 × 44 px,
contraste AA, etiquetas accesibles, `aria-live`, textos alternativos y estabilidad al cargar
medios.

## Formatos revisados

Marcar cada fila después de revisar el primer ejemplo y los ejemplos adicionales cuando existan.
En `feedback` usar correcto, incorrecto, parcial, sin respuesta o timeout según permita el formato.

|   # | Formato                         | Preparado | Jugable | Feedback | Bloqueado |
| --: | ------------------------------- | --------- | ------- | -------- | --------- |
|  01 | elección múltiple               | [ ]       | [ ]     | [ ]      | [ ]       |
|  02 | encontrar el intruso            | [ ]       | [ ]     | [ ]      | [ ]       |
|  03 | emparejar conceptos             | [ ]       | [ ]     | [ ]      | [ ]       |
|  04 | conectar parejas                | [ ]       | [ ]     | [ ]      | [ ]       |
|  05 | verdadero o falso               | [ ]       | [ ]     | [ ]      | [ ]       |
|  06 | respuesta corta                 | [ ]       | [ ]     | [ ]      | [ ]       |
|  07 | ordenar                         | [ ]       | [ ]     | [ ]      | [ ]       |
|  08 | clasificar                      | [ ]       | [ ]     | [ ]      | [ ]       |
|  09 | código lógico                   | [ ]       | [ ]     | [ ]      | [ ]       |
|  10 | estimación                      | [ ]       | [ ]     | [ ]      | [ ]       |
|  11 | adivinanzas por pistas          | [ ]       | [ ]     | [ ]      | [ ]       |
|  12 | mapa de calor                   | [ ]       | [ ]     | [ ]      | [ ]       |
|  13 | etiquetar imagen                | [ ]       | [ ]     | [ ]      | [ ]       |
|  14 | memoria relámpago               | [ ]       | [ ]     | [ ]      | [ ]       |
|  15 | memoria de parejas              | [ ]       | [ ]     | [ ]      | [ ]       |
|  16 | Simon: secuencias               | [ ]       | [ ]     | [ ]      | [ ]       |
|  17 | matrices lógicas                | [ ]       | [ ]     | [ ]      | [ ]       |
|  18 | mini-sudoku                     | [ ]       | [ ]     | [ ]      | [ ]       |
|  19 | mini-nonograma                  | [ ]       | [ ]     | [ ]      | [ ]       |
|  20 | Queens                          | [ ]       | [ ]     | [ ]      | [ ]       |
|  21 | rompecabezas deslizante         | [ ]       | [ ]     | [ ]      | [ ]       |
|  22 | Escape                          | [ ]       | [ ]     | [ ]      | [ ]       |
|  23 | reconstrucción del error        | [ ]       | [ ]     | [ ]      | [ ]       |
|  24 | anagramas                       | [ ]       | [ ]     | [ ]      | [ ]       |
|  25 | hashtag de palabras             | [ ]       | [ ]     | [ ]      | [ ]       |
|  26 | sopa de letras                  | [ ]       | [ ]     | [ ]      | [ ]       |
|  27 | Mini-Wordle                     | [ ]       | [ ]     | [ ]      | [ ]       |
|  28 | imagen progresivamente revelada | [ ]       | [ ]     | [ ]      | [ ]       |
|  29 | laberinto contrarreloj          | [ ]       | [ ]     | [ ]      | [ ]       |
|  30 | Zip / una línea                 | [ ]       | [ ]     | [ ]      | [ ]       |
|  31 | Tuberías                        | [ ]       | [ ]     | [ ]      | [ ]       |

## Incidencias y evidencia

Registrar cada hallazgo con este formato:

| ID     | Formato             | Viewport/estado | Descripción                                   | Severidad | Evidencia                 | Resolución |
| ------ | ------------------- | --------------- | --------------------------------------------- | --------- | ------------------------- | ---------- |
| QA-001 | Queens/Zip/Tuberías | locked          | Celdas del tablero no quedaban deshabilitadas | P1        | Test de variantes         | Corregido  |
| QA-002 | Shell del ejemplo   | 390 × 844       | Cierre del modal medía 43×43 px               | P2        | Medición DOM en navegador | Corregido  |

P0/P1 bloquea la salida. P2 debe corregirse o aceptarse explícitamente antes del cierre. P3 se
documenta para backlog. Las comparativas visuales deben conservarse junto al informe o enlazarse
desde la evidencia.

## Registro manual actual

- 31/31 fichas cargan correctamente en `320×568`, `390×844`, `768×1024` y `1440×900`.
- 31/31 fichas no presentan overflow horizontal en esos cuatro viewports.
- 31/31 fichas abren el modal de ejemplo preparado en `1440×900`.
- `etiquetar-imagen` y `memoria-relampago` fueron revisados en estado jugable y feedback/timeout
  en `390×844`, incluyendo su árbol accesible y transición de memoria.
- El botón de cierre del modal cumple 44×44 px en móvil tras corregir una medición inicial de
  43×43 px.
- Consola del navegador: 0 errores durante el barrido.
- Pendiente de completar manualmente: la interacción exhaustiva de cada formato en los cuatro
  viewports, VoiceOver completo y activación forzada de `prefers-reduced-motion`.
