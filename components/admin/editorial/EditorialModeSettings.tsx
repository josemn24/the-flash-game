import { Button, FormField, Input, Select } from "@/components/ui";
import type { FlashEditorialDocument } from "@/types/view-models/editorial";
import styles from "../EditorialManagement.module.css";
export function EditorialModeSettings({
  fieldId,
  document: parsedDocument,
  onModeChange: updateMode,
  onLivesChange: updateLives,
  onGlobalDurationChange,
  onQuestionPointsChange,
  onQuestionMove,
  onQuestionDifficultyChange,
  libraryDifficulties,
}: {
  readonly onQuestionDifficultyChange?: (
    index: number,
    difficulty: "easy" | "medium" | "hard",
  ) => void;
  readonly libraryDifficulties?: Readonly<Record<string, "easy" | "medium" | "hard">>;
  readonly fieldId: string;
  readonly document: FlashEditorialDocument | null;
  readonly onModeChange: (mode: FlashEditorialDocument["challenge"]["mode"]) => void;
  readonly onLivesChange: (lives: number) => void;
  readonly onGlobalDurationChange?: (seconds: string) => void;
  readonly onQuestionPointsChange?: (index: number, points: number) => void;
  readonly onQuestionMove?: (index: number, offset: -1 | 1) => void;
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
            <option value="time-trial">Contrarreloj</option>
          </Select>
        )}
      </FormField>
      {parsedDocument.questions.map((question, index) => (
        <FormField
          key={index}
          id={`${fieldId}-difficulty-${index}`}
          label={`Dificultad de la pregunta ${index + 1}`}
          density="compact"
        >
          {(field) => (
            <Select
              {...field}
              disabled={"source" in question}
              value={
                "source" in question
                  ? (libraryDifficulties?.[question.questionVersionId] ?? "medium")
                  : (question.difficulty ?? "medium")
              }
              onChange={(e) =>
                onQuestionDifficultyChange?.(index, e.target.value as "easy" | "medium" | "hard")
              }
            >
              <option value="easy">Fácil</option>
              <option value="medium">Media</option>
              <option value="hard">Difícil</option>
            </Select>
          )}
        </FormField>
      ))}
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
      {parsedDocument.challenge.mode === "time-trial" ? (
        <>
          <FormField
            id={fieldId + "-duracion-global"}
            label="Duración global (segundos)"
            density="compact"
          >
            {(field) => (
              <Input
                {...field}
                aria-label="Duración global (segundos)"
                type="number"
                min={1}
                max={2147483}
                step={1}
                value={
                  parsedDocument.challenge.globalTimeLimitMs === undefined
                    ? ""
                    : parsedDocument.challenge.globalTimeLimitMs / 1000
                }
                onChange={(event) => onGlobalDurationChange?.(event.currentTarget.value)}
              />
            )}
          </FormField>
          <p className={styles.helper}>
            Entre 2 y 20 pruebas de un mismo formato: Queens o Conectar parejas con tableros
            cuadrados de 4×4 a 8×8; en Conectar parejas puedes mezclar tamaños y usar entre tres
            parejas y tantas como filas. Ordena las pruebas por dificultad creciente. Puedes rehacer
            caminos sin penalización; en Queens el tercer error termina el desafío. Los tiempos
            individuales no se aplican. Los pesos deben ser enteros positivos y sumar exactamente
            100; guardar y reordenar conservan los pesos.
          </p>
          {parsedDocument.questions.map((question, index) => (
            <div key={"source" in question ? question.questionVersionId : question.slug}>
              <FormField
                id={`${fieldId}-puntos-${index}`}
                label={`Puntos de la prueba ${index + 1}`}
                density="compact"
              >
                {(field) => (
                  <Input
                    {...field}
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    value={question.points}
                    onChange={(event) => {
                      const value = Number(event.currentTarget.value);
                      if (Number.isSafeInteger(value) && value > 0 && value <= 100)
                        onQuestionPointsChange?.(index, value);
                    }}
                  />
                )}
              </FormField>
              <Button
                type="button"
                variant="secondary"
                disabled={index === 0}
                onClick={() => onQuestionMove?.(index, -1)}
              >
                Subir prueba {index + 1}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={index === parsedDocument.questions.length - 1}
                onClick={() => onQuestionMove?.(index, 1)}
              >
                Bajar prueba {index + 1}
              </Button>
            </div>
          ))}
          <p className={styles.helper}>
            Antes de publicar, resuelve la secuencia completa en móvil y escritorio para verificar
            soluciones, pistas, progresión y duración.
          </p>
        </>
      ) : null}
    </div>
  );
}
