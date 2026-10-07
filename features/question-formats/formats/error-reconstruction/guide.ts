import type { QuestionFormatGuide } from "../../catalogTypes";
import { SCORING_POLICIES } from "../../scoringPolicies";

export const guide = {
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
} satisfies QuestionFormatGuide<"error-reconstruction">;
