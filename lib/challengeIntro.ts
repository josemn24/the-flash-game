import type { TimeTrialFormat } from "@/types/domain/time-trial";
import { getChallengeDisplayTitle } from "@/lib/roomPresentation";
import { CHALLENGE_MAX_SCORE } from "@/lib/challengeScoring";
import { QUESTION_FORMAT_LABELS } from "@/lib/questionFormat";
import type { Challenge, GameMode, NarrativeQuestionStep } from "@/types/gameplay";

export type ChallengeIntroMetric = {
  value: string | number;
  label: string;
};

export type ChallengeIntroRule = {
  title: string;
  description: string;
};

export type ChallengeIntroModel = {
  modeLabel: string;
  contextLabel: string;
  title: string;
  metrics: ChallengeIntroMetric[];
  rules: [ChallengeIntroRule, ChallengeIntroRule, ChallengeIntroRule];
};

function formatEstimatedMinutes(seconds: number) {
  const minutes = Math.max(0, Math.floor(seconds / 60));
  return `${minutes} min`;
}

function formatGlobalDuration(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes === 0) return `${seconds} s`;
  return remainingSeconds === 0 ? `${minutes} min` : `${minutes} min ${remainingSeconds} s`;
}

function getQuestionFormats(challenge: Challenge) {
  if (challenge.mode === "alphabet") {
    return challenge.entries.map((entry) => QUESTION_FORMAT_LABELS[entry.question.type]);
  }

  if (challenge.mode === "pyramid") {
    return challenge.levels.map((level) => QUESTION_FORMAT_LABELS[level.question.type]);
  }

  if (challenge.mode === "narrative") {
    return challenge.beats.flatMap((beat) =>
      beat.steps.flatMap((step) =>
        step.type === "question" ? [QUESTION_FORMAT_LABELS[step.question.type]] : [],
      ),
    );
  }

  return challenge.questions.map((question) => QUESTION_FORMAT_LABELS[question.type]);
}

function getModeLabel(challenge: Challenge) {
  return getModeLabelForMode(challenge.mode);
}

function getModeLabelForMode(mode: GameMode) {
  switch (mode) {
    case "time-trial":
      return "Contrarreloj";
    case "flash":
      return "Flash";
    case "survival":
      return "Supervivencia";
    case "alphabet":
      return "Alfabeto";
    case "narrative":
      return "Narrativa";
    case "pyramid":
      return "La Pirámide";
  }
}

function buildSafeRules(
  mode: GameMode,
  format?: TimeTrialFormat,
): [ChallengeIntroRule, ChallengeIntroRule, ChallengeIntroRule] {
  switch (mode) {
    case "time-trial":
      if (format === "queens" || format === "connect-pairs") {
        return [
          {
            title: "El reloj no se detiene",
            description: "Tienes un único tiempo para resolver todos los tableros.",
          },
          {
            title: format === "queens" ? "Tres intentos por tablero" : "Une las parejas",
            description:
              format === "queens"
                ? "Mueve las coronas libremente. Si fallas los tres intentos, la partida termina."
                : "Cubre todo el tablero sin cruzar los caminos. Puedes rehacerlos cuanto quieras.",
          },
          {
            title: "Resuelve para sumar y avanzar",
            description:
              "Cada tablero completado suma puntos. Si lo abandonas sin resolver, termina la partida.",
          },
        ];
      }

      return [
        {
          title: "Un solo reloj compartido",
          description: "Validar y cambiar de prueba también consumen tiempo.",
        },
        {
          title: "Resuelve para avanzar",
          description:
            "Completar una prueba abre la siguiente. Consulta las reglas del formato antes de empezar.",
        },
        {
          title: "Conserva tus aciertos",
          description: "Cada prueba suma puntos; interrumpirla sin respuesta termina la partida.",
        },
      ];
    case "flash":
      return buildFlashRules();
    case "survival":
      return buildSurvivalRules(3);
    case "alphabet":
      return buildAlphabetRules();
    case "narrative":
      return buildNarrativeRules();
    case "pyramid":
      return buildPyramidRules();
  }
}

export type SafeChallengeIntroduction = {
  title: string;
  mode: GameMode;
  questionCount: number;
  maxScore: number;
  timeLimitMs?: number;
  timeTrialFormat?: TimeTrialFormat;
};

export function buildSafeChallengeIntroModel(
  introduction: SafeChallengeIntroduction,
): ChallengeIntroModel {
  const modeLabel = getModeLabelForMode(introduction.mode);
  return {
    modeLabel,
    contextLabel: `Reto de hoy · ${modeLabel}`,
    title: getChallengeDisplayTitle(introduction.title, introduction.mode),
    metrics: [
      {
        value: introduction.questionCount,
        label: introduction.mode === "time-trial" ? "Pruebas" : "Preguntas",
      },
      ...(introduction.mode === "time-trial" && introduction.timeLimitMs
        ? [{ value: formatGlobalDuration(introduction.timeLimitMs), label: "Tiempo global" }]
        : []),
      { value: introduction.maxScore, label: "Puntos" },
    ],
    rules: buildSafeRules(introduction.mode, introduction.timeTrialFormat),
  };
}

function buildFlashRules(): [ChallengeIntroRule, ChallengeIntroRule, ChallengeIntroRule] {
  return [
    {
      title: "Acierta y responde rápido",
      description: "Cuanto antes des la respuesta correcta, más puntos ganas.",
    },
    {
      title: "Sin pausas",
      description: "Una vez empieces, el temporizador no se detiene.",
    },
    {
      title: "Cada punto cuenta",
      description: "Completa todos los retos para mejorar tu resultado.",
    },
  ];
}

function buildSurvivalRules(
  lives: number,
): [ChallengeIntroRule, ChallengeIntroRule, ChallengeIntroRule] {
  return [
    {
      title: `Empiezas con ${lives} vidas`,
      description: "Si fallas o no respondes a tiempo, pierdes una vida.",
    },
    {
      title: "Acertar una parte también suma",
      description: "Si tu respuesta está incompleta, puedes ganar puntos, pero no recuperas vidas.",
    },
    {
      title: "Llega tan lejos como puedas",
      description: "La partida termina cuando te quedas sin vidas.",
    },
  ];
}

function buildAlphabetRules(): [ChallengeIntroRule, ChallengeIntroRule, ChallengeIntroRule] {
  return [
    {
      title: "Una palabra por letra",
      description: "Lee la pista y escribe una palabra que empiece por la letra indicada.",
    },
    {
      title: "Puedes dejarla para después",
      description:
        "Si no sabes la respuesta, pasa a la siguiente. Volverás a esa pregunta mientras quede tiempo.",
    },
    {
      title: "Cuantos más aciertos, mejor",
      description:
        "Si hay empate, queda por delante quien haya conseguido antes su último acierto.",
    },
  ];
}

function buildNarrativeRules(): [ChallengeIntroRule, ChallengeIntroRule, ChallengeIntroRule] {
  return [
    {
      title: "Lee antes de intervenir",
      description: "Cada página añade evidencia a la historia.",
    },
    {
      title: "El registro permanece",
      description: "La evidencia se conserva aunque falles una prueba.",
    },
    {
      title: "Usa las pruebas",
      description: "Avanza con aquello que las imágenes permiten afirmar.",
    },
  ];
}

function buildPyramidRules(): [ChallengeIntroRule, ChallengeIntroRule, ChallengeIntroRule] {
  return [
    {
      title: "Acierta para seguir subiendo",
      description: "Tu respuesta debe ser totalmente correcta para pasar al siguiente nivel.",
    },
    {
      title: "Tienes una sola oportunidad",
      description: "Si fallas, la partida termina y no puedes repetir este desafío.",
    },
    {
      title: "Siete niveles hasta la cima",
      description: "Supera las siete preguntas para completar la pirámide.",
    },
  ];
}

export function buildChallengeIntroModel(challenge: Challenge): ChallengeIntroModel {
  const modeLabel = getModeLabel(challenge);
  const title = getChallengeDisplayTitle(challenge.title, challenge.mode);
  const formats = new Set(getQuestionFormats(challenge));

  switch (challenge.mode) {
    case "flash": {
      const totalTime = challenge.questions.reduce(
        (total, question) => total + question.timeLimit,
        0,
      );

      return {
        modeLabel,
        contextLabel: `Reto de hoy · ${modeLabel}`,
        title,
        metrics: [
          { value: challenge.questions.length, label: "Preguntas" },
          { value: formatEstimatedMinutes(totalTime), label: "Tiempo estimado" },
          { value: formats.size, label: "Formatos" },
        ],
        rules: buildFlashRules(),
      };
    }
    case "survival": {
      const totalTime = challenge.questions.reduce(
        (total, question) => total + question.timeLimit,
        0,
      );

      return {
        modeLabel,
        contextLabel: `Reto de hoy · ${modeLabel}`,
        title,
        metrics: [
          { value: challenge.questions.length, label: "Retos" },
          { value: challenge.lives, label: "Vidas" },
          { value: formatEstimatedMinutes(totalTime), label: "Tiempo estimado" },
        ],
        rules: buildSurvivalRules(challenge.lives),
      };
    }
    case "alphabet":
      return {
        modeLabel,
        contextLabel: `Reto de hoy · ${modeLabel}`,
        title,
        metrics: [
          { value: challenge.entries.length, label: "Letras" },
          { value: formatEstimatedMinutes(challenge.timeLimit), label: "Tiempo estimado" },
          { value: CHALLENGE_MAX_SCORE, label: "Puntos" },
        ],
        rules: buildAlphabetRules(),
      };
    case "narrative": {
      const questionCount = challenge.beats.reduce(
        (total, beat) =>
          total +
          beat.steps.filter((step): step is NarrativeQuestionStep => step.type === "question")
            .length,
        0,
      );

      return {
        modeLabel,
        contextLabel: `Reto de hoy · ${modeLabel}`,
        title,
        metrics: [
          { value: questionCount, label: "Pruebas" },
          { value: challenge.maxScore, label: "Puntos" },
          { value: "≈ 10 min", label: "Tiempo estimado" },
        ],
        rules: buildNarrativeRules(),
      };
    }
    case "pyramid": {
      const totalTime = challenge.levels.reduce(
        (total, level) => total + level.question.timeLimit,
        0,
      );
      return {
        modeLabel,
        contextLabel: `Reto de hoy · ${modeLabel}`,
        title,
        metrics: [
          { value: challenge.levels.length, label: "Niveles" },
          { value: formatEstimatedMinutes(totalTime), label: "Tiempo estimado" },
          { value: CHALLENGE_MAX_SCORE, label: "Puntos" },
        ],
        rules: buildPyramidRules(),
      };
    }
  }
}
