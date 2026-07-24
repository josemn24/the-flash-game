import type { ChallengeAvailabilityStatus } from "@/types/game";

export function getChallengeAvailabilityStatus(
  availableFrom: string,
  availableUntil: string,
  now = new Date(),
): ChallengeAvailabilityStatus {
  const fromTime = new Date(availableFrom).getTime();
  const untilTime = new Date(availableUntil).getTime();
  const nowTime = now.getTime();

  if (nowTime < fromTime) return "locked";
  if (nowTime > untilTime) return "expired";
  return "available";
}
