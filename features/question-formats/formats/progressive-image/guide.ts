import type { QuestionFormatGuide } from "../../catalogTypes";
import { SCORING_POLICIES } from "../../scoringPolicies";

export const guide = {
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
} satisfies QuestionFormatGuide<"progressive-image">;
