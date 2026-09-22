import Image from "next/image";
import { AnswerOption } from "@/components/questions/shared/AnswerOption";
import { WordSearchBoard } from "@/components/questions/formats/word-search/WordSearchQuestion";
import { LogicMatrixQuestion } from "@/components/questions/formats/logic-matrix/LogicMatrixQuestion";
import { ZipBoard } from "@/components/questions/formats/zip/ZipQuestion";
import { EscapeBoard } from "@/components/questions/formats/escape/EscapeQuestion";
import { Chip } from "@/components/ui";
import { replayEscapeMoves } from "@/lib/escape";
import type {
  LogicMatrixQuestion as LegacyLogicMatrixQuestion,
  MultipleChoiceQuestion,
  WordSearchQuestion as LegacyWordSearchQuestion,
  ZipQuestion as LegacyZipQuestion,
  EscapeQuestion as LegacyEscapeQuestion,
} from "@/types/question";
import type { ReactNode } from "react";
import type {
  FlashEditorialDocument,
  FlashEditorialMultipleChoiceQuestion,
  FlashEditorialQuestion,
  FlashEditorialQuestionReference,
} from "@/types/view-models/editorial";
import styles from "./EditorialManagement.module.css";

function previewQuestion(question: FlashEditorialMultipleChoiceQuestion): MultipleChoiceQuestion {
  const tags = question.publicPayload.tags;
  const media = question.publicPayload.media;
  const runtimeMedia =
    media && (media.type === "illustration" || "src" in media) ? media : undefined;
  return {
    id: question.slug,
    type: "multiple-choice",
    category: question.publicPayload.category ?? "",
    tags: {
      domains: Array.isArray(tags?.domains) ? tags.domains : [],
      topics: Array.isArray(tags?.topics) ? tags.topics : [],
      cognitiveSkills: Array.isArray(tags?.cognitiveSkills) ? tags.cognitiveSkills : [],
      formatSkills: Array.isArray(tags?.formatSkills) ? tags.formatSkills : [],
      lifeSkills: Array.isArray(tags?.lifeSkills) ? tags.lifeSkills : [],
    } as MultipleChoiceQuestion["tags"],
    question: question.publicPayload.question,
    options: [...question.publicPayload.options],
    correctAnswer: question.solutionPayload.correctAnswer,
    timeLimit: question.timeLimitMs / 1000,
    points: question.points,
    explanation: question.solutionPayload.explanation ?? "",
    ...(runtimeMedia ? { media: runtimeMedia } : {}),
    ...(question.publicPayload.promptVisual
      ? { promptVisual: question.publicPayload.promptVisual }
      : {}),
  };
}
function isLibraryReference(
  question: FlashEditorialQuestion | FlashEditorialQuestionReference,
): question is FlashEditorialQuestionReference {
  return "source" in question && question.source === "library";
}
function QuestionFrame({
  index,
  meta,
  children,
}: {
  readonly index: number;
  readonly meta: string;
  readonly children: ReactNode;
}) {
  return (
    <article className={styles.previewQuestion}>
      <div className={styles.previewQuestionTopline}>
        <span className={styles.eyebrow}>Pregunta {String(index + 1).padStart(2, "0")}</span>
        <span className={styles.previewMeta}>{meta}</span>
      </div>
      {children}
    </article>
  );
}

function renderQuestion(
  question: FlashEditorialQuestion | FlashEditorialQuestionReference,
  index: number,
) {
  if (isLibraryReference(question))
    return (
      <QuestionFrame
        key={question.challengeItemId ?? question.questionVersionId}
        index={index}
        meta={`${question.points} puntos · biblioteca`}
      >
        <h4>Versión reutilizable</h4>
        <p className={styles.category}>{question.questionVersionId}</p>
        <p className={styles.solution}>
          La pregunta se resolverá desde la versión publicada seleccionada.
        </p>
      </QuestionFrame>
    );
  if (question.type === "mini-wordle")
    return (
      <QuestionFrame
        key={question.slug}
        index={index}
        meta={`${question.timeLimitMs / 1000}s · ${question.points} puntos`}
      >
        <p className={styles.category}>{question.publicPayload.category ?? ""}</p>
        <h4>{question.publicPayload.question}</h4>
        <p>
          {question.publicPayload.hint ?? "Sin pista"} · {question.publicPayload.wordLength} letras
          · {question.publicPayload.maxAttempts} intentos
        </p>
        <p className={styles.solution}>
          Solución privada: <strong>{question.solutionPayload.correctAnswer}</strong>
        </p>
      </QuestionFrame>
    );
  if (question.type === "logic-code")
    return (
      <QuestionFrame
        key={question.slug}
        index={index}
        meta={`${question.timeLimitMs / 1000}s · ${question.points} puntos`}
      >
        <p className={styles.category}>{question.publicPayload.category ?? ""}</p>
        <h4>{question.publicPayload.question}</h4>
        <div className={styles.options}>
          {question.publicPayload.clues.map((clue) => (
            <p key={clue.code}>
              <strong>{clue.code}</strong> · {clue.hint}
            </p>
          ))}
        </div>
        <p>{question.publicPayload.codeLength} cifras</p>
        <p className={styles.solution}>
          Solución privada: <strong>{question.solutionPayload.correctAnswer}</strong>
        </p>
      </QuestionFrame>
    );
  if (question.type === "progressive-clues")
    return (
      <QuestionFrame
        key={question.slug}
        index={index}
        meta={`${question.timeLimitMs / 1000}s · ${question.points} puntos`}
      >
        <p className={styles.category}>{question.publicPayload.category ?? ""}</p>
        <h4>{question.publicPayload.question}</h4>
        <div className={styles.options}>
          {question.publicPayload.clues.map((clue, clueIndex) => (
            <p key={`${clueIndex}-${clue}`}>
              Pista {clueIndex + 1}: {clue}
            </p>
          ))}
        </div>
        <p>Penalización por pista: {question.publicPayload.cluePenalty} puntos</p>
        <p className={styles.solution}>
          Solución privada: <strong>{question.solutionPayload.correctAnswer}</strong>
        </p>
      </QuestionFrame>
    );
  if (question.type === "matching")
    return (
      <QuestionFrame
        key={question.slug}
        index={index}
        meta={`${question.timeLimitMs / 1000}s · ${question.points} puntos`}
      >
        <p className={styles.category}>{question.publicPayload.category ?? ""}</p>
        <h4>{question.publicPayload.question}</h4>
        <div className={styles.options}>
          {question.publicPayload.leftItems.map((item) => (
            <p key={`left-${item.id}`}>
              <strong>{item.label}</strong> · {question.solutionPayload.matches[item.id]}
            </p>
          ))}
        </div>
        <p>{question.publicPayload.leftItems.length} parejas</p>
        <p className={styles.solution}>
          Solución privada:{" "}
          <strong>{Object.keys(question.solutionPayload.matches).length} correspondencias</strong>
        </p>
      </QuestionFrame>
    );
  if (question.type === "word-search") {
    const positions = question.solutionPayload.positionsByTargetId;
    const boardQuestion = {
      id: question.slug,
      type: "word-search" as const,
      category: question.publicPayload.category ?? "",
      tags: { domains: [], topics: [], cognitiveSkills: [], formatSkills: [], lifeSkills: [] },
      question: question.publicPayload.question,
      grid: question.publicPayload.grid,
      letters: [...question.publicPayload.letters],
      targets: question.publicPayload.targets.map((target) => ({
        ...target,
        startCell: positions[target.id]!.startCell,
        endCell: positions[target.id]!.endCell,
      })),
      timeLimit: question.timeLimitMs / 1000,
      points: question.points,
      explanation: question.solutionPayload.explanation ?? "",
    } satisfies LegacyWordSearchQuestion;
    return (
      <QuestionFrame
        key={question.slug}
        index={index}
        meta={`${question.timeLimitMs / 1000}s · ${question.points} puntos`}
      >
        <p className={styles.category}>{question.publicPayload.category ?? ""}</p>
        <h4>{question.publicPayload.question}</h4>
        <WordSearchBoard question={boardQuestion} foundWordIds={[]} revealSolution />
        <p>
          {question.publicPayload.targets.length} palabras · {question.publicPayload.grid.rows}×
          {question.publicPayload.grid.columns}
        </p>
        <p className={styles.solution}>
          Solución privada: <strong>{Object.keys(positions).length} posiciones</strong>
        </p>
      </QuestionFrame>
    );
  }
  if (question.type === "zip") {
    const boardQuestion = {
      id: question.slug,
      type: "zip" as const,
      category: question.publicPayload.category ?? "",
      tags: { domains: [], topics: [], cognitiveSkills: [], formatSkills: [], lifeSkills: [] },
      question: question.publicPayload.question,
      grid: question.publicPayload.grid,
      checkpoints: [...question.publicPayload.checkpoints],
      solution: [...question.solutionPayload.solution],
      instruction: question.publicPayload.instruction,
      mapNote: question.publicPayload.mapNote,
      boardLabel: question.publicPayload.boardLabel,
      timeLimit: question.timeLimitMs / 1000,
      points: question.points,
      explanation: question.solutionPayload.explanation ?? "",
    } satisfies LegacyZipQuestion;
    return (
      <QuestionFrame
        key={question.slug}
        index={index}
        meta={`${question.timeLimitMs / 1000}s · ${question.points} puntos`}
      >
        <p className={styles.category}>{question.publicPayload.category ?? ""}</p>
        <h4>{question.publicPayload.question}</h4>
        <ZipBoard question={boardQuestion} path={[]} solutionPath={boardQuestion.solution} disabled />
        <p className={styles.solution}>
          Solución privada: <strong>{boardQuestion.solution.length} celdas verificadas</strong>
        </p>
      </QuestionFrame>
    );
  }
  if (question.type === "escape") {
    const boardQuestion = {
      id: question.slug,
      type: "escape" as const,
      category: question.publicPayload.category ?? "",
      tags: { domains: [], topics: [], cognitiveSkills: [], formatSkills: [], lifeSkills: [] },
      question: question.publicPayload.question,
      grid: question.publicPayload.grid,
      initialBlocks: [...question.publicPayload.initialBlocks],
      referenceSolution: [...question.solutionPayload.referenceSolution],
      optimalMoves: question.solutionPayload.optimalMoves,
      instruction: question.publicPayload.instruction,
      hideInstruction: question.publicPayload.hideInstruction,
      objectiveLabel: question.publicPayload.objectiveLabel,
      hideObjectiveLabel: question.publicPayload.hideObjectiveLabel,
      completionMessage: question.publicPayload.completionMessage,
      boardLabel: question.publicPayload.boardLabel,
      timeLimit: question.timeLimitMs / 1000,
      points: question.points,
      explanation: question.solutionPayload.explanation ?? "",
    } satisfies LegacyEscapeQuestion;
    const reference = replayEscapeMoves(boardQuestion, boardQuestion.referenceSolution);
    return (
      <QuestionFrame
        key={question.slug}
        index={index}
        meta={`${question.timeLimitMs / 1000}s · ${question.points} puntos`}
      >
        <p className={styles.category}>{question.publicPayload.category ?? ""}</p>
        <h4>{question.publicPayload.question}</h4>
        <EscapeBoard
          question={boardQuestion}
          blocks={reference.blocks}
          label="Solución de referencia de Escape"
        />
        <p className={styles.solution}>
          Solución privada: <strong>{question.solutionPayload.optimalMoves} movimientos óptimos</strong>
        </p>
      </QuestionFrame>
    );
  }
  if (question.type === "logic-matrix") {
    const boardQuestion = {
      id: question.slug,
      type: "logic-matrix" as const,
      category: question.publicPayload.category ?? "",
      tags: { domains: [], topics: [], cognitiveSkills: [], formatSkills: [], lifeSkills: [] },
      question: question.publicPayload.question,
      pieces: [...question.publicPayload.pieces],
      cells: [...question.publicPayload.cells],
      optionIds: [...question.publicPayload.optionIds],
      correctOptionId: question.solutionPayload.correctOptionId,
      showPieceLabels: question.publicPayload.showPieceLabels ?? undefined,
      timeLimit: question.timeLimitMs / 1000,
      points: question.points,
      explanation: question.solutionPayload.explanation ?? "",
    } satisfies LegacyLogicMatrixQuestion;
    return (
      <QuestionFrame
        key={question.slug}
        index={index}
        meta={`${question.timeLimitMs / 1000}s · ${question.points} puntos`}
      >
        <p className={styles.category}>{question.publicPayload.category ?? ""}</p>
        <h4>{question.publicPayload.question}</h4>
        <LogicMatrixQuestion
          pieces={boardQuestion.pieces}
          cells={boardQuestion.cells}
          optionIds={boardQuestion.optionIds}
          showPieceLabels={boardQuestion.showPieceLabels}
          locked
          onSubmit={() => undefined}
        />
        <p className={styles.solution}>
          Solución privada:{" "}
          <strong>
            {boardQuestion.pieces.find((piece) => piece.id === boardQuestion.correctOptionId)
              ?.label ?? boardQuestion.correctOptionId}
          </strong>
        </p>
      </QuestionFrame>
    );
  }
  if (question.type === "progressive-image") {
    const imageSrc =
      "src" in question.publicPayload.surface ? question.publicPayload.surface.src : undefined;
    return (
      <QuestionFrame
        key={question.slug}
        index={index}
        meta={`${question.timeLimitMs / 1000}s · ${question.points} puntos`}
      >
        <p className={styles.category}>{question.publicPayload.category ?? ""}</p>
        <h4>{question.publicPayload.question}</h4>
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={question.publicPayload.surface.alt}
            width={question.publicPayload.surface.width}
            height={question.publicPayload.surface.height}
          />
        ) : (
          <p className={styles.solution}>Asset privado: preview pendiente de URL firmada.</p>
        )}
        <p className={styles.solution}>
          Solución privada: <strong>{question.solutionPayload.correctAnswer}</strong>
        </p>
      </QuestionFrame>
    );
  }
  if (question.type !== "multiple-choice")
    return (
      <QuestionFrame
        key={question.slug}
        index={index}
        meta={`${question.timeLimitMs / 1000}s · ${question.points} puntos`}
      >
        <p className={styles.category}>{question.publicPayload.category ?? ""}</p>
        <h4>{question.publicPayload.question}</h4>
        <p className={styles.solution}>
          Vista previa específica disponible al ejecutar la pregunta.
        </p>
      </QuestionFrame>
    );
  const multipleChoice = previewQuestion(question as FlashEditorialMultipleChoiceQuestion);
  return (
    <QuestionFrame
      key={question.slug}
      index={index}
      meta={`${multipleChoice.timeLimit}s · ${multipleChoice.points} puntos`}
    >
      <p className={styles.category}>{multipleChoice.category}</p>
      <h4>{multipleChoice.question}</h4>
      <div className={styles.options}>
        {multipleChoice.options.map((option, optionIndex) => (
          <AnswerOption
            key={option}
            label={option}
            index={optionIndex}
            disabled
            onSelect={() => undefined}
          />
        ))}
      </div>
      <p className={styles.solution}>
        Solución privada: <strong>{multipleChoice.correctAnswer}</strong>
      </p>
    </QuestionFrame>
  );
}

export function EditorialPreview({ document }: { readonly document: FlashEditorialDocument }) {
  return (
    <div className={styles.preview} aria-label="Previsualización editorial protegida">
      <div className={styles.previewHeading}>
        <div>
          <p className={styles.eyebrow}>Preview protegido</p>
          <h3>{document.challenge.title}</h3>
        </div>
        <Chip variant="data" tone="neutral">
          Sin intento ni puntuación
        </Chip>
      </div>
      <p className={styles.previewDescription}>{document.challenge.description}</p>
      <div className={styles.previewQuestions}>{document.questions.map(renderQuestion)}</div>
    </div>
  );
}
