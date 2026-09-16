import type { GameMode } from "@/types/gameplay/challenge";

export type RoomCalendarAvailability = "upcoming" | "available" | "closed" | "cancelled";

export type RoomCalendarEntry = {
  readonly id: string;
  readonly number: number;
  readonly timeZone: string;
  readonly status: "scheduled" | "open" | "closed" | "cancelled";
  readonly availabilityStatus: RoomCalendarAvailability;
  readonly opensAt: string;
  readonly closesAt: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly mode: GameMode;
  readonly questionCount: number;
  readonly href: string;
  readonly canStart: boolean;
  readonly canContinue: boolean;
};
