import { z } from "zod";

export const REPORT_QUEUE_LIMIT = 5;
export const REPORT_EVENT_LIMIT = 12;
export const REPORT_QUEUE_KEY = "bomba_reportes_pendientes_v1";

export function sanitizeReportText(value: unknown, limit = 500): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/https?:\/\/[^\s"<>]+/gi, "[URL omitida]")
    .replace(
      /(?:authorization|bearer|password|contrase[nñ]a|token|api[_ -]?key|secret|clave)[\s"':=]+[^\s,;]+/gi,
      "[secreto omitido]",
    )
    .replace(
      /eyJ[A-Za-z0-9_.-]+|sb_(?:secret|publishable)_[A-Za-z0-9_-]+|AIza[A-Za-z0-9_-]+/g,
      "[secreto omitido]",
    )
    .replace(/[A-Za-z0-9_./+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[correo omitido]")
    .replace(/[A-Za-z0-9_+/.=-]{40,}/g, "[dato omitido]")
    .replace(/[\u0000-\u001f]/g, " ")
    .slice(0, limit);
}

const text = z.string().max(500);
export const diagnosticSchema = z.object({
  fecha: text,
  version: text,
  build: text,
  dominio: text,
  entorno: text,
  sistema: text,
  navegador: text,
  modo: text,
  pantalla: text,
  accion: text,
  conexion: text,
  codigo: text,
  mensaje: text,
  correlacion: text,
  carpeta_id: text,
  setlist_id: text,
  cancion_id: text,
  archivo_id: text,
  eventos: z
    .array(z.object({ fecha: text, tipo: text, pantalla: text, codigo: text, mensaje: text }))
    .max(REPORT_EVENT_LIMIT),
});
export type ReportDiagnostic = z.infer<typeof diagnosticSchema>;
export const queuedReportSchema = z.object({
  id: z.string().uuid(),
  usuario_id: z.string().uuid(),
  diagnostico: diagnosticSchema,
});
export type QueuedReport = z.infer<typeof queuedReportSchema>;

export function safeDiagnostic(value: ReportDiagnostic): ReportDiagnostic {
  const clean = Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "eventos")
      .map(([key, val]) => [key, sanitizeReportText(val, key === "mensaje" ? 500 : 160)]),
  );
  return diagnosticSchema.parse({
    ...clean,
    eventos: value.eventos.slice(-REPORT_EVENT_LIMIT).map((e) => ({
      fecha: sanitizeReportText(e.fecha, 40),
      tipo: sanitizeReportText(e.tipo, 40),
      pantalla: sanitizeReportText(e.pantalla, 160),
      codigo: sanitizeReportText(e.codigo, 80),
      mensaje: sanitizeReportText(e.mensaje, 300),
    })),
  });
}

export function readReportQueue(storage: Pick<Storage, "getItem">): QueuedReport[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(REPORT_QUEUE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, REPORT_QUEUE_LIMIT).flatMap((row) => {
      const result = queuedReportSchema.safeParse(row);
      return result.success
        ? [{ ...result.data, diagnostico: safeDiagnostic(result.data.diagnostico) }]
        : [];
    });
  } catch {
    return [];
  }
}

export async function deliverReportQueue(
  queue: QueuedReport[],
  userId: string,
  send: (report: QueuedReport) => Promise<void>,
  remove: (id: string) => void,
): Promise<string[]> {
  const delivered: string[] = [];
  for (const report of queue.filter((r) => r.usuario_id === userId)) {
    try {
      await send(report);
      remove(report.id);
      delivered.push(report.id);
    } catch {
      break;
    }
  }
  return delivered;
}
