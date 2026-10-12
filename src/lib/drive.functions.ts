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
    const lovable = process.env["LOVABLE_API_KEY"];
    const key = process.env["GOOGLE_DRIVE_API_KEY"];
    if (!lovable || !key) return { files: [] as DriveFile[], missingKey: true };
    const q = encodeURIComponent(`'${data.folderId}' in parents and trashed = false`);
    const url = `https://connector-gateway.lovable.dev/google_drive/drive/v3/files?q=${q}&fields=files(id,name,mimeType)&orderBy=name&pageSize=500&supportsAllDrives=true&includeItemsFromAllDrives=true`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": key },
    });
    if (!res.ok) {
      console.error(`Drive list failed [${res.status}]: ${await res.text()}`);
      return { files: [] as DriveFile[], missingKey: false, error: res.status };
    }
    const json = (await res.json()) as { files?: DriveFile[] };
    const files = (json.files ?? []).filter(
      (f) => f.mimeType === "application/pdf" || f.mimeType.startsWith("image/"),
    );
    return { files, missingKey: false };
  });
