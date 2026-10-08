import {
  AuthenticationRequiredError,
  SuperadminAccessDeniedError,
  SuperadminAttemptCommandError,
  SuperadminEditorialCommandError,
  SuperadminUserCommandError,
} from "@/application/administration/errors";
import type {
  AdminRateLimiter,
  SuperadminAccess,
  SuperadminAccessDependencies,
  SuperadminAuthAdmin,
} from "@/application/ports/superadmin-access";
import type {
  SuperadminAttemptCommands,
  SuperadminAttemptCommandInput,
  SuperadminAdjustResultInput,
  SuperadminAdministrativeResult,
} from "@/application/ports/superadmin-attempt-commands";
import type {
  CalendarTickRunner,
  CancelScheduledChallengeInput,
  CreateScheduledChallengeInput,
  SuperadminCalendarCommands,
  SuperadminCalendarQueries,
  UpdateScheduledChallengeInput,
} from "@/application/ports/superadmin-calendar-commands";
import type {
  ArchiveChallengeVersionInput,
  ArchiveQuestionInput,
  CreateChallengeRevisionInput,
  CreateFlashDraftInput,
  CreateQuestionDraftInput,
  PublishFlashInput,
  PublishQuestionInput,
  QuestionLibraryFilters,
  SuperadminEditorialCommands,
  SuperadminEditorialQueries,
  UpdateFlashDraftInput,
  UpdateQuestionDraftInput,
} from "@/application/ports/superadmin-editorial-commands";
import type {
  ActivateSeasonInput,
  CreateSeasonInput,
  SuperadminSeasonCommands,
  UpdateSeasonInput,
} from "@/application/ports/superadmin-season-commands";
import type {
  AddSuperadminRoomMemberInput,
  SuperadminUserCommands,
} from "@/application/ports/superadmin-user-commands";
import type {
  CreateRoomInput,
  SuperadminRoomCommands,
} from "@/application/ports/superadmin-room-commands";
import type {
  SuperadminAttemptQueries,
  SuperadminDashboardQueries,
  SuperadminPortalQueries,
  SuperadminRoomQueries,
} from "@/application/queries";
import { findEditorialCapabilityIssue } from "@/lib/editorial/capabilityPreflight";
import type { SuperadminEditorialEntry } from "@/types/view-models/editorial";

export class ApplicationSuperadminAccess {
  constructor(private readonly dependencies: SuperadminAccessDependencies) {}

  async requireAccess(): Promise<SuperadminAccess> {
    const viewer = await this.dependencies.currentViewer.getCurrentViewer();
    if (!viewer) throw new AuthenticationRequiredError();

    const authUserId = await this.dependencies.authenticatedUser.getAuthenticatedUserId();
    if (!authUserId) throw new AuthenticationRequiredError();

    const context = await this.dependencies.portalQueries.getContext();
    if (context.operator.playerId !== viewer.playerId) {
      throw new SuperadminAccessDeniedError();
    }

    return {
      actor: {
        playerId: context.operator.playerId,
        displayName: context.operator.displayName,
        requestId: this.dependencies.requestIds.generate(),
      },
      context,
      authUserId,
    };
  }
}

type ReadDependencies = {
  readonly access: ApplicationSuperadminAccess;
  readonly portal: SuperadminPortalQueries;
  readonly dashboard: SuperadminDashboardQueries;
  readonly rooms: SuperadminRoomQueries;
  readonly editorial: SuperadminEditorialQueries;
  readonly calendar: SuperadminCalendarQueries;
  readonly attempts: SuperadminAttemptQueries;
};

function summarizeChallengeEntries(entries: readonly SuperadminEditorialEntry[]) {
  const latest = entries[0];
  if (!latest) throw new Error("A challenge detail must contain at least one Flash version.");
  const statusCounts = { draft: 0, published: 0, archived: 0 };
  for (const entry of entries) statusCounts[entry.status] += 1;
  return {
    challengeDefinitionId: latest.challengeDefinitionId,
    slug: latest.slug,
    title: latest.title,
    subtitle: latest.subtitle,
    description: latest.description,
    mode: latest.mode,
    questionCount: latest.questionCount,
    versionCount: entries.length,
    status: latest.status,
    statusCounts,
    updatedAt: latest.updatedAt,
    latestVersion: {
      challengeVersionId: latest.challengeVersionId,
      versionNumber: latest.versionNumber,
      status: latest.status,
      questionCount: latest.questionCount,
      updatedAt: latest.updatedAt,
      publishedAt: latest.publishedAt,
    },
  };
}

export class ApplicationSuperadminReads {
  constructor(private readonly dependencies: ReadDependencies) {}

  async getAccess() {
    return this.dependencies.access.requireAccess();
  }

  async lookupPlayers(emails: readonly string[]) {
    await this.dependencies.access.requireAccess();
    return this.dependencies.portal.lookupPlayersByEmail(emails);
  }

  async getDashboard() {
    await this.dependencies.access.requireAccess();
    return this.dependencies.dashboard.getDashboard();
  }

  async getOperator() {
    return (await this.dependencies.access.requireAccess()).context.operator;
  }

  async getRooms() {
    const access = await this.dependencies.access.requireAccess();
    return {
      operator: access.context.operator,
      rooms: access.context.rooms,
      source: "supabase" as const,
    };
  }

  async getQuestionVersion(questionVersionId: string) {
    const access = await this.dependencies.access.requireAccess();
    return {
      operator: access.context.operator,
      detail: await this.dependencies.editorial.getQuestionVersion(questionVersionId),
    };
  }

  async getChallengeCatalog() {
    const access = await this.dependencies.access.requireAccess();
    const catalog = await this.dependencies.editorial.getChallengeCatalog();
    return {
      operator: access.context.operator,
      challenges: catalog.entries,
      source: "supabase" as const,
    };
  }

  async getNewChallenge() {
    const access = await this.dependencies.access.requireAccess();
    return {
      operator: access.context.operator,
      editorial: { entries: [], source: "supabase" as const },
      questionLibrary: await this.dependencies.editorial.getQuestionLibrary({ status: "all" }),
    };
  }

  async getChallengeDetail(
    challengeDefinitionId: string,
    comparisonIds?: readonly [string, string],
  ) {
    const access = await this.dependencies.access.requireAccess();
    const [detail, questionLibrary, comparison] = await Promise.all([
      this.dependencies.editorial.getChallengeDetail(challengeDefinitionId),
      this.dependencies.editorial.getQuestionLibrary({ status: "all" }),
      comparisonIds
        ? this.dependencies.editorial.getChallengeVersionComparison(
            comparisonIds[0],
            comparisonIds[1],
          )
        : Promise.resolve(null),
    ]);
    if (!detail) return null;
    return {
      operator: access.context.operator,
      challenge: summarizeChallengeEntries(detail.entries),
      editorial: { entries: detail.entries, source: "supabase" as const },
      questionLibrary,
      comparison,
      source: "supabase" as const,
    };
  }

  async getRoomDetail(roomId: string) {
    const access = await this.dependencies.access.requireAccess();
    const detail = await this.dependencies.rooms.getDetail(roomId);
    if (!detail) return null;
    const [calendar, editorial] = await Promise.all([
      this.dependencies.calendar.getContext(roomId),
      this.dependencies.editorial.getContext(),
    ]);
    return {
      operator: access.context.operator,
      room: detail.room,
      members: detail.members,
      calendar,
      publishedContent: editorial.entries.filter((entry) => entry.status === "published"),
      source: "supabase" as const,
    };
  }

  async getCalendarContext(roomId?: string) {
    await this.dependencies.access.requireAccess();
    return this.dependencies.calendar.getContext(roomId);
  }

  async getAttemptPublications(roomId: string) {
    const access = await this.dependencies.access.requireAccess();
    const publications = await this.dependencies.attempts.listPublications(roomId);
    if (!publications) return null;
    const room = access.context.rooms.find((entry) => entry.roomId === roomId);
    if (!room) return null;
    return {
      operator: access.context.operator,
      roomId,
      roomTitle: room.title,
      publications,
      source: "supabase" as const,
    };
  }

  async getAttemptList(
    roomId: string,
    scheduledChallengeId: string,
    cursor?: { readonly startedAt: string; readonly attemptId: string } | null,
  ) {
    const access = await this.dependencies.access.requireAccess();
    const list = await this.dependencies.attempts.listAttempts(
      roomId,
      scheduledChallengeId,
      cursor,
    );
    if (!list) return null;
    return { operator: access.context.operator, ...list, source: "supabase" as const };
  }

  async getAttemptInspection(roomId: string, scheduledChallengeId: string, attemptId: string) {
    const access = await this.dependencies.access.requireAccess();
    const inspection = await this.dependencies.attempts.getInspection(
      roomId,
      scheduledChallengeId,
      attemptId,
    );
    if (!inspection) return null;
    return { operator: access.context.operator, ...inspection, source: "supabase" as const };
  }

  async getQuestionLibrary(filters?: QuestionLibraryFilters) {
    const access = await this.dependencies.access.requireAccess();
    return {
      operator: access.context.operator,
      library: await this.dependencies.editorial.getQuestionLibrary(filters),
    };
  }

  async getEditorialContext() {
    await this.dependencies.access.requireAccess();
    return this.dependencies.editorial.getContext();
  }
}

type CommandDependencies = {
  readonly access: ApplicationSuperadminAccess;
  readonly rateLimiter: AdminRateLimiter;
  readonly rooms: SuperadminRoomCommands;
  readonly editorial: SuperadminEditorialCommands;
  readonly editorialQueries: SuperadminEditorialQueries;
  readonly calendar: SuperadminCalendarCommands;
  readonly seasons: SuperadminSeasonCommands;
  readonly users: SuperadminUserCommands;
  readonly authAdmin: SuperadminAuthAdmin;
  readonly attemptCommandsFor: (authUserId: string) => SuperadminAttemptCommands;
};

export class ApplicationSuperadminCommands {
  constructor(private readonly dependencies: CommandDependencies) {}

  private async prepare(key: string) {
    const access = await this.dependencies.access.requireAccess();
    this.dependencies.rateLimiter.consume(key);
    return access;
  }

  async createRoom(input: CreateRoomInput) {
    await this.prepare("superadmin");
    return this.dependencies.rooms.createRoom(input);
  }

  async createSeason(input: CreateSeasonInput) {
    await this.prepare("superadmin");
    return this.dependencies.seasons.createSeason(input);
  }

  async updateSeason(input: UpdateSeasonInput) {
    await this.prepare("superadmin");
    return this.dependencies.seasons.updateSeason(input);
  }

  async activateSeason(input: ActivateSeasonInput) {
    await this.prepare("superadmin");
    return this.dependencies.seasons.activateSeason(input);
  }

  async createScheduledChallenge(input: CreateScheduledChallengeInput) {
    await this.prepare("superadmin");
    return this.dependencies.calendar.createScheduledChallenge(input);
  }

  async updateScheduledChallenge(input: UpdateScheduledChallengeInput) {
    await this.prepare("superadmin");
    return this.dependencies.calendar.updateScheduledChallenge(input);
  }

  async cancelScheduledChallenge(input: CancelScheduledChallengeInput) {
    await this.prepare("superadmin");
    return this.dependencies.calendar.cancelScheduledChallenge(input);
  }

  async createFlashDraft(input: CreateFlashDraftInput) {
    await this.prepare("superadmin");
    return this.dependencies.editorial.createFlashDraft(input);
  }

  async updateFlashDraft(input: UpdateFlashDraftInput) {
    await this.prepare("superadmin");
    return this.dependencies.editorial.updateFlashDraft(input);
  }

  async publishFlash(input: PublishFlashInput) {
    await this.prepare("superadmin");
    const context = await this.dependencies.editorialQueries.getContext();
    const version = context.entries.find(
      (entry) => entry.challengeVersionId === input.challengeVersionId,
    );
    const issue = version?.document ? findEditorialCapabilityIssue(version.document) : null;
    if (issue) throw new SuperadminEditorialCommandError(issue.code);
    return this.dependencies.editorial.publishFlash(input);
  }

  async createChallengeRevision(input: CreateChallengeRevisionInput) {
    await this.prepare("superadmin");
    return this.dependencies.editorial.createChallengeRevision(input);
  }

  async archiveChallengeVersion(input: ArchiveChallengeVersionInput) {
    await this.prepare("superadmin");
    return this.dependencies.editorial.archiveChallengeVersion(input);
  }

  async createQuestionDraft(input: CreateQuestionDraftInput) {
    await this.prepare("superadmin");
    return this.dependencies.editorial.createQuestionDraft(input);
  }

  async updateQuestionDraft(input: UpdateQuestionDraftInput) {
    await this.prepare("superadmin");
    return this.dependencies.editorial.updateQuestionDraft(input);
  }

  async publishQuestion(input: PublishQuestionInput) {
    await this.prepare("superadmin");
    return this.dependencies.editorial.publishQuestion(input);
  }

  async archiveQuestion(input: ArchiveQuestionInput) {
    await this.prepare("superadmin");
    return this.dependencies.editorial.archiveQuestion(input);
  }

  async lookupPlayers(emails: readonly string[]) {
    await this.prepare("superadmin");
    return this.dependencies.users.lookupPlayers(emails);
  }

  async createPlayer(input: {
    readonly idempotencyKey: string;
    readonly email: string;
    readonly password: string;
    readonly displayName: string;
    readonly reason: string;
  }) {
    const access = await this.dependencies.access.requireAccess();
    this.dependencies.rateLimiter.consume(`superadmin-user-create:${access.actor.playerId}`);
    let authUserId: string;
    try {
      authUserId = await this.dependencies.authAdmin.createOrRecoverUser({
        email: input.email,
        password: input.password,
        displayName: input.displayName,
        idempotencyKey: input.idempotencyKey,
      });
    } catch (error) {
      throw new SuperadminUserCommandError(
        error instanceof Error && "code" in error
          ? String((error as { code?: unknown }).code)
          : "auth_unavailable",
        error,
      );
    }
    return this.dependencies.users.createPlayer({
      idempotencyKey: input.idempotencyKey,
      authUserId,
      displayName: input.displayName,
      reason: input.reason,
    });
  }

  async addRoomMember(input: AddSuperadminRoomMemberInput) {
    await this.prepare("superadmin-room-member-add");
    return this.dependencies.users.addRoomMember(input);
  }

  async adjustAttempt(input: SuperadminAdjustResultInput): Promise<SuperadminAdministrativeResult> {
    const access = await this.prepare("superadmin");
    return this.runAttemptCommand(() =>
      this.dependencies.attemptCommandsFor(access.authUserId).adjust(input),
    );
  }

  async invalidateAttempt(
    input: SuperadminAttemptCommandInput,
  ): Promise<SuperadminAdministrativeResult> {
    const access = await this.prepare("superadmin");
    return this.runAttemptCommand(() =>
      this.dependencies.attemptCommandsFor(access.authUserId).invalidate(input),
    );
  }

  private async runAttemptCommand(
    operation: () => Promise<SuperadminAdministrativeResult>,
  ): Promise<SuperadminAdministrativeResult> {
    try {
      return await operation();
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : null;
      if (
        error instanceof Error &&
        error.name === "AttemptCommandError" &&
        typeof code === "string"
      ) {
        throw new SuperadminAttemptCommandError(code, error);
      }
      throw error;
    }
  }
}

export type CalendarTickApplication = {
  runCalendarTick(): ReturnType<CalendarTickRunner["runCalendarTick"]>;
};

export function createCalendarTickApplication(runner: CalendarTickRunner): CalendarTickApplication {
  return { runCalendarTick: () => runner.runCalendarTick() };
}
