"use client";

import { randomUuid } from "@/lib/randomUuid";
import {
  abortQuestionAsset,
  confirmQuestionAsset,
  prepareQuestionAsset,
} from "@/app/admin/question-actions";
import { FormField, Input, Select } from "@/components/ui";
import { uploadFile } from "@/lib/media/uploadFile";
import { useId, useState } from "react";
import styles from "../QuestionVersionEditor.module.css";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function QuestionAssetUploader({
  document,
  onDocumentChange,
}: {
  readonly document: string;
  readonly onDocumentChange: (value: string) => void;
}) {
  const fieldId = useId();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [altText, setAltText] = useState("");
  const [fit, setFit] = useState<"" | "cover" | "contain">("");
  const [position, setPosition] = useState("");
  let target: "multiple-choice" | "progressive-image" | "heat-map" | null = null;
  let currentReference: Record<string, unknown> = {};
  let progressiveImage = false;
  try {
    const parsed = JSON.parse(document) as { type?: unknown; publicPayload?: unknown };
    if (
      parsed.type === "progressive-image" ||
      parsed.type === "multiple-choice" ||
      parsed.type === "heat-map"
    ) {
      target = parsed.type;
      progressiveImage = parsed.type === "progressive-image";
      const publicPayload = isRecord(parsed.publicPayload) ? parsed.publicPayload : {};
      const reference = publicPayload[parsed.type === "progressive-image" ? "surface" : "media"];
      currentReference = isRecord(reference) ? reference : {};
    }
  } catch {
    /* The JSON editor displays the validation error. */
  }
  if (!target) return null;

  const currentAlt = typeof currentReference.alt === "string" ? currentReference.alt : "";
  const currentFit =
    currentReference.fit === "cover" || currentReference.fit === "contain"
      ? currentReference.fit
      : "";
  const currentPosition =
    typeof currentReference.position === "string" ? currentReference.position : "";
  const effectiveAlt = altText || currentAlt;
  const effectiveFit = fit || currentFit;
  const effectivePosition = position || currentPosition;

  async function upload(file: File) {
    setMessage(null);
    setPending(true);
    const idempotencyKey = randomUuid();
    try {
      const alt = effectiveAlt.trim();
      if (!alt || alt.length > 500) {
        setMessage("Introduce un texto alternativo de entre 1 y 500 caracteres.");
        return;
      }
      const prepared = await prepareQuestionAsset({
        mimeType: file.type,
        byteSize: file.size,
        idempotencyKey,
      });
      if (!prepared.ok) {
        setMessage(prepared.message);
        return;
      }
      const uploaded = await uploadFile(prepared.signedUploadUrl, file);
      if (!uploaded) {
        await abortQuestionAsset(prepared.assetId);
        setMessage("No se ha podido subir el asset.");
        return;
      }
      const confirmed = await confirmQuestionAsset({
        assetId: prepared.assetId,
        idempotencyKey: prepared.confirmIdempotencyKey,
      });
      if (!confirmed.ok) {
        setMessage(confirmed.message);
        return;
      }
      const parsed = JSON.parse(document) as Record<string, unknown>;
      const publicPayload = (parsed.publicPayload ?? {}) as Record<string, unknown>;
      const referenceKey = target === "multiple-choice" ? "media" : "surface";
      const reference = (publicPayload[referenceKey] ?? {}) as Record<string, unknown>;
      const privateReference =
        target === "multiple-choice"
          ? {
              type: "image",
              assetId: confirmed.assetId,
              alt,
              width: confirmed.width,
              height: confirmed.height,
              ...(effectiveFit ? { fit: effectiveFit } : {}),
              ...(effectivePosition ? { position: effectivePosition } : {}),
            }
          : {
              ...reference,
              assetId: confirmed.assetId,
              alt,
              width: confirmed.width,
              height: confirmed.height,
              ...(effectiveFit ? { fit: effectiveFit } : {}),
              ...(effectivePosition ? { position: effectivePosition } : {}),
            };
      onDocumentChange(
        JSON.stringify(
          {
            ...parsed,
            payloadSchemaVersion: 2,
            publicPayload: { ...publicPayload, [referenceKey]: privateReference },
          },
          null,
          2,
        ),
      );
      setMessage("Asset confirmado y vinculado al documento.");
    } catch {
      setMessage("No se ha podido completar la subida.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.assetPanel}>
      <div className={styles.assetHeading}>
        <strong>
          Asset privado de{" "}
          {target === "heat-map"
            ? "heat-map"
            : progressiveImage
              ? "progressive-image"
              : "multiple-choice"}
        </strong>
        <span>El servidor inspecciona los bytes y guarda solo el assetId.</span>
      </div>
      <div className={styles.assetFields}>
        <FormField id={fieldId + "-texto-alternativo"} label="Texto alternativo" density="compact">
          {(field) => (
            <Input
              {...field}
              value={effectiveAlt}
              maxLength={500}
              onChange={(event) => setAltText(event.target.value)}
              placeholder="Describe la imagen"
            />
          )}
        </FormField>
        <FormField id={fieldId + "-ajuste"} label="Ajuste" density="compact">
          {(field) => (
            <Select
              {...field}
              value={effectiveFit}
              onChange={(event) => setFit(event.target.value as "" | "cover" | "contain")}
            >
              <option value="">Predeterminado</option>
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
            </Select>
          )}
        </FormField>
        <FormField id={fieldId + "-posicion"} label="Posición" density="compact">
          {(field) => (
            <Input
              {...field}
              value={effectivePosition}
              maxLength={100}
              onChange={(event) => setPosition(event.target.value)}
              placeholder="center"
            />
          )}
        </FormField>
      </div>
      <FormField
        id={fieldId + "-seleccionar-jpeg-png-o-webp"}
        label="Seleccionar JPEG, PNG o WebP"
        density="compact"
      >
        {(field) => (
          <Input
            {...field}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={pending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.currentTarget.value = "";
            }}
          />
        )}
      </FormField>
      {pending ? <span role="status">Subiendo y confirmando…</span> : null}
      {message ? (
        <span className={styles.assetMessage} role="status">
          {message}
        </span>
      ) : null}
    </div>
  );
}
