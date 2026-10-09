import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { dockerSql, sqlString } from "../scripts/support/supabase-local.mjs";

type Account = { email: string; password: string };
async function signIn(page: Page) {
  const fixture = JSON.parse(await readFile("output/fixtures/portal.json", "utf8")) as {
    users: { superadmin: Account };
  };
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(fixture.users.superadmin.email);
  await page.getByLabel("Contraseña").fill(fixture.users.superadmin.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
}
async function selectAvatar(page: Page, color: string) {
  const image = await sharp({ create: { width: 32, height: 32, channels: 4, background: color } })
    .png()
    .toBuffer();
  await page.getByRole("button", { name: "Perfil", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Tu perfil" });
  await dialog
    .getByLabel("Imagen de perfil")
    .setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: image });
  return { dialog, image };
}
async function storedAvatar(assetId: string) {
  const { stdout } = await dockerSql(
    `select json_build_object('path',m.object_path,'status',m.status,'referenced',p.avatar_path=m.object_path,'confirmations',(select count(*) from private.audit_log where action='confirm_avatar_upload' and entity_id=m.id)) from private.media_assets m join public.players p on p.id=m.owner_player_id where m.id=${sqlString(assetId)};`,
  );
  return JSON.parse(stdout) as {
    path: string;
    status: string;
    referenced: boolean;
    confirmations: number;
  };
}

async function expectPersistedAvatar(page: Page, image: Buffer) {
  const avatar = page.getByRole("button", { name: "Perfil", exact: true }).locator("img");
  await expect(avatar).toBeVisible();
  await expect
    .poll(() => avatar.evaluate((element: HTMLImageElement) => element.naturalWidth))
    .toBe(32);
  const src = await avatar.getAttribute("src");
  if (!src) throw new Error("El avatar persistido no tiene src.");
  const response = await page.request.get(new URL(src, page.url()).href);
  expect(response.ok()).toBe(true);
  expect(await response.body()).toEqual(image);
}

test("recupera la confirmación perdida después del commit sin otra subida, incluso al cerrar el diálogo", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await signIn(page);
  const { dialog, image } = await selectAvatar(page, "#da3559");
  const commands: { assetId: string; idempotencyKey: string }[] = [];
  let uploadCount = 0;
  page.on("request", (request) => {
    if (request.method() === "PUT" && request.url().includes("/object/upload/sign/")) {
      uploadCount++;
    }
  });
  await page.route("**/*", async (route) => {
    const request = route.request(),
      body = request.postData() ?? "";
    if (
      request.method() !== "POST" ||
      !request.headers()["next-action"] ||
      !body.includes('"assetId"') ||
      !body.includes('"idempotencyKey"') ||
      body.includes('"mimeType"')
    ) {
      await route.continue();
      return;
    }
    const [command] = JSON.parse(body) as { assetId: string; idempotencyKey: string }[];
    commands.push(command);
    if (commands.length === 1) {
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      expect(await storedAvatar(command.assetId)).toMatchObject({
        status: "ready",
        referenced: true,
        confirmations: 1,
      });
      // The real request and COMMIT completed; only its reply is lost.
      await route.abort("failed");
    } else {
      await route.continue();
    }
  });
  await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(dialog.getByRole("button", { name: "Reintentar confirmación" })).toBeEnabled();
  await expect(dialog.getByLabel("Imagen de perfil")).toBeDisabled();
  await dialog.getByRole("button", { name: "Cerrar perfil" }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Perfil", exact: true }).click();
  await dialog.getByRole("button", { name: "Reintentar confirmación" }).click();
  await expect(dialog).not.toBeVisible();
  expect(commands).toHaveLength(2);
  expect(commands[1]).toEqual(commands[0]);
  expect(uploadCount).toBe(1);
  const stored = await storedAvatar(commands[0].assetId);
  expect(stored).toMatchObject({ status: "ready", referenced: true, confirmations: 1 });
  await page.reload();
  await expectPersistedAvatar(page, image);
});

test("una recarga tras perder la confirmación muestra el avatar persistido", async ({ page }) => {
  test.setTimeout(60_000);
  await signIn(page);
  const { dialog, image } = await selectAvatar(page, "#2c87a0");
  let assetId = "";
  await page.route("**/*", async (route) => {
    const request = route.request(),
      body = request.postData() ?? "";
    if (
      request.method() === "POST" &&
      request.headers()["next-action"] &&
      body.includes('"assetId"') &&
      body.includes('"idempotencyKey"') &&
      !body.includes('"mimeType"')
    ) {
      assetId = (JSON.parse(body) as { assetId: string }[])[0].assetId;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(dialog.getByRole("button", { name: "Reintentar confirmación" })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
  const stored = await storedAvatar(assetId);
  expect(stored).toMatchObject({ status: "ready", referenced: true, confirmations: 1 });
  await expectPersistedAvatar(page, image);
});
