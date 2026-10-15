import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { createServer } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { deterministicUuid, sqlString } from "./support/supabase-local.mjs";
import fixtureScenario from "./fixtures/scenarios/s12.mjs";
import integrationScenario from "./integration/scenarios/s12.mjs";

// A disposable database and PostgREST process exercise the real HTTP transaction
// boundary without running a global tick against the application's local data.
const exec = promisify(execFile);
const dbContainer = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_the-flash-game";
const restContainer = process.env.SUPABASE_REST_CONTAINER ?? "supabase_rest_the-flash-game";
const runId = randomUUID().replaceAll("-", "");
const database = `flash_rpc_${runId}`;
const container = `flash_rpc_rest_${runId}`;
const jwtSecret = randomBytes(32).toString("hex");
let databaseCreated = false;
let restCreated = false;
let gateway;

async function docker(args, options) {
  return (await exec("docker", args, { maxBuffer: 10 * 1024 * 1024, ...options })).stdout;
}

function sql(source) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", [
      "exec",
      "-i",
      dbContainer,
      "psql",
      "-X",
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      database,
    ]);
    let out = "",
      err = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      out += chunk;
    });
    child.stderr.on("data", (chunk) => {
      err += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(err))));
    child.stdin.on("error", () => {});
    child.stdin.end(source);
  });
}

function token(role, sub) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ role, sub, is_anonymous: false, exp: Math.floor(Date.now() / 1000) + 600 }),
  ).toString("base64url");
  const body = `${header}.${payload}`;
  return `${body}.${createHmac("sha256", jwtSecret).update(body).digest("base64url")}`;
}

async function holdCalendarLock(seconds) {
  const marker = `rpc_lock_${randomUUID()}`;
  const operation = sql(`begin; set local application_name = ${sqlString(marker)};
    select pg_advisory_xact_lock(hashtextextended('calendar-tick-global', 0));
    select pg_sleep(${seconds}); commit;`);
  operation.catch(() => {});
  for (let tries = 0; tries < 100; tries++) {
    if (
      (await sql(
        `select exists(select 1 from pg_stat_activity where application_name = ${sqlString(marker)} and wait_event = 'PgSleep');`,
      )) === "t"
    ) {
      return { operation };
    }
    await delay(25);
  }
  await operation;
  throw new Error("The independent connection did not acquire the calendar lock");
}

try {
  const rest = JSON.parse(await docker(["inspect", restContainer]))[0];
  const network = Object.keys(rest.NetworkSettings.Networks)[0];
  const settings = Object.fromEntries(
    rest.Config.Env.map((entry) => {
      const separator = entry.indexOf("=");
      return [entry.slice(0, separator), entry.slice(separator + 1)];
    }),
  );
  const uri = new URL(settings.PGRST_DB_URI);
  uri.hostname = dbContainer;
  uri.pathname = `/${database}`;
  await docker(["exec", dbContainer, "createdb", "-U", "postgres", database]);
  databaseCreated = true;
  await sql(await readFile("supabase/tests/support/bootstrap.sql", "utf8"));
  const directory = process.argv.includes("--migrations")
    ? "supabase/migrations"
    : "supabase/schemas";
  const names = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  await sql(
    `begin; ${(await Promise.all(names.map((name) => readFile(`${directory}/${name}`, "utf8")))).join("\n")} commit;`,
  );

  // Credentials are inherited through named env entries, never printed or placed in arguments.
  await docker(
    [
      "run",
      "--detach",
      "--name",
      container,
      "--network",
      network,
      "--publish",
      "127.0.0.1::3000",
      "--env",
      "PGRST_DB_URI",
      "--env",
      "PGRST_JWT_SECRET",
      "--env",
      "PGRST_DB_SCHEMAS=public",
      "--env",
      "PGRST_DB_ANON_ROLE=anon",
      "--env",
      "PGRST_DB_POOL=4",
      "--env",
      "PGRST_SERVER_PORT=3000",
      rest.Config.Image,
    ],
    { env: { ...process.env, PGRST_DB_URI: uri.toString(), PGRST_JWT_SECRET: jwtSecret } },
  );
  restCreated = true;
  const port = JSON.parse(
    await docker(["inspect", "--format", "{{json .NetworkSettings.Ports}}", container]),
  )["3000/tcp"][0].HostPort;
  const upstream = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let tries = 0; tries < 100; tries++) {
    try {
      ready = (await fetch(upstream, { signal: AbortSignal.timeout(500) })).ok;
    } catch {
      ready = false;
    }
    if (ready) break;
    await delay(50);
  }
  assert.ok(ready, "Disposable PostgREST is ready");
  // Match the Supabase gateway's /rest/v1 prefix; PostgREST itself serves /rpc.
  gateway = createServer(async (request, response) => {
    try {
      const target = new URL(request.url.replace(/^\/rest\/v1/, ""), upstream);
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const result = await fetch(target, {
        method: request.method,
        headers: request.headers,
        body: chunks.length ? Buffer.concat(chunks) : undefined,
        signal: AbortSignal.timeout(20_000),
      });
      response.writeHead(result.status, {
        "content-type": result.headers.get("content-type") ?? "application/json",
      });
      response.end(await result.text());
    } catch {
      response.writeHead(502);
      response.end("Disposable HTTP gateway failed");
    }
  });
  await new Promise((resolve, reject) => {
    gateway.once("error", reject);
    gateway.listen(0, "127.0.0.1", resolve);
  });
  const url = `http://127.0.0.1:${gateway.address().port}`;
  const options = {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  };
  const config = { url, publishableKey: token("anon"), serviceRoleKey: token("service_role") };
  const stableId = (label) => deterministicUuid(`maintenance:${runId}`, label);
  const accounts = Object.fromEntries(
    fixtureScenario.users.map(({ label }) => [
      label,
      {
        playerId: stableId(`player-${label}`),
        authId: stableId(`auth-${label}`),
      },
    ]),
  );
  for (const [label, account] of Object.entries(accounts)) {
    await sql(`insert into auth.users(id) values (${sqlString(account.authId)});
      insert into public.players(id,auth_user_id,display_name) values (${sqlString(account.playerId)},${sqlString(account.authId)},${sqlString(label)});`);
  }
  await sql(
    fixtureScenario.buildDomainSql({
      accounts,
      sqlString,
      sqlUuid: (label) => sqlString(stableId(label)),
    }),
  );
  const fixture = { data: fixtureScenario.manifest({ accounts, stableId }) };
  const clients = Object.fromEntries(
    Object.entries(accounts).map(([label, account]) => [
      label,
      createClient(url, token("authenticated", account.authId), options),
    ]),
  );
  await integrationScenario.run({
    fixture,
    clients,
    config,
    assert: (condition, message) => assert.ok(condition, message),
  });
  console.log("S12 HTTP: service-only RPCs, opening, replay and protected reads passed.");

  const service = createClient(url, config.serviceRoleKey, options);
  const scheduleId = await sql(
    `select id from public.scheduled_challenges where season_id=${sqlString(fixture.data.seasonId)} and number=1;`,
  );
  const attemptId = stableId("stale-attempt");
  await sql(`insert into public.attempts(id,player_id,scheduled_challenge_id,challenge_version_id,kind,client_state_schema_version,last_activity_at)
    values (${sqlString(attemptId)},${sqlString(accounts.member.playerId)},${sqlString(scheduleId)},${sqlString(fixture.data.challengeVersionId)},'competitive',1,clock_timestamp()-interval '16 minutes');
    insert into private.attempt_sessions(attempt_id,session_token_hash) values (${sqlString(attemptId)},repeat('a',64));
    update public.scheduled_challenges set status='closed' where id=${sqlString(scheduleId)};`);
  const input = { runId: "http-expiration-test", roomSlug: fixture.data.roomSlug };
  const snapshot = () =>
    sql(`select jsonb_build_object(
    'attempt',(select to_jsonb(a) from public.attempts a where id=${sqlString(attemptId)}),
    'schedules',(select jsonb_agg(to_jsonb(s) order by id) from public.scheduled_challenges s where season_id=${sqlString(fixture.data.seasonId)}),
    'sessions',(select jsonb_agg(to_jsonb(s) order by id) from private.attempt_sessions s where attempt_id=${sqlString(attemptId)}),
    'audit',(select count(*) from private.audit_log where entity_id=${sqlString(attemptId)} or entity_id in (select id from public.scheduled_challenges where season_id=${sqlString(fixture.data.seasonId)})),
    'points',(select count(*) from private.flash_point_entries where attempt_id=${sqlString(attemptId)}));`);
  const before = await snapshot();
  const wrongRoom = await service.rpc("expire_stale_attempts", {
    input: { ...input, roomSlug: "other-room" },
  });
  assert.equal(wrongRoom.error, null);
  assert.equal(wrongRoom.data.abandonedAttempts, 0);
  assert.equal(await snapshot(), before, "Room filter leaves other attempts untouched");
  const lock = await holdCalendarLock(6.5);
  const started = performance.now();
  try {
    const timeout = await service.rpc("expire_stale_attempts", { input });
    assert.equal(timeout.error?.code, "57014");
    const elapsed = performance.now() - started;
    assert.ok(
      elapsed >= 4500 && elapsed < 6500,
      `Expiration SQL timeout: ${Math.round(elapsed)} ms`,
    );
    assert.equal(await snapshot(), before, "Lock timeout leaves no persisted changes");
  } finally {
    await lock.operation;
  }

  await sql(`create schema rpc_test;
    create function rpc_test.reject_audit() returns trigger language plpgsql as $$ begin
      if new.entity_id=${sqlString(attemptId)}::uuid then raise exception 'rpc_audit_failure'; end if;
      return new; end; $$;
    create trigger rpc_audit_failure before insert on private.audit_log for each row execute function rpc_test.reject_audit();`);
  try {
    const failed = await service.rpc("expire_stale_attempts", { input });
    assert.equal(failed.error?.message, "rpc_audit_failure");
    assert.equal(
      await snapshot(),
      before,
      "Expiration audit failure rolls back state and session revocation",
    );
    await sql(
      // Only the still-future publication may be reprogrammed; keep the terminal one intact.
      `update public.scheduled_challenges set status='open', opens_at=clock_timestamp()-interval '2 hours', closes_at=clock_timestamp()-interval '1 hour' where season_id=${sqlString(fixture.data.seasonId)} and number=2;`,
    );
    const beforeTick = await snapshot();
    const failedTick = await service.rpc("run_calendar_tick", {
      input: { runId: "http-tick-rollback" },
    });
    assert.equal(failedTick.error?.message, "rpc_audit_failure");
    assert.equal(
      await snapshot(),
      beforeTick,
      "Tick audit failure rolls back challenge closure, abandonment and audit",
    );
  } finally {
    await sql("drop trigger rpc_audit_failure on private.audit_log; drop schema rpc_test cascade;");
  }
  const longLock = await holdCalendarLock(9.5);
  const tickStarted = performance.now();
  try {
    const tick = await service.rpc("run_calendar_tick", {
      input: { runId: "http-tick-no-timeout" },
    });
    assert.equal(tick.error, null);
    assert.ok(
      performance.now() - tickStarted > 8000,
      "Tick outlives the inherited eight-second timeout",
    );
    assert.equal(tick.data.closed, 1);
    assert.equal(tick.data.abandonedAttempts, 1);
  } finally {
    await longLock.operation;
  }
  assert.equal(
    await sql(
      `select status || '|' || coalesce(score::text,'null') from public.attempts where id=${sqlString(attemptId)};`,
    ),
    "abandoned|null",
  );
  assert.equal(
    await sql(
      `select count(*) from private.attempt_sessions where attempt_id=${sqlString(attemptId)} and revoked_at is not null;`,
    ),
    "1",
  );
  assert.equal(
    await sql(
      `select count(*) from private.audit_log where entity_id=${sqlString(attemptId)} and action='expire_stale_attempt';`,
    ),
    "1",
  );
  assert.equal(
    await sql(
      `select count(*) from private.flash_point_entries where attempt_id=${sqlString(attemptId)};`,
    ),
    "0",
  );
  const repeated = await service.rpc("expire_stale_attempts", { input });
  assert.equal(repeated.error, null);
  assert.equal(repeated.data.abandonedAttempts, 0);
  console.log(
    "HTTP expiration: room filter, five-second lock timeout, both audit rollbacks, unlimited tick, revocation and replay passed.",
  );
} finally {
  if (gateway) {
    gateway.closeAllConnections();
    await new Promise((resolve) => gateway.close(resolve));
  }
  if (restCreated) await docker(["rm", "--force", container]);
  if (databaseCreated)
    await docker(["exec", dbContainer, "dropdb", "-U", "postgres", "--force", database]);
}
