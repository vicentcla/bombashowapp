import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Expand,
  FileMusic,
  Minimize,
  Search,
  X,
} from "lucide-react";
import { normalize } from "@/lib/format";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { GoogleDriveIcon } from "@/components/BrandIcons";
import { listDriveFiles } from "@/lib/drive.functions";
import { driveUrl } from "@/lib/drive";
import { haptic } from "@/lib/haptics";
import { NativeScore } from "@/components/NativeScore";
import { useSetlists, useSetlistItems, type DriveFolder } from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { matchScores, passRanks } from "@/lib/scoreMatch";
import { ReportProblem } from "@/components/ReportProblem";
import { reportEvent } from "@/lib/problemReports";
import { sanitizeReportText } from "@/lib/reportDiagnostics";

type WakeLockLike = { release: () => Promise<void> };

export function ScoreViewer({ folder, onClose }: { folder: DriveFolder; onClose: () => void }) {
  const list = useServerFn(listDriveFiles);
  const files = useQuery({
    queryKey: ["drive_files", folder.folder_id],
    queryFn: () => list({ data: { folderId: folder.folder_id } }),
    staleTime: 10 * 60 * 1000,
  });
  const [index, setIndex] = useState(0);
  const [setlistId, setSetlistId] = useState("");
  const qc = useQueryClient();
  const setlists = useSetlists();
  const setlistItems = useSetlistItems(setlistId || null);
  const links = useQuery({
    queryKey: ["score_links", folder.folder_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("score_links")
        .select("arrangement_id, file_id")
        .eq("folder_id", folder.folder_id);
      if (error) throw error;
      return data;
    },
  });
  const [query, setQuery] = useState("");
  const [full, setFull] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let lock: WakeLockLike | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: "screen") => Promise<WakeLockLike> };
    };
    const acquire = () => {
      if (document.visibilityState === "visible" && nav.wakeLock) {
        nav.wakeLock
          .request("screen")
          .then((l) => (lock = l))
          .catch(() => {});
      }
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    const onFs = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      document.removeEventListener("visibilitychange", acquire);
      document.removeEventListener("fullscreenchange", onFs);
      void lock?.release().catch(() => {});
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, []);

  function toggleFull() {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
      return;
    }
    if (full) {
      setFull(false);
      return;
    }
    const el = ref.current;
    if (el?.requestFullscreen) void el.requestFullscreen().catch(() => setFull(true));
    else setFull(true);
  }

  const list_ = files.data?.files ?? [];
  const items = setlistItems.data ?? [];
  const ranks = passRanks(setlists.data?.find((s) => s.id === setlistId)?.notes ?? null);
  const entries = setlistId
    ? matchScores(
        items.map((it) => ({
          id: it.id,
          position: it.position,
          arrangement_id: it.arrangement_id,
          title: it.arrangements?.title ?? it.manual_title ?? "",
          pass_rank: ranks[it.id] ?? 0,
        })),
        list_,
        links.data ?? [],
      )
    : [];
  const seq = entries.flatMap((e) => (e.state === "ok" ? [{ e, f: e.file }] : []));
  const viewList = setlistId ? seq.map((s) => s.f) : list_;
  const current = viewList[index];
  useEffect(() => {
    reportEvent("partituras", {
      accion: open ? "abrir partitura" : "abrir carpeta",
      carpeta_id: folder.folder_id,
      setlist_id: setlistId,
      archivo_id: open ? (current?.id ?? "") : "",
    });
  }, [folder.folder_id, setlistId, open, current?.id]);
  async function saveLink(arrangementId: string, fileId: string) {
    const { error } = await supabase
      .from("score_links")
      .upsert(
        { folder_id: folder.folder_id, arrangement_id: arrangementId, file_id: fileId },
        { onConflict: "folder_id,arrangement_id" },
      );
    if (error) toast.error("No se pudo guardar la asociación");
    else {
      toast.success("Partitura asociada");
      void qc.invalidateQueries({ queryKey: ["score_links", folder.folder_id] });
    }
  }
  function errorText() {
    if (files.error) {
      const msg = files.error instanceof Error ? files.error.message : String(files.error);
      if (/unauthor|401|403|jwt|sesi/i.test(msg))
        return "Error de autenticación de la app: vuelve a iniciar sesión.";
      return `Error de ejecución en el servidor: ${sanitizeReportText(msg, 150)}`;
    }
    const d = files.data;
    if (!d) return "No se han podido cargar las partituras de esta carpeta.";
    if (d.status === "missing_key")
      return "El servidor no puede acceder a la clave de Google Drive";
    if (d.status === "google_error")
      return `Google Drive ha devuelto un error (HTTP ${d.httpStatus}): ${sanitizeReportText(d.message)}`;
    if (d.status === "empty")
      return "Google Drive ha respondido correctamente, pero no ha devuelto PDF o imágenes visibles en esta carpeta";
    return "No se han podido cargar las partituras de esta carpeta.";
  }
  const go = (d: number) => {
    if (!viewList.length) return;
    setIndex((i) => (i + d + viewList.length) % viewList.length);
    haptic("selection");
  };

  const filtered = list_
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => {
      const q = normalize(query.trim()).replace(/\s+/g, " ");
      if (!q) return true;
      const name = normalize(f.name.replace(/\.pdf$/i, "")).replace(/[\s_]+/g, " ");
      return name.includes(q);
    });

  if (!open || !current) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-background px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-[max(env(safe-area-inset-top),0.5rem)] sm:px-4">
        <div className="flex items-center gap-2 border-b border-border px-2 py-2">
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="comic-sm comic-press rounded-md bg-secondary p-2"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="min-w-0 flex-1 truncate text-sm font-extrabold">{folder.name}</p>
          {list_.length > 0 && (
            <span className="text-xs font-bold text-muted-foreground">{list_.length}</span>
          )}
          <a
            href={driveUrl(folder.folder_id)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Abrir en Drive"
            className="comic-sm comic-press rounded-md bg-secondary p-2"
          >
            <GoogleDriveIcon className="h-4 w-4" />
          </a>
        </div>
        {list_.length > 0 && (
          <div className="space-y-2 px-2 pt-2">
            <select
              value={setlistId}
              onChange={(e) => {
                setSetlistId(e.target.value);
                setIndex(0);
              }}
              aria-label="Filtrar por setlist"
              className="comic-sm w-full rounded-lg bg-card px-3 py-2.5 text-base font-bold"
            >
              <option value="">Todas las partituras</option>
              {(setlists.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <label
              className={`comic-sm flex items-center gap-2 rounded-lg bg-card px-3 py-2.5 ${setlistId ? "hidden" : ""}`}
            >
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar partitura…"
                className="min-w-0 w-full bg-transparent text-base font-bold outline-none"
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Borrar búsqueda">
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {files.isLoading ? (
            <p className="p-6 text-center text-sm font-bold text-muted-foreground">
              Cargando partituras…
            </p>
          ) : list_.length === 0 ? (
            <div className="p-6 text-center text-sm font-bold text-muted-foreground">
              <p>{errorText()}</p>
              <div className="mt-4">
                <ReportProblem
                  error={errorText()}
                  carpetaId={folder.folder_id}
                  setlistId={setlistId}
                />
              </div>
              <a
                href={driveUrl(folder.folder_id)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-primary underline"
              >
                Abrir en Drive
              </a>
            </div>
          ) : setlistId ? (
            setlistItems.isLoading ? (
              <p className="p-6 text-center text-sm font-bold text-muted-foreground">
                Cargando setlist…
              </p>
            ) : entries.length === 0 ? (
              <p className="p-6 text-center text-sm font-bold text-muted-foreground">
                Este setlist no tiene canciones.
              </p>
            ) : (
              <ol className="space-y-2">
                {entries.map((e, n) => {
                  const pos = n + 1;
                  const title = e.item.title || "Sin título";
                  if (e.state === "ok") {
                    const si = seq.findIndex((s) => s.e === e);
                    return (
                      <li key={e.item.id}>
                        <button
                          onClick={() => {
                            setIndex(si);
                            setOpen(true);
                            haptic("selection");
                          }}
                          className="comic-sm comic-press flex w-full items-center gap-3 rounded-lg bg-card px-3 py-3 text-left"
                        >
                          <span className="w-6 shrink-0 text-center text-xs font-extrabold text-muted-foreground">
                            {pos}
                          </span>
                          <FileMusic className="h-5 w-5 shrink-0 text-primary" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-extrabold">{title}</span>
                            <span className="block truncate text-[11px] font-bold text-muted-foreground">
                              {e.file.name}
                            </span>
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                      </li>
                    );
                  }
                  return (
                    <li
                      key={e.item.id}
                      className="flex items-start gap-3 rounded-lg border-2 border-dashed border-destructive/60 px-3 py-3"
                    >
                      <span className="w-6 shrink-0 text-center text-xs font-extrabold text-muted-foreground">
                        {pos}
                      </span>
                      <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold">{title}</p>
                        {e.state === "missing" ? (
                          <p className="text-xs font-bold text-destructive">
                            Falta la partitura en esta carpeta.
                          </p>
                        ) : (
                          <>
                            <p className="text-xs font-bold text-destructive">
                              Hay {e.candidates.length} PDF posibles. Elige cuál es:
                            </p>
                            {e.item.arrangement_id ? (
                              <select
                                defaultValue=""
                                onChange={(ev) =>
                                  ev.target.value &&
                                  void saveLink(e.item.arrangement_id!, ev.target.value)
                                }
                                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm font-bold"
                              >
                                <option value="">Elegir partitura…</option>
                                {e.candidates.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <p className="text-[11px] font-bold text-muted-foreground">
                                {e.candidates.map((c) => c.name).join(" · ")}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )
          ) : filtered.length === 0 ? (
            <p className="p-6 text-center text-sm font-bold text-muted-foreground">
              Ninguna partitura coincide con «{query}».
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {filtered.map(({ f, i }) => (
                <li key={f.id} className="min-w-0">
                  <button
                    onClick={() => {
                      setIndex(i);
                      setOpen(true);
                      haptic("selection");
                    }}
                    className="comic-sm comic-press flex w-full items-center gap-3 rounded-lg bg-card px-3 py-3 text-left"
                  >
                    <FileMusic className="h-5 w-5 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate text-sm font-extrabold">
                      {f.name.replace(/\.pdf$/i, "")}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="fixed inset-0 z-[60] flex flex-col bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    >
      {!full && (
        <div className="flex items-center gap-2 border-b border-border px-2 py-2">
          <button
            onClick={() => setOpen(false)}
            aria-label="Volver a la lista"
            className="comic-sm comic-press rounded-md bg-secondary p-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <p className="min-w-0 flex-1 truncate text-sm font-extrabold">
            {current.name.replace(/\.pdf$/i, "")}
          </p>
          <span className="text-xs font-bold text-muted-foreground">
            {index + 1}/{viewList.length}
          </span>
          <button
            onClick={toggleFull}
            aria-label="Pantalla completa"
            className="comic-sm comic-press rounded-md bg-secondary p-2"
          >
            <Expand className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="relative flex-1 overflow-hidden">
        <NativeScore key={current.id} fileId={current.id} name={current.name} />
        {full && (
          <>
            <button
              onClick={toggleFull}
              aria-label="Salir de pantalla completa"
              className="absolute right-2 top-2 rounded-full bg-card/70 p-2 backdrop-blur"
            >
              <Minimize className="h-4 w-4" />
            </button>
            <span className="pointer-events-none absolute left-2 top-2 max-w-[70%] truncate rounded-full bg-card/60 px-3 py-1 text-[11px] font-bold backdrop-blur">
              {index + 1}/{viewList.length} · {current.name.replace(/\.pdf$/i, "")}
            </span>
          </>
        )}
        {viewList.length > 1 && (
          <>
            <button
              onClick={() => go(-1)}
              aria-label="Anterior"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-card/60 p-3 backdrop-blur"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => go(1)}
              aria-label="Siguiente"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-card/60 p-3 backdrop-blur"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
