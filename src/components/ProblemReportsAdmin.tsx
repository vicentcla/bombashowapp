import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";

type Report = Tables<"reportes_problemas">;
const STATES = { nuevo: "Nuevo", en_revision: "En revisión", resuelto: "Resuelto" } as const;
type State = keyof typeof STATES;
function isState(value: string): value is State { return value in STATES; }

export function ProblemReportsAdmin() {
  const { isAdmin } = useIsAdmin();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("pendientes");
  const [saving, setSaving] = useState<string | null>(null);
  const reports = useQuery({
    queryKey: ["reportes-problemas", filter], enabled: isAdmin,
    queryFn: async () => {
      let query = supabase.from("reportes_problemas").select("*").order("creado_en", { ascending: false }).limit(100);
      if (filter === "pendientes") query = query.neq("estado", "resuelto");
      else if (filter === "resueltos") query = query.eq("estado", "resuelto");
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
  const profiles = useQuery({
    queryKey: ["reportes-usuarios"], enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,display_name");
      if (error) throw error;
      return data;
    },
  });
  if (!isAdmin) return null;

  async function updateState(id: string, state: string) {
    if (!isState(state)) return;
    setSaving(id);
    try {
      const { data, error } = await supabase.from("reportes_problemas").update({ estado: state }).eq("id", id).select("id").single();
      if (error || !data) throw new Error("No se pudo actualizar el reporte");
      await Promise.all([qc.invalidateQueries({ queryKey: ["reportes-problemas"] }), qc.invalidateQueries({ queryKey: ["pending-admin-badge"] })]);
      toast.success("Estado actualizado");
    } catch { toast.error("No se pudo actualizar el reporte"); }
    finally { setSaving(null); }
  }

  function exportText(report: Report) {
    return JSON.stringify({ id: report.id, fecha: report.creado_en, usuario_id: report.usuario_id, estado: report.estado, resumen: report.resumen, diagnostico: report.diagnostico }, null, 2);
  }
  async function copy(report: Report) {
    try { await navigator.clipboard.writeText(exportText(report)); toast.success("Diagnóstico copiado"); }
    catch { toast.error("No se pudo copiar; puedes descargar el diagnóstico"); }
  }
  function download(report: Report) {
    const url = URL.createObjectURL(new Blob([exportText(report)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = `reporte-${report.id}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section className="min-w-0 space-y-4" aria-label="Problemas reportados">
    <div className="flex items-center gap-2">
      <h3 className="min-w-0 flex-1 text-lg font-bold">Problemas reportados</h3>
      <Button type="button" variant="ghost" size="icon" aria-label="Actualizar reportes" title="Actualizar reportes" onClick={() => void reports.refetch()}><RefreshCw /></Button>
    </div>
    <Select value={filter} onValueChange={setFilter}>
      <SelectTrigger aria-label="Filtrar reportes"><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="pendientes">Pendientes</SelectItem><SelectItem value="resueltos">Resueltos</SelectItem><SelectItem value="todos">Todos</SelectItem></SelectContent>
    </Select>
    {reports.isPending ? <p className="text-sm text-muted-foreground">Cargando reportes…</p> : reports.isError ? <p role="alert" className="text-sm text-destructive">No se pudieron cargar los reportes. Intenta actualizar.</p> : !reports.data?.length ? <p className="py-6 text-center text-muted-foreground">No hay problemas reportados en esta vista.</p> : <ul className="space-y-3">
      {reports.data.map((report) => {
        const diagnostic = report.diagnostico && typeof report.diagnostico === "object" && !Array.isArray(report.diagnostico) ? report.diagnostico : {};
        const equivalents = reports.data.filter((r) => r.huella === report.huella).length;
        const name = profiles.data?.find((p) => p.id === report.usuario_id)?.display_name || report.usuario_id;
        return <li key={report.id} className="min-w-0 rounded-lg border border-border bg-background p-3 space-y-3">
          <div className="space-y-1">
            <p className="break-words font-bold">{report.resumen}</p>
            <p className="break-words text-xs text-muted-foreground">{name} · {new Date(report.creado_en).toLocaleString("es-ES")}</p>
            <p className="break-all font-mono text-xs text-muted-foreground">{report.id}</p>
            <p className="break-words text-xs text-muted-foreground">Versión: {String(diagnostic["version"] ?? "no disponible")} · {String(diagnostic["build"] ?? "no disponible")}</p>
            {equivalents > 1 && <p className="text-xs font-bold text-primary">{equivalents} reportes equivalentes en esta vista</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={report.estado} disabled={saving === report.id} onValueChange={(value) => void updateState(report.id, value)}>
              <SelectTrigger className="min-w-36 flex-1" aria-label={`Estado del reporte ${report.id}`}><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(STATES).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
            </Select>
            <Button type="button" size="icon" variant="outline" title="Copiar diagnóstico" aria-label="Copiar diagnóstico" onClick={() => void copy(report)}><Copy /></Button>
            <Button type="button" size="icon" variant="outline" title="Descargar diagnóstico" aria-label="Descargar diagnóstico" onClick={() => download(report)}><Download /></Button>
          </div>
          <details><summary className="cursor-pointer text-sm font-bold text-primary">Diagnóstico</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs text-muted-foreground">{JSON.stringify(report.diagnostico, null, 2)}</pre></details>
        </li>;
      })}
    </ul>}
    {(reports.data?.length ?? 0) >= 100 && <p className="text-xs text-muted-foreground">Se muestran los 100 reportes más recientes.</p>}
  </section>;
}