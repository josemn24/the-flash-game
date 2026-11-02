"use client";

import { useParams } from "next/navigation";
import { BackLink, Button, Canvas } from "@/components/ui";
import styles from "@/components/game/modes/flash-pop/FlashPopRoomSecondary.module.css";

export default function RankingError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const { roomId } = useParams<{ roomId: string }>();

  return (
    <Canvas contentClassName={styles.content}>
      <header className={styles.historyDetailToolbar}>
        <BackLink href={`/salas/${roomId}`} label="Volver al detalle de la sala" />
      </header>
      <section className={styles.rankingFailure} role="alert">
        <h1>No hemos podido cargar el ranking.</h1>
        <Button variant="secondary" size="sm" onClick={retry}>
          Reintentar
        </Button>
      </section>
    </Canvas>
  );
}
