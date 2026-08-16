import type {
  ChallengeDefinition,
  NarrativeReactionMap,
  NarrativeScene,
  NarrativeTextBlock,
  QuestionMedia,
} from "@/types/game";

const narration = (text: string): NarrativeTextBlock => ({ type: "narration", text });
const dialogue = (speaker: string, text: string): NarrativeTextBlock => ({
  type: "dialogue",
  speaker,
  text,
});

function narrativeImage(src: string, alt: string, position = "50% 50%"): QuestionMedia {
  return { type: "image", src, alt, fit: "cover", position };
}

function scene(
  id: string,
  eyebrow: string,
  title: string,
  media: QuestionMedia,
  blocks: NarrativeTextBlock[],
): NarrativeScene {
  return { id, eyebrow, title, media, blocks };
}

function reactions(correct: string, incorrect: string, timeout: string): NarrativeReactionMap {
  return {
    correct: [narration(correct)],
    incorrect: [narration(incorrect)],
    timeout: [narration(timeout)],
  };
}

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
    title: "El que caminaba hacia las montañas",
    subtitle: "Una dirección no es una explicación",
    description:
      "Sigue el rastro de un pingüino que abandona la colonia, protege su recorrido de cualquier intervención y escribe únicamente aquello que las imágenes permiten afirmar.",
    mode: "narrative",
    implementationStatus: "complete",
    maxScore: 100,
    prologue: scene(
      "scene-prologue",
      "Prólogo · Todos menos uno",
      "Todos menos uno",
      narrativeImage(
        "/visuals/p17/colony-panorama.jpg",
        "Una colonia avanza hacia el mar mientras un pingüino se separa hacia las montañas",
        "50% 52%",
      ),
      [
        narration(
          "La voz de un antiguo investigador llega desde una grabación deformada por el viento y por los años.",
        ),
        dialogue(
          "Grabación",
          "A veces un pingüino se desorienta. Puede terminar muy lejos del océano, en un lugar donde no esperaríamos encontrarlo.",
        ),
        narration(
          "Durante unos segundos solo queda el siseo de la cinta. Cientos de pingüinos avanzan hacia el agua abierta. Todos caminan en la misma dirección. Todos menos uno.",
        ),
      ],
    ),
    beats: [
      {
        id: "all-but-one",
        title: "Todos menos uno",
        steps: [
          {
            type: "question",
            questionId: "mountains-progressive-image",
            unlockEntryIds: ["note-direction"],
            reactions: reactions(
              "La cámara conserva la referencia: montañas, hacia el interior.",
              "Nora congela el fotograma y marca la línea de montañas. Esa es la dirección observable.",
              "La imagen termina de revelarse. P-17 se orienta hacia las montañas.",
            ),
          },
          {
            type: "scene",
            scene: scene(
              "scene-p17",
              "Capítulo I · P-17",
              "Una marca, no una razón",
              narrativeImage(
                "/visuals/p17/p17-identification.jpg",
                "P-17 frente a una cordillera, con la colonia desenfocada al fondo",
                "42% 50%",
              ),
              [
                narration(
                  "La cámara se acerca. En el lado izquierdo de su pecho aparece una pequeña muesca blanca. Nora la anota como identificación visual provisional: P-17.",
                ),
                narration(
                  "El pingüino se detiene, gira y avanza hacia las montañas. No corre. No vuelve a incorporarse a la columna.",
                ),
                dialogue("Nora", "Conserva la imagen. Todavía no escribas una razón."),
              ],
            ),
          },
          {
            type: "question",
            questionId: "trajectory-deviation-heat-map",
            unlockEntryIds: ["note-deviation"],
            reactions: reactions(
              "El punto queda fijado: aquí abandona el corredor de la colonia.",
              "Nora superpone de nuevo las trayectorias y registra el inicio exacto del desvío.",
              "La superposición automática localiza el desvío en el sector C3.",
            ),
          },
          {
            type: "scene",
            scene: scene(
              "scene-camera-limits",
              "Capítulo I · Lo que una cámara no sabe",
              "Lo observable",
              narrativeImage(
                "/visuals/p17/p17-identification.jpg",
                "P-17 permanece orientado hacia las montañas",
                "42% 50%",
              ),
              [
                dialogue("Equipo", "Podríamos decir que está perdido."),
                dialogue("Nora", "Podríamos pensarlo. La imagen solo demuestra que se separa."),
                narration(
                  "En la mesa aparecen movimientos, tiempos y direcciones junto a frases que atribuyen al animal una intención que ningún instrumento ha medido.",
                ),
              ],
            ),
          },
          {
            type: "question",
            questionId: "observation-vs-interpretation",
            unlockEntryIds: ["note-register-rule"],
            reactions: reactions(
              "El registro conserva únicamente lo que los instrumentos pueden sostener.",
              "Nora retira las frases que necesitan suponer qué piensa o siente P-17.",
              "El equipo completa la clasificación antes de continuar.",
            ),
          },
        ],
      },
      {
        id: "stay-out",
        title: "Mantenerse fuera",
        steps: [
          {
            type: "scene",
            scene: scene(
              "scene-corridor",
              "Capítulo II · Mantenerse fuera",
              "El corredor",
              narrativeImage(
                "/visuals/p17/camp-corridor.jpg",
                "Equipo de campamento bloquea temporalmente un corredor de nieve",
                "50% 52%",
              ),
              [
                narration(
                  "Al amanecer, P-17 reaparece cerca del campamento base. Entre él y la llanura hay cajas, trineos y un trípode colocado durante la noche.",
                ),
                narration(
                  "El protocolo exige no tocar al animal, no llamarlo y permanecer fuera de su distancia de seguridad. El obstáculo debe desaparecer antes de que se acerque.",
                ),
                dialogue(
                  "Nora",
                  "Él no ha elegido nuestros objetos. Esa diferencia nos obliga a retirarlos.",
                ),
              ],
            ),
          },
          {
            type: "question",
            questionId: "clear-camp-escape",
            unlockEntryIds: ["note-intervention"],
            reactions: reactions(
              "El trípode sale del corredor. El equipo vuelve a la distancia de seguridad.",
              "Nora completa la retirada desde el lateral protegido.",
              "El equipo retira el último obstáculo antes de la llegada de P-17.",
            ),
          },
          {
            type: "scene",
            scene: scene(
              "scene-nadir",
              "Capítulo II · Campamento Nadir",
              "Tres coincidencias",
              narrativeImage(
                "/visuals/p17/camp-corridor.jpg",
                "Campamento ficticio en una llanura antártica",
                "66% 44%",
              ),
              [
                narration(
                  "P-17 atraviesa el límite del campamento sin variar la dirección registrada. Dos días después llega un mensaje de Nadir.",
                ),
                narration(
                  "Una cámara remota ha registrado un pingüino que entra desde el nordeste y continúa hacia el suroeste. La distancia impide reconocerlo a simple vista.",
                ),
                dialogue(
                  "Nora",
                  "Compara marca, rumbo y tiempo. La compatibilidad necesita las tres columnas.",
                ),
              ],
            ),
          },
          {
            type: "question",
            questionId: "p17-evidence-matrix",
            unlockEntryIds: ["note-nadir"],
            reactions: reactions(
              "Las tres columnas coinciden con P-17.",
              "Nora compara las filas: solo P-17 coincide en los tres criterios.",
              "El equipo registra P-17 como identificación compatible.",
            ),
          },
        ],
      },
      {
        id: "complete-line",
        title: "La línea completa",
        steps: [
          {
            type: "scene",
            scene: scene(
              "scene-complete-line",
              "Capítulo III · La línea completa",
              "Seis registros",
              narrativeImage(
                "/visuals/p17/colony-panorama.jpg",
                "Llanura entre la colonia, el mar y las montañas",
                "45% 60%",
              ),
              [
                narration(
                  "La identificación compatible permite incorporar Nadir. La colonia, el primer desvío, la base, H-3 y una última cámara completan los otros cinco registros.",
                ),
                narration(
                  "Nora coloca los seis puntos sobre una cuadrícula de sectores. No representa una escala exacta; comprueba el orden espacial de las observaciones.",
                ),
              ],
            ),
          },
          {
            type: "question",
            questionId: "p17-route-zip",
            unlockEntryIds: ["note-route"],
            reactions: reactions(
              "Los seis registros forman una trayectoria continua.",
              "Nora conserva los puntos confirmados y completa el único recorrido compatible.",
              "El sistema enlaza los seis registros antes de cerrar el mapa.",
            ),
          },
          {
            type: "scene",
            scene: scene(
              "scene-story-is-not-cause",
              "Capítulo III · Una historia no es una causa",
              "Antes y después",
              narrativeImage(
                "/visuals/p17/p17-identification.jpg",
                "P-17 frente a las montañas durante la observación",
                "42% 50%",
              ),
              [
                narration(
                  "La trayectoria queda continua. El recorrido elimina dudas sobre dónde fue observado P-17, pero no explica por qué siguió esa dirección.",
                ),
                dialogue(
                  "Nora",
                  "Cuanto más completo es el recorrido, más fácil resulta imaginar una intención. El cuaderno debe resistirse a esa facilidad.",
                ),
              ],
            ),
          },
          {
            type: "question",
            questionId: "p17-observation-order",
            unlockEntryIds: ["note-chronology"],
            reactions: reactions(
              "Los hechos quedan ordenados sin añadir una explicación.",
              "Nora recompone la secuencia usando las marcas de tiempo.",
              "El cuaderno ordena automáticamente los cinco registros.",
            ),
          },
          {
            type: "scene",
            scene: scene(
              "scene-last-sheet",
              "Capítulo III · La última hoja",
              "El límite del registro",
              narrativeImage(
                "/visuals/p17/final-plain.jpg",
                "Un pingüino lejano cruza una llanura hacia las montañas dejando huellas",
              ),
              [
                narration(
                  "P-17 avanza sobre una llanura sin referencias próximas. El equipo conserva la distancia establecida por el protocolo.",
                ),
                narration(
                  "El animal se detiene, sacude la nieve de las plumas y continúa. Nora entrega la última hoja.",
                ),
                dialogue(
                  "Nora",
                  "Escribe lo que sabemos. Si una frase necesita entrar en su cabeza, no pertenece al registro.",
                ),
              ],
            ),
          },
          {
            type: "question",
            questionId: "p17-final-record",
            unlockEntryIds: ["note-final"],
            reactions: reactions(
              "La última hoja conserva la trayectoria y deja fuera la causa.",
              "Nora elimina la atribución de intención y escribe el límite de la evidencia.",
              "El informe se cierra con una conclusión limitada a los registros.",
            ),
          },
          {
            type: "scene",
            scene: scene(
              "scene-resolution",
              "Desenlace",
              "El que caminaba hacia las montañas",
              narrativeImage(
                "/visuals/p17/final-plain.jpg",
                "P-17 y sus huellas se pierden en la inmensidad de la llanura",
              ),
              [
                narration(
                  "P-17 abandonó la dirección de la colonia, cruzó el campamento base, fue identificado de forma compatible en Nadir y continuó hacia las montañas. La causa de la trayectoria no pudo determinarse.",
                ),
                narration(
                  "La imagen se aleja. Primero se ve el pingüino. Después, sus huellas. Después, la llanura entera. La cámara deja de seguirlo antes de que desaparezca en la distancia.",
                ),
              ],
            ),
          },
          {
            type: "scene",
            scene: {
              id: "scene-epilogue",
              eyebrow: "Epílogo",
              presentation: "blackout",
              blocks: [narration("La imagen se funde a negro.")],
            },
          },
        ],
      },
    ],
    notebookEntries: [
      {
        id: "note-direction",
        text: "P-17: muesca blanca en el lado izquierdo del pecho. Dirección inicial: montañas, hacia el interior.",
        relevance: "context",
      },
      {
        id: "note-deviation",
        text: "Inicio del desvío localizado en el sector C3 del mapa de observación.",
        relevance: "context",
      },
      {
        id: "note-register-rule",
        text: "Regla de registro: describir movimiento, posición y tiempo; no atribuir intención.",
        relevance: "context",
      },
      {
        id: "note-intervention",
        text: "Intervención humana retirada antes del paso de P-17; sin contacto ni aproximación.",
        relevance: "context",
      },
      {
        id: "note-nadir",
        text: "Nadir: identificación compatible con P-17 por marca, rumbo y ventana temporal.",
        relevance: "context",
      },
      {
        id: "note-route",
        text: "Recorrido reconstruido: colonia → desvío → base → H-3 → Nadir → interior.",
        relevance: "context",
      },
      {
        id: "note-chronology",
        text: "Secuencia temporal verificada en cinco observaciones.",
        relevance: "context",
      },
      {
        id: "note-final",
        text: "P-17 abandonó la dirección de la colonia, cruzó el campamento base, fue identificado de forma compatible en Nadir y continuó hacia las montañas. La causa de la trayectoria no pudo determinarse.",
        relevance: "context",
      },
    ],
    questionPoints: {
      "mountains-progressive-image": 10,
      "trajectory-deviation-heat-map": 10,
      "observation-vs-interpretation": 12,
      "clear-camp-escape": 12,
      "p17-evidence-matrix": 12,
      "p17-route-zip": 14,
      "p17-observation-order": 12,
      "p17-final-record": 18,
    },
  },
} satisfies Record<string, ChallengeDefinition>;

export type KnownChallengeDefinitionId = keyof typeof challengeDefinitions;

export function getChallengeDefinitionById(id: string) {
  return challengeDefinitions[id as KnownChallengeDefinitionId];
}
