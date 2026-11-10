import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { dockerSql, sqlString } from "../scripts/support/supabase-local.mjs";

type Account = { email: string; password: string; playerId: string };

type Fixture = {
  users: Record<"alice" | "dave", Account>;
  data: {
    room: { id: string; slug: string };
    seasonId: string;
    publicationId: string;
    attemptId: string;
    lastBoardId: string;
  };
};

function claims(account: Account) {
  return `do $$ begin
    perform set_config('request.jwt.claims', (select jsonb_build_object(
      'sub', auth_user_id, 'role', 'authenticated', 'is_anonymous', false)::text
      from public.players where id = ${sqlString(account.playerId)}), true);
  end $$;`;
}

async function queryJson(sql: string) {
  return JSON.parse((await dockerSql(sql)).stdout.trim());
}

test("superadmin previews and recognizes Kike's last Queens board with an audited season point", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const { users, data } = JSON.parse(
    await readFile("output/fixtures/time-trial-checkpoint-admin.json", "utf8"),
  ) as Fixture;
  const { room, seasonId, publicationId, attemptId, lastBoardId } = data;
  const attempt = sqlString(attemptId);
  const board = sqlString(lastBoardId);
  const player = sqlString(users.alice.playerId);
  const publication = sqlString(publicationId);
  const season = sqlString(seasonId);
  const reason = "El último borrador válido quedó guardado antes del vencimiento.";
  const readResult = () =>
    queryJson(`
    begin;
    ${claims(users.alice)}
    select jsonb_build_object(
      'rank', (select jsonb_agg(jsonb_build_array(display_name, flash_points, solved_count, last_correct_elapsed_ms)
        order by position) from public.get_challenge_ranking(${publication})),
      'history', (select jsonb_agg(jsonb_build_array(display_name, flash_points, duration_ms) order by position)
        from public.get_room_history(${sqlString(room.slug)}, ${publication})),
      'seasonPoints', (select flash_points from public.get_season_ranking(${season}) where player_id = ${player}),
      'result', (select jsonb_build_object('status', answer_status, 'points', points, 'score', attempt_score, 'timeTrial', time_trial)
        from public.get_my_time_trial_result(${attempt}) where item_position = 7),
      'saved', (private.read_completed_attempt(${attempt})->'result') - 'answers'::text
    );
    rollback;
  `);
  const before = await readResult();
  expect(before).toMatchObject({
    seasonPoints: 99,
    result: {
      status: "partial",
      points: 16,
      score: 99,
      timeTrial: { solvedCount: 6, lastCorrectElapsedMs: 100_724 },
    },
  });
  const selection = {
    roomId: room.id,
    scheduledChallengeId: publicationId,
    attemptId,
    challengeItemId: lastBoardId,
    lockVersion: 77,
  };
  await expect(
    dockerSql(`
      begin;
      ${claims(users.alice)}
      set local role service_role;
      select private.preview_timeout_checkpoint(${sqlString(JSON.stringify(selection))});
      rollback;
    `),
  ).rejects.toThrow("not_authorized");

  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(users.dave.email);
  await page.getByLabel("Contraseña").fill(users.dave.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
  await page.goto(`/admin/rooms/${room.id}/attempts/${publicationId}/${attemptId}`);
  await expect(page.getByRole("heading", { name: "Kike", exact: true })).toBeVisible();
  const action = page.getByRole("region", { name: "Reconocer tablero resuelto al vencer" });
  await expect(action.getByRole("button", { name: "Confirmar reconocimiento" })).toHaveCount(0);
  await action.getByRole("button", { name: "Ver vista previa" }).click();
  await expect(action.getByText("16/17 → 17/17", { exact: true })).toBeVisible();
  await expect(action.getByText("99/100 → 100/100", { exact: true })).toBeVisible();
  await expect(action.getByText("6/7 → 7/7", { exact: true })).toBeVisible();
  await expect(action.getByText("1:40,724 → 2:30,000", { exact: true })).toBeVisible();
  await expect(action.getByText("+1", { exact: true })).toBeVisible();
  expect((await readResult()).seasonPoints).toBe(99);

  await action.getByLabel("Motivo del reconocimiento").fill(reason);
  await action.getByRole("button", { name: "Confirmar reconocimiento" }).click();
  await expect(page).toHaveURL(/\?updated=1$/);
  await expect(
    page.getByText("Efectivos 17/17 puntos · original 16/17", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Motivo tras la corrección: all_solved", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("recognize_timeout_checkpoint", { exact: true })).toBeVisible();
  await expect(action).toHaveCount(0);

  const after = await readResult();
  expect(after.rank).toEqual([
    ["Diego", 100, 7, 99_083],
    ["Palmera", 100, 7, 112_982],
    ["Jhon3D", 100, 7, 124_648],
    ["Kike", 100, 7, 150_000],
  ]);
  expect(after.history).toEqual(
    after.rank.map(([name, points, , time]: [string, number, number, number]) => [
      name,
      points,
      time,
    ]),
  );
  expect(after).toMatchObject({
    seasonPoints: 100,
    result: {
      status: "correct",
      points: 17,
      score: 100,
      timeTrial: { solvedCount: 7, endReason: "all_solved", lastCorrectElapsedMs: 150_000 },
    },
    saved: { score: 100, terminalReason: "all_solved", timeTrial: { solvedCount: 7 } },
  });

  const command = await queryJson(`
    select jsonb_build_object('input', input, 'result', result) from private.command_requests
    where operation = 'recognize_timeout_checkpoint' and input->>'attemptId' = ${attempt};
  `);
  const recognize = (input: object) =>
    queryJson(`
    begin;
    ${claims(users.dave)}
    set local role service_role;
    select private.recognize_timeout_checkpoint(${sqlString(JSON.stringify(input))});
    commit;
  `);
  expect(await recognize(command.input)).toEqual(command.result);
  await expect(
    recognize({ ...command.input, idempotencyKey: "stale-checkpoint-e2e" }),
  ).rejects.toThrow("stale_version");
  await expect(
    recognize({ ...command.input, lockVersion: 78, idempotencyKey: "second-checkpoint-e2e" }),
  ).rejects.toThrow("timeout_checkpoint_unavailable");

  expect(
    await queryJson(`
    select jsonb_build_object(
      'originalScore', a.score, 'originalReason', a.terminal_reason,
      'originalBoard', answer.status, 'originalPoints', answer.points,
      'receiptTimedOut', receipt.timed_out, 'receiptAnswer', receipt.answer,
      'ledger', (select jsonb_agg(jsonb_build_array(entry_type, amount) order by created_at)
        from private.flash_point_entries where attempt_id = a.id),
      'audit', (select jsonb_agg(jsonb_build_object('actor', actor_player_id, 'reason', reason,
        'before', before_payload->'currentEffectiveScore', 'after', after_payload->'effectiveScore'))
        from private.audit_log where entity_id = a.id and action = 'recognize_timeout_checkpoint')
    )
    from public.attempts a join private.attempt_answers answer on answer.attempt_id = a.id
    join private.answer_receipts receipt on receipt.id = answer.receipt_id
    where a.id = ${attempt} and answer.challenge_item_id = ${board};
  `),
  ).toEqual({
    originalScore: 99,
    originalReason: "time_limit",
    originalBoard: "partial",
    originalPoints: 16,
    receiptTimedOut: true,
    receiptAnswer: null,
    ledger: [
      ["accreditation", 99],
      ["answer_regrade", 1],
    ],
    audit: [{ actor: users.dave.playerId, reason, before: 99, after: 100 }],
  });
});
