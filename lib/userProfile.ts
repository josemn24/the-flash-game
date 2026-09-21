export const PROFILE_NAME_MIN_LENGTH = 2;
export const PROFILE_NAME_MAX_LENGTH = 24;
export const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export type ProfileImageValidationError = "type" | "size";

export function getProfileInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.at(0)?.toLocaleUpperCase("es") ?? "")
    .join("");
}

export function validateProfileName(name: string) {
  const trimmedName = name.trim();

  if (trimmedName.length < PROFILE_NAME_MIN_LENGTH) {
    return `El nombre debe tener al menos ${PROFILE_NAME_MIN_LENGTH} caracteres.`;
  }

  if (trimmedName.length > PROFILE_NAME_MAX_LENGTH) {
    return `El nombre no puede superar los ${PROFILE_NAME_MAX_LENGTH} caracteres.`;
  }

  return null;
}

export function validateProfileImage(
  file: Pick<File, "size" | "type">,
): ProfileImageValidationError | null {
  if (!file.type.startsWith("image/")) {
    return "type";
  }

  if (file.size > PROFILE_IMAGE_MAX_BYTES) {
    return "size";
  }

  return null;
}
