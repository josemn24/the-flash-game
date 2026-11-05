import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// The caller owns a disposable database; the application database is never targeted.
export async function testSeasonMeasurementContract(sql) {
  const sources = await Promise.all(
    [
      "command-fixtures.sql",
      "season-measurement-fixtures.sql",
      "room-measurement-contract.sql",
      "experiment-removal-contract.sql",
    ].map((name) => readFile(`supabase/tests/support/${name}`, "utf8")),
  );
  const result = await sql(`begin;\n${sources.join("\n")}\nrollback;`);
  assert.match(result, /room_measurement_contract_ok/);
  assert.match(result, /experiment_removal_contract_ok/);
  const reliability = await readFile(
    "supabase/tests/support/measurement-reliability-contract.sql",
    "utf8",
  );
  const regression = await sql(
    `begin;\n${sources.slice(0, 2).join("\n")}\n${reliability}\nrollback;`,
  );
  assert.match(regression, /measurement_reliability_contract_ok/);
}
