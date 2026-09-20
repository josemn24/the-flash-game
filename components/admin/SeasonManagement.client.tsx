"use client";

import { Chip } from "@/components/ui";
import type { SuperadminPortalRoom } from "@/types/view-models";
import { AdminSectionHeader } from "./AdminSectionHeader";
import { SeasonRoomSection } from "./SeasonRoomSection.client";
import styles from "./SeasonManagement.module.css";

export function SeasonManagement({ room }: { readonly room: SuperadminPortalRoom }) {
  const total = room.seasons.length;
  return (
    <section className={styles.section} aria-labelledby="season-management-title">
      <AdminSectionHeader
        id="season-management-title"
        eyebrow="S10 · operación privada"
        title="Temporadas"
        trailing={
          <Chip variant="data" tone="social">
            {total} temporadas
          </Chip>
        }
      />
      <div className={styles.roomSections}>
        <SeasonRoomSection room={room} />
      </div>
    </section>
  );
}
