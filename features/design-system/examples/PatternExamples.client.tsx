"use client";
import { useState, type FormEvent } from "react";
import { Button, Card } from "@/components/ui";
import { AdminFormError } from "@/components/admin/AdminFormError";
import { AdminNotice } from "@/components/admin/AdminNotice";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import {
  ServerOperationStatus,
  type ServerOperationState,
} from "@/components/questions/shared/ServerOperationStatus";
import { FlashPopFeedback } from "@/components/game/modes/flash-pop/FlashPopFeedback";
import { RoomLeaderboard } from "@/components/game/modes/flash-pop/RoomLeaderboard";
import { ReviewAnswerPanel } from "@/components/game/shared/ReviewAnswerPanel";
import { RoomRankingSkeleton, RoomDetailSkeleton } from "@/components/loading";
import type { AnswerStatus } from "@/types/gameplay";
import adminStyles from "@/components/admin/SuperadminUserCreation.module.css";
import { leaderboardEntries, reviewEntries } from "./fixtures";
import { ExampleControls } from "../ExampleControls.client";
import styles from "../Catalog.module.css";

export function FormsExample() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "invalid" | "submitting" | "error" | "success">(
    "idle",
  );
  const error = state === "invalid" ? "Introduce una dirección de correo válida." : undefined;
  const reset = () => {
    setEmail("");
    setState("idle");
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "submitting" : "invalid");
  };
  return (
    <div className={styles.demo} data-example="formularios">
      <p className={styles.caption}>
        Patrón existente: campos nativos y CSS administrativo. No hay una primitiva compartida de
        campo.
      </p>
      <form className={adminStyles.form} noValidate onSubmit={submit}>
        <div className={adminStyles.field}>
          <label htmlFor="catalog-email">Correo electrónico de ejemplo</label>
          <input
            id="catalog-email"
            type="email"
            value={email}
            placeholder="ana@example.com"
            disabled={state === "submitting"}
            aria-invalid={Boolean(error)}
            aria-describedby={`catalog-email-help${error ? " catalog-email-error" : ""}`}
            onChange={(event) => {
              setEmail(event.currentTarget.value);
              if (state !== "idle") setState("idle");
            }}
          />
          <small id="catalog-email-help">Solo se valida dentro de esta demo.</small>
          {error ? (
            <div id="catalog-email-error">
              <AdminFormError message={error} />
            </div>
          ) : null}
        </div>
        <Button type="submit" loading={state === "submitting"}>
          Guardar correo de ejemplo
        </Button>
      </form>
      {state === "submitting" ? (
        <div className={styles.row}>
          <Button variant="secondary" onClick={() => setState("error")}>
            Simular error de envío
          </Button>
          <Button onClick={() => setState("success")}>Completar envío</Button>
        </div>
      ) : null}
      <ServerOperationStatus
        state={state === "error" ? "error" : state === "submitting" ? "submitting" : "idle"}
        visible
        pendingMessage="Guardando el ejemplo…"
        errorMessage="Error simulado. Puedes reintentar."
        retryLabel="Reintentar envío"
        onRetry={() => setState("submitting")}
      />
      {state === "success" ? (
        <AdminNotice
          title="Correo de ejemplo guardado"
          description="El estado solo existe en esta página."
        />
      ) : null}
      <Button variant="secondary" size="sm" onClick={reset}>
        Reiniciar formulario
      </Button>
    </div>
  );
}

export function FeedbackExample() {
  const [view, setView] = useState("resultado");
  const [status, setStatus] = useState<AnswerStatus>("correct");
  const [inline, setInline] = useState(false);
  const [operation, setOperation] = useState<ServerOperationState>("submitting");
  const copy: Record<AnswerStatus, string> = {
    correct: "Respuesta correcta",
    partial: "Aproximación válida",
    incorrect: "Respuesta fallada",
    unanswered: "Tiempo agotado",
  };
  const reset = () => {
    setView("resultado");
    setStatus("correct");
    setInline(false);
    setOperation("submitting");
  };
  return (
    <div className={styles.previewSurface} data-example="feedback">
      <ExampleControls id="feedback">
        <div className={styles.previewToolbar}>
          <label className={styles.controlLabel}>
            Tipo de feedback
            <select
              className={styles.select}
              value={view}
              onChange={(event) => setView(event.currentTarget.value)}
            >
              <option value="resultado">Resultado del juego</option>
              <option value="operacion">Operación y reintento</option>
              <option value="aviso">Aviso administrativo</option>
            </select>
          </label>
          {view === "resultado" ? (
            <>
              <label className={styles.controlLabel}>
                Estado de respuesta
                <select
                  className={styles.select}
                  value={status}
                  onChange={(event) => setStatus(event.currentTarget.value as AnswerStatus)}
                >
                  {Object.entries(copy).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={inline}
                  onChange={(event) => setInline(event.currentTarget.checked)}
                />{" "}
                Inline
              </label>
            </>
          ) : null}
          <Button variant="secondary" size="sm" onClick={reset}>
            Reiniciar feedback
          </Button>
        </div>
      </ExampleControls>
      {view === "resultado" ? (
        <div>
          <FlashPopFeedback
            key={`${status}-${inline}`}
            status={status}
            variant={inline ? "inline" : "default"}
            eyebrow="Resultado de ejemplo"
            title={copy[status]}
            body="El siguiente paso se decide en esta demo."
            points={status === "correct" ? 100 : status === "partial" ? 50 : 0}
          />
        </div>
      ) : (
        <div className={styles.previewBody}>
          {view === "operacion" ? (
            <>
              <ServerOperationStatus
                state={operation}
                visible
                pendingMessage="Enviando el ejemplo…"
                errorMessage="La operación simulada ha fallado."
                retryLabel="Reintentar operación"
                onRetry={() => setOperation("submitting")}
              />
              <div className={styles.row}>
                <Button onClick={() => setOperation("error")}>Simular error</Button>
                <Button variant="secondary" onClick={() => setOperation("idle")}>
                  Completar operación
                </Button>
              </div>
              <p className={styles.result} role="status">
                {operation === "idle"
                  ? "Operación de ejemplo completada."
                  : "Operación local en curso."}
              </p>
            </>
          ) : (
            <>
              <AdminNotice
                title="Cambios de ejemplo guardados"
                description="Aviso administrativo existente."
              />
              <AdminFormError message="Ejemplo de error de formulario." />
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function RankingsExample() {
  const [variant, setVariant] = useState<"rows" | "cards">("rows");
  const [empty, setEmpty] = useState(false);
  const [selected, setSelected] = useState("");
  const reset = () => {
    setVariant("rows");
    setEmpty(false);
    setSelected("");
  };
  return (
    <div className={styles.previewBody} data-example="rankings">
      <div className={styles.row}>
        <label className={styles.controlLabel}>
          Presentación del ranking
          <select
            className={styles.select}
            value={variant}
            onChange={(event) => {
              setVariant(event.currentTarget.value as typeof variant);
              setSelected("");
            }}
          >
            <option value="rows">Filas</option>
            <option value="cards">Tarjetas</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={empty}
            onChange={(event) => setEmpty(event.currentTarget.checked)}
          />{" "}
          Lista vacía
        </label>
        <Button variant="secondary" size="sm" onClick={reset}>
          Reiniciar ranking
        </Button>
      </div>
      <RoomLeaderboard
        key={`${variant}-${empty}`}
        title="Clasificación de ejemplo"
        description="Ana es el usuario actual. Datos ficticios."
        headingLevel="h1"
        entries={empty ? [] : leaderboardEntries}
        currentUserId="ana"
        variant={variant}
        pendingCount={2}
        emptyMessage="Todavía no hay participantes en esta demo."
        onEntrySelect={(entry) => setSelected(entry.name)}
      />
      <p className={styles.result} role="status">
        {selected ? `Último detalle abierto: ${selected}.` : "Sin participante seleccionado."}
      </p>
    </div>
  );
}

export function ReviewExample() {
  const [cycle, setCycle] = useState(0);
  const [message, setMessage] = useState("Historial de ejemplo preparado.");
  return (
    <div className={styles.previewBody} data-example="revision">
      <ReviewAnswerPanel
        key={cycle}
        entries={reviewEntries}
        countLabel="5 respuestas"
        initialOpenId="correcta"
        onBack={() => setMessage("Has vuelto al resultado de ejemplo.")}
        onReplay={() => {
          setCycle((value) => value + 1);
          setMessage("Historial reiniciado.");
        }}
        replayLabel="Reiniciar revisión"
      />
      <p className={styles.result} role="status">
        {message}
      </p>
    </div>
  );
}

export function LoadingExample() {
  const [view, setView] = useState("ranking");
  return (
    <div className={styles.previewSurface} data-example="carga-vacio">
      <ExampleControls id="carga-vacio">
        <div className={styles.previewToolbar}>
          <label className={styles.controlLabel}>
            Estado del contenido
            <select
              className={styles.select}
              value={view}
              onChange={(event) => setView(event.currentTarget.value)}
            >
              <option value="ranking">Cargando ranking</option>
              <option value="detalle">Cargando detalle</option>
              <option value="vacio">Sin datos</option>
              <option value="contenido">Contenido disponible</option>
            </select>
          </label>
          <Button variant="secondary" size="sm" onClick={() => setView("ranking")}>
            Reiniciar estado
          </Button>
        </div>
      </ExampleControls>
      {view === "ranking" ? (
        <RoomRankingSkeleton />
      ) : view === "detalle" ? (
        <RoomDetailSkeleton />
      ) : (
        <div className={styles.previewBody}>
          <h1>{view === "vacio" ? "Estado vacío" : "Contenido disponible"}</h1>
          {view === "vacio" ? (
            <AdminEmptyState>Todavía no hay datos en este ejemplo.</AdminEmptyState>
          ) : (
            <Card>
              <p role="status">Contenido de ejemplo cargado.</p>
              <p>La transición es local y no solicita datos.</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
