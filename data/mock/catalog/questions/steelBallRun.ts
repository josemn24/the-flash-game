import { defineQuestionCatalog } from "@/data/mock/catalog/questions/definition";

export const steelBallRunQuestions = defineQuestionCatalog([
  {
    slug: "sbr-country",
    practicePoints: 100,
    type: "multiple-choice",
    publicPayload: {
      category: "Steel Ball Run",
      tags: {
        domains: ["media_entertainment", "geography"],
        topics: ["cinema", "maps"],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall"],
        lifeSkills: [],
      },
      prompt: "¿En qué país transcurre la carrera Steel Ball Run?",
      context: null,
      timeLimitMs: 9000,
      payload: {
        options: ["Estados Unidos", "Japón", "México", "Canadá"],
        media: null,
        promptVisual: null,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "Steel Ball Run arranca en Estados Unidos y plantea una carrera a través del continente norteamericano.",
        payload: {
          correctAnswer: "Estados Unidos",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "sbr-race-type",
    practicePoints: 100,
    type: "multiple-choice",
    publicPayload: {
      category: "Steel Ball Run",
      tags: {
        domains: ["media_entertainment", "sports"],
        topics: ["cinema", "olympics"],
        cognitiveSkills: ["memory", "comprehension"],
        formatSkills: ["recall"],
        lifeSkills: [],
      },
      prompt: "¿Qué tipo de carrera es la Steel Ball Run?",
      context: null,
      timeLimitMs: 10000,
      payload: {
        options: [
          "Una carrera a caballo transcontinental",
          "Una regata oceánica",
          "Una prueba de atletismo en pista",
          "Una carrera de coches por equipos",
        ],
        media: null,
        promptVisual: null,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "La premisa de Steel Ball Run es una carrera a caballo de larga distancia a través de Norteamérica.",
        payload: {
          correctAnswer: "Una carrera a caballo transcontinental",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "sbr-year",
    practicePoints: 100,
    type: "short-text",
    publicPayload: {
      category: "Steel Ball Run",
      tags: {
        domains: ["media_entertainment", "history"],
        topics: ["cinema", "inventions"],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall"],
        lifeSkills: [],
      },
      prompt: "¿En qué año comienza la carrera Steel Ball Run?",
      context: null,
      timeLimitMs: 10000,
      payload: null,
    },
    privatePayload: {
      solution: {
        explanation: "Steel Ball Run se ambienta al comienzo de la carrera de 1890.",
        payload: {
          correctAnswer: "1890",
          acceptedAnswers: ["1890", "mil ochocientos noventa"],
        },
      },
      reveals: [],
    },
  },
  {
    slug: "sbr-distance",
    practicePoints: 100,
    type: "multiple-choice",
    publicPayload: {
      category: "Steel Ball Run",
      tags: {
        domains: ["media_entertainment", "mathematics"],
        topics: ["cinema", "arithmetic"],
        cognitiveSkills: ["memory", "quantitative_reasoning"],
        formatSkills: ["recall", "estimation"],
        lifeSkills: [],
      },
      prompt: "¿Qué distancia aproximada tiene la Steel Ball Run?",
      context: null,
      timeLimitMs: 10000,
      payload: {
        options: ["600 km", "6.000 km", "16.000 km", "60.000 km"],
        media: null,
        promptVisual: null,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "La carrera se presenta como una travesía de unos 6.000 km, aproximadamente 4.000 millas.",
        payload: {
          correctAnswer: "6.000 km",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "sbr-prize",
    practicePoints: 100,
    type: "multiple-choice",
    publicPayload: {
      category: "Steel Ball Run",
      tags: {
        domains: ["media_entertainment", "economics"],
        topics: ["cinema", "personal_finance"],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall"],
        lifeSkills: [],
      },
      prompt: "¿Cuál es el premio principal anunciado para la Steel Ball Run?",
      context: null,
      timeLimitMs: 10000,
      payload: {
        options: [
          "5.000 dólares",
          "500.000 dólares",
          "50 millones de dólares",
          "500 millones de dólares",
        ],
        media: null,
        promptVisual: null,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "El gran incentivo de la carrera es un premio principal anunciado de 50 millones de dólares.",
        payload: {
          correctAnswer: "50 millones de dólares",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "sbr-creator",
    practicePoints: 100,
    type: "multiple-choice",
    publicPayload: {
      category: "Steel Ball Run",
      tags: {
        domains: ["media_entertainment", "culture"],
        topics: ["cinema", "popular_music"],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall"],
        lifeSkills: [],
      },
      prompt: "¿Qué mangaka es el autor de Steel Ball Run?",
      context: null,
      timeLimitMs: 14000,
      payload: {
        options: ["Eiichiro Oda", "Masashi Kishimoto", "Yoshihiro Togashi", "Hirohiko Araki"],
        media: null,
        promptVisual: null,
      },
    },
    privatePayload: {
      solution: {
        explanation: "Steel Ball Run es obra de Hirohiko Araki, autor de JoJo's Bizarre Adventure.",
        payload: {
          correctAnswer: "Hirohiko Araki",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "sbr-west-to-east-cities",
    practicePoints: 120,
    type: "ordering",
    publicPayload: {
      category: "Geografía",
      tags: {
        domains: ["geography"],
        topics: ["maps"],
        cognitiveSkills: ["logical_reasoning", "memory"],
        formatSkills: ["ordering"],
        lifeSkills: [],
      },
      prompt: "Ordena estas ciudades de oeste a este.",
      context: null,
      timeLimitMs: 26000,
      payload: {
        items: ["Nueva York", "Denver", "San Diego", "Chicago"],
        directionLabels: {
          start: "Más al oeste",
          end: "Más al este",
        },
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "San Diego está en la costa oeste; Denver queda en las Rocosas, Chicago más al este y Nueva York en la costa atlántica.",
        payload: {
          correctOrder: ["San Diego", "Denver", "Chicago", "Nueva York"],
        },
      },
      reveals: [],
    },
  },
  {
    slug: "sbr-grand-canyon-state",
    practicePoints: 100,
    type: "multiple-choice",
    publicPayload: {
      category: "Geografía",
      tags: {
        domains: ["geography"],
        topics: ["landmarks"],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall"],
        lifeSkills: [],
      },
      prompt: "¿Qué estado estadounidense es conocido por el Gran Cañón?",
      context: null,
      timeLimitMs: 9000,
      payload: {
        options: ["Arizona", "Florida", "Maine", "Oregón"],
        media: null,
        promptVisual: null,
      },
    },
    privatePayload: {
      solution: {
        explanation: "El Gran Cañón se encuentra en Arizona, en el suroeste de Estados Unidos.",
        payload: {
          correctAnswer: "Arizona",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "sbr-grand-canyon-progressive",
    practicePoints: 140,
    type: "progressive-image",
    publicPayload: {
      category: "Geografía",
      tags: {
        domains: ["geography", "culture"],
        topics: ["landmarks"],
        cognitiveSkills: ["memory", "comprehension"],
        formatSkills: ["interpretation", "recall"],
        lifeSkills: [],
      },
      prompt: "¿Qué paisaje aparece en la imagen?",
      context: null,
      timeLimitMs: 20000,
      payload: {
        surface: {
          alt: "Fotografía desenfocada de un paisaje rocoso que se revela progresivamente",
          width: 1280,
          height: 853,
          fit: "cover",
          position: "50% 50%",
        },
        revealDurationMs: 11,
        answerLabel: null,
        answerPlaceholder: null,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "El paisaje representa el Gran Cañón, una de las formaciones más reconocibles del suroeste de Estados Unidos.",
        payload: {
          correctAnswer: "Gran Cañón",
          acceptedAnswers: ["Gran Cañón", "Grand Canyon", "El Gran Cañón"],
          solutionAlt:
            "Fotografía del Gran Cañón con paredes rojizas, sombras profundas y cielo azul.",
        },
      },
      reveals: [
        {
          surface: {
            src: "/visuals/sbr/grand-canyon-nps.jpg",
            alt: "Fotografía desenfocada de un paisaje rocoso que se revela progresivamente",
            width: 1280,
            height: 853,
            fit: "cover",
            position: "50% 50%",
          },
        },
      ],
    },
  },
  {
    slug: "sbr-grand-canyon-heat-map",
    practicePoints: 140,
    type: "heat-map",
    publicPayload: {
      category: "Geografía",
      tags: {
        domains: ["geography"],
        topics: ["maps", "landmarks"],
        cognitiveSkills: ["memory", "problem_solving"],
        formatSkills: ["interpretation"],
        lifeSkills: [],
      },
      prompt: "Marca aproximadamente dónde se encuentra el Gran Cañón en este mapa.",
      context: null,
      timeLimitMs: 18000,
      payload: {
        surface: {
          src: "/visuals/sbr/usa-location-map.svg",
          alt: "Mapa sin etiquetas de los Estados Unidos continentales con fronteras estatales",
          width: 1859,
          height: 968,
          fit: "contain",
        },
        targetLabel: "Norte de Arizona, zona del Gran Cañón",
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "El Gran Cañón está en el norte de Arizona, dentro del suroeste de Estados Unidos.",
        payload: {
          target: {
            x: 0.226,
            y: 0.537,
          },
          fullCreditRadius: 0.04,
          toleranceRadius: 0.12,
        },
      },
      reveals: [],
    },
  },
  {
    slug: "sbr-average-speed",
    practicePoints: 120,
    type: "estimation",
    publicPayload: {
      category: "Matemáticas",
      tags: {
        domains: ["mathematics"],
        topics: ["arithmetic"],
        cognitiveSkills: ["quantitative_reasoning"],
        formatSkills: ["calculation", "estimation"],
        lifeSkills: [],
      },
      prompt: "Un participante recorre 24 km en 40 minutos. ¿Cuál es su velocidad media?",
      context: null,
      timeLimitMs: 22000,
      payload: {
        min: 10,
        max: 60,
        step: 1,
        initialValue: 30,
        unit: "km/h",
        media: null,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "40 minutos son dos tercios de hora. Recorrer 24 km en dos tercios de hora equivale a 36 km/h.",
        payload: {
          correctAnswer: 36,
          tolerance: 18,
        },
      },
      reveals: [],
    },
  },
  {
    slug: "sbr-fire-horse-year",
    practicePoints: 100,
    type: "multiple-choice",
    publicPayload: {
      category: "Cultura",
      tags: {
        domains: ["culture", "history"],
        topics: ["countries_flags"],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall"],
        lifeSkills: [],
      },
      prompt:
        "¿Qué cultura celebra en 2026 el Año del Caballo de Fuego, que se repite cada 60 años?",
      context: null,
      timeLimitMs: 18000,
      payload: {
        options: ["La cultura azteca", "La cultura maya", "La cultura china", "La cultura celta"],
        media: {
          type: "image",
          src: "/visuals/sbr/horse-fire.jpg",
          alt: "Ilustración de un caballo envuelto en llamas sobre un fondo oscuro",
          fit: "cover",
          position: "50% 50%",
        },
        promptVisual: null,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "En el zodiaco chino, 2026 corresponde al Año del Caballo de Fuego dentro del ciclo sexagenario, que combina animales y elementos.",
        payload: {
          correctAnswer: "La cultura china",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "sbr-equidae-odd-one-out",
    practicePoints: 100,
    type: "odd-one-out",
    publicPayload: {
      category: "Ciencias naturales",
      tags: {
        domains: ["natural_sciences"],
        topics: ["biology_taxonomy"],
        cognitiveSkills: ["comprehension"],
        formatSkills: ["classification"],
        lifeSkills: [],
      },
      prompt: "¿Cuál de estos animales no pertenece a la familia de los équidos?",
      context: null,
      timeLimitMs: 14000,
      payload: {
        items: [
          {
            id: "horse",
            label: "Caballo",
          },
          {
            id: "zebra",
            label: "Cebra",
          },
          {
            id: "donkey",
            label: "Burro",
          },
          {
            id: "bison",
            label: "Bisonte",
          },
        ],
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "Caballos, cebras y burros son équidos. El bisonte pertenece a la familia de los bóvidos.",
        payload: {
          correctAnswer: "bison",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "sbr-race-anagram",
    practicePoints: 100,
    type: "anagram",
    publicPayload: {
      category: "Deporte",
      tags: {
        domains: ["language_communication", "sports"],
        topics: ["vocabulary", "spelling"],
        cognitiveSkills: ["problem_solving"],
        formatSkills: ["ordering"],
        lifeSkills: [],
      },
      prompt: "Forma una palabra relacionada con el desafío.",
      context: null,
      timeLimitMs: 30000,
      payload: {
        tiles: [
          {
            id: "a",
            value: "A",
          },
          {
            id: "c",
            value: "C",
          },
          {
            id: "r-1",
            value: "R",
          },
          {
            id: "r-2",
            value: "R",
          },
          {
            id: "a-2",
            value: "A",
          },
          {
            id: "e",
            value: "E",
          },
          {
            id: "r-3",
            value: "R",
          },
        ],
        hint: null,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "Las letras ACRRAER se reordenan como CARRERA, una palabra central en Steel Ball Run.",
        payload: {
          correctAnswer: "CARRERA",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "sbr-pony-express",
    practicePoints: 100,
    type: "multiple-choice",
    publicPayload: {
      category: "Historia",
      tags: {
        domains: ["history", "technology"],
        topics: ["inventions"],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall"],
        lifeSkills: ["communication"],
      },
      prompt: "¿Qué transportaba principalmente el Pony Express?",
      context: null,
      timeLimitMs: 16000,
      payload: {
        options: ["Correo", "Minerales", "Ganado", "Pasajeros"],
        media: null,
        promptVisual: null,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "El Pony Express fue un servicio de mensajería rápida que transportaba principalmente correo.",
        payload: {
          correctAnswer: "Correo",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "sbr-transcontinental-railroad",
    practicePoints: 100,
    type: "multiple-choice",
    publicPayload: {
      category: "Historia",
      tags: {
        domains: ["history", "technology"],
        topics: ["inventions"],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall"],
        lifeSkills: [],
      },
      prompt:
        "¿En qué década se completó el primer ferrocarril transcontinental de Estados Unidos?",
      context: null,
      timeLimitMs: 12000,
      payload: {
        options: ["Década de 1820", "Década de 1860", "Década de 1910", "Década de 1950"],
        media: null,
        promptVisual: null,
      },
    },
    privatePayload: {
      solution: {
        explanation: "El primer ferrocarril transcontinental estadounidense se completó en 1869.",
        payload: {
          correctAnswer: "Década de 1860",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "sbr-anachronism",
    practicePoints: 100,
    type: "multiple-choice",
    publicPayload: {
      category: "Tecnología",
      tags: {
        domains: ["technology", "history"],
        topics: ["inventions"],
        cognitiveSkills: ["critical_thinking"],
        formatSkills: ["comparison"],
        lifeSkills: ["digital_literacy"],
      },
      prompt: "¿Qué objeto no encaja en una carrera ambientada en 1890?",
      context: null,
      timeLimitMs: 10000,
      payload: {
        options: ["Brújula", "Telégrafo", "Cámara fotográfica", "Navegador GPS"],
        media: null,
        promptVisual: null,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "La brújula, el telégrafo y la fotografía ya existían en el siglo XIX. El GPS es tecnología moderna.",
        payload: {
          correctAnswer: "Navegador GPS",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "sbr-1890-gear-classification",
    practicePoints: 120,
    type: "classification",
    publicPayload: {
      category: "Tecnología",
      tags: {
        domains: ["technology", "history"],
        topics: ["inventions"],
        cognitiveSkills: ["critical_thinking", "comprehension"],
        formatSkills: ["classification", "comparison"],
        lifeSkills: ["digital_literacy"],
      },
      prompt: "Clasifica cada objeto según encaje o no en una carrera ambientada en 1890.",
      context: null,
      timeLimitMs: 22000,
      payload: {
        items: [
          {
            label: "Brújula",
          },
          {
            label: "Telégrafo",
          },
          {
            label: "Cantimplora",
          },
          {
            label: "Navegador GPS",
          },
          {
            label: "Smartphone",
          },
        ],
        categories: ["útil en 1890", "anacrónico"],
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "Brújula, telégrafo y cantimplora encajan en el siglo XIX; GPS y smartphone pertenecen a la tecnología moderna.",
        payload: {
          categoriesByItem: {
            Brújula: "útil en 1890",
            Telégrafo: "útil en 1890",
            Cantimplora: "útil en 1890",
            "Navegador GPS": "anacrónico",
            Smartphone: "anacrónico",
          },
        },
      },
      reveals: [],
    },
  },
  {
    slug: "sbr-horse-gaits",
    practicePoints: 120,
    type: "ordering",
    publicPayload: {
      category: "Deporte",
      tags: {
        domains: ["sports", "natural_sciences"],
        topics: ["biology_taxonomy"],
        cognitiveSkills: ["memory", "logical_reasoning"],
        formatSkills: ["ordering"],
        lifeSkills: [],
      },
      prompt: "Ordena estos movimientos del caballo de menor a mayor velocidad.",
      context: null,
      timeLimitMs: 20000,
      payload: {
        items: ["Galope", "Paso", "Trote"],
        directionLabels: {
          start: "Más lento",
          end: "Más rápido",
        },
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "El paso es el ritmo más lento, el trote es intermedio y el galope es el más rápido.",
        payload: {
          correctOrder: ["Paso", "Trote", "Galope"],
        },
      },
      reveals: [],
    },
  },
  {
    slug: "sbr-horses-sleep-standing",
    practicePoints: 100,
    type: "true-false",
    publicPayload: {
      category: "Ciencias naturales",
      tags: {
        domains: ["natural_sciences"],
        topics: ["biology_taxonomy"],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall"],
        lifeSkills: [],
      },
      prompt: "Los caballos pueden dormir de pie.",
      context: null,
      timeLimitMs: 12000,
      payload: null,
    },
    privatePayload: {
      solution: {
        explanation:
          "Los caballos pueden dormir de pie gracias a un mecanismo de bloqueo en las patas, aunque necesitan tumbarse para fases de sueño profundo.",
        payload: {
          correctAnswer: true,
        },
      },
      reveals: [],
    },
  },
  {
    slug: "sbr-friction",
    practicePoints: 100,
    type: "short-text",
    publicPayload: {
      category: "Física",
      tags: {
        domains: ["natural_sciences"],
        topics: ["weather"],
        cognitiveSkills: ["scientific_reasoning"],
        formatSkills: ["recall"],
        lifeSkills: [],
      },
      prompt: "¿Qué fuerza ayuda a que los cascos del caballo no resbalen sobre el terreno?",
      context: null,
      timeLimitMs: 11000,
      payload: null,
    },
    privatePayload: {
      solution: {
        explanation:
          "La fricción, también llamada rozamiento, permite que el casco se agarre al suelo y no deslice.",
        payload: {
          correctAnswer: "Fricción",
          acceptedAnswers: ["fricción", "friccion", "rozamiento"],
        },
      },
      reveals: [],
    },
  },
  {
    slug: "sbr-steel-composition",
    practicePoints: 100,
    type: "multiple-choice",
    publicPayload: {
      category: "Química",
      tags: {
        domains: ["natural_sciences"],
        topics: ["chemistry_elements"],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall"],
        lifeSkills: [],
      },
      prompt: "¿Qué dos elementos forman principalmente el acero?",
      context: null,
      timeLimitMs: 16000,
      payload: {
        options: ["Hierro y carbono", "Cobre y estaño", "Oro y plata", "Sodio y cloro"],
        media: null,
        promptVisual: null,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "El acero es una aleación compuesta principalmente por hierro con una pequeña proporción de carbono.",
        payload: {
          correctAnswer: "Hierro y carbono",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "sbr-bernoulli-principle",
    practicePoints: 100,
    type: "multiple-choice",
    publicPayload: {
      category: "Física",
      tags: {
        domains: ["natural_sciences", "media_entertainment"],
        topics: ["weather", "cinema"],
        cognitiveSkills: ["scientific_reasoning", "comprehension"],
        formatSkills: ["interpretation", "recall"],
        lifeSkills: [],
      },
      prompt:
        "Un caballo galopa con viento. Según Bernoulli, ¿qué pasa con el aire que va más rápido sobre su lomo?",
      context: null,
      timeLimitMs: 20000,
      payload: {
        options: [
          "El aire más rápido ejerce menos presión",
          "El aire se reparte con la misma presión",
          "El viento elimina toda la resistencia",
          "El aire comprimido empuja más hacia abajo",
        ],
        media: null,
        promptVisual: null,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "El principio de Bernoulli relaciona velocidad y presión en un fluido: cuando el flujo de aire se acelera, la presión disminuye. Gyro aprovecha esa diferencia alrededor de su capa para obtener un impulso aerodinámico.",
        payload: {
          correctAnswer: "El aire más rápido ejerce menos presión",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "sbr-currency-matching",
    practicePoints: 120,
    type: "matching",
    publicPayload: {
      category: "Geografía",
      tags: {
        domains: ["geography", "economics"],
        topics: ["countries_flags", "personal_finance"],
        cognitiveSkills: ["memory"],
        formatSkills: ["comparison"],
        lifeSkills: [],
      },
      prompt: "Relaciona cada país con su moneda.",
      context: null,
      timeLimitMs: 22000,
      payload: {
        leftItems: [
          {
            id: "united-states",
            label: "Estados Unidos",
            icon: "🇺🇸",
          },
          {
            id: "japan",
            label: "Japón",
            icon: "🇯🇵",
          },
          {
            id: "mexico",
            label: "México",
            icon: "🇲🇽",
          },
          {
            id: "spain",
            label: "España",
            icon: "🇪🇸",
          },
        ],
        rightItems: [
          {
            id: "yen",
            label: "Yen",
            icon: "¥",
          },
          {
            id: "dollar",
            label: "Dólar",
            icon: "$",
          },
          {
            id: "peso",
            label: "Peso",
            icon: "MX$",
          },
          {
            id: "euro",
            label: "Euro",
            icon: "€",
          },
        ],
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "Estados Unidos usa el dólar estadounidense, Japón usa el yen, México usa el peso mexicano y España usa el euro.",
        payload: {
          matches: {
            "united-states": "dollar",
            japan: "yen",
            mexico: "peso",
            spain: "euro",
          },
        },
      },
      reveals: [],
    },
  },
  {
    slug: "sbr-overtake-second-trap",
    practicePoints: 100,
    type: "true-false",
    publicPayload: {
      category: "Lógica",
      tags: {
        domains: ["mathematics", "sports"],
        topics: ["logic_puzzles"],
        cognitiveSkills: ["critical_thinking", "logical_reasoning"],
        formatSkills: ["deduction"],
        lifeSkills: [],
      },
      prompt:
        "En una carrera, adelantas al participante que va segundo. Por lo tanto, quedas primero.",
      context: null,
      timeLimitMs: 12000,
      payload: null,
    },
    privatePayload: {
      solution: {
        explanation:
          "Si adelantas al participante que va segundo, ocupas su posición: quedas segundo, no primero.",
        payload: {
          correctAnswer: false,
        },
      },
      reveals: [],
    },
  },
] as const);
