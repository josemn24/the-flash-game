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
    prologue: storyScene("scene-field-context", {
      eyebrow: "Prólogo",
      title: "Antes de la imagen",
      presentation: "text-led",
      blocks: [
        narration(
          "En el mar de Ross, el viento borraba las huellas antes de que llegara la siguiente cámara.",
        ),
        narration(
          "Nora y su equipo observaban una colonia de pingüinos desde la estación. No intervenían. Anotaban la hora, el rumbo y cualquier marca que permitiera reconocer a cada animal.",
        ),
        narration("Tú estabas de guardia cuando Nora sacó del archivo una cinta sin fecha."),
        dialogue("Nora", "Lo que la cámara no muestra, no lo damos por cierto."),
        narration("Después pulsó el interruptor."),
      ],
    }),
    beats: [
      {
        id: "all-but-one",
        title: "Todos menos uno",
        steps: [
          {
            type: "scene",
            scene: storyScene("scene-prologue-recording", {
              eyebrow: "Capítulo I",
              title: "Todos menos uno",
              presentation: "chapter-opening",
              media: narrativeImage(
                "/visuals/p17/archive-recorder.jpg",
                "Una grabadora de cinta y un monitor de archivo iluminan una estación antártica oscura",
                "42% 50%",
              ),
              blocks: [
                narration(
                  "La cinta llevaba años al fondo de una caja sin fecha, bajo mapas que nadie consultaba ya. Nora limpió el polvo de la carcasa con la manga y comprobó dos veces que el carrete seguía entero.",
                ),
                narration(
                  "Cuando pulsó el interruptor, el motor tosió antes de ponerse en marcha. Primero llegó el roce de la cinta. Después, un viento antiguo llenó la habitación. Por último, habló una voz que parecía venir de muy lejos.",
                ),
                dialogue(
                  "Grabación",
                  "A veces un pingüino se desorienta. Puede terminar muy lejos del océano, en un lugar donde no esperaríamos encontrarlo.",
                ),
              ],
            }),
          },
          {
            type: "scene",
            scene: storyScene("scene-all-but-one", {
              presentation: "full-bleed",
              media: narrativeImage(
                "/visuals/p17/colony-panorama.jpg",
                "Una colonia de pingüinos avanza hacia el mar de Ross mientras uno se separa hacia el interior",
                "50% 52%",
              ),
              blocks: [
                narration(
                  "La imagen tardó en desprenderse del ruido. Poco a poco aparecieron una llanura blanca, la línea oscura de las montañas y, al fondo, el brillo del agua abierta.",
                ),
                narration(
                  "En el borde del fotograma, una referencia de archivo situaba la estación en el sector del mar de Ross. La cordillera del fondo todavía no tenía nombre en la ficha.",
                ),
                narration(
                  "La colonia se movía hacia el mar con la lentitud de una sola criatura. La mirada podía seguirla sin esfuerzo, hasta que una figura se detuvo y rompió la forma del grupo.",
                ),
                emphasis("Todos siguieron hacia el agua. Todos menos uno."),
              ],
            }),
          },
          {
            type: "question",
            questionId: "ross-sea-transantarctic-range",
            unlockEntryIds: ["note-direction"],
            reactions: reactions(
              "La referencia del mapa quedó encajada: el registro procede del mar de Ross y la cordillera del fondo es la Transantártica. Nora hizo retroceder la cinta hasta el instante preciso del giro.",
              "Nora rebobinó unos segundos. La cordillera seguía sin nombre en la ficha; solo quedaban el mar de Ross a un lado y el interior al otro.",
              "La ficha de archivo terminó de revelarse: mar de Ross, Cordillera Transantártica y un giro desde la colonia hacia el interior.",
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
              blocks: [
                narration(
                  "El fotograma quedó inmóvil. Nora amplió la imagen hasta que las plumas perdieron nitidez. En el lado izquierdo del pecho, una muesca blanca interrumpía el borde oscuro del animal.",
                ),
                narration(
                  "No era un nombre ni una explicación. Era apenas una señal que permitiría reconocerlo si otra cámara volvía a encontrarlo. En el margen del cuaderno escribió P-17 y rodeó el código una sola vez.",
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
                  "Nora soltó el mando y la cinta volvió a avanzar. La colonia se hizo pequeña junto al mar. P-17 permaneció quieto unos segundos; después giró y continuó hacia las montañas.",
                ),
                dialogue("Nora", "¿Has registrado el giro?"),
                narration(
                  "Asentiste sin apartar la mirada de la pantalla. El viento empezaba a borrar las huellas.",
                ),
                dialogue(
                  "Nora",
                  "Registra lo que muestra la cámara. Todavía no sabemos por qué se ha separado.",
                ),
              ],
            }),
          },
          {
            type: "question",
            questionId: "antarctic-circle-map",
            unlockEntryIds: ["note-polar-context"],
            reactions: reactions(
              "Nora trazó el Círculo Polar Antártico en el margen del atlas. La estación quedaba dentro de la región polar; después volvió al registro de P-17.",
              "Nora volvió a extender el atlas. Antes de seguir las trayectorias, había que distinguir el límite polar de las líneas que cruzaban el hemisferio.",
              "La línea quedó anotada en el atlas: el Círculo Polar Antártico. El mapa volvió a cerrarse sobre la mesa de observación.",
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
              blocks: [
                narration(
                  "Nora sujetó el papel translúcido para que no lo levantara la corriente de la calefacción. Debajo se amontonaban cientos de recorridos: líneas breves, casi paralelas, que descendían hacia el mar.",
                ),
                narration(
                  "Marcó una cruz en el lugar donde la trayectoria de P-17 se desprendía de las demás. A partir de allí, una sola línea atravesaba el blanco del mapa y continuaba hacia el interior.",
                ),
              ],
            }),
          },
          {
            type: "question",
            questionId: "polar-fauna-classification",
            unlockEntryIds: ["note-polar-fauna"],
          },
          {
            type: "scene",
            scene: storyScene("scene-observation-rule", {
              presentation: "text-led",
              blocks: [
                narration(
                  "Al caer la tarde, Nora cerró el primer cuaderno. Afuera, el viento hacía temblar la pared de la estación; dentro solo quedó el zumbido del monitor y el olor seco del papel caliente.",
                ),
                narration(
                  "En las páginas permanecían una muesca blanca, una hora, un punto del mapa y una dirección. Nada de aquello explicaba por qué P-17 se había separado. Pero era suficiente para reconocer su rastro si volvía a aparecer.",
                ),
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
                  "Durante la noche el viento cambió de costado. Las lonas golpearon los mástiles hasta el amanecer y la nieve cubrió las marcas alrededor de las tiendas.",
                ),
                narration(
                  "Con la primera claridad, una figura oscura apareció al otro lado del campamento base. Nora reconoció la muesca del pecho antes de que alguien pudiera identificarlo.",
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
              blocks: [
                narration(
                  "P-17 avanzaba hacia el corredor este, despacio y sin desviarse. Entre él y la llanura, el campamento estrechaba el paso con cajas, trineos y un trípode que el equipo había instalado durante la noche.",
                ),
                narration(
                  "Desde la ventana parecía sencillo apartarlo con una voz o un movimiento. El protocolo prohibía ambas cosas: nadie debía tocarlo, llamarlo ni obligarlo a corregir el rumbo. El obstáculo no era el animal, sino todo lo que ellos habían dejado sobre la nieve.",
                ),
                dialogue(
                  "Nora",
                  "Esas cosas las pusimos nosotros. Tienen que desaparecer antes de que llegue.",
                ),
              ],
            }),
          },
          {
            type: "question",
            questionId: "clear-camp-escape",
            unlockEntryIds: ["note-intervention"],
            reactions: reactions(
              "La última pata del trípode desapareció por la salida de servicio. El corredor volvió a quedar abierto.",
              "Desde el lateral protegido, Nora terminó de retirar el trípode y ordenó al equipo que retrocediera.",
              "Cuando P-17 se acercó al límite del campamento, el equipo completó la retirada y dejó libre el paso.",
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
              blocks: [
                narration(
                  "Cuando el último objeto quedó fuera, el corredor volvió a ser una franja de nieve sin marcas humanas. El equipo retrocedió hasta las tiendas y esperó detrás de las ventanas empañadas.",
                ),
                narration(
                  "P-17 atravesó el campamento sin variar el rumbo. Nadie se acercó. Durante unos segundos solo se oyó el viento entre los cables y el roce leve de sus patas sobre la nieve. Después desapareció detrás de una elevación, todavía en dirección al interior.",
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
              blocks: [
                narration(
                  "Dos días más tarde, un chasquido despertó la sala de comunicaciones. La pantalla se encendió con un destello azul y dejó entrar una imagen enviada desde Nadir.",
                ),
                narration(
                  "En el vídeo, un pingüino entraba desde el nordeste y continuaba hacia el suroeste. La figura era demasiado pequeña para reconocerla a simple vista. Junto a la grabación llegaron tres apuntes: una marca en el pecho, un rumbo y una franja de tiempo.",
                ),
                narration(
                  "Nadir no enviaba una respuesta. Enviaba tres detalles que, puestos uno junto a otro, quizá permitieran formular una pregunta mejor.",
                ),
              ],
            }),
          },
          {
            type: "question",
            questionId: "p17-evidence-matrix",
            unlockEntryIds: ["note-nadir"],
            reactions: reactions(
              "Las tres señales coincidieron en el candidato A. La identificación compatible quedó separada de cualquier explicación sobre su conducta.",
              "Nora volvió a recorrer las filas. Dos candidatos coincidían a medias; solo uno reunía los tres datos.",
              "La comparación quedó incompleta. Sin las tres coincidencias, ninguna fila podía darse por compatible.",
            ),
          },
          {
            type: "scene",
            scene: storyScene("scene-nadir-match", {
              presentation: "text-led",
              blocks: [
                narration(
                  "La muesca podía aparecer en más de un animal. El rumbo, por sí solo, tampoco bastaba; lo mismo ocurría con la hora. Pero los tres datos juntos apuntaban al mismo candidato.",
                ),
                narration(
                  "Nadie se apresuró a darlo por encontrado. Nora acercó el cuaderno y escribió con cuidado:",
                ),
                emphasis("Compatible con P-17."),
                narration(
                  "Después cerró la carpeta. Habían encontrado una coincidencia, no una explicación. El motivo de aquel desvío seguía perdido en la nieve.",
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
                  "El viento borró las huellas poco después de cada paso. Una cámara lo vio salir; otra lo encontró mucho más tarde. Entre ambas quedaron horas de oscuridad y kilómetros de nieve sin testigos.",
                ),
                emphasis(
                  "Ninguna mirada había contemplado el viaje entero. Solo quedaban sus fragmentos.",
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
              blocks: [
                narration(
                  "Nora apagó la luz principal y extendió seis registros bajo la lámpara: la colonia, el primer desvío, la base, H-3, Nadir y una última cámara orientada hacia el interior.",
                ),
                narration(
                  "Entre una hoja y la siguiente se veía la superficie desnuda de la mesa. Aquellos espacios eran horas que nadie había observado; no podían llenarse con recuerdos ni con deseos.",
                ),
                narration(
                  "Nora desplazó la primera ficha sobre la cuadrícula. Los fragmentos no contarían qué había ocurrido en los huecos, pero podían revelar si pertenecían a un mismo recorrido.",
                ),
              ],
            }),
          },
          {
            type: "question",
            questionId: "p17-route-zip",
            unlockEntryIds: ["note-route"],
            reactions: reactions(
              "La última unión encajó sin contradecir ninguno de los seis registros. Una línea cruzó la mesa de extremo a extremo.",
              "Nora dejó a un lado los enlaces imposibles y acercó las fichas que aún podían compartir un mismo recorrido.",
              "El sistema terminó de ordenar los seis puntos. Sobre la cuadrícula apareció una sola línea compatible.",
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
              blocks: [
                narration(
                  "Cuando la última unión ocupó su lugar, la línea atravesó los seis registros sin romperse. Nacía junto a la colonia, pasaba por el campamento y Nadir, y terminaba en el blanco del interior.",
                ),
                narration(
                  "No mostraba lo ocurrido entre una cámara y la siguiente. Pero ninguno de los fragmentos la contradecía. Por primera vez, el recorrido podía contemplarse de una sola mirada.",
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
                  "Alguien dejó escapar el aire y dijo que por fin tenían la historia. Nora no contestó. Observó la línea azul, tan limpia sobre el mapa que parecía contener una respuesta.",
                ),
                dialogue(
                  "Nora",
                  "Ahora sabemos por dónde pasó. Seguimos sin saber qué lo llevó hasta allí.",
                ),
                narration(
                  "Con el recorrido completo, ciertos verbos acudían solos: buscaba, huía, quería llegar. Nora los escribió en una hoja aparte y luego le dio la vuelta. Ninguna de las seis cámaras había visto nada de aquello.",
                ),
              ],
            }),
          },
          {
            type: "question",
            questionId: "p17-observation-order",
            unlockEntryIds: ["note-chronology"],
            reactions: reactions(
              "La última hora ocupó su lugar. La secuencia avanzaba sin saltos desde la colonia hasta la cámara final.",
              "Nora volvió a las marcas de tiempo y cambió de lugar dos hojas. El orden apareció sin necesidad de explicar la causa.",
              "El cuaderno terminó de ordenar los cinco registros y dejó la última cámara al final de la secuencia.",
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
              blocks: [
                narration(
                  "La última cámara mostraba una llanura tan extensa que las distancias se volvían difíciles de calcular. P-17 avanzaba como un punto oscuro; sus huellas eran la única referencia sobre la nieve.",
                ),
                narration(
                  "Se detuvo una vez, sacudió la nieve de las plumas y continuó. Durante un instante, el viento lo ocultó. Cuando volvió a verse, parecía más pequeño y estaba más cerca de las montañas.",
                ),
                dialogue(
                  "Nora",
                  "Esta es la última hoja. A partir de aquí, solo podemos describir lo que vemos.",
                ),
                narration(
                  "Nadie respondió. La cinta siguió avanzando unos segundos después de que P-17 desapareciera entre el ruido de la grabación.",
                ),
              ],
            }),
          },
          {
            type: "question",
            questionId: "p17-final-record",
            unlockEntryIds: ["note-final"],
            reactions: reactions(
              "Nora eligió la única conclusión que respetaba los registros: P-17 había recorrido la ruta observada, pero la causa de su trayectoria no pudo determinarse.",
              "Nora descartó la conclusión. Describía una intención de P-17 que ninguna cámara había podido registrar.",
              "El informe quedó sin cerrar. Antes de archivarlo, Nora debía elegir una conclusión que no añadiera una causa a los hechos observados.",
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
              advanceLabel: "Cerrar el registro",
              blocks: [
                narration(
                  "Nora leyó el párrafo en voz baja. Allí estaban el mar, el campamento, Nadir y las montañas; también una respuesta que nadie había visto. La tachó hasta que dejó de poder leerse.",
                ),
                narration(
                  "El texto se volvió más breve y, al mismo tiempo, más verdadero. El papel no explicaba el viaje. Lo dejaba intacto, detenido justo donde terminaban las imágenes.",
                ),
                emphasis(
                  "P-17 abandonó la dirección de la colonia, cruzó el campamento base, fue identificado de forma compatible en Nadir y continuó hacia las montañas. La causa de la trayectoria no pudo determinarse.",
                ),
                narration(
                  "Toda la colonia siguió hacia el agua abierta. P-17 se separó y tomó rumbo hacia las montañas lejanas.",
                ),
                dialogue("Tú", "Pero, ¿por qué?"),
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
        text: "P-17: muesca blanca en el lado izquierdo del pecho. Registro 01 situado en el sector del mar de Ross. Dirección inicial: hacia el interior, frente a la Cordillera Transantártica.",
        relevance: "context",
      },
      {
        id: "note-polar-context",
        text: "Contexto geográfico: el Círculo Polar Antártico delimita aproximadamente la región polar donde se encuentra la estación.",
        relevance: "context",
      },
      {
        id: "note-polar-fauna",
        text: "Guía de fauna polar: pingüinos emperador y de Adelia, y foca de Weddell pertenecen a la fauna antártica; oso polar, morsa y zorro ártico, a la fauna del Ártico.",
        relevance: "context",
      },
      {
        id: "note-intervention",
        text: "Intervención humana retirada antes del paso de P-17; sin contacto ni aproximación.",
        relevance: "context",
      },
      {
        id: "note-nadir",
        text: "Nadir: el candidato A coincide con la marca, el rumbo y la ventana temporal; la identificación queda pendiente.",
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
      "ross-sea-transantarctic-range": 10,
      "antarctic-circle-map": 10,
      "polar-fauna-classification": 12,
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
