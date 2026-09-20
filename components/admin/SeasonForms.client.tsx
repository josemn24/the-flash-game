"use client";

import { useActionState, useEffect, useRef, type FormEvent, type MutableRefObject } from "react";
import { Button, Card, Chip } from "@/components/ui";
import type { SeasonStatus } from "@/types/domain/season";
import type { SuperadminPortalRoom, SuperadminPortalSeason } from "@/types/view-models";
import { activateSeason, createSeasonDraft, updateSeasonDraft, type SeasonActionState } from "@/app/admin/season-actions";
import { utcToLocalDateTime } from "@/lib/zonedDateTime";
import styles from "./SeasonManagement.module.css";

const initialState: SeasonActionState = {};
function newKey() { return globalThis.crypto.randomUUID(); }
function prepareKey(event: FormEvent<HTMLFormElement>, keyRef: MutableRefObject<string | null>) {
  if (!keyRef.current) keyRef.current = newKey();
  const input = event.currentTarget.elements.namedItem("idempotencyKey");
  if (input instanceof HTMLInputElement) input.value = keyRef.current;
}
function ErrorMessage({ state }: { readonly state: SeasonActionState }) { return state.message ? <p className={styles.error} role="alert">{state.message}</p> : null; }

export function SeasonDateFields({ timeZone, startsAt, endsAt, state }: { readonly timeZone: string; readonly startsAt?: string; readonly endsAt?: string; readonly state: SeasonActionState }) {
  return <div className={styles.dateGrid}>{([['startsAtLocal', 'Inicio', startsAt], ['endsAtLocal', 'Fin', endsAt]] as const).map(([name, label, value]) => <label className={styles.field} key={name}><span>{label} · {timeZone}</span><input name={name} type="datetime-local" defaultValue={value ? utcToLocalDateTime(value, timeZone) : undefined} required aria-invalid={Boolean(state.fieldErrors?.[name])} />{state.fieldErrors?.[name] ? <small className={styles.error}>{state.fieldErrors[name]}</small> : null}</label>)}</div>;
}
function ReasonField({ state, label = "Motivo de auditoría", placeholder = "Preparar temporada de la beta" }: { readonly state: SeasonActionState; readonly label?: string; readonly placeholder?: string }) { return <label className={styles.field}><span>{label}</span><textarea name="reason" maxLength={500} rows={2} required placeholder={placeholder} />{state.fieldErrors?.reason ? <small className={styles.error}>{state.fieldErrors.reason}</small> : null}</label>; }

export function DraftSeasonForm({ room }: { readonly room: SuperadminPortalRoom }) {
  const [state, action, pending] = useActionState(createSeasonDraft, initialState); const keyRef = useRef<string | null>(null); useEffect(() => { if (state.message) keyRef.current = null; }, [state.message]);
  return <form action={action} className={styles.form} onSubmit={(event) => prepareKey(event, keyRef)}><input type="hidden" name="roomId" value={room.roomId} readOnly /><input type="hidden" name="idempotencyKey" defaultValue="" /><div className={styles.formHeading}><div><p className={styles.eyebrow}>Nueva operación</p><h4>Preparar temporada</h4></div><span className={styles.helper}>Las fechas se guardan en UTC.</span></div><label className={styles.field}><span>Título</span><input name="title" minLength={3} maxLength={80} required placeholder="Liga de otoño" />{state.fieldErrors?.title ? <small className={styles.error}>{state.fieldErrors.title}</small> : null}</label><SeasonDateFields timeZone={room.timeZone} state={state} /><ReasonField state={state} /><ErrorMessage state={state} /><Button type="submit" loading={pending}>Guardar borrador</Button></form>;
}

export function DraftSeasonEditor({ room, season }: { readonly room: SuperadminPortalRoom; readonly season: SuperadminPortalSeason }) {
  const [state, action, pending] = useActionState(updateSeasonDraft, initialState); const keyRef = useRef<string | null>(null); useEffect(() => { if (state.message) keyRef.current = null; }, [state.message]);
  return <form action={action} className={styles.form} onSubmit={(event) => prepareKey(event, keyRef)}><input type="hidden" name="seasonId" value={season.seasonId} readOnly /><input type="hidden" name="idempotencyKey" defaultValue="" /><div className={styles.formHeading}><div><p className={styles.eyebrow}>Editar borrador</p><h4>{season.title}</h4></div></div><label className={styles.field}><span>Título</span><input name="title" minLength={3} maxLength={80} defaultValue={season.title} required />{state.fieldErrors?.title ? <small className={styles.error}>{state.fieldErrors.title}</small> : null}</label><SeasonDateFields timeZone={room.timeZone} startsAt={season.startsAt} endsAt={season.endsAt} state={state} /><ReasonField state={state} /><ErrorMessage state={state} /><Button type="submit" loading={pending} variant="secondary">Guardar cambios</Button></form>;
}

export function ActivateSeasonForm({ season }: { readonly season: SuperadminPortalSeason }) {
  const [state, action, pending] = useActionState(activateSeason, initialState); const keyRef = useRef<string | null>(null); useEffect(() => { if (state.message) keyRef.current = null; }, [state.message]);
  function confirmActivation(event: FormEvent<HTMLFormElement>) { if (!window.confirm(`¿Activar «${season.title}»? La sala no podrá tener otra temporada activa.`)) { event.preventDefault(); return; } prepareKey(event, keyRef); }
  return <form action={action} className={styles.activateForm} onSubmit={confirmActivation}><input type="hidden" name="seasonId" value={season.seasonId} readOnly /><input type="hidden" name="idempotencyKey" defaultValue="" /><label className={styles.field}><span>Motivo de activación</span><textarea name="reason" maxLength={500} rows={2} required placeholder="Abrir la temporada" />{state.fieldErrors?.reason ? <small className={styles.error}>{state.fieldErrors.reason}</small> : null}</label><ErrorMessage state={state} /><Button type="submit" loading={pending}>Activar temporada</Button></form>;
}

function statusLabel(status: SeasonStatus) { return ({ draft: "Borrador", active: "Activa", scheduled: "Programada", finished: "Finalizada", cancelled: "Cancelada" } satisfies Record<SeasonStatus, string>)[status]; }
function statusTone(status: SeasonStatus) { return status === "active" ? "success" as const : status === "cancelled" ? "danger" as const : status === "draft" ? "info" as const : "neutral" as const; }
export function SeasonCard({ room, season }: { readonly room: SuperadminPortalRoom; readonly season: SuperadminPortalSeason }) {
  const format = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone: room.timeZone });
  return <Card as="article" surface="soft" className={styles.seasonCard}><div className={styles.seasonTopline}><div><p className={styles.eyebrow}>Temporada</p><h4>{season.title}</h4></div><Chip variant="status" tone={statusTone(season.status)}>{statusLabel(season.status)}</Chip></div><p className={styles.window}>{format.format(new Date(season.startsAt))}{" → "}{format.format(new Date(season.endsAt))}</p>{season.status === "draft" ? <div className={styles.seasonActions}><DraftSeasonEditor room={room} season={season} /><ActivateSeasonForm season={season} /></div> : null}</Card>;
}
