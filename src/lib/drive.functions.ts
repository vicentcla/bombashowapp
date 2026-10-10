import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DriveFile = { id: string; name: string; mimeType: string };

export const listDriveFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { folderId: string }) => {
    if (!/^[\w-]{10,}$/.test(d.folderId)) throw new Error("Carpeta no válida");
    return d;
  })
  .handler(async ({ data }) => {
    const key = process.env.GOOGLE_DRIVE_API_KEY;
    if (!key) return { files: [] as DriveFile[], missingKey: true };
    const q = encodeURIComponent(`'${data.folderId}' in parents and trashed = false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType)&orderBy=name&pageSize=500&key=${key}`;
    const res = await fetch(url);
    if (!res.ok) return { files: [] as DriveFile[], missingKey: false, error: res.status };
    const json = (await res.json()) as { files?: DriveFile[] };
    const files = (json.files ?? []).filter(
      (f) => f.mimeType === "application/pdf" || f.mimeType.startsWith("image/"),
    );
    return { files, missingKey: false };
  });
