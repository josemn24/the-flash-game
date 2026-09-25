import type { CurrentViewerProvider } from "@/application/queries";
import { getPlayerRouteKey } from "@/data/mock/selectors";
import type { DomainStore, PlayerId } from "@/types/domain";

export class MockCurrentViewerProvider implements CurrentViewerProvider {
  constructor(
    private readonly store: DomainStore,
    private readonly currentPlayerId: PlayerId,
  ) {}

  async getCurrentViewer() {
    const player = this.store.players.find(({ id }) => id === this.currentPlayerId);
    const routeKey = getPlayerRouteKey(this.currentPlayerId);
    if (!player || !routeKey) throw new Error("The configured mock viewer does not exist.");
    return {
      playerId: player.id,
      id: routeKey,
      name: player.displayName,
      avatarSrc: player.avatarPath ?? undefined,
    };
  }
}
