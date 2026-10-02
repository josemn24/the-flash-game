import type { Feedback, FeedbackChannel, Operation } from "../core/sessionReducer";

const rejectedInput: Record<string, string> = {
  invalid_mini_wordle_guess: "Esta palabra no está disponible para este desafío.",
  duplicate_mini_wordle_guess: "Ya has probado esa palabra. El intento no se ha consumido.",
  invalid_logic_code: "El código debe tener la longitud indicada y contener solo cifras.",
  duplicate_logic_code: "Ya has probado ese código. El intento no se ha consumido.",
  invalid_word_hashtag_swap: "Ese intercambio no está permitido.",
  all_clues_revealed: "Ya has revelado todas las pistas.",
  word_search_target_already_found: "Esa palabra ya está encontrada.",
  invalid_word_search_selection: "La selección no es válida.",
  queens_answer_incomplete: "Completa el tablero para validar la respuesta.",
  invalid_matching_answer: "La respuesta de parejas no es válida. Revisa todas las asociaciones.",
};
const uncertainInput: Partial<Record<Operation, string>> = {
  answer: "No hemos podido confirmar tu respuesta.",
  miniWordleGuess: "No hemos podido confirmar tu palabra.",
  logicCodeAttempt: "No hemos podido confirmar tu código.",
  wordHashtagSwap: "No hemos podido guardar el intercambio.",
  progressiveClueReveal: "No hemos podido revelar la siguiente pista.",
  queensValidation: "No hemos podido validar el tablero. Puedes reintentarlo.",
  wordSearchSelection: "No hemos podido confirmar la selección.",
};

/** Keeps each existing format renderer's feedback contract. */
export function formatFailure(
  operation: Operation,
  code: string | undefined,
  channel?: FeedbackChannel,
) {
  const rejection = code ? rejectedInput[code] : undefined;
  const definitive = Boolean(rejection);
  const message =
    rejection ??
    uncertainInput[operation] ??
    "No hemos podido confirmar la operación. Puedes reintentarlo.";
  const feedback: Feedback | undefined = channel
    ? {
        channel: code === "invalid_matching_answer" ? "submission" : channel,
        state:
          definitive && code !== "invalid_word_hashtag_swap" && code !== "invalid_matching_answer"
            ? "idle"
            : "error",
        visible: true,
        message,
      }
    : undefined;
  return { definitive, message, feedback };
}
