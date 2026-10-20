import type { CompetitiveQuestionType } from "@/lib/question-formats/definitions";
import type { RehearsalSource } from "@/types/gameplay/rehearsal";
import {
  mechanics,
  rehearsalStructure as project,
  rehearsalCompatibility as compare,
} from "./structure-core.mjs";
// Compile-time exhaustiveness also protects the CLI's shared implementation.
const registry: Record<CompetitiveQuestionType, (...args: never[]) => object> = mechanics;
void registry;
export function rehearsalStructure(source: RehearsalSource) {
  return project(source);
}
export function rehearsalCompatibility(
  source: RehearsalSource,
  candidate: RehearsalSource,
): string[] {
  return compare(source, candidate);
}
