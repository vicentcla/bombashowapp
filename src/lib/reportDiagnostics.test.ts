import { describe, expect, it } from "vitest";
import { deliverReportQueue, readReportQueue, REPORT_QUEUE_KEY, safeDiagnostic, sanitizeReportText, type QueuedReport, type ReportDiagnostic } from "./reportDiagnostics";

const diagnostic: ReportDiagnostic = {
  fecha: "2026-10-23T00:00:00Z", version: "1.0", build: "test", dominio: "app.test", entorno: "test", sistema: "iOS", navegador: "Safari", modo: "instalado", pantalla: "/partituras", accion: "abrir PDF", conexion: "sin conexión", codigo: "ERROR", mensaje: "Fallo de prueba", correlacion: "", carpeta_id: "", setlist_id: "", cancion_id: "", archivo_id: "", eventos: [],
};
const user = "00000000-0000-4000-8000-000000000001";
const report: QueuedReport = { id: "00000000-0000-4000-8000-000000000002", usuario_id: user, diagnostico: diagnostic };

describe("diagnóstico privado", () => {
  it("no captura contraseñas, tokens, claves, correo ni URLs", () => {
    const value = sanitizeReportText("password=TESTPASS Bearer TESTTOKEN api_key=TESTKEY https://example.test/?token=TESTQUERY test@example.test sb_secret_TESTSECRET eyJTEST.JWT.VALUE AIzaTESTGOOGLEKEY");
    for (const secret of ["TESTPASS", "TESTTOKEN", "TESTKEY", "TESTQUERY", "test@example.test", "TESTSECRET", "eyJTEST", "AIzaTEST"]) expect(value).not.toContain(secret);
  });
  it("limita la secuencia a doce eventos sin copiar datos arbitrarios", () => {
    const clean = safeDiagnostic({ ...diagnostic, eventos: Array.from({ length: 20 }, (_, i) => ({ fecha: "fecha", tipo: "error", pantalla: "/", codigo: String(i), mensaje: "Bearer TESTTOKEN" })) });
    expect(clean.eventos).toHaveLength(12);
    expect(clean.eventos[0]?.codigo).toBe("8");
    expect(JSON.stringify(clean)).not.toContain("TESTTOKEN");
  });
  it("ignora pendientes corruptos sin perder los válidos", () => {
    const queue = readReportQueue({ getItem: (key) => key === REPORT_QUEUE_KEY ? JSON.stringify([report, { token: "SECRET" }]) : null });
    expect(queue).toEqual([report]);
  });
  it("un fallo conserva el reporte pendiente", async () => {
    const removed: string[] = [];
    const ids = await deliverReportQueue([report], user, async () => { throw new Error("sin conexión"); }, (id) => removed.push(id));
    expect(ids).toEqual([]);
    expect(removed).toEqual([]);
  });
  it("solo confirma y elimina el pendiente tras guardarse", async () => {
    const removed: string[] = [];
    const ids = await deliverReportQueue([report], user, async (r) => { expect(removed).toEqual([]); expect(r.id).toBe(report.id); }, (id) => removed.push(id));
    expect(ids).toEqual([report.id]);
    expect(removed).toEqual([report.id]);
  });
  it("no envía pendientes de otra cuenta", async () => {
    let sends = 0;
    await deliverReportQueue([report], "otro-usuario", async () => { sends++; }, () => { throw new Error("no debe eliminar"); });
    expect(sends).toBe(0);
  });
});