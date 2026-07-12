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
  example: QuestionOfType<T>;
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
    example: {
      id: "guide-choice",
      type: "multiple-choice",
      category: "Geografía",
      question: "¿Cuál es la capital de Canadá?",
      options: ["Toronto", "Ottawa", "Vancouver", "Montreal"],
      correctAnswer: "Ottawa",
      timeLimit: 12,
      points: 100,
      explanation: "Ottawa es la capital de Canadá.",
    },
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
    example: {
      id: "guide-odd-one-out",
      type: "odd-one-out",
      category: "Lengua",
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
    example: {
      id: "guide-matching",
      type: "matching",
      category: "Geografía",
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
      explanation: "Japón, Italia y Francia tienen banderas nacionales claramente diferenciadas.",
    },
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
    example: {
      id: "guide-true-false",
      type: "true-false",
      category: "Ciencia",
      question: "El sonido puede viajar por el vacío del espacio.",
      correctAnswer: false,
      timeLimit: 9,
      points: 100,
      explanation: "El sonido necesita un medio material por el que propagarse.",
    },
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
    example: {
      id: "guide-short-text",
      type: "short-text",
      category: "Historia",
      question: "¿En qué año terminó la Segunda Guerra Mundial?",
      correctAnswer: "1945",
      acceptedAnswers: ["1945", "mil novecientos cuarenta y cinco"],
      timeLimit: 13,
      points: 120,
      explanation: "La Segunda Guerra Mundial terminó en 1945.",
    },
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
    example: {
      id: "guide-ordering",
      type: "ordering",
      category: "Historia",
      question: "Ordena estos inventos del más antiguo al más reciente.",
      items: ["Internet", "Imprenta", "Teléfono", "Máquina de vapor"],
      correctOrder: ["Imprenta", "Máquina de vapor", "Teléfono", "Internet"],
      timeLimit: 16,
      points: 140,
      explanation: "La imprenta precede a la máquina de vapor, el teléfono e Internet.",
    },
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
    example: {
      id: "guide-classification",
      type: "classification",
      category: "Biología",
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
    example: {
      id: "guide-logic-code",
      type: "logic-code",
      category: "Lógica",
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
    example: {
      id: "guide-estimation",
      type: "estimation",
      category: "Lugares",
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
} satisfies QuestionFormatCatalog;

export const questionFormats = Object.values(QUESTION_FORMAT_CATALOG);

export function getQuestionFormatBySlug(slug: string) {
  return questionFormats.find((format) => format.slug === slug);
}
