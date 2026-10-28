import type { GameSessionErrorCode } from "@/types/contracts/competitive-errors";
import type { FailureAction } from "../core/commandRecoveryPolicy";
import type { Feedback, FeedbackChannel, Operation } from "../core/sessionReducer";

const rejectedInput: Partial<Record<GameSessionErrorCode, string>> = {
  request_predates_presentation:
    "La pregunta aún no estaba preparada. Vuelve a enviar tu respuesta.",
  duplicate_queens_placement: "Esa casilla ya tiene una corona.",
  invalid_queens_placement: "No puedes colocar una corona en esa casilla.",
  prefilled_queen_locked: "Esa corona forma parte del tablero inicial.",
  invalid_answer: "La respuesta no es válida. Puedes corregirla.",
  attempt_permission_revoked:
    "Esta partida se cerró porque ya no tienes permiso para competir en esta sala.",
  takeover_not_prepared:
    "Recarga la página para preparar este dispositivo antes de continuar la partida.",
  invalid_mini_wordle_guess: "Esta palabra no está disponible para este desafío.",
  duplicate_mini_wordle_guess: "Ya has probado esa palabra. El intento no se ha consumido.",
  invalid_logic_code: "El código debe tener la longitud indicada y contener solo cifras.",
  duplicate_logic_code: "Ya has probado ese código. El intento no se ha consumido.",
  invalid_word_hashtag_swap: "Ese intercambio no está permitido.",
  all_clues_revealed: "Ya has revelado todas las pistas.",
  word_search_target_already_found: "Esa palabra ya está encontrada.",
  invalid_word_search_selection: "La selección no es válida.",
  queens_answer_incomplete: "Completa el tablero para validar la respuesta.",
  queens_answer_overflow: "Ya tienes todas las coronas. Retira una antes de colocar otra.",
  invalid_queens_answer:
    "La configuración de Queens no es válida. Revisa las coronas y las casillas.",
  invalid_matching_answer: "La respuesta de parejas no es válida. Revisa todas las asociaciones.",
  invalid_connect_pairs_answer:
    "Conecta todas las parejas sin cruces y cubre el tablero completo. Puedes rehacer los caminos.",
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
  code: GameSessionErrorCode | undefined,
  action: FailureAction,
  channel?: FeedbackChannel,
) {
  const rejection = code ? rejectedInput[code] : undefined;
  const definitive = action.type === "command-failed" && action.definitive;
  const retry = action.type === "command-failed" ? action.retry : undefined;
  const message =
    action.type === "reload-projection"
      ? !action.automatic
        ? "La operación se ha rechazado. Recarga la partida para continuar desde el estado guardado."
        : operation === "start" && code === "attempt_session_missing"
          ? "Recarga la página para preparar la sesión antes de empezar."
          : "Comprobando el resultado guardado. Puedes volver a cargarlo."
      : retry?.retryable && retry.delayMs === undefined
        ? "No hemos podido confirmar la operación"
        : code === "alphabet_deadline_not_reached" || code === "time_trial_not_terminal"
          ? "Esperando a que termine el tiempo de la partida."
          : retry?.seconds !== undefined
            ? `Demasiadas solicitudes. Espera ${retry.seconds} ${retry.seconds === 1 ? "segundo" : "segundos"} antes de volver a intentarlo.`
            : (rejection ??
              uncertainInput[operation] ??
              "No hemos podido confirmar la operación. Puedes reintentarlo.");
  const feedback: Feedback | undefined = channel
    ? {
        channel:
          code === "invalid_matching_answer" || code === "invalid_connect_pairs_answer"
            ? "submission"
            : channel,
        state:
          definitive &&
          code !== "invalid_word_hashtag_swap" &&
          code !== "invalid_matching_answer" &&
          code !== "invalid_connect_pairs_answer"
            ? "idle"
            : "error",
        visible: true,
        message,
      }
    : undefined;
  return { message, feedback };
}
