"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, BoltIcon, Card, Canvas } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import styles from "./AuthPanel.module.css";

export function AuthPanel() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    startTransition(() => {
      void authenticate();
    });
  }

  async function authenticate() {
    const supabase = createClient();
    const result = await supabase.auth.signInWithPassword({ email, password });

    if (result.error) {
      setMessage("No se ha podido iniciar sesión. Revisa tus datos.");
      return;
    }

    router.refresh();
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

        <form className={styles.form} onSubmit={handleSubmit}>
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
              autoComplete="current-password"
              onChange={(event) => setPassword(event.currentTarget.value)}
              required
            />
          </div>

          <Button type="submit" fullWidth loading={isPending}>
            Iniciar sesión
          </Button>
          <p className={styles.message} role="status" aria-live="polite">
            {message}
          </p>
        </form>
      </Card>
    </Canvas>
  );
}
