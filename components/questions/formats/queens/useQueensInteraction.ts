"use client";

import { useEffect, useRef, useState } from "react";
import { getQueensConflicts, type QueensConflictType } from "@/lib/queens";
import type { QueensAnswer } from "@/types/gameplay/practice";
import type { QueensBoardQuestion } from "./QueensQuestion";

export const QUEENS_VALIDATION_DELAY_MS = 800;

const CONFLICT_LABELS: Record<QueensConflictType, string> = {
  row: "fila repetida",
  column: "columna repetida",
  region: "región repetida",
  contact: "coronas en contacto",
};

export function useQueensInteraction({
  question,
  questionId,
  initialAnswer,
  disabled,
  onProgress,
  onValidate,
}: {
  question: QueensBoardQuestion;
  questionId: string;
  initialAnswer?: Partial<QueensAnswer>;
  disabled: boolean;
  onProgress: (answer: QueensAnswer, queensChanged: boolean) => void;
  onValidate: (answer: QueensAnswer) => void;
}) {
  const [answer, setAnswer] = useState<QueensAnswer>(() => {
    const queens = [
      ...new Set([...(question.prefilledQueens ?? []), ...(initialAnswer?.queens ?? [])]),
    ].sort((a, b) => a - b);
    return {
      queens,
      marks: [...new Set(initialAnswer?.marks ?? [])]
        .filter((cell) => !queens.includes(cell))
        .sort((a, b) => a - b),
    };
  });
  const [announcement, setAnnouncement] = useState("");
  const currentAnswer = useRef(answer);
  const pendingValidation = useRef<QueensAnswer | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const validate = useRef(onValidate);

  useEffect(() => {
    validate.current = onValidate;
  }, [onValidate]);

  useEffect(() => {
    // Neither a restored board nor a prop update should create a validation.
    pendingValidation.current = null;
    if (timer.current !== null) clearTimeout(timer.current);
    return () => {
      pendingValidation.current = null;
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, [disabled, questionId]);

  const publish = (next: QueensAnswer, message: string) => {
    const previous = currentAnswer.current;
    const queensChanged =
      previous.queens.length !== next.queens.length ||
      previous.queens.some((cell, index) => cell !== next.queens[index]);
    if (timer.current !== null) clearTimeout(timer.current);
    if (queensChanged) {
      pendingValidation.current = next.queens.length === question.grid.rows ? next : null;
    } else if (pendingValidation.current) {
      pendingValidation.current = next;
    }
    currentAnswer.current = next;
    setAnswer(next);
    setAnnouncement(message);
    if (pendingValidation.current) {
      timer.current = setTimeout(() => {
        const candidate = pendingValidation.current;
        pendingValidation.current = null;
        timer.current = null;
        if (candidate) validate.current(candidate);
      }, QUEENS_VALIDATION_DELAY_MS);
    }
    onProgress(next, queensChanged);
  };

  const canEdit = (cell: number) => {
    if (disabled) return false;
    if (question.prefilledQueens?.includes(cell)) {
      setAnnouncement("Esta corona es una pista fija y no se puede retirar.");
      return false;
    }
    return true;
  };

  const clearCell = (cell: number) => {
    if (!canEdit(cell)) return;
    const current = currentAnswer.current;
    if (!current.queens.includes(cell) && !current.marks.includes(cell)) return;
    publish(
      {
        queens: current.queens.filter((candidate) => candidate !== cell),
        marks: current.marks.filter((candidate) => candidate !== cell),
      },
      `Casilla ${cell + 1} vaciada.`,
    );
  };

  const cycleCell = (cell: number) => {
    if (!canEdit(cell)) return;
    const current = currentAnswer.current;
    if (current.queens.includes(cell)) {
      clearCell(cell);
    } else if (current.marks.includes(cell)) {
      if (current.queens.length >= question.grid.rows) {
        clearCell(cell);
        return;
      }
      const queens = [...current.queens, cell].sort((a, b) => a - b);
      const conflicts = [...(getQueensConflicts(question, queens).get(cell) ?? [])];
      publish(
        { queens, marks: current.marks.filter((candidate) => candidate !== cell) },
        conflicts.length
          ? `Corona en conflicto: ${conflicts.map((type) => CONFLICT_LABELS[type]).join(", ")}.`
          : `Corona colocada en la casilla ${cell + 1}.`,
      );
    } else {
      publish(
        { queens: current.queens, marks: [...current.marks, cell].sort((a, b) => a - b) },
        `Casilla ${cell + 1} marcada con X.`,
      );
    }
  };

  return { answer, announcement, cycleCell, clearCell };
}
