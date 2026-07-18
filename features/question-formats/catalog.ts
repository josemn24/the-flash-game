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
          question: "Ordena estos inventos del más antiguo al más reciente.",
          items: ["Internet", "Imprenta", "Teléfono", "Máquina de vapor"],
          correctOrder: ["Imprenta", "Máquina de vapor", "Teléfono", "Internet"],
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
      notes: "El bonus de velocidad se aplica al tiempo hasta confirmar; corregir valores no tiene penalización.",
    },
    scoring: SCORING_POLICIES["mini-sudoku"],
    examples: [
      {
        title: "Cuadrícula de números",
        question: {
          id: "guide-mini-sudoku",
          type: "mini-sudoku",
          category: "Lógica",
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
      notes: "El bonus de velocidad se aplica al tiempo hasta confirmar y el borrador se conserva al agotarse el tiempo.",
    },
    scoring: SCORING_POLICIES["mini-nonogram"],
    examples: [
      {
        title: "Patrón en cruz",
        question: {
          id: "guide-mini-nonogram",
          type: "mini-nonogram",
          category: "Lógica",
          question: "Usa las pistas de filas y columnas para completar el patrón.",
          solution: [
            false, true, true, true, false,
            true, false, true, false, true,
            true, true, true, true, true,
            true, false, true, false, true,
            false, true, true, true, false,
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
      notes: "Los puntos se calculan por la rapidez de resolución; los movimientos se conservan solo para la revisión.",
    },
    scoring: SCORING_POLICIES["sliding-puzzle"],
    examples: [
      {
        title: "Dos deslizamientos",
        question: {
          id: "guide-sliding-puzzle",
          type: "sliding-puzzle",
          category: "Lógica",
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
    recommendations: ["Operaciones breves", "Cronologías", "Clasificaciones y razonamientos lógicos"],
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
      notes: "Reduce el número de pasos antes de ampliar el tiempo si la lectura no cabe con claridad en móvil.",
    },
    scoring: SCORING_POLICIES["error-reconstruction"],
    examples: [
      {
        title: "Operación con corrección",
        question: {
          id: "guide-error-reconstruction-math",
          type: "error-reconstruction",
          category: "Matemáticas",
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
} satisfies QuestionFormatCatalog;

export const questionFormats = Object.values(QUESTION_FORMAT_CATALOG);

export function getQuestionFormatBySlug(slug: string) {
  return questionFormats.find((format) => format.slug === slug);
}
