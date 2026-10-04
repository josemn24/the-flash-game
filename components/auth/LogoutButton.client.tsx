"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { signOut } from "@/app/actions/authentication";

export function LogoutButton() {
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    setMessage("");
    startTransition(async () => {
      try {
        const result = await signOut();
        if (!result.ok) {
          setMessage("No se ha podido cerrar la sesión.");
          return;
        }
        window.location.assign("/");
      } catch {
        setMessage("No se ha podido cerrar la sesión.");
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        loading={isPending}
        onClick={handleLogout}
      >
        Salir
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {message}
      </span>
    </>
  );
}
