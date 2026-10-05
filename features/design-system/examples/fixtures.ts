import type { AvatarData } from "@/components/ui";
import type { RoomLeaderboardEntry } from "@/types/view-models/room";
import type { ReviewAnswerEntry } from "@/components/game/shared/ReviewAnswerList";
import type { ShortTextQuestion } from "@/types/gameplay/practice";

export const participants = [
  { id: "ana", name: "Ana Moreno", initials: "AM", tone: "coral" },
  { id: "luis", name: "Luis Úbeda", initials: "LU", tone: "blue" },
  { id: "rocio", name: "Rocío", tone: "aqua" },
  { id: "joel", name: "Joel", tone: "ink" },
  { id: "marta", name: "Marta", tone: "reward" },
  { id: "ines", name: "Inés", tone: "social" },
] satisfies AvatarData[];
export const leaderboardEntries: RoomLeaderboardEntry[] = [
  { rank: 1, memberId: "luis", name: "Luis Úbeda", initials: "LU", flashPoints: 820 },
  { rank: 2, memberId: "ana", name: "Ana Moreno", initials: "AM", flashPoints: 740 },
  {
    rank: 3,
    memberId: "rocio",
    name: "Rocío del Mar Fernández de los Ríos",
    initials: "RF",
    flashPoints: 610,
  },
];

export const reviewEntries: ReviewAnswerEntry[] = (
  ["correct", "partial", "incorrect", "unanswered", "locked"] as const
).map((status, index) => {
  const question: ShortTextQuestion = {
    id: `catalog-question-${index}`,
    type: "short-text",
    category: "Ejemplo local",
    tags: { domains: [], topics: [], cognitiveSkills: [], formatSkills: [] },
    question: "¿Cuál es el satélite natural de la Tierra?",
    timeLimit: 20,
    points: 100,
    correctAnswer: "Luna",
    explanation: "La Luna es el satélite natural de la Tierra.",
  };
  return {
    id: status === "correct" ? "correcta" : status,
    marker: String(index + 1).padStart(2, "0"),
    title: "Texto breve",
    subtitle: "Ejemplo local",
    status,
    question,
    result:
      status === "locked"
        ? undefined
        : {
            questionId: question.id,
            answer: status === "unanswered" ? null : status === "incorrect" ? "Marte" : "Luna",
            status,
            isCorrect: status === "correct",
            points: status === "correct" ? 100 : status === "partial" ? 50 : 0,
            timeUsed: status === "unanswered" ? 20 : 4,
          },
  };
});
