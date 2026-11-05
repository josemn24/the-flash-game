"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { updateRehearsalPolicy, previewRehearsal } from "@/app/admin/rehearsal-actions";
import { Button, Card, FormField, Input, Select, Textarea } from "@/components/ui";
import type {
  RehearsalCoverage,
  RehearsalPolicy,
  GeneratedRehearsal,
  RehearsalRecipe,
} from "@/types/gameplay/rehearsal";
import { RehearsalGameApp } from "@/components/game/shells/RehearsalGameApp.client";
import { QUESTION_FORMAT_LABELS } from "@/lib/questionFormat";
import styles from "./RehearsalManagement.module.css";
import { randomUuid } from "@/lib/randomUuid";
export type RehearsalEditorModel = {
  challengeVersionId: string;
  status: string;
  coverage: RehearsalCoverage;
  publications: readonly RehearsalPolicy[];
  versionNumber: number;
};
const difficulty = { easy: "Fácil", medium: "Media", hard: "Difícil" };
export function RehearsalManagement({ versions }: { versions: readonly RehearsalEditorModel[] }) {
  return (
    <section aria-label="Pruebas del desafío">
      <h2>Pruebas sin competir</h2>
      <p>Se generan automáticamente a partir del banco. La dificultad es orientativa.</p>
      {versions.map((v) => (
        <Card as="article" key={v.challengeVersionId}>
          <h3>Prueba de la versión {v.versionNumber}</h3>
          <p>{v.coverage.ready ? "Cobertura disponible" : "Faltan preguntas compatibles"}</p>
          {v.coverage.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
          <ul>
            {v.coverage.slots.map((s) => (
              <li key={s.position}>
                Posición {s.position}: {QUESTION_FORMAT_LABELS[s.type]} · {difficulty[s.difficulty]}{" "}
                {s.alphabetLetter && ` · Letra ${s.alphabetLetter}`}· {s.candidateCount} candidatos,{" "}
                {s.independentCandidateCount} familias (Fácil: {s.difficulties.easy}, Media:{" "}
                {s.difficulties.medium}, Difícil: {s.difficulties.hard})
                {s.warnings.map((w) => (
                  <p key={w}>{w}</p>
                ))}
              </li>
            ))}
          </ul>
          <Link href={`/admin/rehearsals/${v.challengeVersionId}`} prefetch={false}>
            Generar vista previa
          </Link>
          {v.publications.map((p) => (
            <Policy key={`${p.publicationId}:${p.updatedAt}`} policy={p} />
          ))}
        </Card>
      ))}
    </section>
  );
}
function Policy({ policy }: { policy: RehearsalPolicy }) {
  const [state, action, pending] = useActionState(updateRehearsalPolicy, {});
  const [commandKey] = useState(randomUuid);
  return (
    <form action={action}>
      <p>{policy.label ?? "Publicación"}</p>
      <input type="hidden" name="publicationId" value={policy.publicationId} />
      <input type="hidden" name="expectedUpdatedAt" value={policy.updatedAt ?? ""} />
      <input type="hidden" name="idempotencyKey" value={commandKey} />
      <FormField id={`${policy.publicationId}-enabled`} label="Pruebas habilitadas">
        {(field) => (
          <Select
            {...field}
            name="enabled"
            defaultValue={String(policy.enabled)}
            disabled={pending}
          >
            <option value="true">Sí</option>
            <option value="false">No</option>
          </Select>
        )}
      </FormField>
      <FormField id={`${policy.publicationId}-reason`} label="Motivo">
        {(field) => <Input {...field} name="reason" required maxLength={500} disabled={pending} />}
      </FormField>
      <Button type="submit" loading={pending}>
        Guardar disponibilidad
      </Button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.message && <p role="status">{state.message}</p>}
    </form>
  );
}
export function RehearsalPreviewClient({
  versionId,
  initial,
}: {
  versionId: string;
  initial: GeneratedRehearsal | null;
}) {
  const [run, setRun] = useState(initial),
    [seed, setSeed] = useState(""),
    [recipe, setRecipe] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function generate(replay = false) {
    setBusy(true);
    setError("");
    try {
      const next = await previewRehearsal(
        versionId,
        replay ? { recipe: JSON.parse(recipe) as RehearsalRecipe } : seed ? { seed } : {},
      );
      if ("error" in next) setError(next.error ?? "No se pudo generar la prueba.");
      else setRun(next.run);
    } catch {
      setError(
        "No se pudo generar o reproducir la prueba. Comprueba la semilla, la receta y la cobertura.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Card>
        <h1>Vista previa de prueba</h1>
        <FormField id="preview-seed" label="Semilla (opcional)">
          {(field) => (
            <Input
              {...field}
              value={seed}
              maxLength={128}
              onChange={(e) => setSeed(e.target.value)}
            />
          )}
        </FormField>
        <Button disabled={busy} onClick={() => void generate()}>
          Generar combinación
        </Button>
        <FormField id="preview-recipe" label="Receta para reproducir">
          {(field) => (
            <Textarea
              {...field}
              value={recipe}
              onChange={(e) => setRecipe(e.target.value)}
              rows={4}
            />
          )}
        </FormField>
        <Button disabled={busy || !recipe} onClick={() => void generate(true)}>
          Reproducir receta
        </Button>
        {error && <p role="alert">{error}</p>}
        {run && run.difficultyFallbacks.length > 0 && (
          <section aria-label="Ajustes de dificultad">
            <h2>Dificultades ajustadas</h2>
            <ul>
              {run.difficultyFallbacks.map((fallback) => (
                <li key={fallback.position}>
                  Posición {fallback.position}: solicitada {difficulty[fallback.requested]},
                  seleccionada {difficulty[fallback.selected]}.
                </li>
              ))}
            </ul>
          </section>
        )}
        {run && (
          <details>
            <summary>Receta generada</summary>
            <pre className={styles.recipe}>{JSON.stringify(run.recipe, null, 2)}</pre>
          </details>
        )}
      </Card>
      {run && (
        <RehearsalGameApp
          definition={run.definition}
          recipe={run.recipe}
          returnTo="/admin/challenges"
        />
      )}
    </>
  );
}
