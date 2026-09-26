import { defineChallengeCatalog } from "@/data/mock/catalog/challengeDefinition";

export const publishedChallengeFixtures = defineChallengeCatalog([
  {
    slug: "demo-challenge-definition",
    mode: "flash",
    title: "Steel Ball Run",
    subtitle: "Carrera, ingenio y reflejos",
    description:
      "Dieciséis retos rápidos sin spoilers inspirados en la carrera transcontinental de Steel Ball Run.",
    modeConfig: null,
    items: [
      {
        questionSlug: "sbr-fire-horse-year",
        points: 6,
        modeConfig: null,
      },
      {
        questionSlug: "sbr-equidae-odd-one-out",
        points: 6,
        modeConfig: null,
      },
      {
        questionSlug: "sbr-currency-matching",
        points: 7,
        modeConfig: null,
      },
      {
        questionSlug: "sbr-west-to-east-cities",
        points: 7,
        modeConfig: null,
      },
      {
        questionSlug: "sbr-grand-canyon-progressive",
        points: 7,
        modeConfig: null,
      },
      {
        questionSlug: "sbr-grand-canyon-heat-map",
        points: 7,
        modeConfig: null,
      },
      {
        questionSlug: "sbr-average-speed",
        points: 6,
        modeConfig: null,
      },
      {
        questionSlug: "sbr-1890-gear-classification",
        points: 6,
        modeConfig: null,
      },
      {
        questionSlug: "sbr-race-anagram",
        points: 6,
        modeConfig: null,
      },
      {
        questionSlug: "sbr-pony-express",
        points: 6,
        modeConfig: null,
      },
      {
        questionSlug: "sbr-horses-sleep-standing",
        points: 6,
        modeConfig: null,
      },
      {
        questionSlug: "sbr-steel-composition",
        points: 6,
        modeConfig: null,
      },
      {
        questionSlug: "sbr-horse-gaits",
        points: 6,
        modeConfig: null,
      },
      {
        questionSlug: "sbr-bernoulli-principle",
        points: 6,
        modeConfig: null,
      },
      {
        questionSlug: "sbr-overtake-second-trap",
        points: 6,
        modeConfig: null,
      },
      {
        questionSlug: "sbr-creator",
        points: 6,
        modeConfig: null,
      },
    ],
  },
  {
    slug: "connections-challenge-definition",
    mode: "flash",
    title: "Conexiones rápidas",
    subtitle: "Patrones, imágenes y cultura bajo presión",
    description:
      "Diez retos para enlazar ideas, detectar patrones y reconocer pistas antes de que se escape el tiempo.",
    modeConfig: null,
    items: [
      {
        questionSlug: "letter-pattern",
        points: 10,
        modeConfig: null,
      },
      {
        questionSlug: "australia-capital",
        points: 9,
        modeConfig: null,
      },
      {
        questionSlug: "gold-symbol",
        points: 10,
        modeConfig: null,
      },
      {
        questionSlug: "italy-flag",
        points: 9,
        modeConfig: null,
      },
      {
        questionSlug: "inventions-order",
        points: 11,
        modeConfig: null,
      },
      {
        questionSlug: "byte-bits",
        points: 9,
        modeConfig: null,
      },
      {
        questionSlug: "red-planet",
        points: 10,
        modeConfig: null,
      },
      {
        questionSlug: "eiffel-tower",
        points: 11,
        modeConfig: null,
      },
      {
        questionSlug: "logic-connection",
        points: 11,
        modeConfig: null,
      },
      {
        questionSlug: "living-things-classification",
        points: 10,
        modeConfig: null,
      },
    ],
  },
  {
    slug: "animals-alphabet-definition",
    mode: "alphabet",
    title: "Reino de animales",
    subtitle: "Dieciocho letras, una sola cuenta atrás",
    description:
      "Recorre dieciocho letras, responde un animal para cada una y pasa las que quieras recuperar antes de que se agote el tiempo.",
    modeConfig: {
      timeLimitMs: 135000,
    },
    items: [
      {
        questionSlug: "alphabet-animals-a",
        points: 6,
        modeConfig: {
          letter: "A",
        },
      },
      {
        questionSlug: "alphabet-animals-b",
        points: 6,
        modeConfig: {
          letter: "B",
        },
      },
      {
        questionSlug: "alphabet-animals-c",
        points: 6,
        modeConfig: {
          letter: "C",
        },
      },
      {
        questionSlug: "alphabet-animals-d",
        points: 6,
        modeConfig: {
          letter: "D",
        },
      },
      {
        questionSlug: "alphabet-animals-e",
        points: 6,
        modeConfig: {
          letter: "E",
        },
      },
      {
        questionSlug: "alphabet-animals-f",
        points: 6,
        modeConfig: {
          letter: "F",
        },
      },
      {
        questionSlug: "alphabet-animals-g",
        points: 6,
        modeConfig: {
          letter: "G",
        },
      },
      {
        questionSlug: "alphabet-animals-h",
        points: 6,
        modeConfig: {
          letter: "H",
        },
      },
      {
        questionSlug: "alphabet-animals-i",
        points: 6,
        modeConfig: {
          letter: "I",
        },
      },
      {
        questionSlug: "alphabet-animals-j",
        points: 6,
        modeConfig: {
          letter: "J",
        },
      },
      {
        questionSlug: "alphabet-animals-l",
        points: 5,
        modeConfig: {
          letter: "L",
        },
      },
      {
        questionSlug: "alphabet-animals-m",
        points: 5,
        modeConfig: {
          letter: "M",
        },
      },
      {
        questionSlug: "alphabet-animals-o",
        points: 5,
        modeConfig: {
          letter: "O",
        },
      },
      {
        questionSlug: "alphabet-animals-p",
        points: 5,
        modeConfig: {
          letter: "P",
        },
      },
      {
        questionSlug: "alphabet-animals-r",
        points: 5,
        modeConfig: {
          letter: "R",
        },
      },
      {
        questionSlug: "alphabet-animals-s",
        points: 5,
        modeConfig: {
          letter: "S",
        },
      },
      {
        questionSlug: "alphabet-animals-t",
        points: 5,
        modeConfig: {
          letter: "T",
        },
      },
      {
        questionSlug: "alphabet-animals-z",
        points: 5,
        modeConfig: {
          letter: "Z",
        },
      },
    ],
  },
  {
    slug: "spain-survival-definition",
    mode: "survival",
    title: "Supervivencia: España",
    subtitle: "20 retos, 3 vidas",
    description:
      "Aguanta una ruta de cultura general sobre España: mapas, patrimonio, lengua, ciencia, arte y lógica con tres vidas.",
    modeConfig: {
      lives: 3,
    },
    items: [
      {
        questionSlug: "spain-survival-teide",
        points: 5,
        modeConfig: null,
      },
      {
        questionSlug: "spain-survival-food-odd",
        points: 4,
        modeConfig: null,
      },
      {
        questionSlug: "spain-survival-city-monument",
        points: 5,
        modeConfig: null,
      },
      {
        questionSlug: "spain-survival-felipe-ii",
        points: 5,
        modeConfig: null,
      },
      {
        questionSlug: "spain-survival-west-east-cities",
        points: 5,
        modeConfig: null,
      },
      {
        questionSlug: "spain-survival-sagrada-progressive",
        points: 5,
        modeConfig: null,
      },
      {
        questionSlug: "spain-survival-ramon-cajal",
        points: 5,
        modeConfig: null,
      },
      {
        questionSlug: "spain-survival-map-santa-cruz-tenerife",
        points: 5,
        modeConfig: null,
      },
      {
        questionSlug: "spain-survival-cinema",
        points: 5,
        modeConfig: null,
      },
      {
        questionSlug: "spain-survival-sports-matching",
        points: 5,
        modeConfig: null,
      },
      {
        questionSlug: "spain-survival-don-quixote-real-name",
        points: 5,
        modeConfig: null,
      },
      {
        questionSlug: "spain-survival-surface-area",
        points: 5,
        modeConfig: null,
      },
      {
        questionSlug: "spain-survival-history-order",
        points: 5,
        modeConfig: null,
      },
      {
        questionSlug: "spain-survival-art-matching",
        points: 5,
        modeConfig: null,
      },
      {
        questionSlug: "spain-survival-alhambra-pattern",
        points: 5,
        modeConfig: null,
      },
      {
        questionSlug: "spain-survival-literature-publication-order",
        points: 5,
        modeConfig: null,
      },
      {
        questionSlug: "spain-survival-nadal-grand-slams",
        points: 5,
        modeConfig: null,
      },
      {
        questionSlug: "spain-survival-seat-rows-total",
        points: 5,
        modeConfig: null,
      },
      {
        questionSlug: "spain-survival-catalan-dance",
        points: 5,
        modeConfig: null,
      },
      {
        questionSlug: "spain-survival-oak-tree",
        points: 6,
        modeConfig: null,
      },
    ],
  },
  {
    slug: "pyramid-logic-definition",
    mode: "pyramid",
    title: "La Pirámide: Cumbre lógica",
    subtitle: "Siete niveles. Sube cuanto puedas.",
    description:
      "Empieza con un patrón sencillo y asciende por siete pruebas de lógica. Solo un acierto completo abre el siguiente nivel.",
    modeConfig: {
      attemptSchemaVersion: 2,
    },
    items: [
      {
        questionSlug: "pyramid-square-intruder",
        points: 10,
        modeConfig: {
          levelId: "entrance",
          label: "Entrada",
          briefing: {
            title: "Encuentra el intruso",
            format: "Encontrar el intruso",
            description: "Selecciona el único número que rompe el patrón de cuadrados perfectos.",
          },
        },
      },
      {
        questionSlug: "pyramid-growing-products",
        points: 12,
        modeConfig: {
          levelId: "pattern",
          label: "Patrón",
          briefing: {
            title: "Completa la secuencia",
            format: "Secuencia numérica",
            description: "Identifica la regla que conecta los términos y elige el siguiente valor.",
          },
        },
      },
      {
        questionSlug: "pyramid-constraint-order",
        points: 13,
        modeConfig: {
          levelId: "order",
          label: "Orden",
          briefing: {
            title: "Construye el orden",
            format: "Ordenación lógica",
            description: "Coloca todos los elementos respetando simultáneamente las restricciones.",
          },
        },
      },
      {
        questionSlug: "pyramid-shape-direction-matrix",
        points: 14,
        modeConfig: {
          levelId: "chamber",
          label: "Cámara",
          briefing: {
            title: "Completa la matriz",
            format: "Matriz visual",
            description: "Observa la regla de figuras y flechas y elige la pieza que falta.",
          },
        },
      },
      {
        questionSlug: "pyramid-connect-pairs-trap",
        points: 15,
        modeConfig: {
          levelId: "trap",
          label: "Conexiones",
          briefing: {
            title: "Cubre la cuadrícula",
            format: "Conectar parejas",
            description:
              "Une cada pareja de símbolos con rutas ortogonales y cubre todas las casillas.",
          },
        },
      },
      {
        questionSlug: "pyramid-secret-code",
        points: 17,
        modeConfig: {
          levelId: "lock",
          label: "Cerradura",
          briefing: {
            title: "Descifra la cerradura",
            format: "Código secreto",
            description:
              "Deduce el código de tres cifras combinando las pistas de posición y presencia.",
          },
        },
      },
      {
        questionSlug: "pyramid-summit-queens",
        points: 19,
        modeConfig: {
          levelId: "summit",
          label: "Cima",
          briefing: {
            title: "Conquista la cima",
            format: "Queens",
            description:
              "Coloca cinco coronas sin repetir fila, columna o región y sin que se toquen.",
          },
        },
      },
    ],
  },
  {
    slug: "pyramid-abrahamic-definition",
    mode: "pyramid",
    title: "Biblia y religiones abrahámicas",
    subtitle: "Siete niveles. Una herencia compartida.",
    description:
      "Asciende por siete pruebas sobre personajes, textos y tradiciones del judaísmo, el cristianismo y el islam. Solo un acierto completo abre el siguiente nivel.",
    modeConfig: {
      attemptSchemaVersion: 1,
    },
    items: [
      {
        questionSlug: "abrahamic-matching-biblical-associations",
        points: 10,
        modeConfig: {
          levelId: "entrance",
          label: "Entrada",
          briefing: {
            title: "Relaciona las figuras",
            format: "Emparejamiento",
            description: "Asocia cada personaje bíblico con una referencia ampliamente reconocida.",
          },
        },
      },
      {
        questionSlug: "abrahamic-progressive-abraham",
        points: 12,
        modeConfig: {
          levelId: "patriarch",
          label: "Adivinanza",
          briefing: {
            title: "Sigue las pistas",
            format: "Adivinanza por pistas",
            description: "Identifica una figura bíblica",
          },
        },
      },
      {
        questionSlug: "abrahamic-order-torah-books",
        points: 13,
        modeConfig: {
          levelId: "torah",
          label: "Secuencia",
          briefing: {
            title: "Ordena los libros",
            format: "Ordenación",
            description: "Reconstruye el orden tradicional de los siguientes libros",
          },
        },
      },
      {
        questionSlug: "abrahamic-mini-wordle-josue",
        points: 14,
        modeConfig: {
          levelId: "name",
          label: "Nombre",
          briefing: {
            title: "Descifra el nombre",
            format: "Mini-Wordle",
            description:
              "Encuentra un personaje bíblico de cinco letras antes de agotar los intentos.",
          },
        },
      },
      {
        questionSlug: "abrahamic-word-search-biblical-characters",
        points: 15,
        modeConfig: {
          levelId: "search",
          label: "Búsqueda",
          briefing: {
            title: "Busca los personajes",
            format: "Sopa de letras",
            description: "Localiza los seis nombres ocultos en la cuadrícula.",
          },
        },
      },
      {
        questionSlug: "abrahamic-classification-three-traditions",
        points: 17,
        modeConfig: {
          levelId: "traditions",
          label: "Tradiciones",
          briefing: {
            title: "Traza el mapa",
            format: "Clasificación",
            description: "Distingue los elementos asociados principalmente a cada tradición.",
          },
        },
      },
      {
        questionSlug: "abrahamic-word-hashtag-references",
        points: 19,
        modeConfig: {
          levelId: "summit",
          label: "Cima",
          briefing: {
            title: "Conquista la cima",
            format: "Hashtag de palabras",
            description: "Completa cuatro referencias cruzadas con el menor número de movimientos.",
          },
        },
      },
    ],
  },
  {
    slug: "antarctica-narrative-definition",
    mode: "narrative",
    title: "El que caminaba hacia las montañas",
    subtitle: "Una dirección no es una explicación",
    description:
      "Sigue el rastro de un pingüino que abandona la colonia, protege su recorrido de cualquier intervención y escribe únicamente aquello que las imágenes permiten afirmar.",
    modeConfig: {
      implementationStatus: "complete",
      prologue: {
        id: "scene-field-context",
        eyebrow: "Prólogo",
        title: "Antes de la imagen",
        presentation: "text-led",
        blocks: [
          {
            type: "narration",
            text: "En el mar de Ross, el viento borraba las huellas antes de que llegara la siguiente cámara.",
          },
          {
            type: "narration",
            text: "Nora y su equipo observaban una colonia de pingüinos desde la estación. No intervenían. Anotaban la hora, el rumbo y cualquier marca que permitiera reconocer a cada animal.",
          },
          {
            type: "narration",
            text: "Tú estabas de guardia cuando Nora sacó del archivo una cinta sin fecha.",
          },
          {
            type: "dialogue",
            speaker: "Nora",
            text: "Lo que la cámara no muestra, no lo damos por cierto.",
          },
          {
            type: "narration",
            text: "Después pulsó el interruptor.",
          },
        ],
      },
      beats: [
        {
          id: "all-but-one",
          title: "Todos menos uno",
          steps: [
            {
              type: "scene",
              scene: {
                id: "scene-prologue-recording",
                eyebrow: "Capítulo I",
                title: "Todos menos uno",
                presentation: "chapter-opening",
                media: {
                  type: "image",
                  src: "/visuals/p17/archive-recorder.jpg",
                  alt: "Una grabadora de cinta y un monitor de archivo iluminan una estación antártica oscura",
                  fit: "cover",
                  position: "42% 50%",
                },
                blocks: [
                  {
                    type: "narration",
                    text: "La cinta llevaba años al fondo de una caja sin fecha, bajo mapas que nadie consultaba ya. Nora limpió el polvo de la carcasa con la manga y comprobó dos veces que el carrete seguía entero.",
                  },
                  {
                    type: "narration",
                    text: "Cuando pulsó el interruptor, el motor tosió antes de ponerse en marcha. Primero llegó el roce de la cinta. Después, un viento antiguo llenó la habitación. Por último, habló una voz que parecía venir de muy lejos.",
                  },
                  {
                    type: "dialogue",
                    speaker: "Grabación",
                    text: "A veces un pingüino se desorienta. Puede terminar muy lejos del océano, en un lugar donde no esperaríamos encontrarlo.",
                  },
                ],
              },
            },
            {
              type: "scene",
              scene: {
                id: "scene-all-but-one",
                presentation: "full-bleed",
                media: {
                  type: "image",
                  src: "/visuals/p17/colony-panorama.jpg",
                  alt: "Una colonia de pingüinos avanza hacia el mar de Ross mientras uno se separa hacia el interior",
                  fit: "cover",
                  position: "50% 52%",
                },
                blocks: [
                  {
                    type: "narration",
                    text: "La imagen tardó en desprenderse del ruido. Poco a poco aparecieron una llanura blanca, la línea oscura de las montañas y, al fondo, el brillo del agua abierta.",
                  },
                  {
                    type: "narration",
                    text: "En el borde del fotograma, una referencia de archivo situaba la estación en el sector del mar de Ross. La cordillera del fondo todavía no tenía nombre en la ficha.",
                  },
                  {
                    type: "narration",
                    text: "La colonia se movía hacia el mar con la lentitud de una sola criatura. La mirada podía seguirla sin esfuerzo, hasta que una figura se detuvo y rompió la forma del grupo.",
                  },
                  {
                    type: "emphasis",
                    text: "Todos siguieron hacia el agua. Todos menos uno.",
                  },
                ],
              },
            },
            {
              type: "question",
              questionSlug: "ross-sea-transantarctic-range",
            },
            {
              type: "scene",
              scene: {
                id: "scene-p17-identification",
                presentation: "split",
                media: {
                  type: "image",
                  src: "/visuals/p17/p17-identification.jpg",
                  alt: "P-17 frente a una cordillera, con la colonia desenfocada al fondo",
                  fit: "cover",
                  position: "42% 50%",
                },
                blocks: [
                  {
                    type: "narration",
                    text: "El fotograma quedó inmóvil. Nora amplió la imagen hasta que las plumas perdieron nitidez. En el lado izquierdo del pecho, una muesca blanca interrumpía el borde oscuro del animal.",
                  },
                  {
                    type: "narration",
                    text: "No era un nombre ni una explicación. Era apenas una señal que permitiría reconocerlo si otra cámara volvía a encontrarlo. En el margen del cuaderno escribió P-17 y rodeó el código una sola vez.",
                  },
                ],
              },
            },
            {
              type: "scene",
              scene: {
                id: "scene-p17-register",
                presentation: "text-led",
                blocks: [
                  {
                    type: "narration",
                    text: "Nora soltó el mando y la cinta volvió a avanzar. La colonia se hizo pequeña junto al mar. P-17 permaneció quieto unos segundos; después giró y continuó hacia las montañas.",
                  },
                  {
                    type: "dialogue",
                    speaker: "Nora",
                    text: "¿Has registrado el giro?",
                  },
                  {
                    type: "narration",
                    text: "Asentiste sin apartar la mirada de la pantalla. El viento empezaba a borrar las huellas.",
                  },
                  {
                    type: "dialogue",
                    speaker: "Nora",
                    text: "Registra lo que muestra la cámara. Todavía no sabemos por qué se ha separado.",
                  },
                ],
              },
            },
            {
              type: "question",
              questionSlug: "antarctic-circle-map",
            },
            {
              type: "scene",
              scene: {
                id: "scene-deviation-overlay",
                presentation: "artifact",
                media: {
                  type: "image",
                  src: "/visuals/p17/observation-table.jpg",
                  alt: "Mapas, fotografías y trayectorias de pingüinos se superponen sobre una mesa de observación",
                  fit: "cover",
                  position: "56% 50%",
                },
                blocks: [
                  {
                    type: "narration",
                    text: "Nora sujetó el papel translúcido para que no lo levantara la corriente de la calefacción. Debajo se amontonaban cientos de recorridos: líneas breves, casi paralelas, que descendían hacia el mar.",
                  },
                  {
                    type: "narration",
                    text: "Marcó una cruz en el lugar donde la trayectoria de P-17 se desprendía de las demás. A partir de allí, una sola línea atravesaba el blanco del mapa y continuaba hacia el interior.",
                  },
                ],
              },
            },
            {
              type: "question",
              questionSlug: "polar-fauna-classification",
            },
            {
              type: "scene",
              scene: {
                id: "scene-observation-rule",
                presentation: "text-led",
                blocks: [
                  {
                    type: "narration",
                    text: "Al caer la tarde, Nora cerró el primer cuaderno. Afuera, el viento hacía temblar la pared de la estación; dentro solo quedó el zumbido del monitor y el olor seco del papel caliente.",
                  },
                  {
                    type: "narration",
                    text: "En las páginas permanecían una muesca blanca, una hora, un punto del mapa y una dirección. Nada de aquello explicaba por qué P-17 se había separado. Pero era suficiente para reconocer su rastro si volvía a aparecer.",
                  },
                ],
              },
            },
          ],
        },
        {
          id: "stay-out",
          title: "Mantenerse fuera",
          steps: [
            {
              type: "scene",
              scene: {
                id: "scene-chapter-stay-out",
                eyebrow: "Capítulo II",
                title: "Mantenerse fuera",
                presentation: "chapter-opening",
                media: {
                  type: "image",
                  src: "/visuals/p17/camp-corridor.jpg",
                  alt: "Un campamento de observación ocupa una llanura recorrida por P-17",
                  fit: "cover",
                  position: "58% 48%",
                },
                blocks: [
                  {
                    type: "narration",
                    text: "Durante la noche el viento cambió de costado. Las lonas golpearon los mástiles hasta el amanecer y la nieve cubrió las marcas alrededor de las tiendas.",
                  },
                  {
                    type: "narration",
                    text: "Con la primera claridad, una figura oscura apareció al otro lado del campamento base. Nora reconoció la muesca del pecho antes de que alguien pudiera identificarlo.",
                  },
                ],
              },
            },
            {
              type: "scene",
              scene: {
                id: "scene-corridor",
                presentation: "split",
                media: {
                  type: "image",
                  src: "/visuals/p17/camp-corridor.jpg",
                  alt: "Equipo de campamento bloquea temporalmente un corredor de nieve",
                  fit: "cover",
                  position: "50% 52%",
                },
                blocks: [
                  {
                    type: "narration",
                    text: "P-17 avanzaba hacia el corredor este, despacio y sin desviarse. Entre él y la llanura, el campamento estrechaba el paso con cajas, trineos y un trípode que el equipo había instalado durante la noche.",
                  },
                  {
                    type: "narration",
                    text: "Desde la ventana parecía sencillo apartarlo con una voz o un movimiento. El protocolo prohibía ambas cosas: nadie debía tocarlo, llamarlo ni obligarlo a corregir el rumbo. El obstáculo no era el animal, sino todo lo que ellos habían dejado sobre la nieve.",
                  },
                  {
                    type: "dialogue",
                    speaker: "Nora",
                    text: "Esas cosas las pusimos nosotros. Tienen que desaparecer antes de que llegue.",
                  },
                ],
              },
            },
            {
              type: "question",
              questionSlug: "clear-camp-escape",
            },
            {
              type: "scene",
              scene: {
                id: "scene-camp-cleared",
                presentation: "full-bleed",
                media: {
                  type: "image",
                  src: "/visuals/p17/cleared-camp.jpg",
                  alt: "P-17 atraviesa un corredor despejado mientras el equipo permanece lejos",
                  fit: "cover",
                  position: "52% 55%",
                },
                blocks: [
                  {
                    type: "narration",
                    text: "Cuando el último objeto quedó fuera, el corredor volvió a ser una franja de nieve sin marcas humanas. El equipo retrocedió hasta las tiendas y esperó detrás de las ventanas empañadas.",
                  },
                  {
                    type: "narration",
                    text: "P-17 atravesó el campamento sin variar el rumbo. Nadie se acercó. Durante unos segundos solo se oyó el viento entre los cables y el roce leve de sus patas sobre la nieve. Después desapareció detrás de una elevación, todavía en dirección al interior.",
                  },
                ],
              },
            },
            {
              type: "scene",
              scene: {
                id: "scene-nadir-message",
                presentation: "artifact",
                media: {
                  type: "image",
                  src: "/visuals/p17/nadir-monitor.jpg",
                  alt: "Un monitor remoto muestra un pingüino distante y tres fragmentos de evidencia",
                  fit: "cover",
                  position: "48% 50%",
                },
                blocks: [
                  {
                    type: "narration",
                    text: "Dos días más tarde, un chasquido despertó la sala de comunicaciones. La pantalla se encendió con un destello azul y dejó entrar una imagen enviada desde Nadir.",
                  },
                  {
                    type: "narration",
                    text: "En el vídeo, un pingüino entraba desde el nordeste y continuaba hacia el suroeste. La figura era demasiado pequeña para reconocerla a simple vista. Junto a la grabación llegaron tres apuntes: una marca en el pecho, un rumbo y una franja de tiempo.",
                  },
                  {
                    type: "narration",
                    text: "Nadir no enviaba una respuesta. Enviaba tres detalles que, puestos uno junto a otro, quizá permitieran formular una pregunta mejor.",
                  },
                ],
              },
            },
            {
              type: "question",
              questionSlug: "p17-evidence-matrix",
            },
            {
              type: "scene",
              scene: {
                id: "scene-nadir-match",
                presentation: "text-led",
                blocks: [
                  {
                    type: "narration",
                    text: "La muesca podía aparecer en más de un animal. El rumbo, por sí solo, tampoco bastaba; lo mismo ocurría con la hora. Pero los tres datos juntos apuntaban al mismo candidato.",
                  },
                  {
                    type: "narration",
                    text: "Nadie se apresuró a darlo por encontrado. Nora acercó el cuaderno y escribió con cuidado:",
                  },
                  {
                    type: "emphasis",
                    text: "Compatible con P-17.",
                  },
                  {
                    type: "narration",
                    text: "Después cerró la carpeta. Habían encontrado una coincidencia, no una explicación. El motivo de aquel desvío seguía perdido en la nieve.",
                  },
                ],
              },
            },
          ],
        },
        {
          id: "complete-line",
          title: "La línea completa",
          steps: [
            {
              type: "scene",
              scene: {
                id: "scene-chapter-complete-line",
                eyebrow: "Capítulo III",
                title: "La línea completa",
                presentation: "chapter-opening",
                media: {
                  type: "image",
                  src: "/visuals/p17/final-plain.jpg",
                  alt: "Una figura y sus huellas avanzan hacia montañas lejanas",
                  fit: "cover",
                  position: "50% 54%",
                },
                blocks: [
                  {
                    type: "narration",
                    text: "El viento borró las huellas poco después de cada paso. Una cámara lo vio salir; otra lo encontró mucho más tarde. Entre ambas quedaron horas de oscuridad y kilómetros de nieve sin testigos.",
                  },
                  {
                    type: "emphasis",
                    text: "Ninguna mirada había contemplado el viaje entero. Solo quedaban sus fragmentos.",
                  },
                ],
              },
            },
            {
              type: "scene",
              scene: {
                id: "scene-six-records",
                presentation: "artifact",
                media: {
                  type: "image",
                  src: "/visuals/p17/route-board.jpg",
                  alt: "Seis registros físicos forman una línea desde la costa hacia las montañas",
                  fit: "cover",
                  position: "50% 50%",
                },
                blocks: [
                  {
                    type: "narration",
                    text: "Nora apagó la luz principal y extendió seis registros bajo la lámpara: la colonia, el primer desvío, la base, H-3, Nadir y una última cámara orientada hacia el interior.",
                  },
                  {
                    type: "narration",
                    text: "Entre una hoja y la siguiente se veía la superficie desnuda de la mesa. Aquellos espacios eran horas que nadie había observado; no podían llenarse con recuerdos ni con deseos.",
                  },
                  {
                    type: "narration",
                    text: "Nora desplazó la primera ficha sobre la cuadrícula. Los fragmentos no contarían qué había ocurrido en los huecos, pero podían revelar si pertenecían a un mismo recorrido.",
                  },
                ],
              },
            },
            {
              type: "question",
              questionSlug: "p17-route-zip",
            },
            {
              type: "scene",
              scene: {
                id: "scene-route-complete",
                presentation: "full-bleed",
                media: {
                  type: "image",
                  src: "/visuals/p17/route-board.jpg",
                  alt: "Los seis registros quedan enlazados por una trayectoria continua",
                  fit: "cover",
                  position: "50% 50%",
                },
                blocks: [
                  {
                    type: "narration",
                    text: "Cuando la última unión ocupó su lugar, la línea atravesó los seis registros sin romperse. Nacía junto a la colonia, pasaba por el campamento y Nadir, y terminaba en el blanco del interior.",
                  },
                  {
                    type: "narration",
                    text: "No mostraba lo ocurrido entre una cámara y la siguiente. Pero ninguno de los fragmentos la contradecía. Por primera vez, el recorrido podía contemplarse de una sola mirada.",
                  },
                ],
              },
            },
            {
              type: "scene",
              scene: {
                id: "scene-story-is-not-cause",
                presentation: "text-led",
                blocks: [
                  {
                    type: "narration",
                    text: "Alguien dejó escapar el aire y dijo que por fin tenían la historia. Nora no contestó. Observó la línea azul, tan limpia sobre el mapa que parecía contener una respuesta.",
                  },
                  {
                    type: "dialogue",
                    speaker: "Nora",
                    text: "Ahora sabemos por dónde pasó. Seguimos sin saber qué lo llevó hasta allí.",
                  },
                  {
                    type: "narration",
                    text: "Con el recorrido completo, ciertos verbos acudían solos: buscaba, huía, quería llegar. Nora los escribió en una hoja aparte y luego le dio la vuelta. Ninguna de las seis cámaras había visto nada de aquello.",
                  },
                ],
              },
            },
            {
              type: "question",
              questionSlug: "p17-observation-order",
            },
            {
              type: "scene",
              scene: {
                id: "scene-last-sheet",
                presentation: "split",
                media: {
                  type: "image",
                  src: "/visuals/p17/final-plain.jpg",
                  alt: "Un pingüino lejano cruza una llanura hacia las montañas dejando huellas",
                  fit: "cover",
                  position: "50% 50%",
                },
                blocks: [
                  {
                    type: "narration",
                    text: "La última cámara mostraba una llanura tan extensa que las distancias se volvían difíciles de calcular. P-17 avanzaba como un punto oscuro; sus huellas eran la única referencia sobre la nieve.",
                  },
                  {
                    type: "narration",
                    text: "Se detuvo una vez, sacudió la nieve de las plumas y continuó. Durante un instante, el viento lo ocultó. Cuando volvió a verse, parecía más pequeño y estaba más cerca de las montañas.",
                  },
                  {
                    type: "dialogue",
                    speaker: "Nora",
                    text: "Esta es la última hoja. A partir de aquí, solo podemos describir lo que vemos.",
                  },
                  {
                    type: "narration",
                    text: "Nadie respondió. La cinta siguió avanzando unos segundos después de que P-17 desapareciera entre el ruido de la grabación.",
                  },
                ],
              },
            },
            {
              type: "question",
              questionSlug: "p17-final-record",
            },
            {
              type: "scene",
              scene: {
                id: "scene-resolution",
                presentation: "artifact",
                media: {
                  type: "image",
                  src: "/visuals/p17/final-plain.jpg",
                  alt: "P-17 y sus huellas se pierden en la inmensidad de la llanura",
                  fit: "cover",
                  position: "50% 50%",
                },
                advanceLabel: "Cerrar el registro",
                blocks: [
                  {
                    type: "narration",
                    text: "Nora leyó el párrafo en voz baja. Allí estaban el mar, el campamento, Nadir y las montañas; también una respuesta que nadie había visto. La tachó hasta que dejó de poder leerse.",
                  },
                  {
                    type: "narration",
                    text: "El texto se volvió más breve y, al mismo tiempo, más verdadero. El papel no explicaba el viaje. Lo dejaba intacto, detenido justo donde terminaban las imágenes.",
                  },
                  {
                    type: "emphasis",
                    text: "P-17 abandonó la dirección de la colonia, cruzó el campamento base, fue identificado de forma compatible en Nadir y continuó hacia las montañas. La causa de la trayectoria no pudo determinarse.",
                  },
                  {
                    type: "narration",
                    text: "Toda la colonia siguió hacia el agua abierta. P-17 se separó y tomó rumbo hacia las montañas lejanas.",
                  },
                  {
                    type: "dialogue",
                    speaker: "Tú",
                    text: "Pero, ¿por qué?",
                  },
                ],
              },
            },
            {
              type: "scene",
              scene: {
                id: "scene-epilogue",
                presentation: "blackout",
                advanceLabel: "Ver resultado",
                blocks: [
                  {
                    type: "narration",
                    text: "La imagen se funde a negro.",
                  },
                ],
              },
            },
          ],
        },
      ],
    },
    items: [
      {
        questionSlug: "ross-sea-transantarctic-range",
        points: 10,
        modeConfig: {
          beatId: "all-but-one",
          beatPosition: 0,
          stepPosition: 2,
          reactions: {
            correct: [
              {
                type: "narration",
                text: "La referencia del mapa quedó encajada: el registro procede del mar de Ross y la cordillera del fondo es la Transantártica. Nora hizo retroceder la cinta hasta el instante preciso del giro.",
              },
            ],
            incorrect: [
              {
                type: "narration",
                text: "Nora rebobinó unos segundos. La cordillera seguía sin nombre en la ficha; solo quedaban el mar de Ross a un lado y el interior al otro.",
              },
            ],
            timeout: [
              {
                type: "narration",
                text: "La ficha de archivo terminó de revelarse: mar de Ross, Cordillera Transantártica y un giro desde la colonia hacia el interior.",
              },
            ],
          },
        },
      },
      {
        questionSlug: "antarctic-circle-map",
        points: 10,
        modeConfig: {
          beatId: "all-but-one",
          beatPosition: 0,
          stepPosition: 5,
          reactions: {
            correct: [
              {
                type: "narration",
                text: "Nora trazó el Círculo Polar Antártico en el margen del atlas. La estación quedaba dentro de la región polar; después volvió al registro de P-17.",
              },
            ],
            incorrect: [
              {
                type: "narration",
                text: "Nora volvió a extender el atlas. Antes de seguir las trayectorias, había que distinguir el límite polar de las líneas que cruzaban el hemisferio.",
              },
            ],
            timeout: [
              {
                type: "narration",
                text: "La línea quedó anotada en el atlas: el Círculo Polar Antártico. El mapa volvió a cerrarse sobre la mesa de observación.",
              },
            ],
          },
        },
      },
      {
        questionSlug: "polar-fauna-classification",
        points: 12,
        modeConfig: {
          beatId: "all-but-one",
          beatPosition: 0,
          stepPosition: 7,
          reactions: null,
        },
      },
      {
        questionSlug: "clear-camp-escape",
        points: 12,
        modeConfig: {
          beatId: "stay-out",
          beatPosition: 1,
          stepPosition: 2,
          reactions: {
            correct: [
              {
                type: "narration",
                text: "La última pata del trípode desapareció por la salida de servicio. El corredor volvió a quedar abierto.",
              },
            ],
            incorrect: [
              {
                type: "narration",
                text: "Desde el lateral protegido, Nora terminó de retirar el trípode y ordenó al equipo que retrocediera.",
              },
            ],
            timeout: [
              {
                type: "narration",
                text: "Cuando P-17 se acercó al límite del campamento, el equipo completó la retirada y dejó libre el paso.",
              },
            ],
          },
        },
      },
      {
        questionSlug: "p17-evidence-matrix",
        points: 12,
        modeConfig: {
          beatId: "stay-out",
          beatPosition: 1,
          stepPosition: 5,
          reactions: {
            correct: [
              {
                type: "narration",
                text: "Las tres señales coincidieron en el candidato A. La identificación compatible quedó separada de cualquier explicación sobre su conducta.",
              },
            ],
            incorrect: [
              {
                type: "narration",
                text: "Nora volvió a recorrer las filas. Dos candidatos coincidían a medias; solo uno reunía los tres datos.",
              },
            ],
            timeout: [
              {
                type: "narration",
                text: "La comparación quedó incompleta. Sin las tres coincidencias, ninguna fila podía darse por compatible.",
              },
            ],
          },
        },
      },
      {
        questionSlug: "p17-route-zip",
        points: 14,
        modeConfig: {
          beatId: "complete-line",
          beatPosition: 2,
          stepPosition: 2,
          reactions: {
            correct: [
              {
                type: "narration",
                text: "La última unión encajó sin contradecir ninguno de los seis registros. Una línea cruzó la mesa de extremo a extremo.",
              },
            ],
            incorrect: [
              {
                type: "narration",
                text: "Nora dejó a un lado los enlaces imposibles y acercó las fichas que aún podían compartir un mismo recorrido.",
              },
            ],
            timeout: [
              {
                type: "narration",
                text: "El sistema terminó de ordenar los seis puntos. Sobre la cuadrícula apareció una sola línea compatible.",
              },
            ],
          },
        },
      },
      {
        questionSlug: "p17-observation-order",
        points: 12,
        modeConfig: {
          beatId: "complete-line",
          beatPosition: 2,
          stepPosition: 5,
          reactions: {
            correct: [
              {
                type: "narration",
                text: "La última hora ocupó su lugar. La secuencia avanzaba sin saltos desde la colonia hasta la cámara final.",
              },
            ],
            incorrect: [
              {
                type: "narration",
                text: "Nora volvió a las marcas de tiempo y cambió de lugar dos hojas. El orden apareció sin necesidad de explicar la causa.",
              },
            ],
            timeout: [
              {
                type: "narration",
                text: "El cuaderno terminó de ordenar los cinco registros y dejó la última cámara al final de la secuencia.",
              },
            ],
          },
        },
      },
      {
        questionSlug: "p17-final-record",
        points: 18,
        modeConfig: {
          beatId: "complete-line",
          beatPosition: 2,
          stepPosition: 7,
          reactions: {
            correct: [
              {
                type: "narration",
                text: "Nora eligió la única conclusión que respetaba los registros: P-17 había recorrido la ruta observada, pero la causa de su trayectoria no pudo determinarse.",
              },
            ],
            incorrect: [
              {
                type: "narration",
                text: "Nora descartó la conclusión. Describía una intención de P-17 que ninguna cámara había podido registrar.",
              },
            ],
            timeout: [
              {
                type: "narration",
                text: "El informe quedó sin cerrar. Antes de archivarlo, Nora debía elegir una conclusión que no añadiera una causa a los hechos observados.",
              },
            ],
          },
        },
      },
    ],
  },
] as const);
