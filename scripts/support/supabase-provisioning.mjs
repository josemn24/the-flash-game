import { randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const APPLICATION_BUCKETS = [
  {
    id: "avatars",
    public: true,
    fileSizeLimit: "5MB",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  },
  {
    id: "question-assets",
    public: false,
    fileSizeLimit: "50MB",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  },
];

export function generatePassword() {
  return `${randomBytes(24).toString("base64url")}Aa1!`;
}

export async function writeJsonSecure(filePath, value) {
  const directory = path.dirname(filePath);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await chmod(temporaryPath, 0o600);
  await rename(temporaryPath, filePath);
  await chmod(filePath, 0o600);
}

export async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw new Error(`No se pudo leer ${filePath}.`);
  }
}

export function comparableSize(value) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|KiB|MiB|GiB)?$/i);
  if (!match) return null;
  const multipliers = {
    b: 1,
    kb: 1000,
    mb: 1000 ** 2,
    gb: 1000 ** 3,
    kib: 1024,
    mib: 1024 ** 2,
    gib: 1024 ** 3,
  };
  return Math.round(Number(match[1]) * (multipliers[match[2]?.toLowerCase() ?? "b"] ?? 1));
}

export function bucketMatches(bucket, expected) {
  const allowedMimeTypes = bucket.allowedMimeTypes ?? bucket.allowed_mime_types ?? [];
  return (
    Boolean(bucket.public) === expected.public &&
    comparableSize(bucket.fileSizeLimit ?? bucket.file_size_limit) ===
      comparableSize(expected.fileSizeLimit) &&
    JSON.stringify([...allowedMimeTypes].sort()) ===
      JSON.stringify([...expected.allowedMimeTypes].sort())
  );
}

export async function ensureBuckets(client, buckets = APPLICATION_BUCKETS) {
  const { data, error } = await client.storage.listBuckets();
  if (error) throw new Error("No se pudieron consultar los buckets.");
  for (const bucket of buckets) {
    const existing = data.find((item) => item.id === bucket.id);
    if (existing) {
      if (!bucketMatches(existing, bucket))
        throw new Error(`El bucket ${bucket.id} existe con una configuración incompatible.`);
      continue;
    }
    const { error: createError } = await client.storage.createBucket(bucket.id, {
      public: bucket.public,
      fileSizeLimit: bucket.fileSizeLimit,
      allowedMimeTypes: bucket.allowedMimeTypes,
    });
    if (createError) throw new Error(`No se pudo crear el bucket ${bucket.id}.`);
  }
}

export async function findAuthUserByEmail(client, email) {
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error("No se pudieron consultar los usuarios de Auth.");
    const match = data.users.find((user) => user.email?.trim().toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
}
