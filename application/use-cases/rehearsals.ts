import type {
  RehearsalCatalog,
  RehearsalStore,
  RehearsalAssociationInput,
} from "@/application/ports/rehearsals";
import { rehearsalCompatibility } from "@/lib/rehearsals/structure";

export class Rehearsals {
  constructor(
    private readonly store: RehearsalStore,
    private readonly catalog: RehearsalCatalog,
  ) {}

  async getPlayerRehearsal(roomKey: string, publicationId: string) {
    const context = await this.store.readPlayer(roomKey, publicationId);
    if (!context) return null;
    const artifact = this.catalog.resolve(context.ref);
    if (!artifact || rehearsalCompatibility(context.source, artifact.source).length) {
      throw new Error(artifact ? "rehearsal_incompatible" : "rehearsal_catalog_missing");
    }
    return { ref: artifact.ref, definition: artifact.definition };
  }

  async getEditorial(versionId: string) {
    const context = await this.store.readEditorial(versionId);
    if (!context) return null;
    return {
      challengeVersionId: context.challengeVersionId,
      status: context.status,
      updatedAt: context.updatedAt,
      ref: context.ref,
      choices: this.catalog.list().map((a) => ({
        ref: a.ref,
        title: a.title,
        issues: rehearsalCompatibility(context.source, a.source),
      })),
    };
  }

  async associate(input: RehearsalAssociationInput) {
    const context = await this.store.readEditorial(input.challengeVersionId);
    if (!context) throw new Error("content_not_found");
    if (input.ref) {
      const artifact = this.catalog.resolve(input.ref);
      if (!artifact || rehearsalCompatibility(context.source, artifact.source).length)
        throw new Error("rehearsal_incompatible");
    }
    await this.store.associate({ ...input, sourceHash: context.sourceHash });
  }
}
