import { SCORING_POLICIES, type ScoringPolicy } from "@/features/question-formats/scoringPolicies";
import type { QuestionOfType, QuestionType } from "@/types/game";

export type QuestionFormatGuide<T extends QuestionType = QuestionType> = {
  id: T;
  slug: string;
  name: string;
  shortName: string;
  summary: string;
  description: string[];
  recommendations: string[];
  avoidWhen: string[];
  rules: string[];
  authoringTips: string[];
  accessibility: string[];
  mediaSupport: string[];
  timing: { recommendedSeconds: string; notes: string };
  scoring: ScoringPolicy;
  examples: Array<{ title: string; question: QuestionOfType<T> }>;
};

export type QuestionFormatCatalog = {
  [T in QuestionType]: QuestionFormatGuide<T>;
};

export const QUESTION_FORMAT_CATALOG = {
  "multiple-choice": {
    id: "multiple-choice",
    slug: "eleccion-multiple",
    name: "Elección múltiple",
    shortName: "Elección",
    summary: "Elegir una respuesta correcta entre varias alternativas, con apoyo visual opcional.",
    description: [
      "El jugador compara varias opciones y toca una para responder inmediatamente. Es un formato rápido, familiar y muy versátil.",
      "Puede incorporar una imagen sin convertirse en otra mecánica: el medio aporta contexto, pero las reglas no cambian.",
    ],
    recommendations: [
      "Comprobar conocimientos concretos",
      "Reconocimiento visual",
      "Rondas rápidas con dificultad gradual",
    ],
    avoidWhen: [
      "Varias respuestas podrían ser defendibles",
      "Se quiere evaluar razonamiento abierto",
      "Las alternativas revelarían la solución",
    ],
    rules: [
      "Tocar una opción envía la respuesta inmediatamente",
      "La respuesta queda bloqueada al enviarse",
      "Agotar el tiempo equivale a no responder",
    ],
    authoringTips: [
      "Usa distractores plausibles y homogéneos",
      "Evita pistas gramaticales o una opción mucho más larga",
      "Formula el enunciado de manera autosuficiente",
    ],
    accessibility: [
      "No dependas solo del color para distinguir opciones",
      "Toda imagen debe tener texto alternativo útil",
      "Mantén áreas táctiles amplias",
    ],
    mediaSupport: ["Texto", "Imagen o ilustración opcional"],
    timing: {
      recommendedSeconds: "8–15 s",
      notes: "Añade tiempo si hay que interpretar una imagen o leer opciones extensas.",
    },
    scoring: SCORING_POLICIES["multiple-choice"],
    examples: [
      {
        title: "Ejemplo",
        question: {
          id: "guide-choice",
          type: "multiple-choice",
          category: "Geografía",
          tags: {
            domains: ["geography"],
            topics: ["capitals"],
            cognitiveSkills: ["memory"],
            formatSkills: ["recall"],
          },
          question: "¿Cuál es la capital de Canadá?",
          options: ["Toronto", "Ottawa", "Vancouver", "Montreal"],
          correctAnswer: "Ottawa",
          timeLimit: 12,
          points: 100,
          explanation: "Ottawa es la capital de Canadá.",
        },
      },
    ],
  },
  "odd-one-out": {
    id: "odd-one-out",
    slug: "encontrar-el-intruso",
    name: "Encontrar el intruso",
    shortName: "Intruso",
    summary: "Detectar qué elemento rompe la relación compartida por el resto.",
    description: [
      "El jugador compara entre tres y seis elementos y toca directamente el único que no comparte la regla del conjunto.",
      "Puede trabajar con palabras, números, imágenes o ilustraciones, siempre que la relación y la excepción sean inequívocas.",
    ],
    recommendations: [
      "Categorías y familias reconocibles",
      "Patrones numéricos o lingüísticos breves",
      "Rondas visuales de alta velocidad",
    ],
    avoidWhen: [
      "Más de un elemento podría considerarse diferente",
      "La relación depende de conocimiento demasiado especializado",
      "Las imágenes contienen detalles difíciles de percibir en móvil",
    ],
    rules: [
      "Hay un único intruso entre tres y seis elementos",
      "La respuesta se envía inmediatamente al tocar una tarjeta",
      "Un fallo resta el 20 % y agotar el tiempo no puntúa",
    ],
    authoringTips: [
      "Define primero la relación exacta que comparten los elementos válidos",
      "Comprueba que el intruso no encaje mediante otra interpretación razonable",
      "Mantén etiquetas e imágenes homogéneas para no revelar la solución por su forma",
    ],
    accessibility: [
      "Proporciona una etiqueta textual útil para cada elemento",
      "Incluye texto alternativo descriptivo en todas las imágenes",
      "Mantén tarjetas amplias, foco visible y un orden de teclado lógico",
    ],
    mediaSupport: ["Elementos de texto", "Imagen o ilustración opcional por elemento"],
    timing: {
      recommendedSeconds: "5–10 s",
      notes: "Añade tiempo cuando la relación exija inspeccionar imágenes o comparar datos.",
    },
    scoring: SCORING_POLICIES["odd-one-out"],
    examples: [
      {
        title: "Ejemplo",
        question: {
          id: "guide-odd-one-out",
          type: "odd-one-out",
          category: "Lengua",
          tags: {
            domains: ["language_communication", "natural_sciences"],
            topics: ["word_groups", "astronomy_planets"],
            cognitiveSkills: ["comprehension", "pattern_recognition"],
            formatSkills: ["comparison", "classification"],
          },
          question: "¿Qué palabra no pertenece al mismo grupo que las demás?",
          items: [
            { id: "mercurio", label: "Mercurio" },
            { id: "venus", label: "Venus" },
            { id: "luna", label: "Luna" },
            { id: "marte", label: "Marte" },
          ],
          correctAnswer: "luna",
          timeLimit: 8,
          points: 100,
          explanation: "Mercurio, Venus y Marte son planetas; la Luna es un satélite natural.",
        },
      },
    ],
  },
  matching: {
    id: "matching",
    slug: "emparejar-conceptos",
    name: "Emparejar conceptos",
    shortName: "Emparejar",
    summary: "Relacionar cada elemento de una columna con su pareja correcta.",
    description: [
      "El jugador selecciona una tarjeta de cada columna para probar una relación. Las parejas correctas quedan resueltas y las incorrectas se rechazan para poder reintentarlas.",
      "Admite relaciones de conocimiento, significado o reconocimiento visual mediante etiquetas e imágenes opcionales.",
    ],
    recommendations: [
      "Países y capitales",
      "Autores y obras",
      "Conceptos, definiciones e imágenes",
    ],
    avoidWhen: [
      "Un elemento puede tener varias parejas defendibles",
      "Las etiquetas necesitan explicaciones muy extensas",
      "Hay más de seis relaciones en una misma ronda",
    ],
    rules: [
      "Se selecciona una tarjeta de cada columna",
      "Las parejas correctas quedan bloqueadas y las incorrectas se liberan",
      "Cada pareja incorrecta resta el 10 % de los puntos base",
      "Completar todas las parejas envía la respuesta automáticamente",
    ],
    authoringTips: [
      "Usa entre tres y seis parejas inequívocas",
      "Desordena explícitamente la columna derecha",
      "Mantén longitud y presentación homogéneas para no dar pistas",
    ],
    accessibility: [
      "Mantén una etiqueta accesible aunque la tarjeta muestre solo la imagen",
      "Anuncia cada acierto y error mediante una región en vivo",
      "Conserva un orden de teclado lógico entre ambas columnas",
    ],
    mediaSupport: ["Elementos de texto", "Imagen o ilustración opcional por tarjeta"],
    timing: {
      recommendedSeconds: "15–25 s",
      notes: "Ajusta el tiempo al número de parejas y a la carga visual de las tarjetas.",
    },
    scoring: SCORING_POLICIES.matching,
    examples: [
      {
        title: "Ejemplo",
        question: {
          id: "guide-matching",
          type: "matching",
          category: "Geografía",
          tags: {
            domains: ["geography", "culture"],
            topics: ["countries_flags"],
            cognitiveSkills: ["memory"],
            formatSkills: ["comparison"],
          },
          question: "Empareja cada país con su bandera.",
          leftItems: [
            { id: "japon", label: "Japón", correctMatchId: "bandera-japon" },
            { id: "italia", label: "Italia", correctMatchId: "bandera-italia" },
            { id: "francia", label: "Francia", correctMatchId: "bandera-francia" },
          ],
          rightItems: [
            {
              id: "bandera-italia",
              label: "Bandera de Italia",
              media: { type: "illustration", id: "italy-flag", alt: "Bandera de Italia" },
            },
            {
              id: "bandera-francia",
              label: "Bandera de Francia",
              media: { type: "illustration", id: "france-flag", alt: "Bandera de Francia" },
            },
            {
              id: "bandera-japon",
              label: "Bandera de Japón",
              media: { type: "illustration", id: "japan-flag", alt: "Bandera de Japón" },
            },
          ],
          timeLimit: 20,
          points: 150,
          explanation:
            "Japón, Italia y Francia tienen banderas nacionales claramente diferenciadas.",
        },
      },
    ],
  },
  "connect-pairs": {
    id: "connect-pairs",
    slug: "conectar-parejas",
    name: "Conectar parejas",
    shortName: "Conectar",
    summary: "Unir pares iguales en una cuadrícula sin cruzar rutas y cubriendo el tablero.",
    description: [
      "El jugador traza caminos ortogonales entre extremos con el mismo símbolo. Cada casilla pertenece como máximo a una ruta.",
      "La v1 usa tableros 5 × 5 con cobertura completa: resolver implica conectar todas las parejas y ocupar todas las casillas.",
    ],
    recommendations: [
      "Puzzles visuales rápidos",
      "Desafíos especiales de lógica espacial",
      "Rondas táctiles con progreso parcial legible",
    ],
    avoidWhen: [
      "La pantalla no permite celdas táctiles cómodas",
      "El reto no tiene solución única o curada",
      "Se quiere evaluar conocimiento verbal en lugar de planificación espacial",
    ],
    rules: [
      "Selecciona un extremo y extiende su ruta por celdas ortogonales",
      "Las rutas no pueden cruzarse ni compartir casillas",
      "Tocar una ruta propia permite recortarla y rehacerla",
      "Completar todas las parejas y cubrir el tablero envía la respuesta automáticamente",
    ],
    authoringTips: [
      "Usa entre tres y cinco parejas en tablero 5 × 5",
      "Comprueba que la solución editorial cubre las 25 casillas sin cruces",
      "Asigna símbolos o etiquetas además de color para cada pareja",
    ],
    accessibility: [
      "No dependas solo del color: cada pareja necesita símbolo visible y nombre accesible",
      "Mantén foco visible en tablero, celdas y controles",
      "Permite construir rutas con teclado mediante flechas",
    ],
    mediaSupport: ["Cuadrícula", "Símbolos y color editorial por pareja"],
    timing: {
      recommendedSeconds: "30–35 s",
      notes: "Ajusta el tiempo al número de parejas y a la necesidad de cobertura completa.",
    },
    scoring: SCORING_POLICIES["connect-pairs"],
    examples: [
      {
        title: "Ejemplo",
        question: {
          id: "guide-connect-pairs",
          type: "connect-pairs",
          category: "Lógica espacial",
          tags: {
            domains: ["mathematics"],
            topics: ["spatial_logic_puzzles"],
            cognitiveSkills: ["problem_solving"],
            formatSkills: ["planning"],
          },
          question: "Conecta cada pareja de símbolos y cubre toda la cuadrícula.",
          grid: { rows: 5, columns: 5 },
          pairs: [
            { id: "a", label: "Pareja A", symbol: "A", endpoints: [0, 4], color: "#35e8ff" },
            { id: "b", label: "Pareja B", symbol: "B", endpoints: [5, 24], color: "#d7ff18" },
            { id: "c", label: "Pareja C", symbol: "C", endpoints: [6, 19], color: "#ff6d73" },
          ],
          solutionPaths: {
            a: [0, 1, 2, 3, 4],
            b: [5, 10, 15, 20, 21, 22, 23, 24],
            c: [6, 7, 8, 9, 14, 13, 12, 11, 16, 17, 18, 19],
          },
          requireFullCoverage: true,
          timeLimit: 35,
          points: 150,
          explanation:
            "Cada símbolo se une con su pareja mediante una ruta ortogonal. La solución cubre las 25 casillas sin cruces ni solapamientos.",
        },
      },
    ],
  },
  "true-false": {
    id: "true-false",
    slug: "verdadero-falso",
    name: "Verdadero o falso",
    shortName: "V/F",
    summary: "Decidir rápidamente si una afirmación es correcta o incorrecta.",
    description: [
      "Presenta una afirmación inequívoca y obliga a tomar una decisión binaria. Su sencillez permite imprimir mucho ritmo.",
    ],
    recommendations: [
      "Detectar conceptos erróneos frecuentes",
      "Activar una sesión",
      "Intercalar preguntas de alta velocidad",
    ],
    avoidWhen: [
      "La afirmación depende del contexto",
      "Existen excepciones relevantes",
      "Se necesita distinguir más de dos alternativas",
    ],
    rules: [
      "Se responde con Verdadero o Falso",
      "La selección se envía inmediatamente",
      "Los fallos tienen una penalización mayor",
    ],
    authoringTips: [
      "Evita dobles negaciones",
      "No uses absolutos salvo que sean esenciales",
      "Comprueba que solo exista una interpretación razonable",
    ],
    accessibility: [
      "Acompaña iconos y colores con texto",
      "No uses únicamente posición izquierda/derecha como instrucción",
    ],
    mediaSupport: ["Texto"],
    timing: {
      recommendedSeconds: "6–10 s",
      notes: "La lectura debe ser breve; una afirmación larga desvirtúa el formato.",
    },
    scoring: SCORING_POLICIES["true-false"],
    examples: [
      {
        title: "Ejemplo",
        question: {
          id: "guide-true-false",
          type: "true-false",
          category: "Ciencia",
          tags: {
            domains: ["natural_sciences"],
            topics: ["sound_waves"],
            cognitiveSkills: ["scientific_reasoning"],
            formatSkills: ["interpretation"],
          },
          question: "El sonido puede viajar por el vacío del espacio.",
          correctAnswer: false,
          timeLimit: 9,
          points: 100,
          explanation: "El sonido necesita un medio material por el que propagarse.",
        },
      },
    ],
  },
  "short-text": {
    id: "short-text",
    slug: "respuesta-corta",
    name: "Respuesta corta",
    shortName: "Texto",
    summary: "Escribir una palabra, nombre, cifra o expresión breve sin opciones visibles.",
    description: [
      "Evalúa recuerdo activo: el jugador debe producir la respuesta en lugar de reconocerla entre alternativas.",
    ],
    recommendations: [
      "Nombres propios y fechas",
      "Vocabulario específico",
      "Evitar que las opciones den pistas",
    ],
    avoidWhen: [
      "Hay muchas formulaciones equivalentes",
      "La ortografía no debería condicionar el resultado",
      "La respuesta requiere varias frases",
    ],
    rules: [
      "Se normalizan mayúsculas, tildes y espacios",
      "Pueden definirse respuestas alternativas",
      "Una respuesta incorrecta no resta puntos",
    ],
    authoringTips: [
      "Indica la unidad cuando corresponda",
      "Incluye variantes comunes aceptables",
      "Pide una respuesta claramente acotada",
    ],
    accessibility: [
      "Asocia una etiqueta visible al campo",
      "Permite enviar con teclado",
      "No uses el placeholder como única instrucción",
    ],
    mediaSupport: ["Texto"],
    timing: {
      recommendedSeconds: "10–18 s",
      notes: "Reserva tiempo adicional para escribir, especialmente en móvil.",
    },
    scoring: SCORING_POLICIES["short-text"],
    examples: [
      {
        title: "Ejemplo",
        question: {
          id: "guide-short-text",
          type: "short-text",
          category: "Historia",
          tags: {
            domains: ["history"],
            topics: ["world_war_ii"],
            cognitiveSkills: ["memory"],
            formatSkills: ["recall"],
          },
          question: "¿En qué año terminó la Segunda Guerra Mundial?",
          correctAnswer: "1945",
          acceptedAnswers: ["1945", "mil novecientos cuarenta y cinco"],
          timeLimit: 13,
          points: 120,
          explanation: "La Segunda Guerra Mundial terminó en 1945.",
        },
      },
    ],
  },
  ordering: {
    id: "ordering",
    slug: "ordenar",
    name: "Ordenar",
    shortName: "Ordenar",
    summary: "Colocar varios elementos en una secuencia correcta.",
    description: [
      "El jugador reorganiza elementos según una regla temporal, numérica, causal o procedimental.",
    ],
    recommendations: ["Cronologías", "Procesos por pasos", "Comparaciones de magnitud"],
    avoidWhen: [
      "Puede haber empates",
      "Existen varios órdenes válidos",
      "La lista es demasiado larga para la pantalla",
    ],
    rules: [
      "Todos los elementos deben colocarse",
      "La secuencia completa debe ser exacta",
      "Un orden incorrecto resta el 20 %",
    ],
    authoringTips: [
      "Explicita el sentido del orden",
      "Usa entre tres y seis elementos",
      "Evita elementos indistinguibles",
    ],
    accessibility: [
      "Ofrece controles de subir y bajar además de arrastre",
      "Anuncia la posición de cada elemento",
      "Conserva un orden de foco lógico",
    ],
    mediaSupport: ["Elementos de texto"],
    timing: {
      recommendedSeconds: "14–24 s",
      notes: "El tiempo crece con el número de elementos y la necesidad de compararlos.",
    },
    scoring: SCORING_POLICIES.ordering,
    examples: [
      {
        title: "Ejemplo",
        question: {
          id: "guide-ordering",
          type: "ordering",
          category: "Historia",
          tags: {
            domains: ["history", "technology"],
            topics: ["inventions"],
            cognitiveSkills: ["memory", "logical_reasoning"],
            formatSkills: ["ordering"],
          },
          question: "Ordena estos inventos del más antiguo al más reciente.",
          items: ["Internet", "Imprenta", "Teléfono", "Máquina de vapor"],
          correctOrder: ["Imprenta", "Máquina de vapor", "Teléfono", "Internet"],
          directionLabels: { start: "Más antiguo", end: "Más reciente" },
          timeLimit: 16,
          points: 140,
          explanation: "La imprenta precede a la máquina de vapor, el teléfono e Internet.",
        },
      },
    ],
  },
  classification: {
    id: "classification",
    slug: "clasificar",
    name: "Clasificar",
    shortName: "Clasificar",
    summary: "Asignar cada elemento a la categoría que le corresponde.",
    description: [
      "Mide la capacidad de reconocer propiedades compartidas y separar conceptos en grupos definidos.",
    ],
    recommendations: ["Taxonomías", "Propiedades y familias", "Actividades con crédito parcial"],
    avoidWhen: [
      "Un elemento puede pertenecer a varias categorías",
      "Las categorías se solapan",
      "Hay demasiadas combinaciones",
    ],
    rules: [
      "Cada elemento recibe una categoría",
      "Se debe completar el conjunto",
      "Cada acierto aporta crédito parcial",
    ],
    authoringTips: [
      "Define categorías mutuamente excluyentes",
      "Equilibra el número de elementos",
      "Usa etiquetas breves",
    ],
    accessibility: [
      "No dependas solo de arrastrar",
      "Etiqueta claramente cada grupo",
      "Permite revisar asignaciones antes de enviar",
    ],
    mediaSupport: ["Elementos y categorías de texto"],
    timing: {
      recommendedSeconds: "18–30 s",
      notes: "Ajusta el tiempo al número de elementos y categorías.",
    },
    scoring: SCORING_POLICIES.classification,
    examples: [
      {
        title: "Ejemplo",
        question: {
          id: "guide-classification",
          type: "classification",
          category: "Biología",
          tags: {
            domains: ["natural_sciences"],
            topics: ["biology_taxonomy"],
            cognitiveSkills: ["comprehension"],
            formatSkills: ["classification"],
          },
          question: "Clasifica cada ser vivo en su grupo.",
          categories: ["mamífero", "ave", "reptil"],
          items: [
            { label: "Delfín", correctCategory: "mamífero" },
            { label: "Águila", correctCategory: "ave" },
            { label: "Tortuga", correctCategory: "reptil" },
          ],
          timeLimit: 20,
          points: 160,
          explanation: "Cada animal pertenece a una clase distinta.",
        },
      },
    ],
  },
  "logic-code": {
    id: "logic-code",
    slug: "codigo-logico",
    name: "Código lógico",
    shortName: "Código",
    summary: "Deducir un código a partir de varias pistas y gestionar los intentos.",
    description: [
      "Combina deducción, descarte y prueba de hipótesis. Las pistas describen qué partes de varios códigos son válidas.",
    ],
    recommendations: ["Retos finales", "Pensamiento deductivo", "Rondas con tensión creciente"],
    avoidWhen: [
      "Las pistas admiten más de una solución",
      "No hay tiempo suficiente para comprobar hipótesis",
      "El público no conoce la convención de las pistas",
    ],
    rules: [
      "El código debe tener la longitud indicada",
      "Se permiten varios intentos hasta acertar o agotar el tiempo",
      "Cada fallo reduce la puntuación final",
    ],
    authoringTips: [
      "Verifica la solución de forma independiente",
      "Ordena las pistas para permitir progreso",
      "Evita pistas redundantes o ambiguas",
    ],
    accessibility: [
      "Expresa cada pista como texto completo",
      "Mantén visibles los intentos anteriores",
      "Usa campos con etiquetas accesibles",
    ],
    mediaSupport: ["Códigos y pistas de texto"],
    timing: {
      recommendedSeconds: "20–40 s",
      notes: "Necesita más tiempo que una pregunta de recuerdo o reconocimiento.",
    },
    scoring: SCORING_POLICIES["logic-code"],
    examples: [
      {
        title: "Ejemplo",
        question: {
          id: "guide-logic-code",
          type: "logic-code",
          category: "Lógica",
          tags: {
            domains: ["mathematics"],
            topics: ["logic_puzzles"],
            cognitiveSkills: ["logical_reasoning", "problem_solving"],
            formatSkills: ["deduction"],
          },
          question: "Deduce el código secreto de tres cifras.",
          clues: [
            { code: "682", hint: "Una cifra es correcta y está bien colocada." },
            { code: "614", hint: "Una cifra es correcta, pero está mal colocada." },
            {
              code: "206",
              hint: "Dos cifras son correctas, pero están mal colocadas.",
            },
            { code: "738", hint: "Ninguna cifra es correcta." },
            { code: "780", hint: "Una cifra es correcta, pero está mal colocada." },
          ],
          codeLength: 3,
          correctAnswer: "042",
          timeLimit: 25,
          points: 150,
          explanation: "Las pistas permiten descartar cifras y posiciones hasta llegar a 042.",
        },
      },
    ],
  },
  estimation: {
    id: "estimation",
    slug: "estimacion",
    name: "Estimación",
    shortName: "Estimación",
    summary: "Aproximarse a un valor numérico dentro de un rango conocido.",
    description: [
      "Premia el conocimiento aproximado y la intuición cuantitativa, incluso cuando no se conoce el dato exacto.",
    ],
    recommendations: [
      "Magnitudes sorprendentes",
      "Activar intuición numérica",
      "Preguntas con crédito gradual",
    ],
    avoidWhen: [
      "El valor cambia con frecuencia",
      "La unidad es ambigua",
      "No existe un rango razonable",
    ],
    rules: [
      "Se selecciona un único valor",
      "La cercanía determina el crédito",
      "Fuera de la tolerancia la puntuación llega a cero",
    ],
    authoringTips: [
      "Muestra siempre la unidad",
      "Define un paso cómodo",
      "Ajusta rango y tolerancia a la dificultad buscada",
    ],
    accessibility: [
      "Muestra el valor actual junto al control",
      "Permite usar teclado",
      "No comuniques la proximidad solo mediante color",
    ],
    mediaSupport: ["Texto", "Imagen o ilustración opcional"],
    timing: {
      recommendedSeconds: "12–20 s",
      notes: "Da tiempo para comprender la escala y ajustar el valor.",
    },
    scoring: SCORING_POLICIES.estimation,
    examples: [
      {
        title: "Ejemplo",
        question: {
          id: "guide-estimation",
          type: "estimation",
          category: "Lugares",
          tags: {
            domains: ["geography", "culture"],
            topics: ["landmarks"],
            cognitiveSkills: ["quantitative_reasoning"],
            formatSkills: ["estimation"],
          },
          question: "¿Cuántos metros mide la Torre Eiffel?",
          correctAnswer: 330,
          min: 100,
          max: 500,
          step: 10,
          initialValue: 300,
          tolerance: 200,
          unit: "m",
          timeLimit: 15,
          points: 140,
          explanation: "La Torre Eiffel alcanza 330 metros contando su antena.",
        },
      },
    ],
  },
  "progressive-clues": {
    id: "progressive-clues",
    slug: "adivinanzas-por-pistas",
    name: "Adivinanzas por pistas",
    shortName: "Pistas",
    summary:
      "Identificar una respuesta revelando solo las pistas necesarias para conservar puntos.",
    description: [
      "El jugador recibe una primera pista y decide entre responder o revelar información adicional. Cada nueva pista facilita la adivinanza, pero reduce el máximo de puntos disponible.",
      "La respuesta es abierta y solo puede enviarse una vez, de modo que la mecánica combina conocimiento, autoconfianza y gestión del riesgo.",
    ],
    recommendations: [
      "Personajes, lugares, obras y conceptos reconocibles",
      "Rondas de conocimiento con dificultad decreciente",
      "Preguntas donde cada pista acota claramente la solución",
    ],
    avoidWhen: [
      "Las primeras pistas no aportan información útil",
      "Varias respuestas encajan razonablemente con todas las pistas",
      "La solución necesita una explicación extensa o muy especializada",
    ],
    rules: [
      "La primera pista está visible y no consume puntos",
      "Cada pista adicional resta una cantidad fija del máximo disponible",
      "Se puede responder en cualquier momento, pero solo hay un intento",
      "Una respuesta incorrecta o agotar el tiempo puntúa cero",
    ],
    authoringTips: [
      "Ordena las pistas desde la más difícil hasta la más reveladora",
      "Haz que cada pista reduzca de forma apreciable el espacio de respuestas",
      "Incluye variantes habituales del nombre entre las respuestas aceptadas",
      "Comprueba que revelar todas las pistas todavía deje puntos disponibles",
    ],
    accessibility: [
      "Anuncia cada nueva pista y el máximo restante mediante una región en vivo",
      "Mantén las pistas anteriores visibles y numeradas",
      "Permite enviar la respuesta con teclado y conserva un foco visible",
    ],
    mediaSupport: ["Pistas de texto"],
    timing: {
      recommendedSeconds: "18–30 s",
      notes:
        "El límite debe permitir leer todas las pistas y escribir una respuesta breve en móvil.",
    },
    scoring: SCORING_POLICIES["progressive-clues"],
    examples: [
      {
        title: "Ejemplo",
        question: {
          id: "guide-progressive-clues",
          type: "progressive-clues",
          category: "Ciencia",
          tags: {
            domains: ["natural_sciences", "history"],
            topics: ["scientists"],
            cognitiveSkills: ["memory", "comprehension"],
            formatSkills: ["deduction", "recall"],
          },
          question: "¿Qué científica soy?",
          clues: [
            "Nací en Varsovia durante la segunda mitad del siglo XIX.",
            "Desarrollé la mayor parte de mi carrera científica en Francia.",
            "Investigué la radiactividad y participé en el descubrimiento del polonio y el radio.",
            "Fui la primera persona en recibir dos premios Nobel en disciplinas científicas distintas.",
          ],
          cluePenalty: 30,
          correctAnswer: "Marie Curie",
          acceptedAnswers: [
            "Marie Curie",
            "Curie",
            "Maria Sklodowska-Curie",
            "Maria Skłodowska-Curie",
          ],
          timeLimit: 25,
          points: 160,
          explanation:
            "Marie Curie nació en Varsovia, desarrolló su carrera en Francia y recibió los premios Nobel de Física y Química por sus investigaciones sobre la radiactividad.",
        },
      },
    ],
  },
  "heat-map": {
    id: "heat-map",
    slug: "mapa-de-calor",
    name: "Mapa de calor",
    shortName: "Mapa",
    summary: "Señalar una ubicación sobre una imagen y puntuar según precisión y velocidad.",
    description: [
      "El jugador coloca un marcador sobre una imagen, mapa, gráfico o escena. Puede corregir la posición antes de confirmarla para que una pulsación accidental no decida la ronda.",
      "La distancia al objetivo se mide en coordenadas normalizadas, por lo que el resultado es equivalente en móvil y escritorio.",
    ],
    recommendations: [
      "Geografía, mapas y localización visual continua",
      "Imágenes con una proporción y un objetivo estables",
      "Rondas donde la cercanía aporte información útil",
    ],
    avoidWhen: [
      "El objetivo es demasiado pequeño para una pantalla táctil",
      "La imagen necesita zoom para distinguir la zona",
      "La respuesta correcta es una categoría o parte discreta de la imagen",
    ],
    rules: [
      "Se coloca un único marcador y se confirma explícitamente",
      "El marcador puede recolocarse antes de confirmar",
      "La zona central concede precisión completa y alrededor hay crédito decreciente",
      "Un marcador sin confirmar se descarta al agotarse el tiempo",
    ],
    authoringTips: [
      "Usa coordenadas normalizadas entre cero y uno",
      "Define una zona plena amplia y una tolerancia mayor",
      "Mantén la proporción original de la superficie",
      "Comprueba que el objetivo pueda alcanzarse con pasos de teclado",
    ],
    accessibility: [
      "Incluye texto alternativo que describa la superficie sin revelar la respuesta",
      "Permite iniciar el marcador y moverlo con flechas y pasos ampliados",
      "Distingue marcador, objetivo y tolerancia mediante forma, etiqueta y color",
    ],
    mediaSupport: ["Imagen, mapa, gráfico o escena estática", "SVG o imagen local"],
    timing: {
      recommendedSeconds: "12–20 s",
      notes:
        "La superficie debe comprenderse y señalarse sin zoom; añade tiempo si contiene mucho detalle.",
    },
    scoring: SCORING_POLICIES["heat-map"],
    examples: [
      {
        title: "Ejemplo",
        question: {
          id: "guide-heat-map",
          type: "heat-map",
          category: "Geografía",
          tags: {
            domains: ["geography"],
            topics: ["maps"],
            cognitiveSkills: ["comprehension"],
            formatSkills: ["interpretation"],
          },
          question: "¿Dónde se encuentra Madrid?",
          surface: {
            src: "/visuals/heat-map/spain-map.svg",
            alt: "Mapa esquemático de España peninsular con Portugal y el mar como referencias, sin ciudades señaladas.",
            width: 720,
            height: 520,
          },
          target: { x: 0.52, y: 0.46 },
          targetLabel: "Madrid, en el centro de la península ibérica",
          fullCreditRadius: 0.055,
          toleranceRadius: 0.18,
          timeLimit: 15,
          points: 140,
          explanation:
            "Madrid se encuentra aproximadamente en el centro geográfico de la península ibérica, sobre la Meseta Central.",
        },
      },
    ],
  },
  "image-labeling": {
    id: "image-labeling",
    slug: "etiquetar-imagen",
    name: "Etiquetar imagen",
    shortName: "Etiquetas",
    summary: "Etiquetar varias zonas o identificar una única parte señalada de una imagen.",
    description: [
      "El jugador selecciona un anclaje sobre una imagen y después una etiqueta. La asociación aparece en la propia zona y puede corregirse antes de confirmar el conjunto.",
      "En la variante simple, una única zona ya aparece señalada y se identifica mediante elección o respuesta de texto. A diferencia de Mapa de calor, las respuestas son categorías discretas.",
    ],
    recommendations: [
      "Anatomía, diagramas y partes de objetos",
      "Imágenes con varias zonas claramente separadas",
      "Actividades donde cada etiqueta tenga un destino inequívoco",
    ],
    avoidWhen: [
      "Las zonas se solapan o necesitan zoom",
      "Una misma etiqueta debería utilizarse varias veces",
      "La cercanía espacial importa más que la identificación exacta",
    ],
    rules: [
      "Se selecciona primero una zona y después una etiqueta",
      "Cada etiqueta solo puede utilizarse una vez",
      "Las asociaciones pueden editarse o limpiarse antes de confirmar",
      "Solo puede confirmarse cuando todas las zonas tienen etiqueta",
      "La identificación única se envía al elegir una opción o al enviar el texto",
    ],
    authoringTips: [
      "Sitúa los anclajes con coordenadas normalizadas entre cero y uno",
      "Deja espacio suficiente para que las etiquetas no se solapen en móvil",
      "Usa etiquetas breves, homogéneas y sin ambigüedad",
      "Puedes añadir distractores, pero cada anclaje debe referenciar una etiqueta existente",
      "En texto libre, incluye equivalencias normalizadas y una respuesta canónica",
    ],
    accessibility: [
      "Mantén anclajes y etiquetas como botones con foco visible",
      "Numera las zonas y ofrece un resumen textual de todas las asociaciones",
      "Anuncia cada selección y no dependas solo del color en la revisión",
      "Describe la imagen y la existencia del objetivo único sin revelar su solución",
    ],
    mediaSupport: ["Imagen o diagrama estático", "Etiquetas, opciones o respuesta de texto"],
    timing: {
      recommendedSeconds: "10–35 s",
      notes:
        "La identificación única debe ser breve; el etiquetado múltiple necesita tiempo para recorrer, completar y revisar todas las zonas.",
    },
    scoring: SCORING_POLICIES["image-labeling"],
    examples: [
      {
        title: "Etiquetado múltiple",
        question: {
          id: "guide-image-labeling",
          type: "image-labeling",
          task: "assign-all",
          category: "Anatomía",
          tags: {
            domains: ["natural_sciences"],
            topics: ["human_anatomy"],
            cognitiveSkills: ["comprehension"],
            formatSkills: ["classification"],
            lifeSkills: ["health_self_care"],
          },
          question: "Etiqueta las principales regiones del cuerpo humano",
          surface: {
            src: "/visuals/heat-map/human-body.svg",
            alt: "Diagrama frontal simplificado del esqueleto humano con cabeza, torso, brazos y piernas.",
            width: 600,
            height: 720,
          },
          anchors: [
            { id: "head", point: { x: 0.5, y: 0.12 }, correctLabelId: "head-label" },
            { id: "torso", point: { x: 0.5, y: 0.31 }, correctLabelId: "torso-label" },
            { id: "arms", point: { x: 0.2, y: 0.43 }, correctLabelId: "arms-label" },
            { id: "thighs", point: { x: 0.5, y: 0.6 }, correctLabelId: "thighs-label" },
            {
              id: "lower-legs",
              point: { x: 0.5, y: 0.82 },
              correctLabelId: "lower-legs-label",
            },
          ],
          labels: [
            { id: "head-label", label: "Cabeza" },
            { id: "torso-label", label: "Torso" },
            { id: "arms-label", label: "Brazos" },
            { id: "thighs-label", label: "Muslos" },
            { id: "lower-legs-label", label: "Piernas inferiores" },
          ],
          timeLimit: 25,
          points: 160,
          explanation:
            "El cuerpo humano se organiza en cabeza, tronco y extremidades; en las piernas se distinguen los muslos de las regiones inferiores.",
        },
      },
      {
        title: "Etiquetado único",
        question: {
          id: "guide-image-labeling-single",
          type: "image-labeling",
          task: "identify-one",
          category: "Anatomía",
          tags: {
            domains: ["natural_sciences"],
            topics: ["human_anatomy"],
            cognitiveSkills: ["comprehension"],
            formatSkills: ["recall", "interpretation"],
            lifeSkills: ["health_self_care"],
          },
          question: "¿Qué región del cuerpo está señalada?",
          surface: {
            src: "/visuals/heat-map/human-body.svg",
            alt: "Diagrama frontal simplificado del esqueleto humano con cabeza, torso, brazos y piernas.",
            width: 600,
            height: 720,
          },
          target: { x: 0.5, y: 0.6 },
          response: {
            kind: "choice",
            options: ["Cabeza", "Torso", "Brazos", "Muslos", "Piernas inferiores"],
            correctAnswer: "Muslos",
          },
          timeLimit: 12,
          points: 100,
          explanation:
            "La zona señalada corresponde a los muslos, la región superior de las piernas entre la cadera y las rodillas.",
        },
      },
    ],
  },
  "flash-memory": {
    id: "flash-memory",
    slug: "memoria-relampago",
    name: "Memoria relámpago",
    shortName: "Memoria",
    summary: "Memorizar una composición breve y reconstruir las posiciones de sus fichas.",
    description: [
      "La composición aparece durante unos segundos y luego se oculta. El jugador debe colocar cada ficha en la posición que recuerda.",
      "La exposición es idéntica para todos; el cronómetro empieza cuando comienza la reconstrucción.",
    ],
    recommendations: [
      "Memoria espacial y reconocimiento visual",
      "Objetos, símbolos, banderas o conceptos breves",
      "Rondas de tensión con reglas inmediatas",
    ],
    avoidWhen: [
      "Las fichas se distinguen solo por detalles muy pequeños",
      "Hay más elementos de los que una cuadrícula móvil puede mostrar con claridad",
      "La respuesta depende de recordar texto extenso",
    ],
    rules: [
      "La composición se muestra durante una exposición fija",
      "El temporizador comienza al ocultarse la composición",
      "Se elige una ficha y después una posición; una ficha colocada puede retirarse",
      "Cada posición correcta aporta crédito parcial",
    ],
    authoringTips: [
      "Empieza con cuadrículas de dos por dos y cuatro fichas claramente diferenciables",
      "Usa posiciones completas y únicas, sin celdas vacías",
      "Mantén etiquetas breves y evita fichas visualmente demasiado parecidas",
    ],
    accessibility: [
      "Todas las fichas necesitan una etiqueta textual, incluso si incluyen una imagen",
      "Las posiciones y fichas son botones accesibles por teclado",
      "Anuncia el paso de memorización a reconstrucción sin depender solo de la animación",
    ],
    mediaSupport: ["Fichas de texto", "Imagen o ilustración opcional por ficha"],
    timing: {
      recommendedSeconds: "3 s de exposición + 10–15 s de reconstrucción",
      notes:
        "La exposición es fija y no cuenta para el límite de respuesta ni para el bonus de velocidad.",
    },
    scoring: SCORING_POLICIES["flash-memory"],
    examples: [
      {
        title: "Posiciones de planetas",
        question: {
          id: "guide-flash-memory",
          type: "flash-memory",
          category: "Espacio",
          tags: {
            domains: ["natural_sciences"],
            topics: ["astronomy_planets"],
            cognitiveSkills: ["memory"],
            formatSkills: ["recall"],
          },
          question: "Memoriza las posiciones de los planetas y reconstruye la cuadrícula.",
          revealDuration: 3,
          grid: { rows: 2, columns: 2 },
          items: [
            { id: "mercurio", label: "Mercurio", correctPosition: 0 },
            { id: "venus", label: "Venus", correctPosition: 1 },
            { id: "tierra", label: "Tierra", correctPosition: 2 },
            { id: "marte", label: "Marte", correctPosition: 3 },
          ],
          timeLimit: 12,
          points: 140,
          explanation:
            "La composición correcta sitúa Mercurio y Venus arriba, y Tierra y Marte abajo. Cada posición recordada suma una parte de los puntos.",
        },
      },
    ],
  },
  "memory-pairs": {
    id: "memory-pairs",
    slug: "memoria-de-parejas",
    name: "Memoria de parejas",
    shortName: "Parejas",
    summary: "Revelar losetas ocultas y encontrar parejas recordando su posición.",
    description: [
      "El jugador descubre dos losetas por intento. Si forman pareja, ambas quedan visibles; si no, se ocultan tras una pausa breve.",
      "Es una adaptación compacta del memory clásico para rondas rápidas, con progreso comparable por parejas encontradas, fallos y velocidad.",
    ],
    recommendations: [
      "Memoria visual pura",
      "Iconos, patrones o conceptos claramente distinguibles",
      "Desafíos especiales con tensión entre explorar y recordar",
    ],
    avoidWhen: [
      "Las losetas se distinguen solo por color",
      "Hay más de diez parejas o etiquetas largas",
      "Las imágenes contienen detalles difíciles de reconocer en móvil",
    ],
    rules: [
      "Tocar una loseta la revela",
      "La segunda loseta completa un intento",
      "Las parejas correctas quedan descubiertas",
      "Las parejas incorrectas se muestran brevemente y se ocultan",
      "Completar todas las parejas envía la respuesta automáticamente",
    ],
    authoringTips: [
      "Usa entre cuatro y diez parejas con símbolos o etiquetas inequívocas",
      "Mezcla las losetas sin dejar patrones evidentes por posición",
      "Mantén cada pareja con la misma etiqueta accesible en sus dos losetas",
    ],
    accessibility: [
      "Cada loseta debe tener etiqueta textual aunque muestre una imagen",
      "No dependas solo del color para distinguir parejas",
      "Los estados de pareja encontrada y fallo deben indicarse con texto o icono además de color",
      "La pausa de fallo debe permitir percibir ambas losetas antes de ocultarlas",
    ],
    mediaSupport: ["Losetas de texto", "Imagen o ilustración opcional por loseta"],
    timing: {
      recommendedSeconds: "15–25 s",
      notes: "Aumenta el límite si hay más de cuatro parejas o contenido visual complejo.",
    },
    scoring: SCORING_POLICIES["memory-pairs"],
    examples: [
      {
        title: "Iconos del clima",
        question: {
          id: "guide-memory-pairs",
          type: "memory-pairs",
          category: "Memoria",
          tags: {
            domains: ["mathematics", "natural_sciences"],
            topics: ["memory_training", "weather"],
            cognitiveSkills: ["memory"],
            formatSkills: ["comparison"],
          },
          question: "Encuentra las parejas de iconos del clima.",
          grid: { rows: 2, columns: 4 },
          mismatchRevealDuration: 0.65,
          tiles: [
            { id: "sol-1", pairId: "sol", label: "Sol", symbol: "☀️" },
            { id: "nube-1", pairId: "nube", label: "Nube", symbol: "☁️" },
            { id: "luna-1", pairId: "luna", label: "Luna", symbol: "🌙" },
            { id: "rayo-1", pairId: "rayo", label: "Rayo", symbol: "⚡" },
            { id: "luna-2", pairId: "luna", label: "Luna", symbol: "🌙" },
            { id: "sol-2", pairId: "sol", label: "Sol", symbol: "☀️" },
            { id: "rayo-2", pairId: "rayo", label: "Rayo", symbol: "⚡" },
            { id: "nube-2", pairId: "nube", label: "Nube", symbol: "☁️" },
          ],
          timeLimit: 18,
          points: 140,
          explanation:
            "El tablero contiene dos losetas de cada icono: Sol, Luna, Nube y Rayo. Cada pareja encontrada suma crédito y cada fallo reduce el resultado.",
        },
      },
    ],
  },
  "simon-sequence": {
    id: "simon-sequence",
    slug: "simon-secuencias",
    name: "Simon: secuencias",
    shortName: "Simon",
    summary: "Observar una secuencia de símbolos iluminados y repetirla exactamente.",
    description: [
      "Los cuatro botones se iluminan en un orden fijo. Cuando termina la reproducción, el jugador debe repetir los mismos pasos sin apoyarse en la secuencia visible.",
      "La reproducción es igual para todos y no consume tiempo de respuesta; solo cuenta la rapidez con que se repite correctamente.",
    ],
    recommendations: [
      "Memoria de trabajo y reflejos",
      "Pausas visuales entre preguntas de conocimiento",
      "Rondas cortas de alta tensión",
    ],
    avoidWhen: [
      "Se necesita evaluar conocimiento temático",
      "La secuencia requiere más de seis pasos en una ronda breve",
      "El jugador no puede distinguir botones mediante etiqueta o símbolo",
    ],
    rules: [
      "Cuatro botones se iluminan uno a uno en una secuencia fija",
      "Los botones se habilitan al acabar la reproducción",
      "Una pulsación incorrecta termina la ronda inmediatamente",
      "Completar la secuencia exacta la envía automáticamente",
    ],
    authoringTips: [
      "Usa cuatro botones con etiquetas y símbolos claramente diferenciables",
      "Mantén la secuencia entre cuatro y seis pasos",
      "Repite algún botón solo si aporta una dificultad deliberada",
    ],
    accessibility: [
      "No dependas solo del color: cada botón muestra símbolo y etiqueta",
      "Mantén los cuatro botones disponibles por teclado con foco visible",
      "Anuncia la transición entre reproducción y repetición",
    ],
    mediaSupport: ["Cuatro botones visuales con símbolo y etiqueta"],
    timing: {
      recommendedSeconds: "4–6 pasos + 8–15 s de respuesta",
      notes:
        "La reproducción tiene ritmo fijo y queda fuera del temporizador y del bonus de velocidad.",
    },
    scoring: SCORING_POLICIES["simon-sequence"],
    examples: [
      {
        title: "Secuencia de símbolos",
        question: {
          id: "guide-simon-sequence",
          type: "simon-sequence",
          category: "Memoria",
          tags: {
            domains: ["mathematics"],
            topics: ["memory_training"],
            cognitiveSkills: ["memory"],
            formatSkills: ["recall"],
          },
          question: "Observa la secuencia y repítela cuando se activen los botones.",
          pads: [
            { id: "orbita", label: "Órbita" },
            { id: "cometa", label: "Cometa" },
            { id: "estrella", label: "Estrella" },
            { id: "luna", label: "Luna" },
          ],
          sequence: ["orbita", "estrella", "cometa", "luna", "estrella"],
          timeLimit: 12,
          points: 140,
          explanation:
            "La secuencia correcta es Órbita, Estrella, Cometa, Luna y Estrella. La reproducción no reduce el tiempo disponible para responder.",
        },
      },
    ],
  },
  "logic-matrix": {
    id: "logic-matrix",
    slug: "matrices-logicas",
    name: "Matrices lógicas",
    shortName: "Matriz",
    summary: "Completar la pieza que falta en un patrón visual de tres por tres.",
    description: [
      "La matriz muestra ocho piezas y una casilla vacía. El jugador analiza las relaciones entre filas y columnas para elegir la pieza que completa el patrón.",
      "La primera versión usa símbolos y etiquetas breves, de modo que la regla no depende únicamente del color.",
    ],
    recommendations: [
      "Razonamiento abstracto",
      "Patrones de rotación, alternancia o combinación",
      "Preguntas especiales de lógica",
    ],
    avoidWhen: [
      "La regla admite más de una continuación razonable",
      "Las piezas necesitan texto largo para distinguirse",
      "El patrón solo funciona por diferencias de color",
    ],
    rules: [
      "La matriz tiene nueve celdas y exactamente una está vacía",
      "Se elige una opción entre cuatro piezas",
      "Tocar una opción envía la respuesta inmediatamente",
      "Un fallo resta el 20 % y agotar el tiempo no puntúa",
    ],
    authoringTips: [
      "Define una regla verificable por filas y columnas antes de crear las opciones",
      "Incluye distractores plausibles sin introducir otra regla válida",
      "Usa símbolos distinguibles y etiquetas cortas que describan cada pieza",
    ],
    accessibility: [
      "Etiqueta cada celda con fila, columna y nombre de pieza",
      "No uses el color como único rasgo diferenciador",
      "Mantén las cuatro opciones como botones amplios y accesibles por teclado",
    ],
    mediaSupport: ["Símbolos o texto breve", "Etiquetas accesibles por pieza"],
    timing: {
      recommendedSeconds: "12–20 s",
      notes: "Reserva más tiempo para reglas que combinen dos transformaciones simultáneas.",
    },
    scoring: SCORING_POLICIES["logic-matrix"],
    examples: [
      {
        title: "Ciclo de símbolos",
        question: {
          id: "guide-logic-matrix",
          type: "logic-matrix",
          category: "Lógica",
          tags: {
            domains: ["mathematics", "art_design"],
            topics: ["visual_patterns"],
            cognitiveSkills: ["logical_reasoning", "pattern_recognition"],
            formatSkills: ["deduction"],
          },
          question: "¿Qué símbolo completa la matriz?",
          pieces: [
            { id: "circle", symbol: "●", label: "Círculo" },
            { id: "triangle", symbol: "▲", label: "Triángulo" },
            { id: "square", symbol: "■", label: "Cuadrado" },
            { id: "diamond", symbol: "◆", label: "Rombo" },
          ],
          cells: [
            "circle",
            "triangle",
            "square",
            "triangle",
            "square",
            "circle",
            "square",
            "circle",
            null,
          ],
          optionIds: ["circle", "triangle", "square", "diamond"],
          correctOptionId: "triangle",
          timeLimit: 15,
          points: 130,
          explanation:
            "Cada fila desplaza el ciclo círculo, triángulo y cuadrado una posición. La tercera fila debe terminar con un triángulo.",
        },
      },
    ],
  },
  "mini-sudoku": {
    id: "mini-sudoku",
    slug: "mini-sudoku",
    name: "Mini-sudoku 4 × 4",
    shortName: "Sudoku",
    summary: "Completar las casillas vacías de un sudoku 4 × 4 con números del 1 al 4.",
    description: [
      "La cuadrícula contiene pistas bloqueadas y tres o cuatro casillas vacías. El jugador puede seleccionar una casilla, escribir un número, reemplazarlo o borrarlo antes de confirmar.",
      "La solución se corrige al final: cada casilla correcta concede crédito parcial y no hay penalización por corregir un valor durante la ronda.",
    ],
    recommendations: [
      "Razonamiento numérico breve",
      "Pausas entre preguntas de conocimiento",
      "Retos táctiles que también funcionen con teclado",
    ],
    avoidWhen: [
      "Se necesita evaluar una cuadrícula de más de cuatro por cuatro",
      "La ronda requiere candidatos o validación de errores en vivo",
      "Hay más de cuatro huecos que completar",
    ],
    rules: [
      "Cada fila, columna y bloque de 2 × 2 contiene los números del 1 al 4 una vez",
      "Solo se pueden editar las casillas vacías",
      "La respuesta se confirma al completar todos los huecos",
      "Al agotarse el tiempo se evalúan los valores ya escritos",
    ],
    authoringTips: [
      "Comprueba que la solución cumpla filas, columnas y bloques antes de publicarla",
      "Deja tres o cuatro huecos y mantén las pistas idénticas a la solución",
      "Evita configuraciones que requieran ensayo y error para resolverse",
    ],
    accessibility: [
      "Cada casilla editable es un botón con fila, columna y valor accesibles",
      "El foco visible marca la casilla seleccionada",
      "El teclado numérico incluye botones etiquetados y una acción de borrar",
    ],
    mediaSupport: ["Cuadrícula numérica 4 × 4", "Teclado táctil de números 1–4"],
    timing: {
      recommendedSeconds: "18–30 s",
      notes:
        "El bonus de velocidad se aplica al tiempo hasta confirmar; corregir valores no tiene penalización.",
    },
    scoring: SCORING_POLICIES["mini-sudoku"],
    examples: [
      {
        title: "Cuadrícula de números",
        question: {
          id: "guide-mini-sudoku",
          type: "mini-sudoku",
          category: "Lógica",
          tags: {
            domains: ["mathematics"],
            topics: ["logic_puzzles"],
            cognitiveSkills: ["logical_reasoning", "problem_solving"],
            formatSkills: ["deduction"],
          },
          question: "Completa el mini-sudoku. Puedes corregir tus valores antes de confirmar.",
          grid: [1, null, 3, 4, 3, 4, null, 2, 2, 1, 4, null, null, 3, 2, 1],
          solution: [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1],
          timeLimit: 24,
          points: 160,
          explanation:
            "Las cuatro casillas vacías son 2, 1, 3 y 4. Cada valor correcto suma una cuarta parte de los puntos, ajustada por la velocidad.",
        },
      },
    ],
  },
  "mini-nonogram": {
    id: "mini-nonogram",
    slug: "mini-nonograma",
    name: "Mini-nonograma 5 × 5",
    shortName: "Nonograma",
    summary: "Resolver una cuadrícula de pistas marcando las celdas que forman el patrón oculto.",
    description: [
      "Las pistas de cada fila y columna indican los grupos consecutivos de celdas rellenas. El jugador puede seleccionar una celda, rellenarla o marcarla vacía y confirmar en cualquier momento.",
      "Solo los rellenos aportan puntuación: los correctos suman crédito y los erróneos lo reducen, sin que el resultado final pueda ser negativo.",
    ],
    recommendations: [
      "Razonamiento visual y deducción",
      "Desafíos especiales de lógica",
      "Pausas táctiles entre preguntas de conocimiento",
    ],
    avoidWhen: [
      "Se necesita una ronda de menos de treinta segundos",
      "El diseño depende de colores en lugar de pistas numéricas",
      "Se requieren cuadrículas mayores de 5 × 5",
    ],
    rules: [
      "Cada número indica la longitud de un grupo consecutivo de celdas rellenas",
      "Dos grupos de una misma línea están separados por al menos una celda vacía",
      "Rellenar y vaciar una celda son acciones reversibles antes de confirmar",
      "El timeout evalúa los rellenos marcados hasta ese momento",
    ],
    authoringTips: [
      "Deriva las pistas directamente de una solución booleana 5 × 5 válida",
      "Usa patrones reconocibles y que no requieran ensayo y error",
      "Comprueba la solución con filas y columnas antes de publicar el contenido",
    ],
    accessibility: [
      "Etiqueta cada celda con su fila, columna y estado",
      "Muestra las pistas como números, no solo como rasgos visuales",
      "Incluye controles de rellenar y marcar vacía utilizables con teclado y foco visible",
    ],
    mediaSupport: ["Cuadrícula numérica 5 × 5", "Pistas de filas y columnas"],
    timing: {
      recommendedSeconds: "90 s",
      notes:
        "El bonus de velocidad se aplica al tiempo hasta confirmar y el borrador se conserva al agotarse el tiempo.",
    },
    scoring: SCORING_POLICIES["mini-nonogram"],
    examples: [
      {
        title: "Patrón en cruz",
        question: {
          id: "guide-mini-nonogram",
          type: "mini-nonogram",
          category: "Lógica",
          tags: {
            domains: ["mathematics"],
            topics: ["visual_patterns"],
            cognitiveSkills: ["logical_reasoning", "pattern_recognition"],
            formatSkills: ["deduction"],
          },
          question: "Usa las pistas de filas y columnas para completar el patrón.",
          solution: [
            false,
            true,
            true,
            true,
            false,
            true,
            false,
            true,
            false,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            false,
            true,
            false,
            true,
            false,
            true,
            true,
            true,
            false,
          ],
          rowClues: [[3], [1, 1, 1], [5], [1, 1, 1], [3]],
          columnClues: [[3], [1, 1, 1], [5], [1, 1, 1], [3]],
          timeLimit: 90,
          points: 180,
          explanation:
            "Las pistas forman una cruz simétrica. Los rellenos correctos suman crédito y los erróneos lo reducen hasta un mínimo de cero.",
        },
      },
    ],
  },
  "sliding-puzzle": {
    id: "sliding-puzzle",
    slug: "rompecabezas-deslizante",
    name: "Rompecabezas deslizante",
    shortName: "Puzzle",
    summary: "Reconstruir el orden de ocho fichas moviéndolas hacia el único hueco disponible.",
    description: [
      "El tablero 3 × 3 contiene ocho fichas numeradas y un hueco. Solo se puede deslizar una ficha que esté junto al hueco, hasta llegar a la disposición objetivo.",
      "La primera versión usa números para mantener las reglas legibles y accesibles; cada configuración editorial se valida para asegurar que es resoluble.",
    ],
    recommendations: [
      "Razonamiento espacial y planificación breve",
      "Desafíos táctiles de lógica",
      "Rondas visuales que premian eficiencia temporal",
    ],
    avoidWhen: [
      "Se necesita una respuesta inmediata de conocimiento",
      "El tablero requiere más de 3 × 3 fichas",
      "Se pretende evaluar precisión de arrastre en lugar de resolución",
    ],
    rules: [
      "Solo se puede mover una ficha adyacente al hueco",
      "La partida termina automáticamente al reconstruir la solución",
      "El número de movimientos se muestra, pero no cambia la puntuación",
      "El timeout no puntúa si el tablero no se ha resuelto",
    ],
    authoringTips: [
      "Usa una solución con las fichas 1 a 8 en orden y el hueco al final",
      "Comprueba que el estado inicial tenga la misma paridad de inversiones que la solución",
      "Empieza con estados cercanos a la solución antes de aumentar la dificultad",
    ],
    accessibility: [
      "Cada ficha comunica número, fila, columna y si se puede mover",
      "Las fichas no movibles quedan deshabilitadas",
      "Las flechas desplazan la ficha correspondiente hacia el hueco y el foco permanece visible",
    ],
    mediaSupport: ["Fichas numéricas 1–8", "Cuadrícula espacial 3 × 3"],
    timing: {
      recommendedSeconds: "60 s",
      notes:
        "Los puntos se calculan por la rapidez de resolución; los movimientos se conservan solo para la revisión.",
    },
    scoring: SCORING_POLICIES["sliding-puzzle"],
    examples: [
      {
        title: "Dos deslizamientos",
        question: {
          id: "guide-sliding-puzzle",
          type: "sliding-puzzle",
          category: "Lógica",
          tags: {
            domains: ["mathematics"],
            topics: ["spatial_logic_puzzles"],
            cognitiveSkills: ["problem_solving"],
            formatSkills: ["planning"],
          },
          question: "Ordena las fichas del 1 al 8 dejando el hueco al final.",
          initialTiles: [1, 2, 3, 4, 5, 6, null, 7, 8],
          solution: [1, 2, 3, 4, 5, 6, 7, 8, null],
          timeLimit: 60,
          points: 150,
          explanation:
            "Desliza primero el 7 y después el 8 hacia el hueco para completar el orden. La solución exacta premia la velocidad.",
        },
      },
    ],
  },
  "error-reconstruction": {
    id: "error-reconstruction",
    slug: "reconstruccion-del-error",
    name: "Reconstrucción del error",
    shortName: "Reconstruir error",
    summary: "Detectar el primer paso inválido de una solución y, opcionalmente, corregirlo.",
    description: [
      "El jugador revisa una secuencia de pasos y señala el primer punto exacto en el que el razonamiento deja de ser válido.",
      "Algunas rondas añaden una corrección guiada para distinguir entre localizar el fallo y saber repararlo.",
    ],
    recommendations: [
      "Operaciones breves",
      "Cronologías",
      "Clasificaciones y razonamientos lógicos",
    ],
    avoidWhen: [
      "Un paso previo admite una interpretación razonable que lo invalida",
      "Hay varios errores independientes",
      "La corrección exige resolver un problema largo desde cero",
    ],
    rules: [
      "Hay un único primer paso erróneo",
      "Se puede cambiar de paso antes de confirmar",
      "La corrección guiada es opcional y solo aparece tras seleccionar un paso",
      "El timeout evalúa el paso ya seleccionado",
    ],
    authoringTips: [
      "Verifica explícitamente la validez de todos los pasos anteriores al error",
      "Haz que los pasos posteriores sean consecuencias del primer fallo, no nuevos errores",
      "Usa correcciones plausibles que no revelen la respuesta por su longitud o estilo",
    ],
    accessibility: [
      "Numera los pasos y describe cada uno con texto suficiente",
      "No señales el error solo con color o posición",
      "Mantén botones amplios, foco visible y confirmación por teclado",
    ],
    mediaSupport: ["Texto", "Notación matemática simple como texto"],
    timing: {
      recommendedSeconds: "15–30 s",
      notes:
        "Reduce el número de pasos antes de ampliar el tiempo si la lectura no cabe con claridad en móvil.",
    },
    scoring: SCORING_POLICIES["error-reconstruction"],
    examples: [
      {
        title: "Operación con corrección",
        question: {
          id: "guide-error-reconstruction-math",
          type: "error-reconstruction",
          category: "Matemáticas",
          tags: {
            domains: ["mathematics"],
            topics: ["arithmetic"],
            cognitiveSkills: ["critical_thinking", "logical_reasoning"],
            formatSkills: ["error_detection", "calculation"],
          },
          question: "Localiza el primer paso incorrecto al resolver 3 × (4 + 2).",
          steps: [
            { id: "expandir", text: "1. Primero resolvemos el paréntesis: 4 + 2 = 6." },
            { id: "multiplicar", text: "2. Después multiplicamos: 3 × 6 = 15." },
            { id: "concluir", text: "3. Por tanto, el resultado es 15." },
          ],
          firstErrorStepId: "multiplicar",
          correction: {
            options: ["3 × 6 = 18", "3 + 6 = 9", "6 × 6 = 36"],
            correctAnswer: "3 × 6 = 18",
          },
          timeLimit: 20,
          points: 100,
          explanation:
            "El paréntesis se resuelve correctamente. El primer error aparece al multiplicar: 3 por 6 es 18, así que el último paso solo propaga ese fallo.",
        },
      },
      {
        title: "Cronología sin corrección",
        question: {
          id: "guide-error-reconstruction-history",
          type: "error-reconstruction",
          category: "Historia",
          tags: {
            domains: ["history", "natural_sciences", "technology"],
            topics: ["space_exploration"],
            cognitiveSkills: ["critical_thinking", "memory"],
            formatSkills: ["error_detection", "ordering"],
          },
          question: "Localiza el primer error de esta cronología de la llegada a la Luna.",
          steps: [
            { id: "lanzamiento", text: "1. Apollo 11 despegó en julio de 1969." },
            { id: "alunizaje", text: "2. El módulo lunar alunizó el 20 de julio de 1969." },
            { id: "primer-paso", text: "3. Neil Armstrong pisó la Luna en 1971." },
            { id: "regreso", text: "4. La misión regresó a la Tierra después de ese alunizaje." },
          ],
          firstErrorStepId: "primer-paso",
          timeLimit: 18,
          points: 100,
          explanation:
            "Armstrong pisó la Luna el 21 de julio de 1969 UTC, no en 1971. Los pasos previos sitúan correctamente el despegue y el alunizaje.",
        },
      },
    ],
  },
  anagram: {
    id: "anagram",
    slug: "anagramas",
    name: "Anagramas",
    shortName: "Anagramas",
    summary: "Ordenar fichas de letras para formar una palabra antes de que se agote el tiempo.",
    description: [
      "El jugador construye una única palabra tocando las fichas de letras en el orden correcto, sin escribir con el teclado.",
      "Cada ficha solo se puede usar una vez; las letras repetidas conservan fichas independientes para que la palabra se pueda reconstruir con precisión.",
    ],
    recommendations: [
      "Vocabulario y ortografía",
      "Conceptos temáticos breves",
      "Rondas lingüísticas de alta velocidad",
    ],
    avoidWhen: [
      "La solución tiene menos de tres o más de diez letras",
      "Varias palabras válidas usan exactamente las mismas letras",
      "La pista depende de un juego de palabras regional o ambiguo",
    ],
    rules: [
      "Se construye una única palabra con todas las fichas",
      "Cada ficha se usa una sola vez",
      "Se puede quitar la última ficha o reiniciar antes de enviar",
      "Un envío incorrecto termina la ronda",
    ],
    authoringTips: [
      "Usa una pista suficiente para descartar anagramas alternativos",
      "Mezcla el orden inicial de las fichas; no muestres la solución ya ordenada",
      "Incluye letras repetidas solo cuando la pista haga inequívoca la respuesta",
    ],
    accessibility: [
      "Cada letra es un botón nativo con etiqueta explícita",
      "La palabra construida anuncia el progreso y el número de fichas usadas",
      "No dependas de color, arrastre o precisión motriz para ordenar las fichas",
    ],
    mediaSupport: ["Texto", "Pista textual opcional"],
    timing: {
      recommendedSeconds: "10–20 s",
      notes: "Aumenta el tiempo solo para palabras largas o pistas de lectura más exigente.",
    },
    scoring: SCORING_POLICIES.anagram,
    examples: [
      {
        title: "Palabra con letras distintas",
        question: {
          id: "guide-anagram-mesa",
          type: "anagram",
          category: "Lengua",
          tags: {
            domains: ["language_communication"],
            topics: ["vocabulary", "spelling"],
            cognitiveSkills: ["problem_solving"],
            formatSkills: ["ordering"],
          },
          question: "Forma la palabra que nombra un mueble para comer o trabajar.",
          hint: "Suele tener patas y una superficie plana.",
          tiles: [
            { id: "s", value: "S" },
            { id: "a", value: "A" },
            { id: "m", value: "M" },
            { id: "e", value: "E" },
          ],
          correctAnswer: "MESA",
          timeLimit: 12,
          points: 100,
          explanation: "Las cuatro fichas se ordenan como M-E-S-A para formar «mesa».",
        },
      },
      {
        title: "Palabra con letras repetidas",
        question: {
          id: "guide-anagram-anana",
          type: "anagram",
          category: "Lengua",
          tags: {
            domains: ["language_communication", "culture"],
            topics: ["vocabulary", "spelling"],
            cognitiveSkills: ["problem_solving"],
            formatSkills: ["ordering"],
          },
          question: "Forma el nombre de una fruta tropical.",
          hint: "Tiene tres letras A y dos letras N.",
          tiles: [
            { id: "n-1", value: "N" },
            { id: "a-1", value: "A" },
            { id: "a-2", value: "A" },
            { id: "n-2", value: "N" },
            { id: "a-3", value: "A" },
          ],
          correctAnswer: "ANANA",
          timeLimit: 15,
          points: 120,
          explanation: "La palabra «anana» alterna las fichas A y N: A-N-A-N-A.",
        },
      },
    ],
  },
  "mini-wordle": {
    id: "mini-wordle",
    slug: "mini-wordle",
    name: "Mini-Wordle",
    shortName: "Wordle",
    summary: "Descubrir una palabra de cuatro letras en un máximo de cuatro intentos.",
    description: [
      "El jugador escribe palabras válidas de cuatro letras. Después de cada intento, cada casilla indica si la letra está en la posición correcta, aparece en otra posición o no pertenece a la solución.",
      "La ronda termina al resolver la palabra o consumir cuatro intentos. Un vocabulario español generado desde Hunspell se carga antes de iniciar el cronómetro y valida los intentos sin depender de servicios externos durante la partida.",
    ],
    recommendations: [
      "Desafíos especiales de lenguaje",
      "Vocabulario temático breve",
      "Rondas donde importen deducción y eficiencia",
    ],
    avoidWhen: [
      "La solución admite variantes ortográficas discutibles",
      "La lista de intentos válidos es demasiado limitada",
      "Se necesita una pregunta de respuesta inmediata",
    ],
    rules: [
      "Cada intento debe ser una palabra válida de cuatro letras",
      "Las casillas distinguen posición correcta, letra desplazada y letra ausente",
      "Los intentos no válidos no consumen una oportunidad",
      "Resolver o fallar el cuarto intento termina la ronda",
    ],
    authoringTips: [
      "Comprueba que la solución pertenezca al vocabulario general o declárala como adición editorial",
      "Evita soluciones regionales, abreviaturas y formas excesivamente raras",
      "Usa la pista opcional para orientar el tema sin revelar directamente la respuesta",
    ],
    accessibility: [
      "Acompaña cada color con un símbolo y una etiqueta textual",
      "Permite enviar con Enter y conserva un campo de texto nativo para teclados móviles",
      "Anuncia los errores de validación sin consumir intentos ni mover el foco",
    ],
    mediaSupport: ["Texto", "Pista temática opcional"],
    timing: {
      recommendedSeconds: "30–45 s",
      notes:
        "Es un desafío especial más largo que una pregunta convencional; cuatro intentos mantienen la ronda contenida.",
    },
    scoring: SCORING_POLICIES["mini-wordle"],
    examples: [
      {
        title: "Palabra de astronomía",
        question: {
          id: "guide-mini-wordle-luna",
          type: "mini-wordle",
          category: "Lengua",
          tags: {
            domains: ["language_communication", "natural_sciences"],
            topics: ["vocabulary", "astronomy_planets"],
            cognitiveSkills: ["logical_reasoning", "memory"],
            formatSkills: ["deduction"],
          },
          question: "Descubre una palabra relacionada con la astronomía.",
          hint: "Puede verse en el cielo nocturno.",
          correctAnswer: "LUNA",
          timeLimit: 40,
          points: 150,
          explanation:
            "La palabra es «LUNA». Cada intento revela qué letras están colocadas, desplazadas o ausentes.",
        },
      },
    ],
  },
  "progressive-image": {
    id: "progressive-image",
    slug: "imagen-progresiva",
    name: "Imagen progresivamente revelada",
    shortName: "Imagen progresiva",
    summary: "Identificar una imagen mientras pasa automáticamente de desenfocada a nítida.",
    description: [
      "La imagen se carga antes de iniciar el cronómetro y comienza muy desenfocada. Durante los primeros segundos se vuelve progresivamente nítida, sin que el jugador tenga que solicitar pistas.",
      "El jugador decide cuándo arriesgarse y dispone de un único intento de texto. Acertar antes conserva más puntos porque se ha necesitado menos tiempo y menos información visual.",
    ],
    recommendations: [
      "Monumentos, lugares, animales y objetos con una identidad visual reconocible",
      "Rondas donde percepción, confianza y velocidad deban pesar por igual",
      "Desafíos especiales que refuercen la identidad visual de The Flash",
    ],
    avoidWhen: [
      "Varias respuestas pueden describir razonablemente la misma imagen",
      "El detalle decisivo solo se distingue con zoom o en pantallas grandes",
      "La imagen contiene texto que revela directamente la solución",
    ],
    rules: [
      "El tiempo comienza únicamente cuando la imagen está preparada",
      "El desenfoque disminuye automáticamente hasta mostrar la imagen nítida",
      "Se puede responder en cualquier momento, pero solo existe un intento",
      "Una respuesta incorrecta o agotar el tiempo concede cero puntos",
    ],
    authoringTips: [
      "Usa una respuesta principal y añade variantes habituales sin duplicarlas",
      "Comprueba el reconocimiento tanto al inicio como al final del revelado",
      "Redacta un texto alternativo de juego que no revele la identidad",
      "Describe la imagen completa en solutionAlt para la revisión",
    ],
    accessibility: [
      "Anuncia la carga y los hitos de revelado del 25 %, 50 %, 75 % y 100 %",
      "Permite responder con teclado y mantiene un foco visible",
      "Con movimiento reducido, cambia el desenfoque en cuatro pasos discretos",
      "La mecánica depende de la visión y no ofrece una experiencia equivalente sin revelar la solución",
    ],
    mediaSupport: ["Imagen local rasterizada o SVG", "Texto alternativo no revelador"],
    timing: {
      recommendedSeconds: "15–25 s",
      notes:
        "El revelado debe terminar antes del límite para dejar una breve ventana de respuesta con la imagen nítida.",
    },
    scoring: SCORING_POLICIES["progressive-image"],
    examples: [
      {
        title: "Monumento entre la niebla",
        question: {
          id: "guide-progressive-image-eiffel",
          type: "progressive-image",
          category: "Lugares",
          tags: {
            domains: ["geography", "culture"],
            topics: ["landmarks"],
            cognitiveSkills: ["memory", "comprehension"],
            formatSkills: ["interpretation", "recall"],
          },
          question: "¿Qué monumento aparece en la imagen?",
          surface: {
            src: "/visuals/connections/eiffel-tower.png",
            alt: "Fotografía desenfocada de un monumento que se revela progresivamente",
            width: 847,
            height: 566,
            fit: "cover",
            position: "50% 50%",
          },
          solutionAlt: "Torre Eiffel junto al río Sena bajo un cielo azul",
          revealDuration: 12,
          correctAnswer: "Torre Eiffel",
          acceptedAnswers: ["Torre Eiffel", "Eiffel", "La Torre Eiffel"],
          timeLimit: 20,
          points: 160,
          explanation:
            "La estructura metálica que aparece junto al río Sena es la Torre Eiffel de París.",
        },
      },
    ],
  },
  "time-maze": {
    id: "time-maze",
    slug: "laberinto-contrarreloj",
    name: "Laberinto contrarreloj",
    shortName: "Laberinto",
    summary: "Guiar una ficha desde la entrada hasta la salida antes de agotar el tiempo.",
    description: [
      "El jugador avanza por una cuadrícula de caminos y muros mediante una cruceta táctil o las flechas del teclado. Puede explorar, retroceder y corregir su ruta sin penalización.",
      "La ronda termina automáticamente al alcanzar la salida. El recorrido y los movimientos se conservan para compararlos con una ruta mínima en la revisión.",
    ],
    recommendations: [
      "Razonamiento espacial y orientación breve",
      "Desafíos especiales donde la ejecución sea tan importante como la solución",
      "Rondas táctiles con una condición de éxito inmediata",
    ],
    avoidWhen: [
      "La cuadrícula necesita más de nueve filas o columnas",
      "Los pasillos solo se distinguen mediante detalles visuales pequeños",
      "Se pretende evaluar precisión de arrastre en lugar de orientación",
    ],
    rules: [
      "Solo se puede avanzar a una casilla transitable ortogonalmente adyacente",
      "Se puede retroceder y los movimientos adicionales no reducen puntos",
      "Llegar a la salida envía automáticamente todo el recorrido",
      "El timeout conserva el camino realizado, pero concede cero puntos",
    ],
    authoringTips: [
      "Usa entre cinco y nueve filas y columnas",
      "Incluye una única entrada, una única salida y al menos una ruta válida",
      "Añade desvíos comprensibles sin depender de pasillos de un píxel",
      "Comprueba la ruta mínima y el tiempo necesario en un teléfono",
    ],
    accessibility: [
      "Evita el arrastre libre y ofrece cruceta y flechas del teclado",
      "Deshabilita direcciones bloqueadas y anuncia los muros al usar teclado",
      "Comunica entrada, salida, posición y recorrido con símbolos además de color",
      "Mantén el foco en el tablero y anuncia cada posición y número de movimientos",
    ],
    mediaSupport: ["Cuadrícula ortogonal de 5 × 5 a 9 × 9", "Símbolos de entrada y salida"],
    timing: {
      recommendedSeconds: "30–60 s",
      notes:
        "El límite debe permitir una exploración breve y algún retroceso sin convertir el reto en una prueba larga.",
    },
    scoring: SCORING_POLICIES["time-maze"],
    examples: [
      {
        title: "Salida relámpago",
        question: {
          id: "guide-time-maze",
          type: "time-maze",
          category: "Orientación",
          tags: {
            domains: ["geography", "mathematics"],
            topics: ["orientation", "spatial_logic_puzzles"],
            cognitiveSkills: ["problem_solving"],
            formatSkills: ["planning"],
          },
          question: "Guía el rayo desde S hasta E antes de que se agote el tiempo.",
          grid: { rows: 7, columns: 7 },
          cells: [
            "start",
            "path",
            "path",
            "path",
            "wall",
            "wall",
            "wall",
            "wall",
            "wall",
            "path",
            "wall",
            "path",
            "wall",
            "wall",
            "path",
            "path",
            "path",
            "wall",
            "path",
            "path",
            "path",
            "path",
            "wall",
            "wall",
            "wall",
            "path",
            "wall",
            "path",
            "path",
            "path",
            "path",
            "path",
            "path",
            "wall",
            "path",
            "path",
            "wall",
            "wall",
            "wall",
            "path",
            "path",
            "path",
            "path",
            "path",
            "path",
            "wall",
            "wall",
            "wall",
            "exit",
          ],
          timeLimit: 35,
          points: 150,
          explanation:
            "La ruta conecta la entrada superior izquierda con la salida inferior derecha. Se puede explorar cualquier desvío y retroceder sin perder puntos; solo importa resolver a tiempo.",
        },
      },
    ],
  },
} satisfies QuestionFormatCatalog;

export const questionFormats = Object.values(QUESTION_FORMAT_CATALOG);

export function getQuestionFormatBySlug(slug: string) {
  return questionFormats.find((format) => format.slug === slug);
}
