import { FormField, Input, Select } from "@/components/ui";
import type { FlashEditorialDocument } from "@/types/view-models/editorial";
import styles from "../EditorialManagement.module.css";
export function EditorialModeSettings({
  fieldId,
  document: parsedDocument,
  onModeChange: updateMode,
  onLivesChange: updateLives,
}: {
  readonly fieldId: string;
  readonly document: FlashEditorialDocument | null;
  readonly onModeChange: (mode: FlashEditorialDocument["challenge"]["mode"]) => void;
  readonly onLivesChange: (lives: number) => void;
}) {
  if (!parsedDocument) return null;
  return (
    <div className={styles.draftSelector}>
      <FormField id={fieldId + "-modo-del-desafio"} label="Modo del desafío" density="compact">
        {(field) => (
          <Select
            {...field}
            aria-label="Modo del desafío"
            value={parsedDocument.challenge.mode}
            onChange={(event) =>
              updateMode(event.target.value as FlashEditorialDocument["challenge"]["mode"])
            }
          >
            <option value="flash">Flash</option>
            <option value="alphabet">Alphabet</option>
            <option value="survival">Supervivencia</option>
            {parsedDocument.challenge.mode === "narrative" ? (
              <option value="narrative">Narrativa</option>
            ) : null}
            <option value="pyramid">La Pirámide</option>
          </Select>
        )}
      </FormField>
      {parsedDocument.challenge.mode === "survival" ? (
        <FormField
          id={fieldId + "-document-0"}
          label={<>Vidas iniciales (1– {parsedDocument.questions.length} )</>}
          density="compact"
        >
          {(field) => (
            <Input
              {...field}
              aria-label="Vidas iniciales"
              type="number"
              min={1}
              max={parsedDocument.questions.length}
              step={1}
              value={parsedDocument.challenge.modeConfig.lives as number}
              onChange={(event) => updateLives(Number(event.currentTarget.value))}
            />
          )}
        </FormField>
      ) : null}
      {parsedDocument.challenge.mode === "pyramid" ? (
        <p className={styles.helper}>
          Configura siete niveles, con una pregunta de biblioteca compatible por nivel, briefings y
          100 puntos en total. Admite los formatos competitivos evaluados por servidor, incluidos
          Verdadero/Falso, Ordenar, Clasificar, Matriz lógica, Zip, Escape y Hashtag de palabras.
          Solo una respuesta completamente correcta abre el nivel siguiente y acredita sus puntos.
        </p>
      ) : null}
    </div>
  );
}
