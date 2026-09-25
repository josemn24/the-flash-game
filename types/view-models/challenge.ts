import type {
  ChallengeAvailabilityStatus,
  ChallengeImplementationStatus,
  GameMode,
} from "@/types/gameplay/challenge";

export type ChallengeSummary = {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  mode?: GameMode;
  questionCount: number;
  availableFrom: string;
  availableUntil: string;
  availabilityStatus: ChallengeAvailabilityStatus;
  playable: boolean;
  openable?: boolean;
  attemptVersion?: number;
  implementationStatus?: ChallengeImplementationStatus;
};
