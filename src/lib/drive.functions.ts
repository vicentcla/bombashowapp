import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DriveFile = { id: string; name: string; mimeType: string };

export type DriveListResult =
  | { status: "ok"; files: DriveFile[] }
  | { status: "missing_key"; files: DriveFile[] }
  | { status: "empty"; files: DriveFile[] }
  | { status: "google_error"; files: DriveFile[]; httpStatus: number; message: string };

type RawFile = DriveFile & { shortcutDetails?: { targetId: string; targetMimeType: string } };

function readEnv(name: string): string | undefined {
  try {
    const req = getRequest() as Request & {
      runtime?: { cloudflare?: { env?: Record<string, unknown> } };
    };
    const v = req.runtime?.cloudflare?.env?.[name];
    if (typeof v === "string" && v) return v;
  } catch {
    /* empty */
  }
  const v = process.env[name];
  return v ? v : undefined;
}

function sanitize(msg: unknown): string {
  if (typeof msg !== "string") return "Error desconocido";
  return msg
    .replace(/https?:\/\/\S+/g, "[url]")
    .replace(/AIza[\w-]{20,}/g, "[clave]")
    .replace(/key=[^&\s]+/gi, "key=[clave]")
    .slice(0, 200);
}

export const listDriveFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { folderId: string }) => {
    if (!/^[\w-]{10,}$/.test(d.folderId)) throw new Error("Carpeta no válida");
    return d;
  })
  .handler(async ({ data }): Promise<DriveListResult> => {
    const googleKey = readEnv("GOOGLE_API_KEY");
    const lovable = readEnv("LOVABLE_API_KEY");
    const key = readEnv("GOOGLE_DRIVE_API_KEY");
    const q = encodeURIComponent(`'${data.folderId}' in parents and trashed = false`);
    const params = `q=${q}&fields=files(id,name,mimeType,shortcutDetails(targetId,targetMimeType))&orderBy=name&pageSize=500&supportsAllDrives=true&includeItemsFromAllDrives=true`;
    let res: Response;
    if (googleKey) {
      res = await fetch(
        `https://www.googleapis.com/drive/v3/files?${params}&key=${encodeURIComponent(googleKey)}`,
      );
    } else if (lovable && key) {
      res = await fetch(
        `https://connector-gateway.lovable.dev/google_drive/drive/v3/files?${params}`,
        {
          headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": key },
        },
      );
    } else {
      console.log(`[drive] hasGoogleKey=false`);
      return { status: "missing_key", files: [] };
    }
    console.log(`[drive] hasGoogleKey=${!!googleKey} googleStatus=${res.status}`);
    let json: { files?: RawFile[]; error?: { message?: string } } = {};
    try {
      json = (await res.json()) as typeof json;
    } catch {
      json = {};
    }
    if (!res.ok) {
      return {
        status: "google_error",
        files: [],
        httpStatus: res.status,
        message: sanitize(json.error?.message),
      };
    }
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
    return files.length ? { status: "ok", files } : { status: "empty", files };
  });

export type DriveFileResult =
  { status: "ok"; mimeType: string; base64: string } | { status: "error"; message: string };

export const getDriveFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { fileId: string }) => {
    if (!/^[\w-]{10,}$/.test(d.fileId)) throw new Error("Archivo no válido");
    return d;
  })
  .handler(async ({ data }): Promise<DriveFileResult> => {
    const googleKey = readEnv("GOOGLE_API_KEY");
    const lovable = readEnv("LOVABLE_API_KEY");
    const key = readEnv("GOOGLE_DRIVE_API_KEY");
    const path = `files/${data.fileId}?alt=media&supportsAllDrives=true`;
    let res: Response;
    if (googleKey) {
      res = await fetch(
        `https://www.googleapis.com/drive/v3/${path}&key=${encodeURIComponent(googleKey)}`,
      );
    } else if (lovable && key) {
      res = await fetch(`https://connector-gateway.lovable.dev/google_drive/drive/v3/${path}`, {
        headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": key },
      });
    } else {
      return { status: "error", message: "Falta la clave de Google Drive en el servidor" };
    }
    if (!res.ok) {
      let msg = "";
      try {
        msg = ((await res.json()) as { error?: { message?: string } }).error?.message ?? "";
      } catch {
        /* empty */
      }
      return { status: "error", message: `Google Drive (HTTP ${res.status}): ${sanitize(msg)}` };
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return {
      status: "ok",
      mimeType: res.headers.get("content-type") ?? "application/pdf",
      base64: btoa(bin),
    };
  });
