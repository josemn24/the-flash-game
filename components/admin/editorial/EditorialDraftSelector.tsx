import { Button, FormField, Select } from "@/components/ui";
import type { SuperadminEditorialEntry } from "@/types/view-models/editorial";
import type { ChangeEvent } from "react";
import styles from "../EditorialManagement.module.css";
export function EditorialDraftSelector({
  fieldId,
  drafts,
  selectedId,
  onSelect: selectDraft,
  allowNewDraft,
  onNewDraft: startNewDraft,
}: {
  readonly fieldId: string;
  readonly drafts: readonly SuperadminEditorialEntry[];
  readonly selectedId: string;
  readonly onSelect: (event: ChangeEvent<HTMLSelectElement>) => void;
  readonly allowNewDraft: boolean;
  readonly onNewDraft: () => void;
}) {
  if (!drafts.length) return null;
  return (
    <div className={styles.draftSelector}>
      <FormField id={fieldId + "-borrador"} label="Borrador" density="compact">
        {(field) => (
          <Select {...field} value={selectedId} onChange={selectDraft}>
            {drafts.map((entry) => (
              <option key={entry.challengeVersionId} value={entry.challengeVersionId}>
                {entry.title} · {entry.slug}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      {allowNewDraft ? (
        <Button type="button" variant="secondary" onClick={startNewDraft}>
          Nuevo borrador
        </Button>
      ) : null}
    </div>
  );
}
