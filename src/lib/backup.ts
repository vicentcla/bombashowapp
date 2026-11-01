export const BACKUP_TABLES = {
  arrangements: "arreglos",
  street_songs: "de calle",
  lyrics: "letras",
  setlists: "setlists",
  setlist_items: "canciones en setlists",
  reset_periods: "periodos",
  play_events: "toques",
  score_links: "partituras vinculadas",
  bolos: "bolos",
} as const;

export type BackupData = {
  app: "la-bomba-show";
  version: number;
  creado: string;
} & { [K in keyof typeof BACKUP_TABLES]: unknown[] };

export function parseBackup(raw: unknown): BackupData {
  if (!raw || typeof raw !== "object") throw new Error("Archivo no válido");
  const o = raw as Record<string, unknown>;
  if (o.app !== "la-bomba-show" || typeof o.version !== "number" || o.version > 1)
    throw new Error("Archivo no válido");
  for (const k of Object.keys(BACKUP_TABLES)) {
    if (o[k] === undefined) o[k] = [];
    if (!Array.isArray(o[k])) throw new Error("Archivo no válido");
  }
  return o as BackupData;
}

export function backupSummary(d: BackupData): [string, number][] {
  return (Object.keys(BACKUP_TABLES) as (keyof typeof BACKUP_TABLES)[]).map((k) => [
    BACKUP_TABLES[k],
    d[k].length,
  ]);
}
