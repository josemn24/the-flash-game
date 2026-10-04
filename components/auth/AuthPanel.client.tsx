"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { isAuthError, isAuthRetryableFetchError } from "@supabase/supabase-js";
import { Button, BoltIcon, Card, Canvas } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import styles from "./AuthPanel.module.css";

type LoginState =
  | { status: "idle" | "authenticating" | "authenticated" }
  | { status: "error"; message: string; invalidCredentials: boolean };

function loginErrorState(error: unknown): LoginState {
  let message = "No se ha podido iniciar sesión. Inténtalo de nuevo.";
  let invalidCredentials = false;

  if (isAuthError(error)) {
    if (error.code === "invalid_credentials") {
      message = "Correo o contraseña incorrectos. Revisa tus datos.";
      invalidCredentials = true;
    } else if (error.status === 429 || error.code === "over_request_rate_limit") {
      message = "Demasiados intentos. Espera un momento y vuelve a intentarlo.";
    } else if (
      (error.status !== undefined && error.status >= 500 && error.status < 600) ||
      error.code === "request_timeout"
    ) {
      message = "El servicio no está disponible ahora. Inténtalo de nuevo.";
    } else if (isAuthRetryableFetchError(error)) {
      message = "No hemos podido conectar. Comprueba tu conexión y vuelve a intentarlo.";
    }
  }

  return { status: "error", message, invalidCredentials };
}

export function AuthPanel() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<LoginState>({ status: "idle" });
  const [isPending, startTransition] = useTransition();
  const submissionInFlight = useRef(false);

  useEffect(() => {
    // A fast transition may finish without committing a pending render.
    if (!isPending) submissionInFlight.current = false;
  }, [isPending, state]);

  const authenticated = state.status === "authenticated";
  const invalidCredentials = state.status === "error" && state.invalidCredentials;
  const progressMessage = isPending ? (authenticated ? "Entrando…" : "Iniciando sesión…") : "";
  const errorMessage =
    state.status === "error"
      ? state.message
      : authenticated && !isPending
        ? "No hemos podido abrir tu sesión. Reintenta la entrada."
        : "";

  function clearError() {
    if (state.status === "error") setState({ status: "idle" });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionInFlight.current || isPending) return;
    submissionInFlight.current = true;

    if (authenticated) {
      setState({ status: "authenticated" });
      startTransition(() => router.refresh());
      return;
    }

    setState({ status: "authenticating" });
    startTransition(async () => {
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          setState(loginErrorState(error));
          return;
        }

        setState({ status: "authenticated" });
        startTransition(() => router.refresh());
      } catch (error) {
        setState(loginErrorState(error));
      }
    });
  }

  return (
    <Canvas className={styles.panel} contentClassName={styles.content}>
      <Card className={styles.card}>
        <div className={styles.brand} aria-label="The Flash">
          <span className={styles.brandMark}>
            <BoltIcon />
          </span>
          <span className={styles.brandName}>The Flash</span>
        </div>

        <div className={styles.heading}>
          <h1>Entra a jugar</h1>
          <p>Inicia sesión para acceder a tu perfil y tus salas.</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} aria-busy={isPending}>
          <div className={styles.field}>
            <label htmlFor="auth-email">Correo electrónico</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              autoComplete="email"
              disabled={isPending || authenticated}
              aria-invalid={invalidCredentials || undefined}
              aria-describedby={invalidCredentials ? "auth-error" : undefined}
              onChange={(event) => {
                setEmail(event.currentTarget.value);
                clearError();
              }}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="auth-password">Contraseña</label>
            <input
              id="auth-password"
              type="password"
              value={password}
              minLength={6}
              autoComplete="current-password"
              disabled={isPending || authenticated}
              aria-invalid={invalidCredentials || undefined}
              aria-describedby={invalidCredentials ? "auth-error" : undefined}
              onChange={(event) => {
                setPassword(event.currentTarget.value);
                clearError();
              }}
              required
            />
          </div>

          <Button type="submit" fullWidth loading={isPending}>
            {progressMessage || (authenticated ? "Reintentar entrada" : "Iniciar sesión")}
          </Button>
        </form>
        <div className={styles.feedback}>
          <p className="sr-only" role="status" aria-live="polite">
            {progressMessage}
          </p>
          <p id="auth-error" className={styles.error} role="alert">
            {errorMessage}
          </p>
        </div>
      </Card>
    </Canvas>
  );
}
