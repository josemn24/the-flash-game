import { readStoredQuestion } from "@/lib/question-formats/storedRegistry";
import type { DurationMs } from "@/types/domain/values";
import type { QuestionVersionId } from "@/types/domain/identifiers";
import type { AlphabetChallenge, ServerAlphabetChallenge } from "@/types/gameplay/challenge";
import type { LocalAlphabetDefinition } from "@/types/gameplay/local-alphabet";

/** Bridges the existing mock/practice challenge into the shared session contract. */
export function localAlphabetDefinitionFromChallenge(
  challenge: AlphabetChallenge,
): LocalAlphabetDefinition {
  if (challenge.entries.length < 2 || challenge.entries.length > 20)
    throw new Error("invalid_local_alphabet_definition");
  const fallbackBase = Math.floor(100 / challenge.entries.length);
  const fallbackRemainder = 100 % challenge.entries.length;
  const entries = challenge.entries.map((entry, index) => {
    const question = entry.question;
    if (question.type !== "short-text") throw new Error("unsupported_local_alphabet_question");
    const points =
      entry.points ?? fallbackBase + (index === challenge.entries.length - 1 ? fallbackRemainder : 0);
    const timeLimitMs = Math.round(question.timeLimit * 1_000) as DurationMs;
    const id = question.id;
    const questionVersionId = id as QuestionVersionId;
    const publicPayload = {
      ...(question.category ? { category: question.category } : {}),
      tags: {
        domains: question.tags.domains,
        topics: question.tags.topics,
        cognitiveSkills: question.tags.cognitiveSkills,
        formatSkills: question.tags.formatSkills,
        lifeSkills: question.tags.lifeSkills ?? [],
      },
      question: question.question,
      ...(question.questionContext ? { context: question.questionContext } : {}),
    };
    const resolved = readStoredQuestion({
      questionType: "short-text",
      payloadSchemaVersion: 1,
      publicPayload,
      solutionPayload: {
        correctAnswer: question.correctAnswer,
        acceptedAnswers: question.acceptedAnswers ?? [question.correctAnswer],
        explanation: question.explanation,
      },
      timeLimitMs,
      itemPoints: points,
      receiptId: id,
      questionVersionId,
      mode: "alphabet",
      itemConfigSchemaVersion: 1,
      modeConfigSchemaVersion: 1,
      itemConfig: {},
      modeConfig: {},
      publicRepresentation: "authorized-runtime",
    });
    return {
      challengeEntry: {
        id,
        position: index + 1,
        letter: entry.letter,
        questionType: "short-text" as const,
        payloadSchemaVersion: 1,
        timeLimitMs,
        points,
      },
      level: {
        challengeItemId: id,
        payloadSchemaVersion: 1,
        publicQuestion: resolved.publicQuestion,
        solution: resolved.solution,
      },
    };
  });
  const maxScore = entries.reduce((sum, entry) => sum + entry.challengeEntry.points, 0);
  if (maxScore !== 100) throw new Error("invalid_local_alphabet_score_weights");

  const serverChallenge: ServerAlphabetChallenge = {
    id: challenge.id,
    definitionId: challenge.definitionId,
    number: challenge.number,
    title: challenge.title,
    subtitle: challenge.subtitle,
    description: challenge.description,
    mode: "alphabet",
    timeLimitMs: Math.round(challenge.timeLimit * 1_000),
    maxScore,
    entries: entries.map(({ challengeEntry }) => challengeEntry),
  };
  return {
    challenge: serverChallenge,
    levels: entries.map(({ level }) => level),
  };
}
