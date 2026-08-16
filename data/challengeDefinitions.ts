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
    subtitle: "Lo que el hielo no explica",
    description:
      "Acompaña a un equipo de campo hasta C4, registra una señal que se repite cada cuarenta segundos y observa qué queda fuera de toda explicación.",
    mode: "narrative",
    implementationStatus: "complete",
    maxScore: 100,
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
          text: "Un instrumento bajo el hielo repite una señal con ese intervalo. Está registrada en C4. Iremos a observarla; no a inventarle una respuesta.",
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
              eyebrow: "Movimiento I · Llegada a C4",
              blocks: [
                {
                  type: "narration",
                  text: "El viento borra el avión y después el primer poste. La estación queda a tu espalda; delante, en algún punto, está C4 y la ruta de observación.",
                },
                {
                  type: "narration",
                  text: "Nora te entrega una brújula y una tarjeta. La aguja marca 090°; una corrección convierte esa lectura en rumbo de mapa hacia la estación y el punto C4.",
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
                  text: "Las luces aparecen detrás de la nieve. Has llegado a la estación; C4 queda para la salida de la tarde. Al detenerte, el sudor empieza a enfriarse bajo el cortavientos.",
                },
                {
                  type: "narration",
                  text: "Nora abre tu chaqueta: llevas base seca y barrera exterior, pero nada que retenga aire caliente entre ambas. En C4 no habrá una puerta que cerrar.",
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
      {
        id: "station",
        title: "Preparar la observación",
        steps: [
          {
            type: "scene",
            scene: {
              id: "scene-station",
              eyebrow: "Movimiento II · Preparar la observación",
              blocks: [
                {
                  type: "narration",
                  text: "McMurdo surge como una ciudad de almacenes, tuberías y motores. Dentro del depósito, Álex extiende el plano de C4 y separa el equipo que puede viajar.",
                },
                {
                  type: "dialogue",
                  speaker: "Álex",
                  text: "El vehículo admite cuatro bultos científicos. Lo que no llevemos no podrá convertirse en dato.",
                },
              ],
            },
          },
          {
            type: "question",
            questionId: "antarctica-field-kit-selection",
            unlockEntryIds: ["note-kit"],
            reactions: {
              correct: [
                {
                  type: "dialogue",
                  speaker: "Álex",
                  text: "El equipo de observación está completo. Podemos ir a C4.",
                },
              ],
              incorrect: [
                {
                  type: "narration",
                  text: "Álex retira lo redundante y vuelve a revisar el plano de C4.",
                },
                {
                  type: "dialogue",
                  speaker: "Álex",
                  text: "El vehículo solo puede llevar lo que convierte una observación en evidencia.",
                },
              ],
              timeout: [
                {
                  type: "narration",
                  text: "El motor arranca antes de que termines. Álex carga el kit mínimo y deja el resto en el almacén.",
                },
              ],
            },
          },
          {
            type: "scene",
            scene: {
              id: "scene-after-q3",
              eyebrow: "Movimiento II · Preparar la observación",
              blocks: [
                {
                  type: "narration",
                  text: "Alba cuenta cuatro radios y te pasa la autonomía: seis horas fuera, tres por batería, más una reserva por persona. La vuelta también forma parte de la misión.",
                },
                {
                  type: "dialogue",
                  speaker: "Alba",
                  text: "Aquí una batería de menos es alguien que deja de poder llamar.",
                },
              ],
            },
          },
          {
            type: "question",
            questionId: "antarctica-radio-batteries",
            unlockEntryIds: ["note-batteries"],
            reactions: {
              correct: [
                {
                  type: "narration",
                  text: "Alba cuenta doce baterías.",
                },
                {
                  type: "dialogue",
                  speaker: "Alba",
                  text: "Autonomía y reservas cubiertas.",
                },
              ],
              incorrect: [
                {
                  type: "narration",
                  text: "Alba separa doce baterías y repasa el cálculo contigo.",
                },
              ],
              timeout: [
                {
                  type: "narration",
                  text: "El vehículo arranca. Alba completa la carga con doce baterías.",
                },
              ],
            },
          },
          {
            type: "scene",
            scene: {
              id: "scene-after-q4",
              eyebrow: "Movimiento II · Preparar la observación",
              blocks: [
                {
                  type: "narration",
                  text: "El equipo ya está cargado. Desde el banco de pruebas llega un pulso; luego, silencio. Nora abre una hoja en blanco para el protocolo.",
                },
                {
                  type: "dialogue",
                  speaker: "Nora",
                  text: "Antes de interpretar, decidimos qué vamos a registrar y en qué orden.",
                },
              ],
            },
          },
          {
            type: "question",
            questionId: "antarctica-observation-protocol",
            unlockEntryIds: ["note-protocol", "note-location"],
            reactions: {
              correct: [
                {
                  type: "narration",
                  text: "Mara copia el protocolo en el cuaderno. Nadie escribe todavía una causa.",
                },
              ],
              incorrect: [
                {
                  type: "dialogue",
                  speaker: "Mara",
                  text: "Primero registramos; después comparamos. Una hipótesis no puede ocupar el lugar de un dato.",
                },
              ],
              timeout: [
                {
                  type: "narration",
                  text: "Llega otro pulso. Mara deja el orden marcado para revisarlo en C4.",
                },
              ],
            },
          },
          {
            type: "scene",
            scene: {
              id: "scene-departure",
              eyebrow: "Movimiento II · Preparar la observación",
              blocks: [
                {
                  type: "narration",
                  text: "Alba guarda la cámara, Mara el sismómetro y Álex los dos hidrófonos. Nora marca C4 en el mapa: un lugar concreto para una pregunta que todavía no lo es.",
                },
                {
                  type: "narration",
                  text: "Un pulso aparece en pantalla. Cuarenta segundos después llega otro. Todos miran el reloj antes de partir.",
                },
              ],
            },
          },
        ],
      },
      {
        id: "field",
        title: "Lo que queda sin explicación",
        steps: [
          {
            type: "scene",
            scene: {
              id: "scene-field",
              eyebrow: "Movimiento III · Lo que queda sin explicación",
              blocks: [
                {
                  type: "narration",
                  text: "La estación desaparece en el retrovisor. En C4, el equipo abre un acceso y la cámara desciende bajo el hielo. Primero ves burbujas; después, una sombra que gira lentamente mientras el cuaderno espera una descripción.",
                },
                {
                  type: "dialogue",
                  speaker: "Alba",
                  text: "No decidas qué significa. Empieza por nombrar lo que ves.",
                },
              ],
            },
          },
          {
            type: "question",
            questionId: "antarctica-weddell-seal",
            unlockEntryIds: ["note-species"],
            reactions: {
              correct: [
                {
                  type: "narration",
                  text: "Alba sigue la silueta.",
                },
                {
                  type: "dialogue",
                  speaker: "Alba",
                  text: "Foca de Weddell; nada más todavía.",
                },
              ],
              incorrect: [
                {
                  type: "narration",
                  text: "La imagen se enfoca: es una foca de Weddell.",
                },
              ],
              timeout: [
                {
                  type: "narration",
                  text: "La cámara corrige el enfoque: una foca de Weddell.",
                },
              ],
            },
          },
          {
            type: "scene",
            scene: {
              id: "scene-after-q6",
              eyebrow: "Movimiento III · Lo que queda sin explicación",
              blocks: [
                {
                  type: "narration",
                  text: "Álex conecta los dos hidrófonos; Mara activa el sismómetro. El protocolo ya está escrito. En el mismo minuto, dos líneas recogen pulsos a cero y cuarenta segundos; la tercera no.",
                },
                {
                  type: "dialogue",
                  speaker: "Mara",
                  text: "Dime hasta dónde llegan los datos.",
                },
              ],
            },
          },
          {
            type: "question",
            questionId: "antarctica-sensor-reading",
            unlockEntryIds: ["note-signal"],
            reactions: {
              correct: [
                {
                  type: "narration",
                  text: "Mara asiente.",
                },
                {
                  type: "dialogue",
                  speaker: "Mara",
                  text: "Dos puntos de escucha; ningún origen demostrado.",
                },
              ],
              incorrect: [
                {
                  type: "narration",
                  text: "Mara subraya los pulsos. El origen continúa abierto.",
                },
              ],
              timeout: [
                {
                  type: "narration",
                  text: "Llega otro pulso. Mara guarda los registros sin interpretarlo.",
                },
              ],
            },
          },
          {
            type: "scene",
            scene: {
              id: "scene-return",
              eyebrow: "Movimiento III · Lo que queda sin explicación",
              blocks: [
                {
                  type: "narration",
                  text: "La señal sigue sin nombre cuando desmontáis el equipo. El acceso vuelve a cubrirse hasta parecer intacto y el vehículo emprende el regreso. Los datos tienen límites; el silencio de dentro no necesita una hipótesis.",
                },
              ],
            },
          },
          {
            type: "scene",
            scene: {
              id: "scene-penguin",
              eyebrow: "Movimiento III · Lo que queda sin explicación",
              blocks: [
                {
                  type: "narration",
                  text: "Casi todos los pingüinos avanzan hacia el mar. Uno se separa y camina hacia una extensión sin agua ni refugio. No hay señal en el cuaderno que explique ese desvío.",
                },
                {
                  type: "narration",
                  text: "Nora escribe 270° y te devuelve el cuaderno abierto por las notas marcadas: C4, la corrección y los límites de lo que habéis medido.",
                },
                {
                  type: "dialogue",
                  speaker: "Nora",
                  text: "No sabemos por qué. Anota solo hacia dónde va.",
                },
              ],
            },
            unlockEntryIds: ["note-final-bearing"],
          },
          {
            type: "question",
            questionId: "antarctica-penguin-trajectory",
            unlockEntryIds: ["note-final-route"],
            reactions: {
              correct: [
                {
                  type: "narration",
                  text: "Nora comprueba C4 y la Ruta B. La trayectoria queda registrada sin añadirle un motivo.",
                },
              ],
              incorrect: [
                {
                  type: "narration",
                  text: "Nora vuelve a la hoja de calibración y separa la trayectoria de cualquier explicación.",
                },
                {
                  type: "dialogue",
                  speaker: "Nora",
                  text: "C4, Ruta B hacia el interior. Eso registramos; el motivo queda abierto.",
                },
              ],
              timeout: [
                {
                  type: "narration",
                  text: "Nora aplica la corrección y anota C4, Ruta B hacia el interior. No añade una causa.",
                },
              ],
            },
          },
          {
            type: "scene",
            scene: {
              id: "scene-resolution",
              eyebrow: "Desenlace",
              presentation: "standard",
              blocks: [
                {
                  type: "narration",
                  text: "Nora registra la trayectoria: el pingüino sale de C4 y continúa hacia el interior hasta convertirse en una mancha sobre el hielo.",
                },
                {
                  type: "narration",
                  text: "El equipo observa en silencio. La imagen se aleja; solo quedan la figura, la llanura y las montañas.",
                },
                {
                  type: "dialogue",
                  speaker: "Nora",
                  text: "Eso es lo que hemos visto. Lo demás sigue fuera del cuaderno.",
                },
              ],
            },
          },
          {
            type: "scene",
            scene: {
              id: "scene-epilogue",
              eyebrow: "Epílogo",
              presentation: "blackout",
              blocks: [
                {
                  type: "narration",
                  text: "La pantalla se queda en negro.",
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
      {
        id: "note-kit",
        text: "Kit de C4: cámara submarina, H-1 y H-2, sismómetro y baterías de reserva.",
        relevance: "potential",
      },
      {
        id: "note-batteries",
        text: "12 baterías para 4 radios; incluye una reserva por persona.",
        relevance: "context",
      },
      {
        id: "note-protocol",
        text: "Protocolo: registrar hidrófonos y sismómetro, comparar los tiempos y anotar los límites de la evidencia.",
        relevance: "potential",
      },
      {
        id: "note-location",
        text: "Punto de observación de la colonia: C4.",
        relevance: "potential",
      },
      {
        id: "note-species",
        text: "Observación visual: foca de Weddell bajo el hielo.",
        relevance: "context",
      },
      {
        id: "note-signal",
        text: "H-1 y H-2: pulsos cada 40 s. Sin variación simultánea en el sismómetro. Origen no determinado.",
        relevance: "context",
      },
      {
        id: "note-final-bearing",
        text: "Observación final: lectura de brújula 270°. El registro no explica la trayectoria.",
        relevance: "potential",
      },
      {
        id: "note-final-route",
        text: "Trayectoria registrada: C4, Ruta B hacia el interior. El motivo queda abierto.",
        relevance: "context",
      },
    ],
    questionPoints: {
      "antarctica-orientation-calibration": 12,
      "antarctica-cold-layer": 12,
      "antarctica-field-kit-selection": 12,
      "antarctica-radio-batteries": 12,
      "antarctica-observation-protocol": 12,
      "antarctica-weddell-seal": 12,
      "antarctica-sensor-reading": 12,
      "antarctica-penguin-trajectory": 16,
    },
  },
} satisfies Record<string, ChallengeDefinition>;

export type KnownChallengeDefinitionId = keyof typeof challengeDefinitions;

export function getChallengeDefinitionById(id: string) {
  return challengeDefinitions[id as KnownChallengeDefinitionId];
}
