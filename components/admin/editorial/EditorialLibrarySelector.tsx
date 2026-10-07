import { Button, FormField, Select } from "@/components/ui";
import type { SuperadminQuestionLibraryEntry } from "@/types/view-models/editorial";
import Link from "next/link";
import styles from "../EditorialManagement.module.css";
export function EditorialLibrarySelector({
  fieldId,
  entries: publishedLibraryEntries,
  selectedId: libraryQuestionId,
  onSelect: setLibraryQuestionId,
  replaceIndex,
  onReplaceIndex: setReplaceIndex,
  questionCount,
  onUseVersion: selectLibraryQuestion,
}: {
  readonly fieldId: string;
  readonly entries: readonly SuperadminQuestionLibraryEntry[];
  readonly selectedId: string;
  readonly onSelect: (id: string) => void;
  readonly replaceIndex: string;
  readonly onReplaceIndex: (index: string) => void;
  readonly questionCount: number;
  readonly onUseVersion: () => void;
}) {
  if (!publishedLibraryEntries.length) return null;
  return (
    <>
      <div className={styles.draftSelector}>
        <FormField
          id={fieldId + "-version-publicada-de-biblioteca"}
          label="Versión publicada de biblioteca"
          density="compact"
        >
          {(field) => (
            <Select
              {...field}
              value={libraryQuestionId}
              onChange={(event) => setLibraryQuestionId(event.target.value)}
            >
              {publishedLibraryEntries.map((entry) => (
                <option key={entry.questionVersionId} value={entry.questionVersionId}>
                  {entry.slug} · v{entry.versionNumber} · {entry.type}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField
          id={fieldId + "-sustituir-pregunta"}
          label="Sustituir pregunta"
          density="compact"
        >
          {(field) => (
            <Select
              {...field}
              value={replaceIndex}
              onChange={(event) => setReplaceIndex(event.target.value)}
            >
              {Array.from({ length: questionCount }, (_, index) => (
                <option key={index} value={index}>
                  #{index + 1}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <Button type="button" variant="secondary" onClick={selectLibraryQuestion}>
          Usar versión
        </Button>
      </div>
      <p className={styles.helper}>
        Las preguntas publicadas son referencias inmutables. Para corregir el enunciado o la
        solución, crea una nueva versión desde{" "}
        <Link href="/admin/questions">la biblioteca de preguntas</Link> y selecciónala después en
        este desafío.
      </p>
    </>
  );
}
