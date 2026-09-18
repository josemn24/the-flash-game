"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  TrophyIcon,
} from "@/components/ui";
import { LogoutButton } from "@/components/auth/LogoutButton.client";
import {
  abortProfileAvatar,
  confirmProfileAvatar,
  prepareProfileAvatar,
  updateProfileName,
} from "@/app/actions/profile";
import { createClient } from "@/lib/supabase/client";
import { ROOM_ART_FALLBACK } from "@/application/presentation/room";
import { getProfileInitials } from "@/lib/userProfile";
import type { RoomCardModel } from "@/types/game";
import type { UserProfile } from "@/types/user";
import { FlashPopProfileDialog } from "./FlashPopProfileDialog.client";
import styles from "./FlashPopHome.module.css";

type FlashPopHomeProps = {
  rooms: RoomCardModel[];
  initialProfile: UserProfile;
};

export function FlashPopHome({ rooms, initialProfile }: FlashPopHomeProps) {
  const [profile, setProfile] = useState(initialProfile);
  const [profileOpen, setProfileOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const hasOpenedProfile = useRef(false);

  const visibleRooms = useMemo(
    () =>
      rooms.map((room) => ({
        ...room,
        memberPreviews: room.memberPreviews.map((member) =>
          member.id === profile.id
            ? {
                ...member,
                name: profile.name,
                initials: getProfileInitials(profile.name),
                src: profile.avatarSrc,
              }
            : member,
        ),
      })),
    [profile, rooms],
  );

  useEffect(() => {
    if (profileOpen) {
      hasOpenedProfile.current = true;
      return;
    }

    if (hasOpenedProfile.current) {
      profileTriggerRef.current?.focus();
    }
  }, [profileOpen]);

  const handleProfileSave = useCallback(async ({ name, file }: { name: string; file: File | null }) => {
    const nameResult = await updateProfileName(name);
    if (!nameResult.ok) return nameResult;
    if (!file) {
      setProfile(nameResult.profile);
      setProfileOpen(false);
      setStatusMessage("Cambios guardados.");
      return nameResult;
    }

    const idempotencyKey = crypto.randomUUID();
    const prepared = await prepareProfileAvatar({
      mimeType: file.type,
      byteSize: file.size,
      idempotencyKey,
    });
    if (!prepared.ok) return prepared;

    const uploadClient = createClient();
    const { error: uploadError } = await uploadClient.storage
      .from("avatars")
      .uploadToSignedUrl(prepared.objectPath, prepared.uploadToken, file, {
        contentType: file.type,
        upsert: false,
      });
    if (uploadError) {
      await abortProfileAvatar(prepared.assetId);
      return {
        ok: false as const,
        code: "storage_unavailable" as const,
        message: "No se ha podido subir la imagen. Inténtalo de nuevo.",
      };
    }

    const confirmed = await confirmProfileAvatar({
      assetId: prepared.assetId,
      idempotencyKey: prepared.confirmIdempotencyKey,
    });
    if (confirmed.ok) {
      setProfile(confirmed.profile);
      setProfileOpen(false);
      setStatusMessage("Cambios guardados.");
    }
    return confirmed;
  }, []);

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
          <IconButton
            ref={profileTriggerRef}
            label="Perfil"
            className={styles.profileButton}
            aria-expanded={profileOpen}
            aria-haspopup="dialog"
            aria-controls="flash-pop-profile-dialog"
            onClick={() => {
              setStatusMessage("");
              setProfileOpen(true);
            }}
          >
            <Avatar name={profile.name} src={profile.avatarSrc} tone="social" size="sm" />
          </IconButton>
          <LogoutButton />
        </nav>
      </header>

      <section className={styles.roomsSection} aria-labelledby="rooms-title">
        <h1 id="rooms-title">Mis salas</h1>

        {rooms.length > 0 ? (
          <div className={styles.roomGrid}>
            {visibleRooms.map((room, index) => {
              const challenge = room.dailyChallenge;
              const imageSrc = challenge?.imageSrc ?? ROOM_ART_FALLBACK;
              const imageAlt = challenge
                ? `Ilustración del desafío ${challenge.title}`
                : `Ilustración de la sala ${room.title}`;
              const isClosed = room.seasonStatus !== null && room.seasonStatus !== "active";

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
                  <Card as="article" elevation="card" padding="none" className={styles.roomCard}>
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
                          <p>{challenge?.formatLabel ?? "Sin reto hoy"}</p>
                        </div>
                        <span className={styles.roomArrow} aria-hidden="true">
                          <ArrowIcon />
                        </span>
                      </div>

                      <div
                        className={styles.roomStats}
                        aria-label={`Estadísticas de ${room.title}`}
                      >
                        <span
                          className={styles.statBadge}
                          role="img"
                          aria-label={`${room.currentUser.totalFlashPoints} Flash Points`}
                        >
                          <strong aria-hidden="true">{room.currentUser.totalFlashPoints}</strong>
                          <BoltIcon aria-hidden="true" />
                        </span>
                        <span className={styles.statBadge}>
                          <TrophyIcon aria-hidden="true" />
                          <strong>
                            {room.currentUser.roomRank === null
                              ? "—"
                              : `#${room.currentUser.roomRank}`}
                          </strong>
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

      <span className={styles.visuallyHidden} aria-live="polite">
        {statusMessage}
      </span>

      <FlashPopProfileDialog
        open={profileOpen}
        profile={profile}
        onClose={() => setProfileOpen(false)}
        onSave={handleProfileSave}
      />
    </Canvas>
  );
}
