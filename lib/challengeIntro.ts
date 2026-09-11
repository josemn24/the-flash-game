import { CHALLENGE_MAX_SCORE } from "@/lib/challengeScoring";
import { QUESTION_FORMAT_LABELS } from "@/lib/questionFormat";
import type { Challenge, NarrativeQuestionStep } from "@/types/game";

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
  metrics: [ChallengeIntroMetric, ChallengeIntroMetric, ChallengeIntroMetric];
  rules: [ChallengeIntroRule, ChallengeIntroRule, ChallengeIntroRule];
};

function formatEstimatedMinutes(seconds: number) {
  const minutes = Math.max(0, Math.floor(seconds / 60));
  return `${minutes} min`;
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
  switch (challenge.mode) {
    case "flash":
      return "Flash clásico";
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

function buildFlashRules(): [ChallengeIntroRule, ChallengeIntroRule, ChallengeIntroRule] {
  return [
    {
      title: "Primero, acierta",
      description: "Después, responde rápido para sumar más.",
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
      title: `${lives} vidas para llegar lejos`,
      description: "Cada fallo o timeout consume una vida.",
    },
    {
      title: "Los parciales cuentan",
      description: "Suman puntos, pero no recuperan una vida.",
    },
    {
      title: "Aguanta hasta el final",
      description: "La partida termina cuando te quedas sin vidas.",
    },
  ];
}

function buildAlphabetRules(): [ChallengeIntroRule, ChallengeIntroRule, ChallengeIntroRule] {
  return [
    {
      title: "Responde",
      description: "Escribe una palabra que empiece por la letra activa.",
    },
    {
      title: "Pasa si lo necesitas",
      description: "La letra volverá en otra vuelta antes de que acabe el tiempo.",
    },
    {
      title: "Desempate",
      description: "Primero cuentan los aciertos y después la velocidad del último acierto.",
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
      title: "Sube nivel a nivel",
      description: "Solo un acierto completo abre la siguiente prueba.",
    },
    {
      title: "Puedes volver a intentarlo",
      description: "Revisa tu ascenso y repite la partida cuando quieras.",
    },
    {
      title: "Llega a la cima",
      description: "Supera los siete niveles para completar el desafío.",
    },
  ];
}

export function buildChallengeIntroModel(challenge: Challenge): ChallengeIntroModel {
  const modeLabel = getModeLabel(challenge);
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
        title: challenge.title,
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
        title: challenge.title,
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
        title: challenge.title,
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
        title: challenge.title,
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
        title: challenge.title,
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
