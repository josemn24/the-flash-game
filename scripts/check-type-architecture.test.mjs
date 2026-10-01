import { execFile } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();
const fixturePath = path.join(projectRoot, "app", "__architecture-boundary-test__.ts");

describe("type architecture boundary checker", () => {
  it("fails when a production route imports the demo facade", async () => {
    await writeFile(
      fixturePath,
      'import { getFlashPopLobbyPageModel } from "@/server/demo-data-access";\n\nvoid getFlashPopLobbyPageModel;\n',
    );

    try {
      await expect(
        execFileAsync("node", ["scripts/check-type-architecture.mjs"], { cwd: projectRoot }),
      ).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringContaining(
          "app/__architecture-boundary-test__.ts imports the demo server facade outside app/demo",
        ),
      });
    } finally {
      await rm(fixturePath, { force: true });
    }
  });
});
