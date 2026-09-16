"use client";

import { useActionState, useEffect, useRef, type FormEvent, type MutableRefObject } from "react";
import { Button, Card, Chip } from "@/components/ui";
import type { SeasonStatus } from "@/types/domain/season";
import type { SuperadminPortalRoom, SuperadminPortalSeason } from "@/types/view-models";
import {
  activateSeason,
  createSeasonDraft,
  updateSeasonDraft,
  type SeasonActionState,
} from "@/app/admin/season-actions";
import { utcToLocalDateTime } from "@/lib/zonedDateTime";
import styles from "./SeasonManagement.module.css";

const initialState: SeasonActionState = {};

function statusLabel(status: SeasonStatus) {
  switch (status) {
    case "draft":
      return "Borrador";
    case "active":
      return "Activa";
    case "scheduled":
      return "Programada";
    case "finished":
      return "Finalizada";
    case "cancelled":
      return "Cancelada";
  }
}

function statusTone(status: SeasonStatus) {
  if (status === "active") return "success" as const;
  if (status === "cancelled") return "danger" as const;
  if (status === "draft") return "info" as const;
  return "neutral" as const;
}

function newKey() {
  return globalThis.crypto.randomUUID();
}

function prepareKey(event: FormEvent<HTMLFormElement>, keyRef: MutableRefObject<string | null>) {
  if (!keyRef.current) keyRef.current = newKey();
  const input = event.currentTarget.elements.namedItem("idempotencyKey");
  if (input instanceof HTMLInputElement) input.value = keyRef.current;
}

function ErrorMessage({ state }: { readonly state: SeasonActionState }) {
  return state.message ? (
    <p className={styles.error} role="alert">
      {state.message}
    </p>
  ) : null;
}

function DateFields({
  timeZone,
  startsAt,
  endsAt,
  state,
}: {
  readonly timeZone: string;
  readonly startsAt?: string;
  readonly endsAt?: string;
  readonly state: SeasonActionState;
}) {
  return (
    <div className={styles.dateGrid}>
      <label className={styles.field}>
        <span>Inicio · {timeZone}</span>
        <input
          name="startsAtLocal"
          type="datetime-local"
          defaultValue={startsAt ? utcToLocalDateTime(startsAt, timeZone) : undefined}
          required
          aria-invalid={Boolean(state.fieldErrors?.startsAtLocal)}
        />
        {state.fieldErrors?.startsAtLocal ? (
          <small className={styles.error}>{state.fieldErrors.startsAtLocal}</small>
        ) : null}
      </label>
      <label className={styles.field}>
        <span>Fin · {timeZone}</span>
        <input
          name="endsAtLocal"
          type="datetime-local"
          defaultValue={endsAt ? utcToLocalDateTime(endsAt, timeZone) : undefined}
          required
          aria-invalid={Boolean(state.fieldErrors?.endsAtLocal)}
        />
        {state.fieldErrors?.endsAtLocal ? (
          <small className={styles.error}>{state.fieldErrors.endsAtLocal}</small>
        ) : null}
      </label>
    </div>
  );
}

function ReasonField({ state }: { readonly state: SeasonActionState }) {
  return (
    <label className={styles.field}>
      <span>Motivo de auditoría</span>
      <textarea
        name="reason"
        maxLength={500}
        rows={2}
        required
        placeholder="Preparar temporada de la beta"
      />
      {state.fieldErrors?.reason ? (
        <small className={styles.error}>{state.fieldErrors.reason}</small>
      ) : null}
    </label>
  );
}

function DraftSeasonForm({ room }: { readonly room: SuperadminPortalRoom }) {
  const [state, action, pending] = useActionState(createSeasonDraft, initialState);
  const keyRef = useRef<string | null>(null);
  useEffect(() => {
    if (state.message) keyRef.current = null;
  }, [state.message]);

  return (
    <form action={action} className={styles.form} onSubmit={(event) => prepareKey(event, keyRef)}>
      <input type="hidden" name="roomId" value={room.roomId} readOnly />
      <input type="hidden" name="idempotencyKey" defaultValue="" />
      <div className={styles.formHeading}>
        <div>
          <p className={styles.eyebrow}>Nueva operación</p>
          <h4>Preparar temporada</h4>
        </div>
        <span className={styles.helper}>Las fechas se guardan en UTC.</span>
      </div>
      <label className={styles.field}>
        <span>Título</span>
        <input name="title" minLength={3} maxLength={80} required placeholder="Liga de otoño" />
        {state.fieldErrors?.title ? (
          <small className={styles.error}>{state.fieldErrors.title}</small>
        ) : null}
      </label>
      <DateFields timeZone={room.timeZone} state={state} />
      <ReasonField state={state} />
      <ErrorMessage state={state} />
      <Button type="submit" loading={pending}>
        Guardar borrador
      </Button>
    </form>
  );
}

function DraftSeasonEditor({
  room,
  season,
}: {
  readonly room: SuperadminPortalRoom;
  readonly season: SuperadminPortalSeason;
}) {
  const [state, action, pending] = useActionState(updateSeasonDraft, initialState);
  const keyRef = useRef<string | null>(null);
  useEffect(() => {
    if (state.message) keyRef.current = null;
  }, [state.message]);

  return (
    <form action={action} className={styles.form} onSubmit={(event) => prepareKey(event, keyRef)}>
      <input type="hidden" name="seasonId" value={season.seasonId} readOnly />
      <input type="hidden" name="idempotencyKey" defaultValue="" />
      <div className={styles.formHeading}>
        <div>
          <p className={styles.eyebrow}>Editar borrador</p>
          <h4>{season.title}</h4>
        </div>
      </div>
      <label className={styles.field}>
        <span>Título</span>
        <input name="title" minLength={3} maxLength={80} defaultValue={season.title} required />
        {state.fieldErrors?.title ? (
          <small className={styles.error}>{state.fieldErrors.title}</small>
        ) : null}
      </label>
      <DateFields
        timeZone={room.timeZone}
        startsAt={season.startsAt}
        endsAt={season.endsAt}
        state={state}
      />
      <ReasonField state={state} />
      <ErrorMessage state={state} />
      <Button type="submit" loading={pending} variant="secondary">
        Guardar cambios
      </Button>
    </form>
  );
}

function ActivateSeasonForm({ season }: { readonly season: SuperadminPortalSeason }) {
  const [state, action, pending] = useActionState(activateSeason, initialState);
  const keyRef = useRef<string | null>(null);
  useEffect(() => {
    if (state.message) keyRef.current = null;
  }, [state.message]);

  function confirmActivation(event: FormEvent<HTMLFormElement>) {
    if (
      !window.confirm(`¿Activar «${season.title}»? La sala no podrá tener otra temporada activa.`)
    ) {
      event.preventDefault();
      return;
    }
    prepareKey(event, keyRef);
  }

  return (
    <form action={action} className={styles.activateForm} onSubmit={confirmActivation}>
      <input type="hidden" name="seasonId" value={season.seasonId} readOnly />
      <input type="hidden" name="idempotencyKey" defaultValue="" />
      <label className={styles.field}>
        <span>Motivo de activación</span>
        <textarea
          name="reason"
          maxLength={500}
          rows={2}
          required
          placeholder="Abrir la temporada"
        />
        {state.fieldErrors?.reason ? (
          <small className={styles.error}>{state.fieldErrors.reason}</small>
        ) : null}
      </label>
      <ErrorMessage state={state} />
      <Button type="submit" loading={pending}>
        Activar temporada
      </Button>
    </form>
  );
}

function SeasonCard({
  room,
  season,
}: {
  readonly room: SuperadminPortalRoom;
  readonly season: SuperadminPortalSeason;
}) {
  return (
    <Card as="article" surface="soft" className={styles.seasonCard}>
      <div className={styles.seasonTopline}>
        <div>
          <p className={styles.eyebrow}>Temporada</p>
          <h4>{season.title}</h4>
        </div>
        <Chip variant="status" tone={statusTone(season.status)}>
          {statusLabel(season.status)}
        </Chip>
      </div>
      <p className={styles.window}>
        {new Intl.DateTimeFormat("es-ES", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: room.timeZone,
        }).format(new Date(season.startsAt))}
        {" → "}
        {new Intl.DateTimeFormat("es-ES", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: room.timeZone,
        }).format(new Date(season.endsAt))}
      </p>
      {season.status === "draft" ? (
        <div className={styles.seasonActions}>
          <DraftSeasonEditor room={room} season={season} />
          <ActivateSeasonForm season={season} />
        </div>
      ) : null}
    </Card>
  );
}

export function SeasonManagement({ rooms }: { readonly rooms: readonly SuperadminPortalRoom[] }) {
  if (rooms.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby="season-management-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>S10 · operación privada</p>
          <h2 id="season-management-title">Temporadas</h2>
        </div>
        <Chip variant="data" tone="social">
          {rooms.reduce((count, room) => count + room.seasons.length, 0)} temporadas
        </Chip>
      </div>
      <div className={styles.roomSections}>
        {rooms.map((room) => (
          <Card
            as="section"
            key={room.roomId}
            className={styles.roomSection}
            aria-labelledby={`season-room-${room.roomId}`}
          >
            <div className={styles.roomHeading}>
              <div>
                <p className={styles.eyebrow}>
                  /{room.slug} · {room.timeZone}
                </p>
                <h3 id={`season-room-${room.roomId}`}>{room.title}</h3>
              </div>
              <Chip variant="data" tone="neutral">
                {room.seasons.length} {room.seasons.length === 1 ? "temporada" : "temporadas"}
              </Chip>
            </div>
            {room.seasons.length > 0 ? (
              <div className={styles.seasonList}>
                {room.seasons.map((season) => (
                  <SeasonCard key={season.seasonId} room={room} season={season} />
                ))}
              </div>
            ) : (
              <p className={styles.helper}>Todavía no hay temporadas preparadas.</p>
            )}
            <DraftSeasonForm room={room} />
          </Card>
        ))}
      </div>
    </section>
  );
}
