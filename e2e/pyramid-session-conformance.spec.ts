import { sessionValidationContext } from "@/features/game/session/sessionResult";
import { test, expect, type BrowserContext, type APIRequestContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { CompetitiveSessionEngine } from "@/features/game/competitive/core/sessionEngine";
import type { GameSessionProvider, SessionClock } from "@/application/ports/game-session";
import type { GameSessionOperation } from "@/types/contracts/game-session";
import type { GameSessionResult } from "@/types/gameplay/authoritative-session";
import { createRemoteGameSessionProvider } from "@/features/game/session/providers/remote";
import { createLocalPyramidSessionProvider } from "@/features/game/session/providers/localPyramid";
import {
  sessionCases,
  definitionFor,
  correctActions,
  adverseActions,
  exhaustedHashtagActions,
  resolvedFor,
  testDictionaries,
  type SessionCase,
} from "@/test-utils/game-session-conformance/corpus";
import {
  SessionDriver,
  manualClock,
  confirmed,
  loseConfirmation,
} from "@/test-utils/game-session-conformance/driver";

type CaseIds = {
  publicationId: string;
  roomSlug: string;
  timeLimitMs?: number;
  seasonId: string;
  challengeVersionId: string;
  itemIds: string[];
  questionIds: string[];
};
type Fixture = {
  users: Record<string, { email: string; password: string }>;
  data: { cases: Record<string, CaseIds> };
};
const fixture = () =>
  JSON.parse(readFileSync("output/fixtures/pyramid-session-conformance.json", "utf8")) as Fixture;
const contexts = new Map<string, BrowserContext>();
const origin = process.env.APP_ORIGIN ?? "http://127.0.0.1:3300";

function sql(source: string): string {
  const container = process.env.SUPABASE_DB_CONTAINER;
  if (!container?.startsWith("supabase_db_flash-competitive-e2e-"))
    throw new Error("Conformance SQL requires the disposable E2E database");
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-At",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: source, encoding: "utf8" },
  ).trim();
}
/** The real transport and remote provider run unchanged, using the browser's authenticated cookie jar. */
function remoteProvider(
  api: APIRequestContext,
  challenge: import("@/types/gameplay/challenge").CompetitiveChallenge,
): GameSessionProvider {
  const remote = createRemoteGameSessionProvider({ context: sessionValidationContext(challenge) });
  return {
    async execute(command, options) {
      const original = globalThis.fetch;
      globalThis.fetch = async (url, init) => {
        const response = await api.fetch(new URL(String(url), origin).href, {
          method: init?.method,
          headers: { ...(init?.headers as Record<string, string>), origin },
          data: init?.body as string,
        });
        return new Response(await response.text(), {
          status: response.status(),
          // Playwright already applies Set-Cookie to its jar. Its joined multi-cookie
          // header contains newlines, which native Response correctly refuses.
          headers: response
            .headersArray()
            .filter((header) => header.name.toLowerCase() !== "set-cookie")
            .map(({ name, value }): [string, string] => [name, value]),
        });
      };
      try {
        return await remote.execute(command, options);
      } finally {
        globalThis.fetch = original;
      }
    },
  };
}
function normalized(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalized);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, v]) =>
          v !== undefined && !["sessionId", "revision", "authorizationLost"].includes(key),
      )
      .map(([key, v]) => {
        if (["presentedAt", "deadlineAt"].includes(key) && typeof v === "string")
          return [key, Date.parse(v)];
        if (key === "src" && typeof v === "string") {
          const id = decodeURIComponent(v).match(/[0-9a-f]{8}-[0-9a-f-]{27,}/i)?.[0];
          if (id) return [key, `asset:${id}`];
        }
        return [key, normalized(v)];
      }),
  );
}
function compare(local: GameSessionResult, remote: GameSessionResult) {
  // Optional local diagnostics may be richer; every observable remote field must match.
  expect(normalized(local)).toMatchObject(normalized(remote) as Record<string, unknown>);
  if (remote.kind === "accepted" && remote.effect !== "completed")
    expect(local).not.toHaveProperty("review");
}

class Pair {
  readonly clock = manualClock();
  readonly local: SessionDriver;
  readonly remote: SessionDriver;
  anchor = 0;
  constructor(
    readonly example: SessionCase,
    readonly ids: CaseIds,
    api: APIRequestContext,
    readonly timeoutCredit?: "queens" | "word-search",
  ) {
    const definition = this.definition;
    this.local = new SessionDriver(
      createLocalPyramidSessionProvider({
        definition,
        clock: this.clock,
        dictionaries: testDictionaries,
      }),
      ids.publicationId,
      ids.itemIds,
    );
    this.remote = new SessionDriver(
      remoteProvider(api, definition.challenge),
      ids.publicationId,
      ids.itemIds,
    );
  }
  get definition() {
    const definition = definitionFor(this.example, {
      challengeId: this.ids.publicationId,
      itemIds: this.ids.itemIds,
      questionIds: this.ids.questionIds,
      duration: this.ids.timeLimitMs,
    });
    if (!this.timeoutCredit) return definition;
    return {
      ...definition,
      challenge: {
        ...definition.challenge,
        [this.timeoutCredit === "queens"
          ? "queensTimeoutPartialCredit"
          : "wordSearchTimeoutPartialCredit"]: true,
      },
    };
  }
  async issue(operation: GameSessionOperation, data: object = {}, index = 0) {
    const remoteCommand = this.remote.command(operation, data, index);
    const localCommand = this.local.command(operation, data, index);
    const r = await this.remote.execute(remoteCommand);
    this.syncTime(r, operation, index);
    const l = await this.local.execute(localCommand);
    compare(l, r);
    return { local: l, remote: r, localCommand, remoteCommand };
  }
  syncTime(r: GameSessionResult, operation: GameSessionOperation, index: number) {
    if (r.kind === "accepted") {
      if (operation === "activate") {
        this.anchor = Date.parse(r.state.presentedAt!);
        this.clock.set(this.anchor);
      } else if (operation !== "start" && operation !== "prepareSession" && this.anchor) {
        const last = r.state.answers?.at(-1);
        let elapsed = r.state.timeUsedMs ?? (last ? Math.round(last.timeUsed * 1000) : undefined);
        if (elapsed === undefined && !["complete", "prepare", "abandon"].includes(operation)) {
          const tables: Partial<Record<GameSessionOperation, string>> = {
            queensValidation: "queens_validation_events",
            miniWordleGuess: "mini_wordle_guess_events",
            logicCodeAttempt: "logic_code_attempt_events",
            wordSearchSelection: "word_search_selection_events",
          };
          if (tables[operation])
            elapsed = Number(
              sql(
                `select time_used_ms from private.${tables[operation]} where attempt_id='${this.remote.sessionId}' and challenge_item_id='${this.ids.itemIds[index]}' order by sequence desc limit 1;`,
              ),
            );
          if (operation === "progressiveClueReveal")
            elapsed = Number(
              sql(
                `select floor(extract(epoch from (e.revealed_at-u.started_at))*1000) from private.progressive_clue_reveal_events e join private.attempt_timing_units u using(attempt_id,challenge_item_id) where e.attempt_id='${this.remote.sessionId}' order by e.clue_index desc limit 1;`,
              ),
            );
        }
        if (elapsed !== undefined) this.clock.set(this.anchor + elapsed);
      }
    }
  }
  async begin() {
    await this.issue("prepareSession");
    await this.issue("start");
  }
  async open(index = 0) {
    await this.issue("prepare", {}, index);
    await this.issue("activate", {}, index);
  }
  fastForwardDeadline() {
    // Move only fixture timing facts in this guarded disposable DB. SET LOCAL
    // bypasses their append-only guard for this transaction and restores it on commit.
    sql(
      `begin; set local session_replication_role = replica; with instant as materialized (select clock_timestamp() as now), shifted as (update private.attempt_timing_units set started_at=instant.now-(deadline_at-started_at)-interval '100 milliseconds', deadline_at=instant.now-interval '100 milliseconds' from instant where attempt_id='${this.remote.sessionId}' returning *), intervals as (update private.interaction_intervals i set started_at=u.started_at from shifted u where i.timing_unit_id=u.id and i.ended_at is null returning i.id) update public.attempts a set started_at=least(a.started_at,u.started_at) from shifted u where a.id=u.attempt_id; commit;`,
    );
  }
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120000);
  for (const label of ["alice", "bob", "carol", "dave", "erin", "frank", "grace"]) {
    const context = await browser.newContext();
    contexts.set(label, context);
    const page = await context.newPage();
    const account = fixture().users[label]!;
    await page.goto(origin);
    await page.getByLabel("Correo electrónico").fill(account.email);
    await page.getByLabel("Contraseña").fill(account.password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
    await page.close();
  }
});
test.afterAll(async () => {
  for (const context of contexts.values()) await context.close();
});

for (const example of sessionCases) {
  test(`${example.id}: solution, intermediate events, summit and terminal review conform`, async () => {
    test.setTimeout(120000);
    const pair = new Pair(
      example,
      fixture().data.cases[example.id]!,
      contexts.get("alice")!.request,
    );
    await pair.begin();
    for (let index = 0; index < 7; index++) {
      await pair.open(index);
      for (const action of correctActions(resolvedFor(pair.definition, index))) {
        const result = await pair.issue(action.operation, action.input, index);
        expect(result.remote.kind).toBe("accepted");
      }
    }
    const final = await pair.issue("complete");
    expect(confirmed(final.local).state.score).toBe(confirmed(final.remote).state.score);
    expect(confirmed(final.local).state.answers).toHaveLength(7);
    await pair.issue("recover");
  });
  test(`${example.id}: active recovery conforms without revealing future levels`, async () => {
    const pair = new Pair(example, fixture().data.cases[example.id]!, contexts.get("bob")!.request);
    await pair.begin();
    await pair.open();
    const result = await pair.issue("recover");
    expect(confirmed(result.local).state.score).toBe(0);
    expect(confirmed(result.local).effect).toBe("completed");
    if (result.local.kind === "accepted" && result.local.effect === "completed")
      expect(result.local.review).toHaveLength(1);
  });
  test(`${example.id}: authoritative deadline, exact duration and points conform`, async () => {
    const pair = new Pair(
      example,
      fixture().data.cases[example.id]!,
      contexts.get("carol")!.request,
    );
    await pair.begin();
    await pair.open();
    pair.fastForwardDeadline();
    const result = await pair.issue("answer", { answer: null });
    expect(confirmed(result.local).state).toMatchObject({ timedOut: true, points: 0 });
    await pair.issue("complete");
  });
  test(`${example.id}: the existing engine has equivalent transitions with both real providers`, async () => {
    test.setTimeout(120000);
    const pair = new Pair(
      example,
      fixture().data.cases[example.id]!,
      contexts.get("frank")!.request,
    );
    function controlledClock() {
      let sequence = 0;
      const callbacks = new Map<ReturnType<typeof setTimeout>, () => void>();
      return {
        now: pair.clock.now,
        setTimeout(callback: () => void) {
          const id = ++sequence as unknown as ReturnType<typeof setTimeout>;
          callbacks.set(id, callback);
          return id;
        },
        clearTimeout(id: ReturnType<typeof setTimeout>) {
          callbacks.delete(id);
        },
        flush() {
          const pending = [...callbacks.values()];
          callbacks.clear();
          pending.forEach((callback) => callback());
        },
      } satisfies SessionClock & { flush(): void };
    }
    const remoteClock = controlledClock();
    const localClock = controlledClock();
    const synchronizedRemote: GameSessionProvider = {
      async execute(command, options) {
        const result = await pair.remote.provider.execute(command, options);
        if (result.kind === "accepted")
          pair.remote.sessionId = result.state.sessionId ?? pair.remote.sessionId;
        const index =
          "challengeItemId" in command.input
            ? pair.ids.itemIds.indexOf(command.input.challengeItemId)
            : 0;
        pair.syncTime(result, command.operation, index);
        return result;
      },
    };
    const initialSession = { status: "new" as const, results: [], score: 0 };
    const remoteEngine = new CompetitiveSessionEngine({
      challenge: pair.definition.challenge,
      initialSession,
      provider: synchronizedRemote,
      clock: remoteClock,
    });
    const localEngine = new CompetitiveSessionEngine({
      challenge: pair.definition.challenge,
      initialSession,
      provider: pair.local.provider,
      clock: localClock,
    });
    const snapshot = (engine: CompetitiveSessionEngine) => {
      const s = engine.getSnapshot();
      return normalized({
        phase: s.phase,
        questionIndex: s.questionIndex,
        results: s.results,
        score: s.score,
        question: s.question,
        lastResult: s.lastResult,
        locked: s.locked,
      });
    };
    const both = async (action: (engine: CompetitiveSessionEngine) => Promise<unknown>) => {
      await action(remoteEngine);
      await action(localEngine);
      expect(snapshot(localEngine)).toEqual(snapshot(remoteEngine));
    };
    const act = async (
      engine: CompetitiveSessionEngine,
      action: ReturnType<typeof correctActions>[number],
    ) => {
      switch (action.operation) {
        case "answer":
          return engine.interactions.submit(action.input.answer);
        case "queensValidation":
          return engine.interactions.validateQueensBoard(action.input.queens);
        case "miniWordleGuess":
          return engine.interactions.submitMiniWordleGuess(action.input.guess);
        case "logicCodeAttempt":
          return engine.interactions.submitLogicCodeAttempt(action.input.code);
        case "wordHashtagSwap":
          return engine.interactions.submitWordHashtagSwap(
            action.input.fromCell,
            action.input.toCell,
          );
        case "wordSearchSelection":
          return engine.interactions.submitWordSearchSelection(
            action.input.startCell,
            action.input.endCell,
          );
        default:
          throw new Error("unexpected action");
      }
    };
    try {
      await both((engine) => engine.lifecycle.begin());
      for (let index = 0; index < 7; index++) {
        await both((engine) => engine.startQuestions());
        await both((engine) => engine.lifecycle.activate());
        for (const action of correctActions(resolvedFor(pair.definition, index)))
          await both((engine) => act(engine, action));
        for (
          let turn = 0;
          turn < 3 &&
          remoteEngine.getSnapshot().phase !== "briefing" &&
          remoteEngine.getSnapshot().phase !== "results";
          turn++
        ) {
          remoteClock.flush();
          await expect.poll(() => remoteEngine.getSnapshot().busy).toBe(false);
          localClock.flush();
          await expect.poll(() => localEngine.getSnapshot().busy).toBe(false);
        }
        expect(snapshot(localEngine)).toEqual(snapshot(remoteEngine));
      }
      expect(localEngine.getSnapshot().phase).toBe("results");
    } finally {
      localEngine.dispose();
      remoteEngine.dispose();
    }
  });
  if (example.document.type !== "queens")
    test(`${example.id}: mistakes, partial work, invalid inputs and duplicate events conform`, async () => {
      const pair = new Pair(
        example,
        fixture().data.cases[example.id]!,
        contexts.get("dave")!.request,
      );
      await pair.begin();
      await pair.open();
      for (const action of adverseActions(resolvedFor(pair.definition)))
        await pair.issue(action.operation, action.input);
      const final = await pair.issue("complete");
      expect(confirmed(final.local).state.score).toBe(0);
    });
  test(`${example.id}: repeated preparation/activation, stale revision and abandonment conform`, async () => {
    const pair = new Pair(
      example,
      fixture().data.cases[example.id]!,
      contexts.get("erin")!.request,
    );
    await pair.begin();
    const premature = await pair.issue("complete");
    expect(premature.remote.kind).toBe("rejected");
    const first = await pair.issue("prepare");
    compare(
      await pair.local.execute(first.localCommand),
      await pair.remote.execute(first.remoteCommand),
    );
    const staleLocal = pair.local.command("prepare", { revision: 1 });
    const staleRemote = pair.remote.command("prepare", { revision: 1 });
    compare(await pair.local.execute(staleLocal), await pair.remote.execute(staleRemote));
    const recovery = await pair.issue("recover");
    compare(
      await pair.local.execute(recovery.localCommand),
      await pair.remote.execute(recovery.remoteCommand),
    );
    await pair.open();
    const deadline = pair.clock.now();
    await pair.issue("activate");
    expect(pair.clock.now()).toBe(deadline);
    await pair.issue("abandon");
  });
}

test("Queens: intermediate failures, rejected boards, exact replay, conflict and exhaustion conform", async () => {
  const example = sessionCases.find((row) => row.document.type === "queens")!;
  const pair = new Pair(example, fixture().data.cases[example.id]!, contexts.get("dave")!.request);
  await pair.begin();
  await pair.issue("prepare");
  await pair.issue("recover");
  await pair.open();
  const q = resolvedFor(pair.definition);
  if (q.type !== "queens") throw new Error("fixture");
  await pair.issue("queensValidation", { queens: [] });
  const invalid = Array.from({ length: q.grid.rows }, (_, index) => index);
  await pair.issue("queensDraft", { queens: invalid });
  const first = await pair.issue("queensValidation", { queens: invalid });
  expect(confirmed(first.local).effect).toBe("progress");
  compare(
    await pair.local.execute(first.localCommand),
    await pair.remote.execute(first.remoteCommand),
  );
  const l = structuredClone(first.localCommand);
  const r = structuredClone(first.remoteCommand);
  if (l.operation !== "queensValidation" || r.operation !== "queensValidation")
    throw new Error("command");
  compare(
    await pair.local.execute({ ...l, input: { ...l.input, queens: q.solution } }),
    await pair.remote.execute({ ...r, input: { ...r.input, queens: q.solution } }),
  );
  await pair.issue("queensValidation", { queens: invalid });
  const third = await pair.issue("queensValidation", { queens: invalid });
  expect(confirmed(third.local).state).toMatchObject({
    status: "incorrect",
    points: 0,
    details: { failureReason: "attempts_exhausted" },
  });
  await pair.issue("complete");
});

test("a receipt survives evaluation interruption and is recovered exactly once with its original time and input", async () => {
  const example = sessionCases[0]!;
  const pair = new Pair(example, fixture().data.cases[example.id]!, contexts.get("grace")!.request);
  await pair.begin();
  await pair.open();
  const remoteCommand = pair.remote.command("answer", { answer: "A" });
  const localCommand = pair.local.command("answer", { answer: "A" });
  // Fault injection is confined to the disposable database, after the receipt's transaction commits.
  sql(
    `create function private.conformance_interrupt_evaluation() returns trigger language plpgsql set search_path = '' as $$ begin if new.attempt_id='${pair.remote.sessionId}' then raise exception 'conformance_evaluation_interrupted'; end if; return new; end; $$; create trigger conformance_interrupt_evaluation before insert on private.attempt_answers for each row execute function private.conformance_interrupt_evaluation();`,
  );
  try {
    const remoteResult = await pair.remote.execute(remoteCommand);
    expect(remoteResult.kind).toBe("uncertain");
    const elapsed = Number(
      sql(
        `select time_used_ms from private.answer_receipts where attempt_id='${pair.remote.sessionId}';`,
      ),
    );
    pair.clock.set(pair.anchor + elapsed);
    const abort = new AbortController();
    const pending = pair.local.execute(localCommand, abort.signal);
    await Promise.resolve();
    abort.abort();
    expect((await pending).kind).toBe("uncertain");
    expect(
      sql(
        `select count(*) from private.attempt_answers where attempt_id='${pair.remote.sessionId}';`,
      ),
    ).toBe("0");
  } finally {
    sql(
      "drop trigger conformance_interrupt_evaluation on private.attempt_answers; drop function private.conformance_interrupt_evaluation();",
    );
  }
  await pair.issue("start");
  await pair.issue("recover");
  const remoteResult = await pair.remote.execute(remoteCommand);
  const localResult = await pair.local.execute(localCommand);
  compare(localResult, remoteResult);
  expect(confirmed(localResult).state.status).toBe("correct");
  expect(
    sql(
      `select count(*) from private.answer_receipts where attempt_id='${pair.remote.sessionId}';`,
    ),
  ).toBe("1");
  expect(
    sql(
      `select count(*) from private.attempt_answers where attempt_id='${pair.remote.sessionId}';`,
    ),
  ).toBe("1");
  await pair.issue("start");
  await pair.open(1);
  const syncedRemote: GameSessionProvider = {
    async execute(command, options) {
      const result = await pair.remote.provider.execute(command, options);
      pair.syncTime(result, command.operation, 1);
      return result;
    },
  };
  const local = new SessionDriver(
    loseConfirmation(pair.local.provider, "answer"),
    pair.ids.publicationId,
    pair.ids.itemIds,
  );
  const remote = new SessionDriver(
    loseConfirmation(syncedRemote, "answer"),
    pair.ids.publicationId,
    pair.ids.itemIds,
  );
  Object.assign(local, { sessionId: pair.local.sessionId, revision: pair.local.revision });
  Object.assign(remote, { sessionId: pair.remote.sessionId, revision: pair.remote.revision });
  const l = local.command("answer", { answer: "A" }, 1);
  const r = remote.command("answer", { answer: "A" }, 1);
  expect((await remote.execute(r)).kind).toBe("uncertain");
  expect((await local.execute(l)).kind).toBe("uncertain");
  compare(await local.execute(l), await remote.execute(r));
  expect(
    sql(
      `select count(*) from private.answer_receipts where attempt_id='${pair.remote.sessionId}';`,
    ),
  ).toBe("2");
});

for (const failures of [1, 2])
  test(`Queens: fixed cells and success after ${failures} mistakes preserve exact weight penalties`, async () => {
    const example = sessionCases.find((row) => row.document.type === "queens")!;
    const pair = new Pair(
      example,
      fixture().data.cases[`queens-after-${failures}`]!,
      contexts.get("grace")!.request,
    );
    await pair.begin();
    await pair.open();
    const q = resolvedFor(pair.definition);
    if (q.type !== "queens") throw new Error("fixture");
    const empty = await pair.issue("queensDraft", { queens: [] });
    expect(confirmed(empty.local).state.queens).toEqual(q.prefilledQueens);
    const invalid = Array.from({ length: q.grid.rows }, (_, i) => i);
    for (let i = 0; i < failures; i++) await pair.issue("queensValidation", { queens: invalid });
    const incomplete = await pair.issue("queensValidation", {
      queens: q.solution.filter((cell) => !q.prefilledQueens?.includes(cell)),
    });
    expect(incomplete.remote.kind).toBe("rejected");
    const result = await pair.issue("queensValidation", { queens: q.solution });
    expect(confirmed(result.local).state).toMatchObject({
      status: "correct",
      points: 14 - failures,
    });
  });

for (const format of ["queens", "mini-wordle", "progressive-clues"])
  test(`${format}: recovery uses accepted intermediate progress with the server's format policy`, async () => {
    const example = sessionCases.find((row) => row.document.type === format)!;
    const pair = new Pair(
      example,
      fixture().data.cases[example.id]!,
      contexts.get("grace")!.request,
    );
    await pair.begin();
    await pair.open();
    const q = resolvedFor(pair.definition);
    if (q.type === "queens") await pair.issue("queensDraft", { queens: q.solution });
    else if (q.type === "mini-wordle")
      await pair.issue("miniWordleGuess", { guess: q.additionalGuesses![0]! });
    else if (q.type === "progressive-clues") await pair.issue("progressiveClueReveal");
    const result = await pair.issue("recover");
    expect(confirmed(result.local).state.answers).toHaveLength(1);
    expect(confirmed(result.local).state.answers![0]!.status).toBe(
      format === "queens" ? "correct" : "unanswered",
    );
  });

for (const format of ["mini-wordle", "progressive-clues", "logic-code", "word-search"])
  test(`${format}: accepted mistakes or revelations preserve exact winning consequences`, async () => {
    const example = sessionCases.find((row) => row.document.type === format)!;
    const variant = ["mini-wordle", "progressive-clues"].includes(format)
      ? `${format}-after-one`
      : example.id;
    const pair = new Pair(example, fixture().data.cases[variant]!, contexts.get("grace")!.request);
    await pair.begin();
    await pair.open();
    const q = resolvedFor(pair.definition);
    if (q.type === "mini-wordle") await pair.issue("miniWordleGuess", { guess: "CASAS" });
    else if (q.type === "progressive-clues") await pair.issue("progressiveClueReveal");
    else if (q.type === "logic-code") await pair.issue("logicCodeAttempt", { code: "1111" });
    else if (q.type === "word-search")
      await pair.issue("wordSearchSelection", { startCell: 0, endCell: 1 });
    let final: GameSessionResult | undefined;
    for (const action of correctActions(q))
      final = (await pair.issue(action.operation, action.input)).local;
    expect(confirmed(final!).state.status).toBe("correct");
    if (format === "word-search") {
      // Existing rules record wrong selections but do not deduct points for them.
      expect(confirmed(final!).state).toMatchObject({
        points: 14,
        details: { incorrectSelections: 1 },
      });
    } else expect(confirmed(final!).state.points).toBeLessThan(14);
  });
test("Word Hashtag: legal reversible moves exhaust the authoritative move budget", async () => {
  const example = sessionCases.find((row) => row.document.type === "word-hashtag")!;
  const pair = new Pair(example, fixture().data.cases[example.id]!, contexts.get("grace")!.request);
  await pair.begin();
  await pair.open();
  const q = resolvedFor(pair.definition);
  if (q.type !== "word-hashtag") throw new Error("fixture");
  let final: GameSessionResult | undefined;
  for (const action of exhaustedHashtagActions(q))
    final = (await pair.issue(action.operation, action.input)).local;
  expect(confirmed(final!).state).toMatchObject({ points: 0, movesRemaining: 0 });
  await pair.issue("complete");
});

for (const format of ["word-search", "queens"] as const) {
  test(`${format} opt-in timeout credit survives reload and reaches the ranking`, async () => {
    test.setTimeout(90_000);
    const example = sessionCases.find((row) => row.document.type === format)!;
    const ids = fixture().data.cases[`${format}-timeout-credit`]!;
    const context = contexts.get("alice")!;
    const pair = new Pair(example, ids, context.request, format);
    await pair.begin();
    await pair.open();
    const question = resolvedFor(pair.definition);
    const points = format === "queens" ? 8 : 7;
    if (question.type === "queens") {
      await pair.issue("queensDraft", { queens: question.solution.slice(0, 4) });
    } else {
      await pair.issue("wordSearchSelection", { startCell: 0, endCell: 3 });
    }
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(0, pair.anchor + ids.timeLimitMs! - Date.now() + 75)),
    );
    const scored = (await pair.issue("answer", { answer: null })).remote;
    expect(scored).toMatchObject({
      kind: "accepted",
      state: { status: "partial", points, details: { timeoutPartialCredit: true } },
    });
    expect((await pair.issue("prepare")).remote).toMatchObject({
      kind: "rejected",
      code: "pyramid_level_failed",
    });
    expect((await pair.issue("complete")).remote).toMatchObject({
      effect: "completed",
      state: { score: points },
    });

    const page = await context.newPage();
    try {
      const resultUrl = `${origin}/desafios/${ids.publicationId}?roomId=${ids.roomSlug}`;
      await page.goto(resultUrl);
      await expect(page.getByText(`+${points} puntos en Nivel 1`)).toBeVisible();
      await page.reload();
      await page.getByRole("button", { name: "Ver respuestas" }).click();
      await expect(page.getByText("0 de 7 superados")).toBeVisible();
      await expect(page.getByText("No alcanzado", { exact: true })).toHaveCount(6);
      await page.locator("details").first().locator("summary").click();
      if (format === "word-search") {
        await expect(
          page
            .getByRole("list", { name: "Resultado de las palabras objetivo" })
            .getByText("encontrada", { exact: true }),
        ).toHaveCount(1);
      } else {
        await expect(page.getByText("Acertaste 3 de 5 coronas por colocar.")).toBeVisible();
      }
      await page.goto(`${origin}/salas/${ids.roomSlug}/ranking`);
      const playerRow = page.getByRole("listitem").filter({
        has: page.getByRole("img", { name: "Conformidad alice", exact: true }),
      });
      await expect(playerRow.getByRole("img", { name: `${points} Flash Points` })).toBeVisible();
    } finally {
      await page.close();
    }
  });
}
