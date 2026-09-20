"use client";

import { Chip } from "@/components/ui";
import type { SuperadminPortalRoom } from "@/types/view-models";
import { AdminSectionHeader } from "./AdminSectionHeader";
import { SeasonRoomSection } from "./SeasonRoomSection.client";
import styles from "./SeasonManagement.module.css";

export function SeasonManagement({ rooms }: { readonly rooms: readonly SuperadminPortalRoom[] }) {
  if (rooms.length === 0) return null;
  const total = rooms.reduce((count, room) => count + room.seasons.length, 0);
  return <section className={styles.section} aria-labelledby="season-management-title">
    <AdminSectionHeader id="season-management-title" eyebrow="S10 · operación privada" title="Temporadas" trailing={<Chip variant="data" tone="social">{total} temporadas</Chip>} />
    <div className={styles.roomSections}>{rooms.map((room) => <SeasonRoomSection key={room.roomId} room={room} />)}</div>
  </section>;
}
