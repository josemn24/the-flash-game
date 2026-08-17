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
                  "La imagen tardó en desprenderse del ruido. Poco a poco aparecieron una llanura blanca, la línea oscura de las montañas y, al fondo, el brillo del agua abierta.",
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
            questionId: "mountains-progressive-image",
            unlockEntryIds: ["note-direction"],
            reactions: reactions(
              "La cordillera quedó señalada en el monitor. Nora hizo retroceder la cinta hasta el instante preciso del giro.",
              "Nora rebobinó unos segundos. Al abrirse de nuevo el plano, el mar quedó a un lado y las montañas al otro.",
              "El grano terminó por disiparse. Debajo apareció el giro: desde la colonia hacia la línea de montañas.",
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
                dialogue("Nora", "¿Lo has registrado?"),
                narration(
                  "Asentiste sin apartar la mirada de la pantalla. El viento pasaba sobre las huellas recientes y deshacía primero los bordes, luego la forma entera.",
                ),
                dialogue(
                  "Nora",
                  "Guarda lo que la cámara nos ha dado. La razón, si llega alguna vez, tendrá que esperar.",
                ),
              ],
            }),
          },
          {
            type: "question",
            questionId: "trajectory-deviation-heat-map",
            unlockEntryIds: ["note-deviation"],
            reactions: reactions(
              "La marca cayó en el sector C3, allí donde una línea se apartaba del haz que descendía hacia el mar.",
              "Nora desplazó el papel translúcido unos milímetros. Solo entonces los dos recorridos se separaron con claridad.",
              "La superposición terminó de ajustarse y dejó al descubierto el desvío, en el sector C3.",
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
                  "Nora sujetó el papel translúcido para que no lo levantara la corriente de la calefacción. Debajo se amontonaban cientos de recorridos: líneas breves, casi paralelas, que descendían hacia el mar.",
                ),
                narration(
                  "Marcó una cruz en el lugar donde la trayectoria de P-17 se desprendía de las demás. A partir de allí, una sola línea atravesaba el blanco del mapa y continuaba hacia el interior.",
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
                narration(
                  "Nora no respondió enseguida. Miró otra vez el punto oscuro detenido en el monitor, abrió el cuaderno por una página limpia y trazó una línea vertical de arriba abajo.",
                ),
                narration(
                  "A un lado copió lo que había resistido al rebobinado: la hora, el rumbo, cuarenta y dos minutos sin regresar a la colonia. Al otro quedaron palabras que ninguna cámara había registrado: perdido, enfermo, decidido.",
                ),
                dialogue(
                  "Nora",
                  "Esto pertenece a la imagen. Lo demás, por ahora, nos pertenece a nosotros.",
                ),
              ],
            }),
          },
          {
            type: "question",
            questionId: "observation-vs-interpretation",
            unlockEntryIds: ["note-register-rule"],
            reactions: reactions(
              "Las últimas notas quedaron a ambos lados de la línea. Nora apartó las palabras que la cámara nunca había visto.",
              "Nora devolvió una nota a la mesa y volvió a leerla en voz baja. La frase decía más que las imágenes.",
              "Antes de cerrar el cuaderno, el equipo separó las medidas de todo aquello que solo podía imaginar.",
            ),
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
                  "Con la primera claridad, una figura oscura apareció al otro lado del campamento base. Nora reconoció la muesca del pecho antes de que nadie pronunciara el código.",
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
              caption: "Corredor despejado · sin contacto",
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
              caption: "Transmisión entrante · estación Nadir",
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
              "La marca, el rumbo y la hora terminaron sobre la misma fila. Nora mantuvo el dedo junto al código P-17.",
              "Nora recorrió de nuevo las filas. Dos candidatos coincidían a medias; solo uno reunía los tres detalles.",
              "Cuando la comparación terminó, una sola fila permaneció abierta sobre la mesa: P-17.",
            ),
          },
          {
            type: "scene",
            scene: storyScene("scene-nadir-match", {
              presentation: "text-led",
              blocks: [
                narration(
                  "La muesca podía repetirse en otro animal. También el rumbo o la hora, tomados por separado, demostraban muy poco. Pero las tres señales terminaban en la misma fila.",
                ),
                narration(
                  "Nadie dijo que lo hubieran encontrado. Nora acercó el cuaderno, mojó la punta del lápiz en los labios y eligió con cuidado las únicas palabras que los datos permitían.",
                ),
                emphasis("Compatible con P-17."),
                narration(
                  "Después cerró la carpeta. La duda no era un defecto del registro; era la parte que todavía pertenecía a la nieve.",
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
              caption: "Colonia · desvío · base · H-3 · Nadir · último registro",
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
              caption: "Único recorrido compatible con los seis registros",
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
              caption: "Última imagen conservada",
              blocks: [
                narration(
                  "La última cámara mostraba una llanura tan abierta que resultaba difícil medir las distancias. P-17 avanzaba en ella como un punto oscuro; detrás, sus huellas eran la única escala.",
                ),
                narration(
                  "Se detuvo una vez, sacudió la nieve de las plumas y continuó. Por un instante el viento lo borró de la imagen. Cuando volvió a aparecer, era más pequeño y estaba más cerca de las montañas.",
                ),
                dialogue(
                  "Nora",
                  "Esta es la última hoja. La frase no puede llegar más lejos que la imagen.",
                ),
                narration(
                  "Nadie respondió. La cinta siguió corriendo unos segundos después de que P-17 desapareciera en el grano.",
                ),
              ],
            }),
          },
          {
            type: "question",
            questionId: "p17-final-record",
            unlockEntryIds: ["note-final"],
            reactions: reactions(
              "Las palabras «estaba perdido» desaparecieron del párrafo. En su lugar quedó escrito el límite de lo observado.",
              "Nora tachó la frase que atribuía una decisión a P-17 y dejó el lápiz junto al margen vacío.",
              "Antes de cerrar el informe, Nora retiró la causa que ninguna cámara había podido registrar.",
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
                  "Nora leyó el párrafo en voz baja. Allí estaban el mar, el campamento, Nadir y las montañas; también una respuesta que nadie había visto. La tachó hasta que dejó de poder leerse.",
                ),
                narration(
                  "El texto se volvió más breve y, al mismo tiempo, más verdadero. El papel no explicaba el viaje. Lo dejaba intacto, detenido justo donde terminaban las imágenes.",
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
