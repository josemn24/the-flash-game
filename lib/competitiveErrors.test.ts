import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { isAttemptErrorCode, isGameSessionErrorCode } from "./competitiveErrors";

describe("competitive error vocabulary", () => {
  it("covers the literal diagnostics in the existing attempt command SQL", () => {
    const files = readdirSync("supabase/schemas").filter((name) =>
      /^(89_attempt|89_progressive_clues|91_attempt|91_alphabet|92_mini_wordle_commands|93_logic_code|94_progressive_clues|99_queens_03|99_word_search|99_word_hashtag)/.test(
        name,
      ),
    );
    for (const file of files) {
      const sql = readFileSync(`supabase/schemas/${file}`, "utf8");
      for (const [, code] of sql.matchAll(/raise\s+exception\s+'([a-z_]+)'/gi))
        expect(isAttemptErrorCode(code), `${file}: ${code}`).toBe(true);
    }
  });

  it.each([undefined, null, {}, "invented_error", "prefix stale_version", "__proto__", "toString"])(
    "rejects unknown codes and partial matches (%s)",
    (code) => {
      expect(isAttemptErrorCode(code)).toBe(false);
      expect(isGameSessionErrorCode(code)).toBe(false);
    },
  );
});
