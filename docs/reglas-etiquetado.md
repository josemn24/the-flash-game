# Reglas editoriales de etiquetado

## Propósito

Esta guía define criterios editoriales para asignar `domains`, `topics`, `cognitiveSkills`, `formatSkills` y `lifeSkills` a cada prueba de The Flash.

No sustituye a la taxonomía técnica de `lib/questionTags.ts` ni añade validación automática. Su objetivo es que el contenido se etiquete de forma consistente y que los datos sirvan mejor para filtrar, recomendar, equilibrar desafíos y analizar resultados.

## Principio general

```text
Domain responde a: ¿de qué trata principalmente la prueba?
Topic responde a: ¿qué subtema concreto toca?
CognitiveSkill responde a: ¿qué habilidad mental exige?
FormatSkill responde a: ¿qué operación realiza el jugador?
LifeSkill responde a: ¿qué aplicación práctica/social tiene?
```

## Reglas generales

- Usar 1 dominio principal siempre que sea posible.
- Añadir un segundo dominio solo si cambia cómo filtrar, recomendar o analizar la prueba.
- No añadir dominios por contexto decorativo.
- Preferir `topic` antes que crear un dominio nuevo.
- Usar `lifeSkills` cuando el foco sea aplicación práctica, social o cotidiana.
- No mezclar `domain` con `formatSkill`: el dominio describe contenido; el format skill describe la operación.
- Mantener los IDs en `snake_case`, como en `lib/questionTags.ts`.
- Si un ejemplo usa un topic todavía no definido en la taxonomía, tratarlo como candidato futuro, no como ID disponible.

## Reglas por dominio

| Dominio                  | Usar cuando la prueba trata de...                                                                                           | No usar cuando...                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `mathematics`            | aritmética, álgebra, geometría, probabilidad, estadística, patrones, lógica o cálculo.                                      | el número sea solo un dato histórico, deportivo o cultural sin razonamiento matemático.         |
| `natural_sciences`       | física, química, biología, astronomía, geología, meteorología, cuerpo humano o ciencias ambientales.                        | el foco sea tecnología aplicada, salud como hábito personal o historia de un descubrimiento.    |
| `technology`             | informática, programación, internet, electrónica, máquinas, ingeniería, ciberseguridad o energía.                           | la tecnología sea solo contexto de una pregunta histórica o económica.                          |
| `history`                | acontecimientos, cronologías, civilizaciones, guerras, revoluciones, inventos en contexto temporal o historia de ideas.     | el foco sea una institución actual, una obra cultural o una tecnología sin dimensión histórica. |
| `geography`              | capitales, mapas, territorios, población, clima regional, recursos, migraciones, regiones o geopolítica territorial.        | la localización sea solo decorado y no ayude a filtrar o analizar la prueba.                    |
| `society_politics_law`   | instituciones, leyes, derechos, ciudadanía, democracia, poder, justicia, relaciones internacionales o movimientos sociales. | sea historia pura sin foco institucional, legal o social.                                       |
| `economics`              | mercados, empleo, empresas, impuestos, comercio, productividad, desigualdad o economía doméstica.                           | sea solo cálculo numérico sin contexto económico.                                               |
| `language_communication` | gramática, vocabulario, comprensión lectora, escritura, idiomas, argumentación, retórica o traducción.                      | el foco sea una obra literaria concreta.                                                        |
| `literature`             | autores, libros, poesía, teatro, géneros literarios, tradición oral o mitología como relato.                                | sea gramática, vocabulario o comprensión lectora general.                                       |
| `philosophy`             | lógica, ética, epistemología, metafísica, filosofía política, estética o grandes corrientes filosóficas.                    | sea solo opinión o debate social sin marco filosófico claro.                                    |
| `art_design`             | pintura, escultura, arquitectura, fotografía, ilustración, diseño gráfico, composición, color o perspectiva.                | la imagen sea solo soporte visual para otro dominio.                                            |
| `music`                  | canciones, artistas, instrumentos, géneros musicales, teoría musical o historia de la música.                               | la música sea solo parte de una escena cultural más amplia.                                     |
| `media_entertainment`    | cine, series, videojuegos, cómic, animación, cultura pop, celebridades o industria del entretenimiento.                     | el foco principal sea música o literatura.                                                      |
| `sports`                 | reglas deportivas, técnica, estrategia, entrenamiento, competición, juego limpio o estadísticas deportivas.                 | el deporte sea solo contexto para cálculo, geografía o historia.                                |
| `culture`                | tradiciones, festividades, gastronomía, religiones, patrimonio, costumbres, identidad o diversidad cultural.                | sea principalmente una película, canción, videojuego, cómic o libro concreto.                   |

## Criterios para solapes

### Cultura, medios, música y literatura

Usar `culture` para prácticas, tradiciones y patrimonio. Usar `media_entertainment` para productos audiovisuales y cultura pop. Usar `music` cuando el foco musical sea central. Usar `literature` cuando el foco sea una obra, autor o género literario.

Ejemplo:

```ts
domains: ["music"];
topics: ["popular_music"];
```

No añadir `culture` a una pregunta sobre Queen solo porque Queen forme parte de la cultura popular.

### Lenguaje y literatura

Usar `language_communication` cuando se evalúa cómo funciona el lenguaje: gramática, vocabulario, comprensión, escritura, argumentación o traducción. Usar `literature` cuando el foco sea una obra, autor, personaje, género o tradición narrativa.

### Historia, sociedad y política

Usar `history` cuando el foco sea temporal o cronológico. Usar `society_politics_law` cuando el foco sean instituciones, derechos, ciudadanía, leyes, poder o justicia. Pueden convivir si el análisis requiere ambos.

### Economía, matemáticas y vida práctica

Usar `economics` cuando hay contexto económico. Añadir `mathematics` si el cálculo o el razonamiento cuantitativo es parte relevante de la prueba. Usar `lifeSkills` como `personal_finance` cuando la situación sea aplicable a decisiones cotidianas.

### Ciencia, tecnología y salud

Usar `natural_sciences` para cuerpo humano, biología, química o física. Usar `technology` para sistemas, máquinas, informática o ingeniería. Usar `lifeSkills` como `health_self_care` cuando el foco sea cuidado personal o hábitos de salud.

## Ejemplos

### Queen / Bohemian Rhapsody

```ts
domains: ["music"];
topics: ["popular_music"];
```

El foco es musical. No usar `culture` salvo que la prueba trate de la influencia cultural de la canción.

### Día de los Muertos

```ts
domains: ["culture"];
topics: ["festivities"]; // topic candidato futuro
```

El foco es tradición/festividad. Añadir `history` solo si la pregunta trata explícitamente del origen histórico.

### Falacia en discurso electoral

```ts
domains: ["language_communication", "society_politics_law"];
topics: ["argumentation", "democracy"]; // topics candidatos futuros
cognitiveSkills: ["critical_thinking"];
```

Aquí importan tanto el análisis del lenguaje como el contexto político.

### IVA de una compra

```ts
domains: ["economics", "mathematics"];
topics: ["taxes", "percentages"]; // topics candidatos futuros
lifeSkills: ["personal_finance"];
```

El contexto económico y la aplicación cotidiana justifican `economics` y `lifeSkills`. El cálculo justifica `mathematics`.

### Inventos por fecha

```ts
domains: ["history", "technology"];
topics: ["inventions"];
formatSkills: ["ordering"];
```

El foco combina cronología e inventos tecnológicos. `ordering` describe la operación del jugador, no el contenido.

## Checklist editorial

Antes de publicar una prueba, comprobar:

- ¿Tiene un dominio principal claro?
- ¿El segundo dominio, si existe, aporta algo real?
- ¿Los topics son más concretos que los dominios?
- ¿Las habilidades cognitivas describen lo que el jugador debe hacer mentalmente?
- ¿Las format skills describen la operación en pantalla?
- ¿Las life skills solo aparecen cuando hay aplicación práctica, social o cotidiana?
- ¿Hay algún dominio usado solo como contexto decorativo?
