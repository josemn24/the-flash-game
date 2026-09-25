"use client";
import { Card, Chip } from "@/components/ui";
import type { SuperadminPortalRoom } from "@/types/view-models";
import { AdminEmptyState } from "./AdminEmptyState";
import { DraftSeasonForm, SeasonCard } from "./SeasonForms.client";
import styles from "./SeasonManagement.module.css";
export function SeasonRoomSection({ room }: { readonly room: SuperadminPortalRoom }) { return <Card as="section" className={styles.roomSection} aria-labelledby={`season-room-${room.roomId}`}><div className={styles.roomHeading}><div><p className={styles.eyebrow}>/{room.slug} · {room.timeZone}</p><h3 id={`season-room-${room.roomId}`}>{room.title}</h3></div><Chip variant="data" tone="neutral">{room.seasons.length} {room.seasons.length === 1 ? "temporada" : "temporadas"}</Chip></div>{room.seasons.length > 0 ? <div className={styles.seasonList}>{room.seasons.map((season) => <SeasonCard key={season.seasonId} room={room} season={season} />)}</div> : <AdminEmptyState>Todavía no hay temporadas preparadas.</AdminEmptyState>}<DraftSeasonForm room={room} /></Card>; }
