import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { deliverReportQueue, readReportQueue, safeDiagnostic, sanitizeReportText, REPORT_EVENT_LIMIT, REPORT_QUEUE_KEY, REPORT_QUEUE_LIMIT, type QueuedReport, type ReportDiagnostic } from "./reportDiagnostics";

type ReportContext = Partial<Pick<ReportDiagnostic, "accion" | "codigo" | "mensaje" | "correlacion" | "carpeta_id" | "setlist_id" | "cancion_id" | "archivo_id">>;
let context: ReportContext = {};
let events: ReportDiagnostic["eventos"] = [];
let flushing = false;
let submitting = false;
const listeners = new Set<(ids: string[]) => void>();

export function onReportsDelivered(listener: (ids: string[]) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function reportEvent(tipo: string, detail: ReportContext = {}) {
  if (typeof window === "undefined") return;
  context = Object.fromEntries(Object.entries(detail).map(([key, val]) => [key, sanitizeReportText(val)]));
  events = [...events, {
    fecha: new Date().toISOString(), tipo: sanitizeReportText(tipo, 40),
    pantalla: sanitizeReportText(window.location.pathname, 160),
    codigo: sanitizeReportText(detail.codigo, 80), mensaje: sanitizeReportText(detail.mensaje, 300),
  }].slice(-REPORT_EVENT_LIMIT);
}

export function recordReportError(error: unknown, detail: ReportContext = {}) {
  const e = error instanceof Error ? error : null;
  const code = error && typeof error === "object" && "code" in error ? error.code : e?.name;
  reportEvent("error", { ...detail, codigo: sanitizeReportText(code), mensaje: sanitizeReportText(e?.message ?? (error && typeof error === "object" && "message" in error ? error.message : "Error sin detalle disponible")) });
}

function collectDiagnostic(extra: ReportContext): ReportDiagnostic {
  const ua = navigator.userAgent;
  const sistema = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? "iOS/iPadOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "macOS" : "Otro";
  const navegador = /Edg\//.test(ua) ? "Edge" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Chrome|CriOS/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "Otro";
  const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return safeDiagnostic({
    fecha: new Date().toISOString(), version: __APP_VERSION__, build: __APP_BUILD__,
    dominio: window.location.hostname, entorno: window.location.hostname === "localhost" ? "desarrollo" : window.location.hostname.includes("id-preview") ? "vista previa" : "publicado",
    sistema, navegador, modo: installed ? "instalado" : "navegador",
    pantalla: window.location.pathname, accion: "reporte manual", conexion: navigator.onLine ? "con conexión" : "sin conexión",
    codigo: "", mensaje: "Problema comunicado por un miembro", correlacion: "", carpeta_id: "", setlist_id: "", cancion_id: "", archivo_id: "",
    ...context, ...extra, eventos: events,
  });
}

function removePending(id: string) {
  const queue = readReportQueue(localStorage).filter((r) => r.id !== id);
  localStorage.setItem(REPORT_QUEUE_KEY, JSON.stringify(queue));
}

async function send(report: QueuedReport) {
  const { data, error } = await supabase.rpc("enviar_reporte_problema", {
    reporte_id: report.id, datos: report.diagnostico as unknown as Json,
  });
  if (error || data !== report.id) throw new Error("No se pudo guardar el reporte");
}

export async function retryPendingReports() {
  if (flushing || typeof window === "undefined" || !navigator.onLine || document.visibilityState !== "visible") return;
  flushing = true;
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user.id) return;
    const ids = await deliverReportQueue(readReportQueue(localStorage), data.session.user.id, send, removePending);
    if (ids.length) listeners.forEach((listener) => listener(ids));
  } catch { /* El reporte conserva su estado pendiente. */ }
  finally { flushing = false; }
}

export async function submitProblemReport(extra: ReportContext = {}): Promise<{ id: string; estado: "enviado" | "pendiente" }> {
  if (submitting) throw new Error("Ya se está enviando un reporte");
  submitting = true;
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) throw new Error("Inicia sesión para enviar el problema");
    const report: QueuedReport = { id: crypto.randomUUID(), usuario_id: userId, diagnostico: collectDiagnostic(extra) };
    const queue = readReportQueue(localStorage);
    if (queue.length >= REPORT_QUEUE_LIMIT) throw new Error("Hay cinco reportes pendientes; espera a que se envíen");
    try { localStorage.setItem(REPORT_QUEUE_KEY, JSON.stringify([...queue, report])); }
    catch {
      if (!navigator.onLine) throw new Error("No se puede guardar el pendiente en este navegador");
      await send(report);
      return { id: report.id, estado: "enviado" };
    }
    if (navigator.onLine) {
      try {
        await send(report);
        removePending(report.id);
        listeners.forEach((listener) => listener([report.id]));
        return { id: report.id, estado: "enviado" };
      } catch { return { id: report.id, estado: "pendiente" }; }
    }
    return { id: report.id, estado: "pendiente" };
  } finally { submitting = false; }
}