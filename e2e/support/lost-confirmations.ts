import { expect, type Page } from "@playwright/test";
import { dockerSql } from "../../scripts/support/supabase-local.mjs";

/** Discard a real committed response, rather than failing before the request reaches PostgreSQL. */
export async function loseGameplayConfirmations(page: Page) {
  const bodies = new Map<string, Record<string, unknown>[]>();
  let attemptId: string | undefined;
  await page.route("**/api/competitive/attempts/**", async (route) => {
    const operation = new URL(route.request().url()).pathname.split("/").at(-1)!;
    if (operation === "recover") {
      // Recovery can finalize an eliminated Survival attempt. Lose that terminal
      // confirmation too, then exercise the cookie-independent result fallback.
      const response = await route.fetch();
      const result = await response.json();
      if (response.ok() && result.phase === "results") {
        const requests = bodies.get("complete") ?? [];
        requests.push(route.request().postDataJSON());
        bodies.set("complete", requests);
        if (requests.length === 1) return route.abort("failed");
      }
      return route.fulfill({ response });
    }
    if (!["start", "answer", "complete"].includes(operation)) return route.continue();
    const requests = bodies.get(operation) ?? [];
    requests.push(route.request().postDataJSON());
    bodies.set(operation, requests);
    if (requests.length !== 1) return route.continue();
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    if (operation === "start") attemptId = (await response.json()).attemptId;
    await route.abort("failed");
  });
  return async () => {
    for (const operation of ["start", "answer", "complete"]) {
      const requests = bodies.get(operation)!;
      expect(
        requests,
        `${operation} actually retried after a committed response was discarded`,
      ).toBeDefined();
      expect(requests.length).toBeGreaterThanOrEqual(2);
      expect(requests[1]).toEqual(requests[0]);
    }
    expect(attemptId).toMatch(/^[a-f0-9-]{36}$/);
    const { stdout } = await dockerSql(`select jsonb_build_object(
      'status', a.status, 'score', a.score,
      'attempts', (select count(*) from public.attempts other where other.player_id=a.player_id and other.scheduled_challenge_id=a.scheduled_challenge_id),
      'receipts', (select count(*) from private.answer_receipts where attempt_id=a.id),
      'evaluations', (select count(*) from private.attempt_answers where attempt_id=a.id),
      'accreditations', (select count(*) from private.flash_point_entries where attempt_id=a.id and entry_type='accreditation'),
      'points', (select sum(amount) from private.flash_point_entries where attempt_id=a.id)
    ) from public.attempts a where a.id='${attemptId}'::uuid;`);
    const saved = JSON.parse(stdout.trim());
    expect(saved.status).toBe("completed");
    expect(saved.attempts).toBe(1);
    expect(saved.accreditations).toBe(1);
    expect(saved.evaluations).toBe(saved.receipts);
    expect(saved.points).toBe(saved.score);
  };
}
