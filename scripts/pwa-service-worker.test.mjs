import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";

const execFileAsync = promisify(execFile);

test("service worker is valid JavaScript", async () => {
  await execFileAsync(process.execPath, ["--check", "public/sw.js"]);
});
