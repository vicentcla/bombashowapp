import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, Minimize, Search, X } from "lucide-react";
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
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void ref.current?.requestFullscreen?.().catch(() => setFull((f) => !f));
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

  return (
    <div
      ref={ref}
      className={`fixed inset-0 z-[60] flex flex-col bg-background ${full ? "" : "p-2 sm:p-4"}`}
    >
      <div className="flex items-center gap-2 border-b border-border px-2 py-2">
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="comic-sm comic-press rounded-md bg-secondary p-2"
        >
          <X className="h-4 w-4" />
        </button>
        <p className="min-w-0 flex-1 truncate text-sm font-extrabold">
          {current ? current.name : folder.name}
        </p>
        {list_.length > 1 && (
          <span className="text-xs font-bold text-muted-foreground">
            {index + 1}/{list_.length}
          </span>
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
        <button
          onClick={toggleFull}
          aria-label="Pantalla completa"
          className="comic-sm comic-press rounded-md bg-secondary p-2"
        >
          {full ? <Minimize className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
        </button>
      </div>

      {list_.length > 1 && (
        <div className="px-2 pt-2">
          <label className="comic-sm flex items-center gap-2 rounded-lg bg-card px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar partitura…"
              className="w-full bg-transparent text-sm font-bold outline-none"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Borrar búsqueda">
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
        </div>
      )}
      {list_.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-2 py-2">
          {list_
            .map((f, i) => ({ f, i }))
            .filter(({ f }) => !query || normalize(f.name).includes(normalize(query)))
            .map(({ f, i }) => (
              <button
                key={f.id}
                onClick={() => setIndex(i)}
                className={`comic-sm shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold ${
                  i === index ? "bg-primary text-primary-foreground" : "bg-card"
                }`}
              >
                {f.name.replace(/\.pdf$/i, "")}
              </button>
            ))}
        </div>
      )}

      <div className="relative flex-1">
        {files.isLoading ? (
          <p className="p-6 text-center text-sm font-bold text-muted-foreground">
            Cargando partituras…
          </p>
        ) : current ? (
          <iframe
            key={current.id}
            src={`https://drive.google.com/file/d/${current.id}/preview`}
            title={current.name}
            allow="fullscreen"
            className="h-full w-full"
          />
        ) : (
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
        )}
        {list_.length > 1 && (
          <>
            <button
              onClick={() => go(-1)}
              aria-label="Anterior"
              className="comic-sm comic-press absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-card/90 p-3"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => go(1)}
              aria-label="Siguiente"
              className="comic-sm comic-press absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-card/90 p-3"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
