import "server-only";

import type {
  CreateFlashDraftInput,
  CreateQuestionDraftInput,
  ArchiveQuestionInput,
  PublishFlashInput,
  PublishQuestionInput,
  QuestionLibraryFilters,
  SuperadminEditorialCommands,
  SuperadminEditorialQueries,
  UpdateFlashDraftInput,
  UpdateQuestionDraftInput,
} from "@/application/ports/superadmin-editorial-commands";
import {
  SuperadminAccessDeniedError,
  SuperadminEditorialCommandError,
} from "@/application/administration/errors";
import { isFlashEditorialDocument, parseFlashEditorialQuestionDocument } from "@/lib/editorial/flashDocument";
import { createClient } from "@/lib/supabase/server";
import type {
  SuperadminEditorialCommandResult,
  SuperadminChallengeCatalogContext,
  SuperadminChallengeDetailContext,
  SuperadminChallengeSummary,
  SuperadminEditorialContext,
  SuperadminEditorialEntry,
  SuperadminQuestionLibraryContext,
  SuperadminQuestionLibraryEntry,
  SuperadminQuestionVersionDetail,
} from "@/types/view-models/editorial";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statuses = new Set(["draft", "published", "archived"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isIsoDate(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isEditorialEntry(
  value: unknown,
  allowDraftWithoutDocument = false,
): value is SuperadminEditorialEntry {
  if (!isRecord(value)) return false;
  const isDraft = value.status === "draft";
  return (
    typeof value.challengeDefinitionId === "string" && uuidPattern.test(value.challengeDefinitionId) &&
    typeof value.challengeVersionId === "string" && uuidPattern.test(value.challengeVersionId) &&
    typeof value.versionNumber === "number" && Number.isSafeInteger(value.versionNumber) && value.versionNumber > 0 &&
    typeof value.status === "string" && statuses.has(value.status) &&
    typeof value.slug === "string" && value.slug.trim().length > 0 &&
    typeof value.title === "string" && value.title.trim().length > 0 &&
    typeof value.subtitle === "string" && typeof value.description === "string" &&
    value.mode === "flash" && typeof value.questionCount === "number" && Number.isSafeInteger(value.questionCount) && value.questionCount >= 0 &&
    isIsoDate(value.createdAt) && isIsoDate(value.updatedAt) &&
    (value.publishedAt === null || isIsoDate(value.publishedAt)) &&
    (isDraft
      ? (allowDraftWithoutDocument && value.document === null) || isFlashEditorialDocument(value.document)
      : value.document === null)
  );
}

function isEditorialContext(value: unknown): value is Omit<SuperadminEditorialContext, "source"> {
  return isRecord(value) && Array.isArray(value.entries) && value.entries.every((entry) => isEditorialEntry(entry));
}

function isChallengeSummary(value: unknown): value is SuperadminChallengeSummary {
  if (!isRecord(value) || !isRecord(value.latestVersion) || !isRecord(value.statusCounts)) return false;
  const latest = value.latestVersion;
  const counts = value.statusCounts;
  return (
    typeof value.challengeDefinitionId === "string" && uuidPattern.test(value.challengeDefinitionId) &&
    typeof value.slug === "string" && value.slug.trim().length > 0 &&
    typeof value.title === "string" && value.title.trim().length > 0 &&
    typeof value.subtitle === "string" && typeof value.description === "string" &&
    value.mode === "flash" &&
    typeof value.questionCount === "number" && Number.isSafeInteger(value.questionCount) && value.questionCount >= 0 &&
    typeof value.versionCount === "number" && Number.isSafeInteger(value.versionCount) && value.versionCount > 0 &&
    statuses.has(String(value.status)) && isIsoDate(value.updatedAt) &&
    ("draft" in counts && "published" in counts && "archived" in counts) &&
    ["draft", "published", "archived"].every((status) => typeof counts[status] === "number" && Number.isSafeInteger(counts[status]) && counts[status] >= 0) &&
    typeof latest.challengeVersionId === "string" && uuidPattern.test(latest.challengeVersionId) &&
    typeof latest.versionNumber === "number" && Number.isSafeInteger(latest.versionNumber) && latest.versionNumber > 0 &&
    statuses.has(String(latest.status)) &&
    typeof latest.questionCount === "number" && Number.isSafeInteger(latest.questionCount) && latest.questionCount >= 0 &&
    isIsoDate(latest.updatedAt) && (latest.publishedAt === null || isIsoDate(latest.publishedAt))
  );
}

function isChallengeCatalog(value: unknown): value is Omit<SuperadminChallengeCatalogContext, "source"> {
  return isRecord(value) && Array.isArray(value.entries) && value.entries.every(isChallengeSummary);
}

function isChallengeDetail(value: unknown): value is Omit<SuperadminChallengeDetailContext, "source"> {
  return isRecord(value) && typeof value.challengeDefinitionId === "string" &&
    uuidPattern.test(value.challengeDefinitionId) && Array.isArray(value.entries) &&
    value.entries.length > 0 && value.entries.every((entry) => isEditorialEntry(entry));
}

function isQuestionLibraryEntry(value: unknown): value is SuperadminQuestionLibraryEntry {
  return isRecord(value) &&
    typeof value.questionDefinitionId === "string" && uuidPattern.test(value.questionDefinitionId) &&
    typeof value.questionVersionId === "string" && uuidPattern.test(value.questionVersionId) &&
    typeof value.versionNumber === "number" && Number.isSafeInteger(value.versionNumber) && value.versionNumber > 0 &&
    typeof value.status === "string" && statuses.has(value.status) &&
    typeof value.slug === "string" && value.slug.length > 0 &&
    typeof value.type === "string" &&
    typeof value.question === "string" && value.question.length > 0 &&
    (value.category === null || typeof value.category === "string") &&
    isRecord(value.tags) &&
    typeof value.timeLimitMs === "number" && Number.isSafeInteger(value.timeLimitMs) && value.timeLimitMs > 0 &&
    isIsoDate(value.createdAt) && isIsoDate(value.updatedAt) &&
    (value.publishedAt === null || isIsoDate(value.publishedAt)) &&
    typeof value.versionCount === "number" && Number.isSafeInteger(value.versionCount) && value.versionCount > 0 &&
    typeof value.usageCount === "number" && Number.isSafeInteger(value.usageCount) && value.usageCount >= 0;
}

function isQuestionLibraryContext(value: unknown): value is Omit<SuperadminQuestionLibraryContext, "source"> {
  return isRecord(value) && Array.isArray(value.entries) && value.entries.every(isQuestionLibraryEntry) &&
    typeof value.total === "number" && Number.isSafeInteger(value.total) && value.total >= 0 &&
    typeof value.page === "number" && Number.isSafeInteger(value.page) && value.page > 0 &&
    typeof value.pageSize === "number" && Number.isSafeInteger(value.pageSize) && value.pageSize > 0;
}

function isQuestionVersionDetail(value: unknown): value is SuperadminQuestionVersionDetail {
  return isRecord(value) && typeof value.questionDefinitionId === "string" && uuidPattern.test(value.questionDefinitionId) &&
    typeof value.slug === "string" && value.slug.length > 0 && Array.isArray(value.versions) &&
    value.versions.every((version) => {
      if (!isQuestionLibraryEntry(version) || !("document" in version)) return false;
      return version.document === null || (() => {
        try {
          parseFlashEditorialQuestionDocument(version.document);
          return true;
        } catch {
          return false;
        }
      })();
    });
}

function commandErrorCode(error: { code?: string; message?: string }) {
  const message = error.message ?? "";
  const candidates = [
    "not_authorized",
    "invalid_command",
    "invalid_content",
    "content_not_found",
    "content_not_draft",
    "content_already_published",
    "unsupported_mode",
    "unsupported_question_type",
    "unsupported_schema_version",
    "invalid_public_payload",
    "invalid_solution_payload",
    "points_total_invalid",
    "incomplete_content",
    "content_conflict",
    "content_slug_conflict",
    "content_not_published",
    "invalid_question_document",
    "invalid_question_reference",
    "question_not_published",
    "idempotency_conflict",
  ];
  return candidates.find((candidate) => message.includes(candidate)) ?? error.code ?? "command_failed";
}

async function callQuestionCommand<T>(
  functionName:
    | "create_superadmin_question_draft"
    | "update_superadmin_question_draft"
    | "publish_superadmin_question"
    | "archive_superadmin_question",
  input: CreateQuestionDraftInput | UpdateQuestionDraftInput | PublishQuestionInput | ArchiveQuestionInput,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(functionName, { input });
  if (error) {
    if (error.code === "42501" || error.message.includes("not_authorized")) {
      throw new SuperadminAccessDeniedError();
    }
    throw new SuperadminEditorialCommandError(commandErrorCode(error), error);
  }
  if (!isQuestionVersionDetail(data)) {
    throw new SuperadminEditorialCommandError("invalid_response");
  }
  return { ...data, source: "supabase" as const } as T;
}

async function callCommand<T>(
  functionName:
    | "create_superadmin_flash_draft"
    | "update_superadmin_flash_draft"
    | "publish_superadmin_flash",
  input: CreateFlashDraftInput | UpdateFlashDraftInput | PublishFlashInput,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(functionName, { input });
  if (error) {
    if (error.code === "42501" || error.message.includes("not_authorized")) {
      throw new SuperadminAccessDeniedError();
    }
    throw new SuperadminEditorialCommandError(commandErrorCode(error), error);
  }
  if (!isEditorialEntry(data, true)) {
    throw new SuperadminEditorialCommandError("invalid_response");
  }
  return { ...data, source: "supabase" as const } as T;
}

export class SupabaseSuperadminEditorialQueries
  implements SuperadminEditorialQueries, SuperadminEditorialCommands
{
  async getContext(): Promise<SuperadminEditorialContext> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_superadmin_editorial_context");
    if (error) {
      if (error.code === "42501" || error.message.includes("not_authorized")) {
        throw new SuperadminAccessDeniedError();
      }
      throw new Error(`Supabase editorial read failed: ${error.message}`);
    }
    if (!isEditorialContext(data)) {
      throw new Error("Supabase editorial read returned an invalid context payload.");
    }
    return { ...data, source: "supabase" };
  }

  async getChallengeCatalog(): Promise<SuperadminChallengeCatalogContext> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_superadmin_challenge_catalog");
    if (error) {
      if (error.code === "42501" || error.message.includes("not_authorized")) {
        throw new SuperadminAccessDeniedError();
      }
      throw new Error(`Supabase challenge catalog read failed: ${error.message}`);
    }
    if (!isChallengeCatalog(data)) throw new Error("Supabase challenge catalog returned an invalid payload.");
    return { ...data, source: "supabase" };
  }

  async getChallengeDetail(challengeDefinitionId: string): Promise<SuperadminChallengeDetailContext | null> {
    if (!uuidPattern.test(challengeDefinitionId)) return null;
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_superadmin_challenge_detail", {
      target_challenge_definition_id: challengeDefinitionId,
    });
    if (error) {
      if (error.code === "42501" || error.message.includes("not_authorized")) {
        throw new SuperadminAccessDeniedError();
      }
      throw new Error(`Supabase challenge detail read failed: ${error.message}`);
    }
    if (data === null) return null;
    if (!isChallengeDetail(data)) throw new Error("Supabase challenge detail returned an invalid payload.");
    return { ...data, source: "supabase" };
  }

  createFlashDraft(input: CreateFlashDraftInput): Promise<SuperadminEditorialCommandResult> {
    return callCommand("create_superadmin_flash_draft", input);
  }

  updateFlashDraft(input: UpdateFlashDraftInput): Promise<SuperadminEditorialCommandResult> {
    return callCommand("update_superadmin_flash_draft", input);
  }

  publishFlash(input: PublishFlashInput): Promise<SuperadminEditorialCommandResult> {
    return callCommand("publish_superadmin_flash", input);
  }

  async getQuestionLibrary(filters: QuestionLibraryFilters = {}): Promise<SuperadminQuestionLibraryContext> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_superadmin_question_library", { input: filters });
    if (error) {
      if (error.code === "42501" || error.message.includes("not_authorized")) {
        throw new SuperadminAccessDeniedError();
      }
      throw new Error(`Supabase question library read failed: ${error.message}`);
    }
    if (!isQuestionLibraryContext(data)) throw new Error("Supabase question library returned an invalid payload.");
    return { ...data, source: "supabase" };
  }

  async getQuestionVersion(questionVersionId: string): Promise<SuperadminQuestionVersionDetail> {
    if (!uuidPattern.test(questionVersionId)) {
      throw new SuperadminEditorialCommandError("invalid_command");
    }
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_superadmin_question_version", {
      question_version_id: questionVersionId,
    });
    if (error) {
      if (error.code === "42501" || error.message.includes("not_authorized")) {
        throw new SuperadminAccessDeniedError();
      }
      throw new Error(`Supabase question version read failed: ${error.message}`);
    }
    if (!isQuestionVersionDetail(data)) throw new Error("Supabase question version returned an invalid payload.");
    return { ...data, source: "supabase" };
  }

  createQuestionDraft(input: CreateQuestionDraftInput): Promise<SuperadminQuestionVersionDetail> {
    return callQuestionCommand("create_superadmin_question_draft", input);
  }

  updateQuestionDraft(input: UpdateQuestionDraftInput): Promise<SuperadminQuestionVersionDetail> {
    return callQuestionCommand("update_superadmin_question_draft", input);
  }

  publishQuestion(input: PublishQuestionInput): Promise<SuperadminQuestionVersionDetail> {
    return callQuestionCommand("publish_superadmin_question", input);
  }

  archiveQuestion(input: ArchiveQuestionInput): Promise<SuperadminQuestionVersionDetail> {
    return callQuestionCommand("archive_superadmin_question", input);
  }
}

export const supabaseSuperadminEditorialQueries = new SupabaseSuperadminEditorialQueries();
export const supabaseSuperadminEditorialCommands = supabaseSuperadminEditorialQueries;

export function isSuperadminEditorialContext(value: unknown): value is SuperadminEditorialContext {
  return isEditorialContext(value);
}

export function isSuperadminEditorialCommandResult(
  value: unknown,
): value is SuperadminEditorialCommandResult {
  return isEditorialEntry(value, true);
}
