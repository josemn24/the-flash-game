import Image from "next/image";
import Link from "next/link";
import {
  ArrowIcon,
  Avatar,
  AvatarStack,
  BoltIcon,
  Card,
  Canvas,
  Chip,
  IconButton,
  SettingsIcon,
  TrophyIcon,
} from "@/components/ui";
import { ROOM_ART_FALLBACK } from "@/lib/roomCard";
import type { RoomCardModel } from "@/types/game";
import styles from "./FlashPopHome.module.css";

type FlashPopHomeProps = {
  rooms: RoomCardModel[];
};

export function FlashPopHome({ rooms }: FlashPopHomeProps) {
  return (
    <Canvas contentClassName={styles.content}>
      <header className={styles.homeHeader}>
        <div className={styles.brand} aria-label="Flash Pop">
          <span className={styles.brandMark}>
            <BoltIcon />
          </span>
          <span className={styles.brandName}>Flash Pop</span>
        </div>

        <nav className={styles.headerActions} aria-label="Acciones de cuenta">
          <IconButton label="Perfil" className={styles.profileButton}>
            <Avatar name="Jugador" initials="TÚ" tone="social" size="sm" />
          </IconButton>
          <IconButton label="Configuración">
            <SettingsIcon />
          </IconButton>
        </nav>
      </header>

      <section className={styles.roomsSection} aria-labelledby="rooms-title">
        <h1 id="rooms-title">Mis salas</h1>

        {rooms.length > 0 ? (
          <div className={styles.roomGrid}>
            {rooms.map((room, index) => {
              const challenge = room.dailyChallenge;
              const imageSrc = challenge?.imageSrc ?? ROOM_ART_FALLBACK;
              const imageAlt = challenge
                ? `Ilustración del desafío ${challenge.title}`
                : `Ilustración de la sala ${room.title}`;
              const isClosed = room.seasonStatus !== "active";

              return (
                <Link
                  href={room.href}
                  key={room.roomId}
                  className={styles.roomLink}
                  aria-label={
                    challenge
                      ? `Abrir sala ${room.title}. ${challenge.title}`
                      : `Abrir sala ${room.title}. Sin reto hoy`
                  }
                >
                  <Card as="article" elevation="hero" padding="none" className={styles.roomCard}>
                    <div className={styles.roomArt}>
                      <Image
                        src={imageSrc}
                        alt={imageAlt}
                        fill
                        priority={index === 0}
                        sizes="(max-width: 760px) 100vw, 50vw"
                      />
                      {isClosed || !challenge ? (
                        <Chip
                          variant="data"
                          tone={isClosed ? "neutral" : "danger"}
                          className={styles.artStatus}
                        >
                          {isClosed ? "Cerrada" : "Sin reto hoy"}
                        </Chip>
                      ) : null}
                      <AvatarStack
                        items={room.memberPreviews}
                        maxVisible={4}
                        size="sm"
                        label={`${room.memberCount} jugadores`}
                        className={styles.memberStack}
                      />
                    </div>

                    <div className={styles.roomBody}>
                      <div className={styles.roomTopline}>
                        <div className={styles.roomTitles}>
                          <h2>{room.title}</h2>
                          <p>{challenge?.title ?? "Sin reto hoy"}</p>
                        </div>
                        <span className={styles.roomArrow} aria-hidden="true">
                          <ArrowIcon />
                        </span>
                      </div>

                      <div
                        className={styles.roomStats}
                        aria-label={`Estadísticas de ${room.title}`}
                      >
                        <span className={styles.statBadge}>
                          <BoltIcon aria-hidden="true" />
                          <strong>{room.currentUser.totalPoints}</strong>
                          <span className={styles.visuallyHidden}> gemas</span>
                        </span>
                        <span className={styles.statBadge}>
                          <TrophyIcon aria-hidden="true" />
                          <strong>#{room.currentUser.roomRank}</strong>
                          <span className={styles.visuallyHidden}> ranking</span>
                        </span>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card as="section" surface="soft" className={styles.emptyState}>
            <BoltIcon />
            <h2>No tienes salas.</h2>
            <p>Cuando te unas a una sala, aparecerá aquí.</p>
          </Card>
        )}
      </section>
    </Canvas>
  );
}
