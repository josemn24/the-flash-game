import type { RehearsalArtifact, RehearsalRef, RehearsalSource } from "@/types/gameplay/rehearsal";

export type EditorialRehearsalSnapshot = {
  readonly challengeVersionId: string;
  readonly status: "draft" | "published" | "archived";
  readonly updatedAt: string;
  readonly sourceHash: string;
  readonly source: RehearsalSource;
  readonly ref: RehearsalRef | null;
};
export type RehearsalAssociationInput = {
  readonly challengeVersionId: string;
  readonly expectedUpdatedAt: string;
  readonly idempotencyKey: string;
  readonly reason: string;
  readonly ref: RehearsalRef | null;
};
export interface RehearsalStore {
  readPlayer(
    roomKey: string,
    publicationId: string,
  ): Promise<{ ref: RehearsalRef; source: RehearsalSource } | null>;
  readEditorial(versionId: string): Promise<EditorialRehearsalSnapshot | null>;
  associate(input: RehearsalAssociationInput & { sourceHash: string }): Promise<void>;
}
export interface RehearsalCatalog {
  list(): readonly RehearsalArtifact[];
  resolve(ref: RehearsalRef): RehearsalArtifact | null;
}
