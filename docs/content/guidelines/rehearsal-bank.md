> Estado: vigente. Criterios editoriales y de publicación del banco de ensayo v1.

# Rúbrica editorial del banco de prueba

Las preguntas activas deben enseñar su solución, admitir los modos declarados y ofrecer al menos
una familia por formato/modo/dificultad. Alfabeto exige ese mínimo para cada una de las 27 letras
españolas en cada dificultad. Narrativa no forma parte de este banco.

La dificultad describe conocimientos, inferencias, alternativas plausibles y restricciones
mecánicas. El tiempo oficial se hereda del desafío: acortar el cronómetro no convierte una pregunta
fácil en difícil. Para cubrir un hueco se redacta o revisa un ejercicio real; cambiar únicamente
la etiqueta no es suficiente.

| Formato                    | Fácil                                        | Media                                              | Difícil                                                       |
| -------------------------- | -------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------- |
| Elección múltiple          | Identificación o cálculo directo             | Dos pasos y distractores plausibles                | Composición de proporciones u operaciones                     |
| Verdadero/falso            | Hecho elemental o propiedad visible          | Aplicar una propiedad a un caso                    | Refutar una generalización mediante un contraejemplo          |
| Respuesta corta / Alfabeto | Vocabulario cotidiano con definición directa | Vocabulario técnico que exige distinguir conceptos | Terminología especializada con diferencias precisas           |
| Intruso                    | Propiedad inmediatamente visible             | Reconocer una categoría matemática o conceptual    | Comprobar varios candidatos con una regla no evidente         |
| Emparejar                  | Pocas asociaciones o sumas elementales       | Varias asociaciones y conocimientos diferenciados  | Conversiones o cálculos previos para cada asociación          |
| Ordenación                 | Enteros con orden evidente                   | Etapas o unidades que necesitan interpretación     | Fracciones o magnitudes que requieren conversión              |
| Clasificación              | Categorías explícitas o estados cotidianos   | Relacionar características con categorías          | Combinar criterios independientes para cada elemento          |
| Estimación                 | Una operación o conteo directo               | Referencia conceptual o conversión                 | Encadenar proporciones sobre cantidades que cambian           |
| Mapa de calor              | Esquina, centro u objetivo visible           | Convertir fracciones a coordenadas                 | Deducir una posición mediante relaciones geométricas          |
| Pistas progresivas         | Objetos cotidianos                           | Integrar propiedades de conceptos próximos         | Terminología específica con pistas indirectas                 |
| Imagen progresiva          | Figura cotidiana                             | Clasificar con información parcial                 | Contar o distinguir propiedades de polígonos menos familiares |
| Anagrama                   | Palabra breve y pista directa                | Más letras y repeticiones                          | Mayor longitud, repeticiones y terminología específica        |
| Mini-Wordle                | Definición precisa y más intentos            | Pista temática y margen estándar                   | Vocabulario menos frecuente y menos intentos                  |
| Matriz lógica              | Regla explícita sencilla                     | Aplicar o inferir una progresión                   | Combinar operaciones para completar la casilla                |
| Código lógico              | Pistas directas de cada cifra                | Combinar exclusiones y posiciones                  | Encadenamientos y ceros iniciales cuando proceda              |
| Queens                     | Tablero pequeño con apoyos                   | Más regiones y restricciones entre filas           | Tablero mayor y restricciones entre varias regiones           |
| Conectar parejas           | Tablero pequeño y pocas rutas                | Rutas que compiten por casillas                    | Tablero mayor y reserva de pasos para otras parejas           |
| Escape                     | Salida libre o bloqueo directo               | Varias maniobras previas                           | Cadena de dependencias entre barreras                         |
| Zip                        | Numerosos controles que guían                | Controles separados y cobertura completa           | Menos controles y riesgo de aislar casillas                   |
| Word Hashtag               | Pocas letras descolocadas                    | Varios cruces y cambios                            | Más intercambios coordinados con cruces simultáneos           |
| Sopa de letras             | Pocas palabras cortas horizontales           | Más palabras y orientaciones                       | Palabras largas, orientaciones mezcladas e inversiones        |

## Explicaciones y soluciones

Justificar la respuesta específica: mostrar las operaciones con sus valores, la propiedad que
distingue las opciones o las correspondencias comprobadas. En vocabulario, añadir el rasgo
definitorio y una relación que ayude a comprenderlo; repetir solo la respuesta no basta.

Los puzles incluyen posiciones o recorridos verificables. Indicar cuándo las coordenadas cuentan
desde uno; los movimientos de Escape usan posiciones desde cero. Word Hashtag documenta una
secuencia legal de intercambios. La resolución y la explicación no sustituyen la calibración editorial.

Se rechazan explicaciones vacías y las plantillas «La solución de este ejercicio permite revisar
cómo funciona el formato», «Resuelve el ejercicio siguiendo sus reglas y comprueba la solución» y
«[Respuesta] es la respuesta descrita». Una longitud mínima no acredita calidad.
Las variantes de una familia comparten su criterio; no se crean familias ficticias para mejorar cifras.

## Publicación y regresión

La base consolidada contiene 232 preguntas en versión editorial 1 y admite únicamente recetas del
generador v1 consolidado. Las recetas de desarrollo previas quedan fuera de este contrato. Desde
esta base, las correcciones y retiradas añaden versiones; las anteriores conservan metadatos y
huellas para las recetas del generador vigente. La calidad se exige al conjunto activo.

Ejecutar `npm run rehearsals:check` y revisar el informe por combinación y estructura. El mínimo de
una familia no garantiza repeticiones de formato y dificultad sin sustituciones: la asignación
completa y sus avisos muestran esa limitación. Antes de publicar, añadir las nuevas huellas al
inventario con `npm run rehearsals:history:register`, que rechaza cambios históricos, y revisar el
preview con una semilla fija.
El [procedimiento técnico](../../current/rehearsals.md) detalla selección y compatibilidad.
