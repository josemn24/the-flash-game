"use client";

import { randomUuid } from "@/lib/randomUuid";

import {
  useId,
  useActionState,
  useEffect,
  useRef,
  type FormEvent,
  type MutableRefObject,
} from "react";

import { FormField, Input, Textarea, Button, Card, Chip } from "@/components/ui";

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
function newKey() {
  return randomUuid();
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

export function SeasonDateFields({
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
  const fieldId = useId();
  return (
    <div className={styles.dateGrid}>
      {(
        [
          ["startsAtLocal", "Inicio", startsAt],
          ["endsAtLocal", "Fin", endsAt],
        ] as const
      ).map(([name, label, value]) => (
        <FormField
          id={fieldId + "-" + name}
          label={
            <>
              {label} · {timeZone}
            </>
          }
          density="compact"
          required
          key={name}
          error={state.fieldErrors?.[name]}
        >
          {(field) => (
            <Input
              {...field}
              name={name}
              type="datetime-local"
              defaultValue={value ? utcToLocalDateTime(value, timeZone) : undefined}
            />
          )}
        </FormField>
      ))}
    </div>
  );
}
function ReasonField({
  state,
  label = "Motivo de auditoría",
  placeholder = "Preparar temporada de la beta",
}: {
  readonly state: SeasonActionState;
  readonly label?: string;
  readonly placeholder?: string;
}) {
  const fieldId = useId();
  return (
    <FormField
      id={fieldId + "-reason"}
      label={label}
      density="compact"
      required
      error={state.fieldErrors?.reason}
    >
      {(field) => (
        <Textarea {...field} name="reason" maxLength={500} rows={2} placeholder={placeholder} />
      )}
    </FormField>
  );
}

export function DraftSeasonForm({ room }: { readonly room: SuperadminPortalRoom }) {
  const fieldId = useId();
  const [state, action, pending] = useActionState(createSeasonDraft, initialState);
  const keyRef = useRef<string | null>(null);
  useEffect(() => {
    if (state.message) keyRef.current = null;
  }, [state.message]);
  return (
    <form
      action={action}
      className={styles.form}
      onSubmit={(event) => prepareKey(event, keyRef)}
      aria-busy={pending}
    >
      <input type="hidden" name="roomId" value={room.roomId} readOnly />
      <input type="hidden" name="idempotencyKey" defaultValue="" />
      <div className={styles.formHeading}>
        <div>
          <p className={styles.eyebrow}>Nueva operación</p>
          <h4>Preparar temporada</h4>
        </div>
        <span className={styles.helper}>Las fechas se guardan en UTC.</span>
      </div>
      <FormField
        id={fieldId + "-title"}
        label="Título"
        density="compact"
        required
        error={state.fieldErrors?.title}
      >
        {(field) => (
          <Input {...field} name="title" minLength={3} maxLength={80} placeholder="Liga de otoño" />
        )}
      </FormField>
      <SeasonDateFields timeZone={room.timeZone} state={state} />
      <ReasonField state={state} />
      <ErrorMessage state={state} />
      <Button type="submit" loading={pending}>
        Guardar borrador
      </Button>
    </form>
  );
}

export function DraftSeasonEditor({
  room,
  season,
}: {
  readonly room: SuperadminPortalRoom;
  readonly season: SuperadminPortalSeason;
}) {
  const fieldId = useId();
  const [state, action, pending] = useActionState(updateSeasonDraft, initialState);
  const keyRef = useRef<string | null>(null);
  useEffect(() => {
    if (state.message) keyRef.current = null;
  }, [state.message]);
  return (
    <form
      action={action}
      className={styles.form}
      onSubmit={(event) => prepareKey(event, keyRef)}
      aria-busy={pending}
    >
      <input type="hidden" name="seasonId" value={season.seasonId} readOnly />
      <input type="hidden" name="idempotencyKey" defaultValue="" />
      <div className={styles.formHeading}>
        <div>
          <p className={styles.eyebrow}>Editar borrador</p>
          <h4>{season.title}</h4>
        </div>
      </div>
      <FormField
        id={fieldId + "-title"}
        label="Título"
        density="compact"
        required
        error={state.fieldErrors?.title}
      >
        {(field) => (
          <Input {...field} name="title" minLength={3} maxLength={80} defaultValue={season.title} />
        )}
      </FormField>
      <SeasonDateFields
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

export function ActivateSeasonForm({ season }: { readonly season: SuperadminPortalSeason }) {
  const fieldId = useId();
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
    <form
      action={action}
      className={styles.activateForm}
      onSubmit={confirmActivation}
      aria-busy={pending}
    >
      <input type="hidden" name="seasonId" value={season.seasonId} readOnly />
      <input type="hidden" name="idempotencyKey" defaultValue="" />
      <FormField
        id={fieldId + "-reason"}
        label="Motivo de activación"
        density="compact"
        required
        error={state.fieldErrors?.reason}
      >
        {(field) => (
          <Textarea
            {...field}
            name="reason"
            maxLength={500}
            rows={2}
            placeholder="Abrir la temporada"
          />
        )}
      </FormField>
      <ErrorMessage state={state} />
      <Button type="submit" loading={pending}>
        Activar temporada
      </Button>
    </form>
  );
}

function statusLabel(status: SeasonStatus) {
  return (
    {
      draft: "Borrador",
      active: "Activa",
      scheduled: "Programada",
      finished: "Finalizada",
      cancelled: "Cancelada",
    } satisfies Record<SeasonStatus, string>
  )[status];
}
function statusTone(status: SeasonStatus) {
  return status === "active"
    ? ("success" as const)
    : status === "cancelled"
      ? ("danger" as const)
      : status === "draft"
        ? ("info" as const)
        : ("neutral" as const);
}
export function SeasonCard({
  room,
  season,
}: {
  readonly room: SuperadminPortalRoom;
  readonly season: SuperadminPortalSeason;
}) {
  const format = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: room.timeZone,
  });
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
        {format.format(new Date(season.startsAt))}
        {" → "}
        {format.format(new Date(season.endsAt))}
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
