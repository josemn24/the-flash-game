import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { dockerSql } from "../../scripts/support/supabase-local.mjs";
import { betaVipTimeTrialQuestions } from "../../scripts/fixtures/scenarios/betavip-time-trial.mjs";
import { betaVipConnectPairsQuestions } from "../../scripts/fixtures/scenarios/betavip-connect-pairs.mjs";
import { TABARNIA_QUEENS_TIME_TRIAL } from "../../scripts/fixtures/scenarios/tabarnia-time-trial-queens.mjs";
import { TABARNIA_CONNECT_PAIRS_TIME_TRIAL } from "../../scripts/fixtures/scenarios/tabarnia-time-trial-connect-pairs.mjs";

type Question = {
  publicPayload: { grid: { rows: number }; prefilledQueens?: number[] };
  solutionPayload: { solution?: number[]; paths?: Record<string, number[] | undefined> };
};
type Fixture = {
  users: Record<string, { email: string; password: string; playerId: string }>;
  data: {
    room: { slug: string };
    seasonId: string;
    publications: Array<{ id: string; title: string }>;
  };
};

export async function captureRoomTimeTrialIntro(page: Page, name: string) {
  await expect
    .poll(() =>
      page.getByRole("grid").evaluate((element) => {
        let opacity = 1;
        for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
          opacity *= Number(getComputedStyle(ancestor).opacity);
        }
        return opacity;
      }),
    )
    .toBe(1);
  await mkdir("output/playwright", { recursive: true });
  await page.screenshot({
    path: `output/playwright/${name}-intro.png`,
    fullPage: true,
    animations: "disabled",
  });
}

export function roomTimeTrialTests(
  room: "betavip" | "tabarnia",
  devices: Array<"desktop" | "mobile">,
  formats = ["queens", "connect-pairs"],
) {
  const sequences: Array<{ format: string; title: string; questions: Question[] }> =
    room === "betavip"
      ? [
          { format: "queens", title: "Escalera de coronas", questions: betaVipTimeTrialQuestions },
          {
            format: "connect-pairs",
            title: "Circuito de parejas",
            questions: betaVipConnectPairsQuestions,
          },
        ]
      : [
          { format: "queens", title: "Queens", questions: TABARNIA_QUEENS_TIME_TRIAL.questions },
          {
            format: "connect-pairs",
            title: "Flow Free",
            questions: TABARNIA_CONNECT_PAIRS_TIME_TRIAL.questions,
          },
        ];

  for (const sequence of sequences.filter((sequence) => formats.includes(sequence.format))) {
    for (const device of devices) {
      test.describe(`${room} Contrarreloj ${device}`, () => {
        test.use({
          viewport:
            device === "mobile" ? { width: 390, height: 844 } : { width: 1280, height: 900 },
          hasTouch: device === "mobile",
        });
        test(`${sequence.title}: siete pruebas, puntuación acumulada y un único reloj`, async ({
          page,
        }) => {
          test.setTimeout(150_000);
          const fixture = JSON.parse(
            await readFile(`output/fixtures/${room}.json`, "utf8"),
          ) as Fixture;
          const account = fixture.users[device === "mobile" ? "dark" : "ches"];
          const publication = fixture.data.publications.find((p) => p.title === sequence.title)!;
          await dockerSql(`begin;
            do $$ begin
              if not exists (
                select 1 from public.scheduled_challenges sc join public.seasons s on s.id = sc.season_id
                where sc.id = '${publication.id}' and private.publication_is_effectively_open(
                  sc.status, s.status, s.starts_at, s.ends_at, sc.opens_at, sc.closes_at, clock_timestamp())) then
                update public.scheduled_challenges set status = 'cancelled', cancelled_at = clock_timestamp()
                  where season_id = '${fixture.data.seasonId}' and id <> '${publication.id}' and status = 'open';
                update public.scheduled_challenges set opens_at = clock_timestamp() + interval '200 milliseconds',
                  closes_at = clock_timestamp() + interval '1 hour' where id = '${publication.id}';
                perform pg_sleep(0.3);
              end if;
            end $$;
            set local role service_role;
            select private.run_calendar_tick_command('{"runId":"${room}-${sequence.format}-${device}"}'::jsonb);
            commit;`);
          const preparations: Array<{ deadlineAt: string }> = [];
          page.on("response", async (response) => {
            if (response.url().endsWith("/prepare") && response.ok())
              preparations.push(await response.json());
          });
          await page.goto("/");
          await page.getByLabel("Correo electrónico").fill(account.email);
          await page.getByLabel("Contraseña").fill(account.password);
          await page.getByRole("button", { name: "Iniciar sesión" }).click();
          await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
          await page.goto(`/desafios/${publication.id}?roomId=${fixture.data.room.slug}`);
          await expect(
            page.getByRole("heading", { name: sequence.title, exact: true }),
          ).toBeVisible();
          await expect(page.getByText("2 min 30 s", { exact: true })).toBeVisible();
          await page.getByRole("button", { name: "Empezar desafío" }).click();

          for (const [index, question] of sequence.questions.entries()) {
            await expect(page.getByText(`Prueba ${index + 1} de 7`, { exact: true })).toBeVisible({
              timeout: 15_000,
            });
            if (index === 0) {
              await expect(page.getByRole("grid")).toBeVisible();
              expect(
                await page.evaluate(
                  () => document.documentElement.scrollWidth <= window.innerWidth,
                ),
              ).toBe(true);
              await captureRoomTimeTrialIntro(page, `${room}-${sequence.format}-${device}`);
            }
            const size = question.publicPayload.grid.rows;
            const cell = (position: number) =>
              page.getByRole(sequence.format === "queens" ? "gridcell" : "button", {
                name: new RegExp(
                  `^Fila ${Math.floor(position / size) + 1}, columna ${(position % size) + 1}(?:[:,]|$)`,
                ),
              });
            const activate = async (position: number) => {
              if (device === "mobile") await cell(position).tap();
              else await cell(position).click();
            };
            if (sequence.format === "queens") {
              for (const position of question.solutionPayload.solution!) {
                if (question.publicPayload.prefilledQueens!.includes(position)) continue;
                await activate(position);
                await expect(cell(position)).toHaveAccessibleName(/marcada con X/);
                await activate(position);
              }
            } else {
              for (const path of Object.values(question.solutionPayload.paths!)) {
                if (!path) throw new Error("Missing editorial route");
                for (const position of path) await activate(position);
              }
            }
            // Wait for evaluation before reading persisted points; the last solve closes immediately.
            if (index < 6)
              await expect(page.getByText(`Prueba ${index + 2} de 7`, { exact: true })).toBeVisible(
                { timeout: 15_000 },
              );
            else
              await expect(
                page.getByRole("heading", { name: "Todas las pruebas resueltas" }),
              ).toBeVisible({ timeout: 15_000 });
            const { stdout } =
              await dockerSql(`select coalesce(sum(aa.points),0) from private.attempt_answers aa
              join public.attempts a on a.id = aa.attempt_id where a.scheduled_challenge_id = '${publication.id}'
              and a.player_id = '${account.playerId}' and a.kind = 'competitive';`);
            expect(Number(stdout.trim())).toBe([12, 25, 38, 52, 67, 83, 100][index]);
          }
          await expect(page.getByText("7/7", { exact: true })).toBeVisible();
          await expect(page.getByLabel("100 de 100 puntos")).toBeVisible();
          expect(preparations).toHaveLength(7);
          expect(preparations[0].deadlineAt).toEqual(expect.any(String));
          expect(new Set(preparations.map((p) => p.deadlineAt)).size).toBe(1);
          expect(JSON.stringify(preparations)).not.toMatch(/solutionPayload|"solution"/);
          await page.reload();
          await expect(page.getByText("7/7", { exact: true })).toBeVisible();
          const { stdout } = await dockerSql(`select count(*) from private.flash_point_entries
            where player_id = '${account.playerId}' and scheduled_challenge_id = '${publication.id}' and amount = 100;`);
          expect(Number(stdout.trim())).toBe(1);
        });
      });
    }
  }
}
