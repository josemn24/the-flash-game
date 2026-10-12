import type { QuestionFormatGuide } from "../../catalogTypes";
import { SCORING_POLICIES } from "../../scoringPolicies";

export const guide = {
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
} satisfies QuestionFormatGuide<"image-labeling">;
