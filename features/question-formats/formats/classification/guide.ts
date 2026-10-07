import type { QuestionFormatGuide } from "../../catalogTypes";
import { SCORING_POLICIES } from "../../scoringPolicies";

export const guide = {
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
} satisfies QuestionFormatGuide<"classification">;
