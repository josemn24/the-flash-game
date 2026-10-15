import { CompetitiveGameApp } from "./CompetitiveGameApp";
import { MockGameApp } from "./MockGameApp";
import type { GameAppProps } from "./gameAppTypes";

export type { GameAppProps } from "./gameAppTypes";

export function GameApp(props: GameAppProps) {
  return props.persistence === "server" ? (
    <CompetitiveGameApp {...props} />
  ) : (
    <MockGameApp {...props} />
  );
}
