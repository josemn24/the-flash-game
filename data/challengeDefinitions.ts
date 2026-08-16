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
const emphasis = (text: string): NarrativeTextBlock => ({ type: "emphasis", text });

function narrativeImage(src: string, alt: string, position = "50% 50%"): QuestionMedia {
  return { type: "image", src, alt, fit: "cover", position };
}

function storyScene(id: string, scene: Omit<NarrativeScene, "id">): NarrativeScene {
  return { id, ...scene };
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
    prologue: storyScene("scene-prologue-recording", {
      eyebrow: "Capítulo I",
      title: "Todos menos uno",
      presentation: "chapter-opening",
      media: narrativeImage(
        "/visuals/p17/archive-recorder.jpg",
        "Una grabadora de cinta y un monitor de archivo iluminan una estación antártica oscura",
        "42% 50%",
      ),
      caption: "Archivo de campo · cinta sin fechar",
      blocks: [
        narration(
          "La cinta llevaba años guardada en una caja sin fecha. Cuando Nora pulsó el interruptor, el motor tardó unos segundos en vencer el frío.",
        ),
        narration(
          "Primero llegó el roce del carrete. Después, el viento. Por último, la voz de alguien que ya no estaba allí.",
        ),
        dialogue(
          "Grabación",
          "A veces un pingüino se desorienta. Puede terminar muy lejos del océano, en un lugar donde no esperaríamos encontrarlo.",
        ),
      ],
    }),
    beats: [
      {
        id: "all-but-one",
        title: "Todos menos uno",
        steps: [
          {
            type: "scene",
            scene: storyScene("scene-all-but-one", {
              presentation: "full-bleed",
              media: narrativeImage(
                "/visuals/p17/colony-panorama.jpg",
                "Una colonia avanza hacia el mar mientras un pingüino se separa hacia las montañas",
                "50% 52%",
              ),
              caption: "Primer registro · 06:42",
              blocks: [
                narration(
                  "La imagen emergió despacio del ruido: una llanura blanca, la línea de las montañas y la colonia moviéndose hacia el agua abierta.",
                ),
                emphasis("Todos avanzaban en la misma dirección. Todos menos uno."),
              ],
            }),
          },
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
            scene: storyScene("scene-p17-identification", {
              presentation: "split",
              media: narrativeImage(
                "/visuals/p17/p17-identification.jpg",
                "P-17 frente a una cordillera, con la colonia desenfocada al fondo",
                "42% 50%",
              ),
              caption: "Muesca blanca · lado izquierdo del pecho",
              blocks: [
                narration(
                  "Nora detuvo el fotograma. En el lado izquierdo del pecho había una muesca blanca, pequeña y desigual. Bastaba para volver a encontrarlo entre otras imágenes.",
                ),
                narration(
                  "En el margen del cuaderno escribió una identificación provisional: P-17.",
                ),
              ],
            }),
          },
          {
            type: "scene",
            scene: storyScene("scene-p17-register", {
              presentation: "text-led",
              blocks: [
                narration(
                  "El pingüino se detuvo una vez. La colonia siguió alejándose hacia el mar. Luego P-17 giró y continuó hacia las montañas hasta que el viento empezó a borrar sus huellas.",
                ),
                dialogue("Nora", "¿Lo has registrado?"),
                narration("Asentiste sin apartar la mirada de la pantalla."),
                dialogue("Nora", "Entonces conserva la imagen. Todavía no escribas una razón."),
              ],
            }),
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
            scene: storyScene("scene-deviation-overlay", {
              presentation: "artifact",
              media: narrativeImage(
                "/visuals/p17/observation-table.jpg",
                "Mapas, fotografías y trayectorias de pingüinos se superponen sobre una mesa de observación",
                "56% 50%",
              ),
              caption: "Superposición de recorridos · sector C3",
              blocks: [
                narration(
                  "Nora trazó una cruz allí donde la línea de P-17 abandonaba el corredor de la colonia. Debajo del papel translúcido, cientos de recorridos terminaban en el mar; uno solo continuaba hacia el interior.",
                ),
              ],
            }),
          },
          {
            type: "scene",
            scene: storyScene("scene-camera-limits", {
              presentation: "text-led",
              blocks: [
                dialogue("Equipo", "Podríamos decir que está perdido."),
                narration("Nora dejó el lápiz sobre el borde del cuaderno."),
                dialogue(
                  "Nora",
                  "Podríamos pensarlo. Pero la imagen solo demuestra que se separa.",
                ),
                narration(
                  "Sobre la mesa convivían dos clases de frase. Unas hablaban de posiciones, minutos y direcciones. Las otras cruzaban una frontera invisible y entraban en la mente del animal.",
                ),
              ],
            }),
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
          {
            type: "scene",
            scene: storyScene("scene-observation-rule", {
              presentation: "text-led",
              blocks: [
                narration(
                  "Al caer la tarde, Nora cerró el primer cuaderno. Las frases que no podían sostenerse habían quedado fuera. En las páginas permanecían una marca blanca, una hora, un punto del mapa y una dirección.",
                ),
                emphasis("Era menos que una explicación. Era todo lo que sabían."),
              ],
            }),
          },
        ],
      },
      {
        id: "stay-out",
        title: "Mantenerse fuera",
        steps: [
          {
            type: "scene",
            scene: storyScene("scene-chapter-stay-out", {
              eyebrow: "Capítulo II",
              title: "Mantenerse fuera",
              presentation: "chapter-opening",
              media: narrativeImage(
                "/visuals/p17/camp-corridor.jpg",
                "Un campamento de observación ocupa una llanura recorrida por P-17",
                "58% 48%",
              ),
              blocks: [
                narration(
                  "Durante la noche cambió el viento. Al amanecer, una figura oscura apareció al otro lado del campamento base.",
                ),
              ],
            }),
          },
          {
            type: "scene",
            scene: storyScene("scene-corridor", {
              presentation: "split",
              media: narrativeImage(
                "/visuals/p17/camp-corridor.jpg",
                "Equipo de campamento bloquea temporalmente un corredor de nieve",
                "50% 52%",
              ),
              caption: "Campamento base · corredor este",
              blocks: [
                narration(
                  "P-17 avanzaba hacia el corredor este. Entre él y la llanura quedaban cajas, trineos y un trípode que el equipo había instalado durante la noche.",
                ),
                narration(
                  "Nadie podía tocarlo, llamarlo ni cerrarle el paso. Eran los objetos humanos los que debían desaparecer.",
                ),
                dialogue(
                  "Nora",
                  "Nosotros conocemos su posición. Él no ha elegido nuestros objetos. Esa diferencia nos obliga a retirarlos.",
                ),
              ],
            }),
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
            scene: storyScene("scene-camp-cleared", {
              presentation: "full-bleed",
              media: narrativeImage(
                "/visuals/p17/cleared-camp.jpg",
                "P-17 atraviesa un corredor despejado mientras el equipo permanece lejos",
                "52% 55%",
              ),
              caption: "Corredor despejado · sin contacto",
              blocks: [
                narration(
                  "Cuando el trípode alcanzó la salida de servicio, el corredor volvió a ser una franja de nieve vacía. El equipo retrocedió hasta las tiendas.",
                ),
                narration(
                  "P-17 cruzó el campamento sin variar la dirección registrada. Nadie se acercó. Durante unos segundos solo se oyó el viento entre los cables.",
                ),
              ],
            }),
          },
          {
            type: "scene",
            scene: storyScene("scene-nadir-message", {
              presentation: "artifact",
              media: narrativeImage(
                "/visuals/p17/nadir-monitor.jpg",
                "Un monitor remoto muestra un pingüino distante y tres fragmentos de evidencia",
                "48% 50%",
              ),
              caption: "Transmisión entrante · estación Nadir",
              blocks: [
                narration(
                  "Dos días más tarde, la pantalla de comunicaciones se encendió con un destello azul. Nadir había registrado un pingüino entrando desde el nordeste y continuando hacia el suroeste.",
                ),
                narration(
                  "La figura era demasiado pequeña para reconocerla. Junto al vídeo llegaron tres fragmentos: una marca en el pecho, un rumbo y una ventana de tiempo.",
                ),
              ],
            }),
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
          {
            type: "scene",
            scene: storyScene("scene-nadir-match", {
              presentation: "text-led",
              blocks: [
                narration(
                  "Nora recorrió las tres columnas una última vez. La muesca, el rumbo y el intervalo coincidían en una sola fila.",
                ),
                emphasis("Compatible con P-17."),
                narration(
                  "No escribió que fuera él con absoluta certeza. Cerró la carpeta y dejó que aquella cautela permaneciera en la frase.",
                ),
              ],
            }),
          },
        ],
      },
      {
        id: "complete-line",
        title: "La línea completa",
        steps: [
          {
            type: "scene",
            scene: storyScene("scene-chapter-complete-line", {
              eyebrow: "Capítulo III",
              title: "La línea completa",
              presentation: "chapter-opening",
              media: narrativeImage(
                "/visuals/p17/final-plain.jpg",
                "Una figura y sus huellas avanzan hacia montañas lejanas",
                "50% 54%",
              ),
              blocks: [
                narration(
                  "Las cámaras no habían visto un viaje. Habían conservado fragmentos separados por horas de oscuridad y kilómetros de nieve.",
                ),
              ],
            }),
          },
          {
            type: "scene",
            scene: storyScene("scene-six-records", {
              presentation: "artifact",
              media: narrativeImage(
                "/visuals/p17/route-board.jpg",
                "Seis registros físicos forman una línea desde la costa hacia las montañas",
                "50% 50%",
              ),
              caption: "Colonia · desvío · base · H-3 · Nadir · último registro",
              blocks: [
                narration(
                  "Nora extendió seis registros sobre la mesa: la colonia, el primer desvío, la base, H-3, Nadir y una última cámara orientada hacia el interior.",
                ),
                narration(
                  "Entre uno y otro había zonas que nadie había observado. La cuadrícula no podía llenarlas con certezas, pero sí comprobar si los fragmentos admitían una línea continua.",
                ),
              ],
            }),
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
            scene: storyScene("scene-route-complete", {
              presentation: "full-bleed",
              media: narrativeImage(
                "/visuals/p17/route-board.jpg",
                "Los seis registros quedan enlazados por una trayectoria continua",
                "50% 50%",
              ),
              caption: "Único recorrido compatible con los seis registros",
              blocks: [
                narration(
                  "La línea atravesó los seis registros sin romperse. Por primera vez, los fragmentos podían leerse como una trayectoria completa desde la colonia hasta el interior.",
                ),
              ],
            }),
          },
          {
            type: "scene",
            scene: storyScene("scene-story-is-not-cause", {
              presentation: "text-led",
              blocks: [
                narration(
                  "Al verla terminada, alguien dijo que por fin tenían la historia. Nora observó la línea azul, tan limpia que parecía contener una respuesta.",
                ),
                dialogue("Nora", "Tenemos un antes y un después. No tenemos un porqué."),
                narration(
                  "Cuanto más completo resultaba el recorrido, más fácil era imaginar una intención. El cuaderno debía resistirse precisamente a esa facilidad.",
                ),
              ],
            }),
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
            scene: storyScene("scene-last-sheet", {
              presentation: "split",
              media: narrativeImage(
                "/visuals/p17/final-plain.jpg",
                "Un pingüino lejano cruza una llanura hacia las montañas dejando huellas",
              ),
              caption: "Última imagen conservada",
              blocks: [
                narration(
                  "Ordenados por su hora, los registros dejaron la última cámara al final de la secuencia. En ella, P-17 avanzaba sobre una llanura sin referencias próximas.",
                ),
                narration(
                  "Se detuvo, sacudió la nieve de las plumas y continuó. La cámara dejó que la distancia creciera.",
                ),
                dialogue(
                  "Nora",
                  "Esta es la última hoja. Si una frase necesita entrar en su cabeza, no pertenece aquí.",
                ),
              ],
            }),
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
            scene: storyScene("scene-resolution", {
              presentation: "artifact",
              media: narrativeImage(
                "/visuals/p17/final-plain.jpg",
                "P-17 y sus huellas se pierden en la inmensidad de la llanura",
              ),
              caption: "Cierre del registro P-17",
              advanceLabel: "Cerrar el registro",
              blocks: [
                narration(
                  "Nora leyó el texto una vez, tachó una palabra y volvió a empezar. La hoja no necesitaba resolver aquello que las imágenes habían dejado abierto.",
                ),
                emphasis(
                  "P-17 abandonó la dirección de la colonia, cruzó el campamento base, fue identificado de forma compatible en Nadir y continuó hacia las montañas. La causa de la trayectoria no pudo determinarse.",
                ),
              ],
            }),
          },
          {
            type: "scene",
            scene: {
              id: "scene-epilogue",
              presentation: "blackout",
              advanceLabel: "Ver resultado",
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
