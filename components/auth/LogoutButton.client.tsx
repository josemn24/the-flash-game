"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    setMessage("");
    startTransition(() => {
      void (async () => {
        const supabase = createClient();
        const { error } = await supabase.auth.signOut();
        if (error) {
          setMessage("No se ha podido cerrar la sesión.");
          return;
        }
        window.location.assign("/");
      })();
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
