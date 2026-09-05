import { FlashPopHome } from "@/components/flash-pop/FlashPopHome.client";
import { getChallengeDefinitionById } from "@/data/challengeDefinitions";
import { getNarrativeQuestionIds, getPyramidQuestionIds } from "@/data/challenges";
import { demoRoom } from "@/data/demoRoom";
import { getChallengeAvailabilityStatus } from "@/lib/challengeAvailability";
import type { ChallengeSummary } from "@/types/game";

export default function Home() {
  const activeSeason = demoRoom.activeSeason;
  const challengeSummaries: ChallengeSummary[] = activeSeason.scheduledChallenges.map(
    (scheduledChallenge) => {
      if (!("challengeDefinitionId" in scheduledChallenge)) {
        const availabilityStatus = getChallengeAvailabilityStatus(
          scheduledChallenge.availableFrom,
          scheduledChallenge.availableUntil,
        );

        return {
          id: scheduledChallenge.id,
          number: scheduledChallenge.number,
          title: scheduledChallenge.title,
          subtitle: scheduledChallenge.subtitle,
          mode: scheduledChallenge.mode,
          questionCount: 0,
          availableFrom: scheduledChallenge.availableFrom,
          availableUntil: scheduledChallenge.availableUntil,
          availabilityStatus,
          playable: false,
        };
      }

      const { challengeDefinitionId } = scheduledChallenge;
      if (!challengeDefinitionId) {
        throw new Error(
          `Missing playable definition id for scheduled challenge "${scheduledChallenge.id}"`,
        );
      }

      const definition = getChallengeDefinitionById(challengeDefinitionId);
      if (!definition) {
        throw new Error(
          `Missing challenge definition for scheduled challenge "${scheduledChallenge.id}"`,
        );
      }
      const availabilityStatus = getChallengeAvailabilityStatus(
        scheduledChallenge.availableFrom,
        scheduledChallenge.availableUntil,
      );

      return {
        id: scheduledChallenge.id,
        number: scheduledChallenge.number,
        title: definition.title,
        subtitle: definition.subtitle,
        mode: definition.mode,
        questionCount:
          definition.mode === "alphabet"
            ? definition.entries.length
            : definition.mode === "narrative"
              ? getNarrativeQuestionIds(definition).length
              : definition.mode === "pyramid"
                ? getPyramidQuestionIds(definition).length
                : definition.questionIds.length,
        availableFrom: scheduledChallenge.availableFrom,
        availableUntil: scheduledChallenge.availableUntil,
        availabilityStatus,
        playable: definition.mode === "pyramid" || availabilityStatus === "available",
        openable: scheduledChallenge.id === "tabarnia-flash-01",
        implementationStatus:
          scheduledChallenge.id === "tabarnia-flash-01"
            ? "prototype"
            : definition.mode === "narrative"
              ? definition.implementationStatus
              : definition.mode === "pyramid"
                ? "prototype"
                : undefined,
      };
    },
  );

  return (
    <FlashPopHome
      roomTitle={demoRoom.title}
      seasonTitle={activeSeason.title}
      seasonStatus={activeSeason.status}
      challenges={challengeSummaries}
    />
  );
}
