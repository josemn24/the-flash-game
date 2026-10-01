"use client";

import { useCallback, useReducer, useRef } from "react";
import {
  initialServerFlashSessionState,
  serverFlashSessionReducer,
  type ServerFlashAttemptState,
  type ServerFlashPhase,
} from "./competitive/sessionState";

export function useCompetitiveSessionLifecycle(initialPhase: ServerFlashPhase) {
  const [state, dispatch] = useReducer(
    serverFlashSessionReducer,
    initialServerFlashSessionState(initialPhase),
  );
  const recoveryStarted = useRef(false);

  const setPhase = useCallback(
    (phase: ServerFlashPhase) => dispatch({ type: "set_phase", phase }),
    [],
  );
  const setAttempt = useCallback(
    (attempt: ServerFlashAttemptState | null) => dispatch({ type: "set_attempt", attempt }),
    [],
  );
  const setAttemptExpired = useCallback(
    (value: boolean) => dispatch({ type: "set_attempt_expired", value }),
    [],
  );
  const setStartNotice = useCallback(
    (notice?: string) => dispatch({ type: "set_start_notice", notice }),
    [],
  );
  const setLevelNotice = useCallback(
    (notice?: string) => dispatch({ type: "set_level_notice", notice }),
    [],
  );

  return {
    phase: state.phase,
    setPhase,
    attempt: state.attempt,
    setAttempt,
    attemptExpired: state.attemptExpired,
    setAttemptExpired,
    startNotice: state.startNotice,
    setStartNotice,
    levelNotice: state.levelNotice,
    setLevelNotice,
    recoveryStartedRef: recoveryStarted,
  };
}
