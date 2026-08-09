import type { ChallengeDefinition } from "@/types/game";

export const challengeDefinitions = {
  "demo-challenge-definition": {
    id: "demo-challenge-definition",
    title: "Steel Ball Run: primera etapa",
    subtitle: "Carrera, ingenio y reflejos",
    description:
      "Dieciséis retos rápidos sin spoilers inspirados en la carrera transcontinental de Steel Ball Run.",
    mode: "flash",
    questionIds: [
      "sbr-fire-horse-year",
      "sbr-equidae-odd-one-out",
      "sbr-currency-matching",
      "sbr-west-to-east-cities",
      "sbr-grand-canyon-progressive",
      "sbr-grand-canyon-heat-map",
      "sbr-average-speed",
      "sbr-1890-gear-classification",
      "sbr-race-anagram",
      "sbr-pony-express",
      "sbr-horses-sleep-standing",
      "sbr-steel-composition",
      "sbr-horse-gaits",
      "sbr-bernoulli-principle",
      "sbr-overtake-second-trap",
      "sbr-creator",
    ],
    questionPoints: {
      "sbr-fire-horse-year": 6,
      "sbr-equidae-odd-one-out": 6,
      "sbr-currency-matching": 7,
      "sbr-west-to-east-cities": 7,
      "sbr-grand-canyon-progressive": 7,
      "sbr-grand-canyon-heat-map": 7,
      "sbr-average-speed": 6,
      "sbr-1890-gear-classification": 6,
      "sbr-race-anagram": 6,
      "sbr-pony-express": 6,
      "sbr-horses-sleep-standing": 6,
      "sbr-steel-composition": 6,
      "sbr-horse-gaits": 6,
      "sbr-bernoulli-principle": 6,
      "sbr-overtake-second-trap": 6,
      "sbr-creator": 6,
    },
  },
  "connections-challenge-definition": {
    id: "connections-challenge-definition",
    title: "Conexiones rápidas",
    subtitle: "Patrones, imágenes y cultura bajo presión",
    description:
      "Diez retos para enlazar ideas, detectar patrones y reconocer pistas antes de que se escape el tiempo.",
    mode: "flash",
    questionIds: [
      "letter-pattern",
      "australia-capital",
      "gold-symbol",
      "italy-flag",
      "inventions-order",
      "byte-bits",
      "red-planet",
      "eiffel-tower",
      "logic-connection",
      "living-things-classification",
    ],
    questionPoints: {
      "letter-pattern": 10,
      "australia-capital": 9,
      "gold-symbol": 10,
      "italy-flag": 9,
      "inventions-order": 11,
      "byte-bits": 9,
      "red-planet": 10,
      "eiffel-tower": 11,
      "logic-connection": 11,
      "living-things-classification": 10,
    },
  },
  "animals-alphabet-definition": {
    id: "animals-alphabet-definition",
    title: "Reino de animales",
    subtitle: "Dieciocho letras, una sola cuenta atrás",
    description:
      "Recorre dieciocho letras, responde un animal para cada una y pasa las que quieras recuperar antes de que se agote el tiempo.",
    mode: "alphabet",
    timeLimit: 135,
    entries: [
      { letter: "A", questionId: "alphabet-animals-a" },
      { letter: "B", questionId: "alphabet-animals-b" },
      { letter: "C", questionId: "alphabet-animals-c" },
      { letter: "D", questionId: "alphabet-animals-d" },
      { letter: "E", questionId: "alphabet-animals-e" },
      { letter: "F", questionId: "alphabet-animals-f" },
      { letter: "G", questionId: "alphabet-animals-g" },
      { letter: "H", questionId: "alphabet-animals-h" },
      { letter: "I", questionId: "alphabet-animals-i" },
      { letter: "J", questionId: "alphabet-animals-j" },
      { letter: "L", questionId: "alphabet-animals-l" },
      { letter: "M", questionId: "alphabet-animals-m" },
      { letter: "O", questionId: "alphabet-animals-o" },
      { letter: "P", questionId: "alphabet-animals-p" },
      { letter: "R", questionId: "alphabet-animals-r" },
      { letter: "S", questionId: "alphabet-animals-s" },
      { letter: "T", questionId: "alphabet-animals-t" },
      { letter: "Z", questionId: "alphabet-animals-z" },
    ],
  },
  "spain-survival-definition": {
    id: "spain-survival-definition",
    title: "Supervivencia: España",
    subtitle: "20 retos, 3 vidas",
    description:
      "Aguanta una ruta de cultura general sobre España: mapas, patrimonio, lengua, ciencia, arte y lógica con tres vidas.",
    mode: "survival",
    lives: 3,
    questionIds: [
      "spain-survival-teide",
      "spain-survival-food-odd",
      "spain-survival-city-monument",
      "spain-survival-felipe-ii",
      "spain-survival-west-east-cities",
      "spain-survival-sagrada-progressive",
      "spain-survival-ramon-cajal",
      "spain-survival-map-santa-cruz-tenerife",
      "spain-survival-cinema",
      "spain-survival-sports-matching",
      "spain-survival-don-quixote-real-name",
      "spain-survival-surface-area",
      "spain-survival-history-order",
      "spain-survival-art-matching",
      "spain-survival-alhambra-pattern",
      "spain-survival-literature-publication-order",
      "spain-survival-nadal-grand-slams",
      "spain-survival-seat-rows-total",
      "spain-survival-catalan-dance",
      "spain-survival-oak-tree",
    ],
    questionPoints: {
      "spain-survival-teide": 5,
      "spain-survival-felipe-ii": 5,
      "spain-survival-map-santa-cruz-tenerife": 5,
      "spain-survival-food-odd": 4,
      "spain-survival-city-monument": 5,
      "spain-survival-west-east-cities": 5,
      "spain-survival-don-quixote-real-name": 5,
      "spain-survival-ramon-cajal": 5,
      "spain-survival-cinema": 5,
      "spain-survival-surface-area": 5,
      "spain-survival-sagrada-progressive": 5,
      "spain-survival-nadal-grand-slams": 5,
      "spain-survival-history-order": 5,
      "spain-survival-literature-publication-order": 5,
      "spain-survival-sports-matching": 5,
      "spain-survival-alhambra-pattern": 5,
      "spain-survival-art-matching": 5,
      "spain-survival-seat-rows-total": 5,
      "spain-survival-catalan-dance": 5,
      "spain-survival-oak-tree": 6,
    },
  },
  "antarctica-narrative-definition": {
    id: "antarctica-narrative-definition",
    title: "Encuentros en el fin del mundo",
    subtitle: "Una señal bajo el hielo",
    description:
      "Acompaña a un equipo de campo en la Antártida, registra lo que observas y ayuda a interpretar una señal que se repite cada cuarenta segundos.",
    mode: "narrative",
    implementationStatus: "prototype",
    maxScore: 24,
    prologue: {
      id: "scene-prologue",
      eyebrow: "Prólogo",
      title: "El cuaderno",
      blocks: [
        {
          type: "narration",
          text: "Tras la ventanilla, la nieve convierte el mundo en una página en blanco. Al bajar, el frío encuentra el hueco entre guante y manga.",
        },
        {
          type: "narration",
          text: "Nora Valdés te entrega un cuaderno impermeable. En la primera página: 40 segundos.",
        },
        {
          type: "dialogue",
          speaker: "Nora",
          text: "Un instrumento bajo el hielo repite una señal con ese intervalo. Esta tarde iremos a revisarlo. Por ahora, observa.",
        },
      ],
    },
    beats: [
      {
        id: "arrival",
        title: "Llegada",
        steps: [
          {
            type: "scene",
            scene: {
              id: "scene-arrival",
              eyebrow: "Movimiento I · Llegada",
              blocks: [
                {
                  type: "narration",
                  text: "El viento borra el avión y después el primer poste. La estación debería estar delante, pero cada dirección parece la misma.",
                },
                {
                  type: "narration",
                  text: "Nora te entrega una brújula y una tarjeta. La aguja marca 090°; una corrección convierte esa lectura en rumbo de mapa.",
                },
                {
                  type: "dialogue",
                  speaker: "Nora",
                  text: "La estación no se ha movido. Corrige la lectura y elige por dónde seguimos.",
                },
              ],
            },
          },
          {
            type: "question",
            questionId: "antarctica-orientation-calibration",
            unlockEntryIds: ["note-calibration"],
            reactions: {
              correct: [
                {
                  type: "dialogue",
                  speaker: "Nora",
                  text: "Bien. Podemos orientarnos.",
                },
              ],
              incorrect: [
                {
                  type: "narration",
                  text: "Nora enfrenta tarjeta y aguja.",
                },
                {
                  type: "dialogue",
                  speaker: "Nora",
                  text: "El mapa necesita 060°. Lo anotamos.",
                },
              ],
              timeout: [
                {
                  type: "narration",
                  text: "El viento borra las huellas. Nora fija el rumbo: 060°.",
                },
              ],
            },
          },
          {
            type: "scene",
            scene: {
              id: "scene-after-q1",
              eyebrow: "Movimiento I · Llegada",
              blocks: [
                {
                  type: "narration",
                  text: "Las luces aparecen detrás de la nieve. Al detenerte, el sudor empieza a enfriarse bajo el cortavientos.",
                },
                {
                  type: "narration",
                  text: "Nora abre tu chaqueta: llevas base seca y barrera exterior, pero nada que retenga aire caliente entre ambas.",
                },
                {
                  type: "dialogue",
                  speaker: "Nora",
                  text: "Al frío le basta con una capa sin completar.",
                },
              ],
            },
          },
          {
            type: "question",
            questionId: "antarctica-cold-layer",
            unlockEntryIds: ["note-weather"],
            reactions: {
              correct: [
                {
                  type: "narration",
                  text: "Nora cierra la chaqueta.",
                },
                {
                  type: "dialogue",
                  speaker: "Nora",
                  text: "Así conservas el aire caliente.",
                },
              ],
              incorrect: [
                {
                  type: "narration",
                  text: "Nora añade un forro polar.",
                },
                {
                  type: "dialogue",
                  speaker: "Nora",
                  text: "Necesitamos aislamiento entre base y viento.",
                },
              ],
              timeout: [
                {
                  type: "narration",
                  text: "Tus dedos se entumecen. Nora te ayuda a añadir aislamiento.",
                },
              ],
            },
          },
        ],
      },
    ],
    notebookEntries: [
      {
        id: "note-calibration",
        text: "Calibración: rumbo de mapa = lectura de brújula − 30°.",
        relevance: "potential",
      },
      {
        id: "note-weather",
        text: "Condiciones al aterrizar: −18 °C. Capas: base + aislamiento + cortavientos.",
        relevance: "context",
      },
    ],
    questionPoints: {
      "antarctica-orientation-calibration": 12,
      "antarctica-cold-layer": 12,
    },
  },
} satisfies Record<string, ChallengeDefinition>;

export type KnownChallengeDefinitionId = keyof typeof challengeDefinitions;

export function getChallengeDefinitionById(id: string) {
  return challengeDefinitions[id as KnownChallengeDefinitionId];
}
