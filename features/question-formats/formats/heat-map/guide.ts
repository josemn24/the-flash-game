import type { QuestionFormatGuide } from "../../catalogTypes";
import { SCORING_POLICIES } from "../../scoringPolicies";

export const guide = {
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
} satisfies QuestionFormatGuide<"heat-map">;
