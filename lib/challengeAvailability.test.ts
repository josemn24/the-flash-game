import { describe, expect, it } from "vitest";
import { getChallengeAvailabilityStatus } from "@/lib/challengeAvailability";

const availableFrom = "2026-07-23T22:00:00.000Z";
const availableUntil = "2026-07-24T21:59:59.999Z";

describe("getChallengeAvailabilityStatus", () => {
  it("locks a challenge before its availability window", () => {
    expect(
      getChallengeAvailabilityStatus(
        availableFrom,
        availableUntil,
        new Date("2026-07-23T21:59:59.999Z"),
      ),
    ).toBe("locked");
  });

  it("marks a challenge available during its availability window", () => {
    expect(
      getChallengeAvailabilityStatus(
        availableFrom,
        availableUntil,
        new Date("2026-07-24T10:00:00.000Z"),
      ),
    ).toBe("available");
  });

  it("expires a challenge after its availability window", () => {
    expect(
      getChallengeAvailabilityStatus(
        availableFrom,
        availableUntil,
        new Date("2026-07-24T22:00:00.000Z"),
      ),
    ).toBe("expired");
  });
});
