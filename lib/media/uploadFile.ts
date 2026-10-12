/** Upload to the opaque signed URL prepared by the server, without a storage SDK. */
export async function uploadFile(signedUploadUrl: string, file: File): Promise<boolean> {
  try {
    const response = await fetch(signedUploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type, "Cache-Control": "max-age=3600" },
      body: file,
    });
    return response.ok;
  } catch {
    return false;
  }
}
