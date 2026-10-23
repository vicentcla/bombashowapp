import { useEffect, useRef, useState } from "react";
import { Bug, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { onReportsDelivered, submitProblemReport } from "@/lib/problemReports";

export function ReportProblem({ error, carpetaId = "", setlistId = "", archivoId = "" }: { error?: string; carpetaId?: string; setlistId?: string; archivoId?: string }) {
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [result, setResult] = useState<{ id: string; estado: "enviado" | "pendiente" } | null>(null);
  const [failure, setFailure] = useState("");
  useEffect(() => onReportsDelivered((ids) => setResult((r) => r && ids.includes(r.id) ? { ...r, estado: "enviado" } : r)), []);

  async function submit() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setFailure("");
    try {
      setResult(await submitProblemReport({ ...(error ? { mensaje: error } : {}), ...(carpetaId ? { carpeta_id: carpetaId } : {}), ...(setlistId ? { setlist_id: setlistId } : {}), ...(archivoId ? { archivo_id: archivoId } : {}) }));
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "No se pudo enviar el problema");
      lock.current = false;
    } finally { setBusy(false); }
  }

  return <div className="min-w-0 space-y-2">
    <Button type="button" variant="outline" className="h-auto min-h-11 w-full whitespace-normal" disabled={busy || !!result} onClick={() => void submit()}>
      {busy ? <LoaderCircle className="animate-spin" /> : <Bug />}
      Enviar problema a Vicent
    </Button>
    <div aria-live="polite" className="break-words text-sm text-muted-foreground">
      {busy && "Enviando…"}
      {failure && <p role="alert">{failure}</p>}
      {result && <><p className="font-bold">{result.estado === "enviado" ? "Enviado" : "Pendiente de envío"}</p><p className="break-all">{result.id}</p>{result.estado === "pendiente" && <p>Se reintentará con la app abierta y conexión.</p>}</>}
    </div>
  </div>;
}