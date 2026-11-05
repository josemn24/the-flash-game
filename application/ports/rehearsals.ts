import type { RehearsalTemplate, RehearsalPolicy } from "@/types/gameplay/rehearsal";

export type EditorialRehearsalSnapshot = {
  readonly template: RehearsalTemplate;
  readonly status: "draft" | "published" | "archived";
  readonly publications: readonly RehearsalPolicy[];
};
export type RehearsalPolicyInput = {
  readonly publicationId: string;
  readonly enabled: boolean;
  readonly expectedUpdatedAt: string | null;
  readonly idempotencyKey: string;
  readonly reason: string;
};
export interface RehearsalStore {
  readPlayer(
    roomKey: string,
    publicationId: string,
  ): Promise<{ template: RehearsalTemplate; enabled: boolean } | null>;
  readEditorial(versionId: string): Promise<EditorialRehearsalSnapshot | null>;
  setPolicy(input: RehearsalPolicyInput): Promise<void>;
}
