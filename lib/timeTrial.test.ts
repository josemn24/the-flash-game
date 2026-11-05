import { describe, expect, it } from "vitest";
import { isTimeTrialFormat, timeTrialFormat } from "./timeTrial";
describe("Contrarreloj format metadata", () => {
  it.each(["queens", "connect-pairs"])("derives %s from a homogeneous sequence", (format) => {
    expect(isTimeTrialFormat(format)).toBe(true);
    expect(timeTrialFormat([format, format])).toBe(format);
  });
  it.each([[], ["queens", "connect-pairs"], ["escape"]])(
    "rejects unsupported or mixed metadata %j",
    (...types) => {
      expect(() => timeTrialFormat(types)).toThrow();
    },
  );
});
