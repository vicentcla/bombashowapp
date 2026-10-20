import { useEffect, useRef, useState } from "react";
import {
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
import type { DriveFolder } from "@/lib/queries";

type WakeLockLike = { release: () => Promise<void> };

export function ScoreViewer({ folder, onClose }: { folder: DriveFolder; onClose: () => void }) {
  const list = useServerFn(listDriveFiles);
  const files = useQuery({
    queryKey: ["drive_files", folder.folder_id],
    queryFn: () => list({ data: { folderId: folder.folder_id } }),
    staleTime: 10 * 60 * 1000,
  });
  const [index, setIndex] = useState(0);
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
  const current = list_[index];
  function errorText() {
    if (files.error) {
      const msg = files.error instanceof Error ? files.error.message : String(files.error);
      if (/unauthor|401|403|jwt|sesi/i.test(msg))
        return "Error de autenticación de la app: vuelve a iniciar sesión.";
      return `Error de ejecución en el servidor: ${msg.slice(0, 150)}`;
    }
    const d = files.data;
    if (!d) return "No se han podido cargar las partituras de esta carpeta.";
    if (d.status === "missing_key")
      return "El servidor no puede acceder a la clave de Google Drive";
    if (d.status === "google_error")
      return `Google Drive ha devuelto un error (HTTP ${d.httpStatus}): ${d.message}`;
    if (d.status === "empty")
      return "Google Drive ha respondido correctamente, pero no ha devuelto PDF o imágenes visibles en esta carpeta";
    return "No se han podido cargar las partituras de esta carpeta.";
  }
  const go = (d: number) => {
    if (!list_.length) return;
    setIndex((i) => (i + d + list_.length) % list_.length);
    haptic("selection");
  };

  const filtered = list_
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => {
      const q = normalize(query.trim());
      if (!q) return true;
      const name = normalize(f.name.replace(/\.pdf$/i, ""));
      const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^a-z0-9])${esc}`).test(name);
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
          <div className="px-2 pt-2">
            <label className="comic-sm flex items-center gap-2 rounded-lg bg-card px-3 py-2.5">
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
              <a
                href={driveUrl(folder.folder_id)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-primary underline"
              >
                Abrir en Drive
              </a>
            </div>
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
            {index + 1}/{list_.length}
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
        <iframe
          key={current.id}
          src={`https://drive.google.com/file/d/${current.id}/preview`}
          title={current.name}
          allow="fullscreen"
          className="absolute inset-0 h-full w-full"
        />
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
              {index + 1}/{list_.length} · {current.name.replace(/\.pdf$/i, "")}
            </span>
          </>
        )}
        {list_.length > 1 && (
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
