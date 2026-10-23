import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { onReportsDelivered, recordReportError, reportEvent, retryPendingReports } from "@/lib/problemReports";

export function ReportDiagnosticsMonitor() {
  const qc = useQueryClient();
  const { pathname } = useLocation();
  useEffect(() => { reportEvent("pantalla", { accion: "abrir pantalla" }); }, [pathname]);
  useEffect(() => {
    const error = (e: ErrorEvent) => recordReportError(e.error ?? new Error(e.message), { accion: "error de navegador" });
    const rejection = (e: PromiseRejectionEvent) => recordReportError(e.reason, { accion: "operación fallida" });
    const retry = () => { void retryPendingReports(); };
    const unsubscribeQuery = qc.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "error") {
        recordReportError(event.query.state.error, { accion: "cargar datos", ...(event.query.queryKey[0] === "drive_files" ? { carpeta_id: String(event.query.queryKey[1] ?? "") } : {}), ...(event.query.queryKey[0] === "drive_file" ? { archivo_id: String(event.query.queryKey[1] ?? "") } : {}) });
      }
    });
    const unsubscribeMutation = qc.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "error") recordReportError(event.mutation.state.error, { accion: "guardar cambios" });
    });
    const unsubscribeReports = onReportsDelivered(() => {
      void qc.invalidateQueries({ queryKey: ["reportes-problemas"] });
      void qc.invalidateQueries({ queryKey: ["pending-admin-badge"] });
    });
    const { data: auth } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") setTimeout(retry, 0);
    });
    window.addEventListener("error", error);
    window.addEventListener("unhandledrejection", rejection);
    window.addEventListener("online", retry);
    window.addEventListener("focus", retry);
    document.addEventListener("visibilitychange", retry);
    const timer = setInterval(retry, 60_000);
    retry();
    return () => {
      unsubscribeQuery(); unsubscribeMutation(); unsubscribeReports(); auth.subscription.unsubscribe(); clearInterval(timer);
      window.removeEventListener("error", error); window.removeEventListener("unhandledrejection", rejection); window.removeEventListener("online", retry); window.removeEventListener("focus", retry); document.removeEventListener("visibilitychange", retry);
    };
  }, [qc]);
  return null;
}