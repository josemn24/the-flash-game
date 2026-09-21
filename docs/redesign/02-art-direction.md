# 02. Dirección artística

## Concepto: Flash Pop

Flash Pop combina la energía del rayo con un mundo de juego blando, colorido y social. La marca conserva velocidad y competición, pero abandona la estética de terminal técnica como apariencia dominante.

Tres palabras visuales: **eléctrico, táctil, humano**.

## Invariantes de marca

Una pantalla debe seguir pareciendo The Flash aunque se oculte el logotipo. Son obligatorios:

1. **Contraste Flash**: Canvas y Surface claros, Ink como estructura y amarillo eléctrico reservado para acción, energía y progreso.
2. **Geometría de rayo**: cortes, muescas o divisiones diagonales con un ángulo común aproximado de 12° en componentes protagonistas, nunca en todas las superficies.
3. **Tipografía dual**: display redondeada para juego y celebración; voz condensada o mono solo para cronómetros, niveles, puntuaciones y eventos competitivos.
4. **Movimiento direccional**: entradas rápidas, una estela corta y un único destello; el rebote blando se reserva para premios.
5. **Diorama eléctrico**: escenas 2.5D geométricas atravesadas por una trayectoria de energía, sin recurrir a mascotas infantiles.

## Composición

- Mobile first, con un lienzo de referencia de 390 × 844 px.
- La acción principal aparece completa en el primer viewport.
- Las pantallas se organizan alrededor de una pieza hero: reto, pregunta o puntuación.
- La información secundaria se agrupa en chips, tiras o tarjetas pequeñas.
- Se evita repetir tarjetas con idéntico peso durante listas largas.
- Los elementos sociales pueden solaparse de forma controlada para sugerir grupo y actividad.
- Las ilustraciones ocupan entre el 35 % y el 55 % de la tarjeta destacada.

## Paleta

### Colores base

| Token conceptual | Valor inicial | Uso                                   |
| ---------------- | ------------- | ------------------------------------- |
| Canvas           | `#F7F5ED`     | Fondo general cálido                  |
| Surface          | `#FFFFFF`     | Tarjetas y controles elevados         |
| Ink              | `#171720`     | Texto, iconos y contornos principales |
| Ink muted        | `#686872`     | Texto secundario                      |
| Flash            | `#D7FF19`     | CTA, progreso, energía y marca        |
| Violet           | `#6957E8`     | Social, navegación y competición      |
| Aqua             | `#13B89A`     | Éxito y cooperación                   |
| Coral            | `#FF7276`     | Error, vidas y urgencia               |
| Sky              | `#74A7F5`     | Información y ayudas                  |
| Gold             | `#FFD85A`     | Premios, coronas y récords            |

Los valores son punto de partida. Antes de implementarlos como definitivos deben validarse en contraste, pantallas OLED y luz exterior.

### Roles obligatorios

- **Flash**: acción primaria y progreso de temporada. Nunca texto pequeño sobre blanco.
- **Aqua**: respuesta correcta. Siempre acompañado de check o copy.
- **Coral**: error o peligro. Nunca se usa como decoración en el mismo contexto.
- **Violet**: presencia social, liga y navegación secundaria.
- **Gold**: recompensa excepcional; no sustituye al CTA.

### Modo oscuro

No desaparece, pero deja de ser la base universal. Se reserva para:

- Retos nocturnos o especiales.
- Pantallas de boss o final de temporada.
- Estados contrarreloj de alta tensión.
- Preferencia explícita del sistema en una fase posterior.

## Tipografía

### Roles

- **Display redondeada**: títulos de pantalla, puntuaciones y nombres de reto.
- **Sans de interfaz**: cuerpo, botones y datos.
- **Mono**: cronómetro, códigos, atajos y microdatos competitivos.

### Criterios de selección

- Formas geométricas y terminales suaves.
- Excelente legibilidad en español.
- Pesos 500, 700, 800 y 900.
- Números tabulares para cronómetro y rankings.
- Licencia compatible con distribución web.

La selección de familia se hará durante el prototipo visual. Hasta entonces, el sistema debe usar fallbacks y no comprometerse con una fuente remota.

### Reglas

- Sentence case por defecto.
- Mayúsculas espaciadas solo en microetiquetas de hasta tres palabras.
- Los títulos no deben superar tres líneas en 390 px.
- Cuerpo mínimo recomendado: 16 px.
- Metadatos importantes: mínimo 13 px.
- Se abandona la condensada extrema como voz general; puede sobrevivir en puntuaciones y eventos especiales.

## Forma, bordes y profundidad

- Tarjeta hero: radio 28–32 px.
- Tarjeta estándar: radio 20–24 px.
- Control: radio 16–20 px.
- Chip y avatar: radio completo.
- Contorno: 2 px oscuro o coloreado en elementos prioritarios.
- Sombra: visible, suave y con dirección vertical.
- Sombra de pulsación: se reduce mientras el componente desciende 2–4 px.

La profundidad se limita a tres niveles:

1. Canvas sin sombra.
2. Tarjeta o control con sombra corta.
3. Hero, diálogo o recompensa con sombra amplia.

No se apilan sombras fuertes dentro de sombras fuertes.

Los hero, CTA y barras de progreso pueden incorporar un único corte diagonal de firma. El recorte no debe reducir el área táctil ni dificultar el contorno de foco. Los controles secundarios conservan geometría simple para que la firma no se convierta en ruido.

## Fondos

El fondo principal usa color cálido y un patrón de baja opacidad. Motivos posibles:

- Puntos.
- Mini rayos.
- Estrellas de cuatro puntas.
- Círculos y cápsulas.

El patrón nunca debe competir con texto ni generar vibración visual. Las líneas diagonales actuales pueden reaparecer dentro de eventos especiales, no como textura constante.

## Ilustración

### Estilo

- Diorama 2.5D estilizado; no se usa 3D en tiempo real en el vertical slice.
- Geometría redondeada y volúmenes simples.
- Luz suave y sombras limpias.
- Colores saturados sobre fondos controlados.
- Cámara ligeramente isométrica o frontal elevada.
- Sin fotorealismo.
- Sin personajes de aspecto infantil extremo.
- Una trayectoria de energía o rayo atraviesa la composición como firma.
- Los objetos no reciben caras por defecto y no se adopta una mascota para resolver cada modalidad.

### Sistema escalable de familias

Cada formato recibe un símbolo vectorial, un color de acento y uno o dos objetos propios, pero comparte escena maestra con su familia. El sistema inicial contiene seis escenas, no veinticinco universos:

| Familia               | Formatos                                                                                        | Mundo visual                             |
| --------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Instinto              | Elección múltiple, intruso, verdadero/falso, estimación y adivinanzas                           | Objetos atravesando puertas o detectores |
| Palabras              | Respuesta corta, anagramas y Mini-Wordle                                                        | Letras físicas, imprentas y paneles      |
| Vínculos              | Emparejar conceptos, conectar parejas, clasificar y código lógico                               | Nodos, cables y constelaciones           |
| Orden y lógica        | Ordenar, matrices, mini-sudoku, mini-nonograma y reconstrucción del error                       | Máquinas, carriles y piezas encajables   |
| Observación y memoria | Mapa de calor, etiquetar imagen, memoria relámpago, memoria de parejas, Simon e imagen revelada | Lentes, focos y cámaras                  |
| Escape y manipulación | Rompecabezas deslizante y laberinto                                                             | Dioramas recorribles y mecanismos        |

Pirámide reutiliza la familia Orden y lógica con una torre como objeto protagonista. Intruso abre la validación de Instinto. El vertical slice solo exige arte final para esas dos expresiones; las demás familias se producen después de aprobar la dirección.

### Uso de imagen existente

Las fotografías, mapas y evidencias ya usadas dentro de preguntas siguen siendo contenido, no decoración. Deben mantenerse visualmente separadas de la ilustración de marca para que el jugador entienda cuándo una imagen contiene información necesaria para responder.

## Iconografía

- Trazo base grueso y extremos redondeados.
- Contenedores de 44–56 px para acciones principales.
- Cortes diagonales inspirados en el rayo como firma secundaria.
- Una sola familia para navegación y acciones.
- Símbolos ilustrados permitidos para recompensas, nunca mezclados con controles funcionales.
- Emojis solo como contenido creado por usuarios o reacción social, no como iconografía del sistema.

## Avatar y presencia humana

- Avatares circulares de 32, 40, 56 y 72 px.
- Contorno blanco de 2–3 px cuando se solapan.
- Estado online o actividad reciente mediante un punto, no mediante brillo continuo.
- Si no existe fotografía, usar iniciales, color asignado y una pieza gráfica sencilla.
- No mostrar más de cuatro avatares solapados; el resto se resume como `+N`.

## Tono de contenido

La interfaz habla con frases breves, positivas y directas.

| Actual             | Flash Pop                   |
| ------------------ | --------------------------- |
| Tu próximo desafío | Tu reto de hoy              |
| Empezar desafío    | Jugar ahora                 |
| Confirmar inicio   | Empezar intento             |
| Respuesta enviada  | ¡Bien visto!                |
| Respuesta fallada  | Casi. Era 27                |
| Tiempo agotado     | ¡Se escapó por poco!        |
| Meta cruzada       | Reto completado             |
| Volver a jugar     | Volver al lobby             |
| Bloqueado          | Se abre al completar Patrón |

El copy competitivo nunca ridiculiza al jugador. Los fallos ofrecen información y una próxima acción.

La interfaz nunca invita a repetir o practicar un reto completado. Las siguientes acciones son consultar la clasificación, revisar respuestas o volver al lobby.

## Qué evitar

- Reproducir el violeta de Playus como fondo universal.
- Convertir cada dato en un badge.
- Usar cinco colores con igual intensidad en una misma tarjeta.
- Mezclar iconos lineales, emojis y objetos 3D para la misma función.
- Añadir sombra a todo.
- Usar ilustración como sustituto de instrucciones necesarias.
- Ocultar estados detrás de color o animación.
- Saturar cada pantalla con rankings, monedas, rachas y notificaciones simultáneas.
- Presentar los rayos como saldo gastable, energía o vidas.
- Usar una estética casual genérica que solo sea reconocible por el logotipo.
