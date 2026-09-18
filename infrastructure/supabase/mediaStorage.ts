import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { MediaStorage, MediaUploadInspection, MediaUploadPreparation } from "@/application/ports/media-storage";
import { inspectAvatarBytes } from "@/lib/media/avatarValidation";

const AVATAR_BUCKET = "avatars";

function getAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("storage_unavailable");
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const supabaseMediaStorage: MediaStorage = {
  async prepareUpload(input): Promise<MediaUploadPreparation> {
    const client = getAdminClient();
    const { data, error } = await client.storage.from(AVATAR_BUCKET).createSignedUploadUrl(input.objectPath);
    if (error || !data?.signedUrl || !data.token) throw new Error("storage_unavailable");
    return {
      assetId: input.assetId,
      objectPath: input.objectPath,
      signedUploadUrl: data.signedUrl,
      uploadToken: data.token,
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    };
  },

  async inspectUpload(input): Promise<MediaUploadInspection> {
    const { data, error } = await getAdminClient().storage.from(AVATAR_BUCKET).download(input.objectPath);
    if (error || !data) throw new Error("upload_missing");
    const bytes = new Uint8Array(await data.arrayBuffer());
    return inspectAvatarBytes(bytes);
  },

  async deleteObject(input) {
    const { error } = await getAdminClient().storage.from(AVATAR_BUCKET).remove([input.objectPath]);
    if (error) throw new Error("storage_cleanup_failed");
  },

  getPublicUrl(objectPath) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) throw new Error("storage_unavailable");
    const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
    return `${url.replace(/\/$/, "")}/storage/v1/object/public/${AVATAR_BUCKET}/${encodedPath}`;
  },
};
