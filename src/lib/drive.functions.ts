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
    const googleKey = process.env["GOOGLE_API_KEY"];
    const lovable = process.env["LOVABLE_API_KEY"];
    const key = process.env["GOOGLE_DRIVE_API_KEY"];
    const q = encodeURIComponent(`'${data.folderId}' in parents and trashed = false`);
    const params = `q=${q}&fields=files(id,name,mimeType,shortcutDetails(targetId,targetMimeType))&orderBy=name&pageSize=500&supportsAllDrives=true&includeItemsFromAllDrives=true`;
    let res: Response;
    if (googleKey) {
      res = await fetch(
        `https://www.googleapis.com/drive/v3/files?${params}&key=${encodeURIComponent(googleKey)}`,
      );
    } else if (lovable && key) {
      res = await fetch(`https://connector-gateway.lovable.dev/google_drive/drive/v3/files?${params}`, {
        headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": key },
      });
    } else {
      return { files: [] as DriveFile[], missingKey: true };
    }
    if (!res.ok) {
      console.error(`Drive list failed [${res.status}]: ${await res.text()}`);
      return { files: [] as DriveFile[], missingKey: false, error: res.status };
    }
    const json = (await res.json()) as {
      files?: (DriveFile & { shortcutDetails?: { targetId: string; targetMimeType: string } })[];
    };
    const files = (json.files ?? [])
      .map((f) =>
        f.shortcutDetails
          ? {
              id: f.shortcutDetails.targetId,
              name: f.name,
              mimeType: f.shortcutDetails.targetMimeType,
            }
          : { id: f.id, name: f.name, mimeType: f.mimeType },
      )
      .filter((f) => f.mimeType === "application/pdf" || f.mimeType.startsWith("image/"));
    return { files, missingKey: false };
  });
