"use client";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import type {
  ProductEventInput,
  ProductEventType,
  ProductRating,
} from "@/types/contracts/product-measurement";
import { sendProductEvent } from "@/features/product/transport";
import { Button, Card, StarIcon } from "@/components/ui";
import { randomUuid } from "@/lib/randomUuid";
import styles from "./Measurement.module.css";
type Context = { roomId: string; publicationId?: string; attemptId?: string } & (
  { rehearsal: true; runId: string } | { rehearsal?: false; runId?: never }
);
type Observation = {
  key: string;
  sent: boolean;
  id: string;
  visit: string;
  input?: ProductEventInput;
};
const MeasurementContext = createContext<
  | (Context & {
      rehearsalEvents: RefObject<Map<string, Observation>>;
      setAttemptId: (id: string) => void;
    })
  | null
>(null);
export function MeasurementProvider({
  children,
  attemptId: initialAttemptId,
  ...context
}: Context & { children: ReactNode }) {
  const [attemptId, setAttemptId] = useState(initialAttemptId);
  const rehearsalEvents = useRef(new Map<string, Observation>());
  return (
    <MeasurementContext.Provider value={{ ...context, attemptId, setAttemptId, rehearsalEvents }}>
      {children}
    </MeasurementContext.Provider>
  );
}
export function useMeasurementAttempt(attemptId: string | undefined) {
  const setAttemptId = useContext(MeasurementContext)?.setAttemptId;
  useEffect(() => {
    if (attemptId) setAttemptId?.(attemptId);
  }, [attemptId, setAttemptId]);
}

export function useProductSignal(type: ProductEventType, enabled = true) {
  const context = useContext(MeasurementContext),
    event = useRef<Observation | null>(null);
  const room = context?.roomId,
    pub = context?.publicationId,
    run = context?.runId,
    rehearsal = context?.rehearsal,
    rehearsalEvents = context?.rehearsalEvents;
  const attemptId = type === "review_viewed" ? context?.attemptId : undefined;
  useEffect(() => {
    if (
      !room ||
      !enabled ||
      (type === "review_viewed" && !attemptId) ||
      (!rehearsal && type.startsWith("rehearsal_")) ||
      (rehearsal && !type.startsWith("rehearsal_"))
    )
      return;
    const key = JSON.stringify([room, pub, type, run, attemptId]);
    // The provider survives results/review remounts within the same execution.
    const saved = rehearsal ? rehearsalEvents?.current.get(key) : undefined;
    if (saved) event.current = saved;
    else if (event.current?.key !== key) {
      const observation: Observation = {
        key,
        sent: false,
        id: randomUuid(),
        visit: run ?? randomUuid(),
      };
      event.current = observation;
      if (rehearsal) rehearsalEvents?.current.set(key, observation);
    }
    const emit = () => {
      const current = event.current;
      if (
        !current ||
        current.sent ||
        (!type.startsWith("rehearsal_") && document.visibilityState !== "visible")
      )
        return;
      current.sent = true;
      current.input ??= {
        eventId: current.id,
        type,
        roomId: room!,
        ...(pub ? { publicationId: pub } : {}),
        ...(attemptId ? { attemptId } : {}),
        visitId: current.visit,
        occurredAt: new Date().toISOString(),
        appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0",
      };
      void sendProductEvent(current.input);
    };
    emit();
    document.addEventListener("visibilitychange", emit);
    return () => document.removeEventListener("visibilitychange", emit);
    // Context object identity changes during renders; scalar keys define the observation.
  }, [room, pub, run, type, enabled, rehearsal, rehearsalEvents, attemptId]);
}
export function ProductSignal({ type }: { type: ProductEventType }) {
  useProductSignal(type);
  return null;
}
export function EnjoymentRating() {
  const context = useContext(MeasurementContext);
  const attemptId = context?.attemptId;
  const pub = context?.rehearsal || !attemptId ? undefined : context?.publicationId;
  const [loaded, setLoaded] = useState<{
    pub: string;
    attemptId: string;
    rating: ProductRating | null;
  } | null>(null);
  useEffect(() => {
    let active = true;
    if (!pub || !attemptId) return;
    void fetch(`/api/product/ratings/${encodeURIComponent(pub)}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((value: ProductRating | null) => {
        if (active) setLoaded({ pub, attemptId, rating: value });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [pub, attemptId]);
  if (!pub || !attemptId || loaded?.pub !== pub || loaded.attemptId !== attemptId || !loaded.rating)
    return null;
  return (
    <OwnEnjoymentRating key={attemptId} pub={pub} attemptId={attemptId} initial={loaded.rating} />
  );
}
function OwnEnjoymentRating({
  pub,
  attemptId,
  initial,
}: {
  pub: string;
  attemptId: string;
  initial: ProductRating;
}) {
  const ratingId = useId();
  const [rating, setRating] = useState<ProductRating | null>(initial),
    [pending, setPending] = useState<{ id: string; value: number } | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  if (!pub || !rating || (!rating.eligible && rating.value === null)) return null;
  async function save(command: { id: string; value: number }) {
    setPending(command);
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/product/ratings/${encodeURIComponent(pub!)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...command,
          seasonId: initial.seasonId,
          attemptId,
        }),
      });
      if (!response.ok) throw new Error("rating_failed");
      const saved = (await response.json()) as ProductRating;
      setRating(saved);
      setPending(null);
      setMessage("Valoración guardada. Gracias.");
    } catch {
      setMessage("No se pudo guardar. Puedes reintentar o continuar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card as="section" className={styles.rating} aria-label="Valoración del desafío">
      <fieldset
        className={styles.fieldset}
        disabled={!rating.eligible}
        aria-busy={busy}
        aria-describedby={`${ratingId}-help`}
      >
        <legend className={styles.legend}>¿Cuánto has disfrutado este desafío?</legend>
        <p id={`${ratingId}-help`} className={styles.help}>
          Opcional · 1 = nada · 5 = muchísimo
        </p>
        <div className={styles.stars}>
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className={styles.option} data-filled={value <= (rating.value ?? 0)}>
              <input
                className={styles.input}
                type="radio"
                name={`${ratingId}-enjoyment`}
                value={value}
                checked={rating.value === value}
                aria-label={`${value} de 5 estrellas${value === 1 ? ": nada" : value === 5 ? ": muchísimo" : ""}`}
                aria-disabled={busy || undefined}
                onClick={(event) => {
                  if (busy) event.preventDefault();
                }}
                onKeyDown={(event) => {
                  // Keep focus during saving while preventing another native radio selection.
                  if (
                    busy &&
                    [" ", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
                  )
                    event.preventDefault();
                }}
                onChange={() => {
                  if (!busy && rating.value !== value) void save({ id: randomUuid(), value });
                }}
              />
              <span className={styles.starFace}>
                <StarIcon className={styles.starIcon} />
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <p role="status" className="sr-only">
        {busy ? "Guardando…" : message}
      </p>
      {pending && !busy ? (
        <Button type="button" variant="secondary" onClick={() => void save(pending)}>
          Reintentar valoración
        </Button>
      ) : null}
    </Card>
  );
}
