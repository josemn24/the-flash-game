import type { RehearsalStore, RehearsalPolicyInput } from "@/application/ports/rehearsals";
import type { RehearsalBankQuestion, RehearsalRecipe } from "@/types/gameplay/rehearsal";
import { generateRehearsal, rehearsalCoverage, replayRehearsal } from "@/lib/rehearsals/generator";

export class Rehearsals {
  constructor(
    private readonly store: RehearsalStore,
    private readonly bank: readonly RehearsalBankQuestion[],
    private readonly seed: () => string,
  ) {}
  async getAvailability(room: string, publication: string) {
    const context = await this.store.readPlayer(room, publication);
    return Boolean(context?.enabled && rehearsalCoverage(this.bank, context.template).ready);
  }
  async getPlayerRehearsal(room: string, publication: string) {
    const context = await this.store.readPlayer(room, publication);
    if (!context) return null;
    if (!context.enabled || !rehearsalCoverage(this.bank, context.template).ready)
      return { status: "unavailable" as const };
    return {
      status: "ready" as const,
      ...generateRehearsal(this.bank, context.template, this.seed()),
    };
  }
  async getEditorial(version: string) {
    const context = await this.store.readEditorial(version);
    return context
      ? {
          challengeVersionId: context.template.challengeVersionId,
          status: context.status,
          publications: context.publications,
          coverage: rehearsalCoverage(this.bank, context.template),
        }
      : null;
  }
  async preview(version: string, options: { seed?: string; recipe?: RehearsalRecipe } = {}) {
    const context = await this.store.readEditorial(version);
    if (!context) return null;
    return options.recipe
      ? replayRehearsal(this.bank, context.template, options.recipe)
      : generateRehearsal(this.bank, context.template, options.seed ?? this.seed());
  }
  async setPolicy(input: RehearsalPolicyInput) {
    await this.store.setPolicy(input);
  }
}
