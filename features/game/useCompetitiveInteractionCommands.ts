"use client";

import { useMemo } from "react";
import {
  createCompetitiveAttemptClient,
  createCompetitiveIdempotencyKey,
} from "./competitive/attemptClient";

export function useCompetitiveInteractionCommands() {
  const client = useMemo(() => createCompetitiveAttemptClient(), []);
  return { client, idempotencyKey: createCompetitiveIdempotencyKey };
}
