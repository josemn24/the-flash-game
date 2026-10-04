"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, BoltIcon, Card, Canvas } from "@/components/ui";
import { signIn } from "@/app/actions/authentication";
import type { AuthenticationFailureCode } from "@/types/contracts/authentication";
import styles from "./AuthPanel.module.css";

type LoginState =
  | { status: "idle" | "authenticating" | "authenticated" }
  | { status: "error"; message: string; invalidCredentials: boolean };

function loginErrorState(code: AuthenticationFailureCode): LoginState {
  const messages: Record<AuthenticationFailureCode, string> = {
    credentials: "Correo o contraseña incorrectos. Revisa tus datos.",
    rate_limit: "Demasiados intentos. Espera un momento y vuelve a intentarlo.",
    service: "El servicio no está disponible ahora. Inténtalo de nuevo.",
    connection: "No hemos podido conectar. Comprueba tu conexión y vuelve a intentarlo.",
    unexpected: "No se ha podido iniciar sesión. Inténtalo de nuevo.",
  };
  return { status: "error", message: messages[code], invalidCredentials: code === "credentials" };
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
        const result = await signIn({ email, password });

        if (!result.ok) {
          setState(loginErrorState(result.code));
          return;
        }

        setState({ status: "authenticated" });
        startTransition(() => router.refresh());
      } catch {
        setState(loginErrorState("unexpected"));
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
