"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, BoltIcon, Card, Canvas } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { validateProfileName } from "@/lib/userProfile";
import styles from "./AuthPanel.module.css";

type AuthMode = "signIn" | "signUp";

export function AuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [nameError, setNameError] = useState("");
  const [isPending, startTransition] = useTransition();

  function toggleMode() {
    setMode((current) => (current === "signIn" ? "signUp" : "signIn"));
    setMessage("");
    setNameError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (mode === "signUp") {
      const validationError = validateProfileName(displayName);
      if (validationError) {
        setNameError(validationError);
        return;
      }
    }

    startTransition(() => {
      void authenticate();
    });
  }

  async function authenticate() {
    const supabase = createClient();
    const result =
      mode === "signIn"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { data: { display_name: displayName.trim() } },
          });

    if (result.error) {
      setMessage(
        mode === "signIn"
          ? "No se ha podido iniciar sesión. Revisa tus datos."
          : "No se ha podido crear la cuenta. Revisa los datos e inténtalo de nuevo.",
      );
      return;
    }

    if (!result.data.session) {
      setMessage("Cuenta creada. Revisa tu correo para confirmar el acceso.");
      return;
    }

    router.refresh();
  }

  const isSignUp = mode === "signUp";

  return (
    <Canvas className={styles.panel} contentClassName={styles.content}>
      <Card className={styles.card}>
        <div className={styles.brand} aria-label="Flash Pop">
          <span className={styles.brandMark}>
            <BoltIcon />
          </span>
          <span className={styles.brandName}>Flash Pop</span>
        </div>

        <div className={styles.heading}>
          <h1>{isSignUp ? "Crea tu cuenta" : "Entra a jugar"}</h1>
          <p>
            {isSignUp
              ? "Guarda tu perfil y prepárate para competir."
              : "Inicia sesión para acceder a tu perfil y tus salas."}
          </p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {isSignUp ? (
            <div className={styles.field}>
              <label htmlFor="auth-display-name">Nombre visible</label>
              <input
                id="auth-display-name"
                type="text"
                value={displayName}
                minLength={2}
                maxLength={24}
                autoComplete="name"
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? "auth-display-name-error" : undefined}
                onChange={(event) => {
                  setDisplayName(event.currentTarget.value);
                  if (nameError && !validateProfileName(event.currentTarget.value))
                    setNameError("");
                }}
                required
              />
              {nameError ? (
                <span id="auth-display-name-error" className={styles.error} role="alert">
                  {nameError}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className={styles.field}>
            <label htmlFor="auth-email">Correo electrónico</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              autoComplete="email"
              onChange={(event) => setEmail(event.currentTarget.value)}
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
              autoComplete={isSignUp ? "new-password" : "current-password"}
              onChange={(event) => setPassword(event.currentTarget.value)}
              required
            />
          </div>

          <Button type="submit" fullWidth loading={isPending}>
            {isSignUp ? "Crear cuenta" : "Iniciar sesión"}
          </Button>
          <p className={styles.message} role="status" aria-live="polite">
            {message}
          </p>
        </form>

        <div className={styles.switch}>
          <span>{isSignUp ? "¿Ya tienes cuenta?" : "¿Todavía no tienes cuenta?"}</span>
          <button type="button" onClick={toggleMode}>
            {isSignUp ? "Inicia sesión" : "Crea una cuenta"}
          </button>
        </div>
      </Card>
    </Canvas>
  );
}
