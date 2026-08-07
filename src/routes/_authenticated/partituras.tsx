import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ElementType, type FormEvent } from "react";
import { Music4, Folder, Pin, Pencil, Trash2, X, Plus, Save, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { GoogleDriveIcon } from "@/components/BrandIcons";
import {
  PercusionIcon,
  TrombonIcon,
  TrompetaIcon,
  SaxoIcon,
  SousaphoneIcon,
} from "@/components/InstrumentIcons";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { useDriveFolders, useInvalidate, type DriveFolder } from "@/lib/queries";

const INSTRUMENTS = ["Percusión", "Trombón", "Trompeta", "Saxo", "Sousaphone"] as const;

const INSTRUMENT_ICONS: Record<string, ElementType> = {
  Percusión: PercusionIcon,
  Trombón: TrombonIcon,
  Trompeta: TrompetaIcon,
  Saxo: SaxoIcon,
  Sousaphone: SousaphoneIcon,
};

function driveUrl(folderId: string) {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

function embedUrl(folderId: string) {
  return `https://drive.google.com/embeddedfolderview?id=${folderId}#grid`;
}

function extractFolderId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (!trimmed.includes("/")) return trimmed;
  const last = trimmed.split("/").filter(Boolean).pop() ?? "";
  return last.split("?")[0] ?? "";
}

function useIsTouch() {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setIsTouch(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isTouch;
}

export const Route = createFileRoute("/_authenticated/partituras")({
  head: () => ({
    meta: [
      { title: "Partituras — La Bomba Show" },
      {
        name: "description",
        content: "Carpetas de partituras por instrumento, vinculadas a Google Drive.",
      },
    ],
  }),
  component: Partituras,
});

function DriveFolderCard({
  folder,
  pinned,
  onOpen,
}: {
  folder: DriveFolder;
  pinned: boolean;
  onOpen: () => void;
}) {
  const Icon = INSTRUMENT_ICONS[folder.instrument] ?? Folder;
  return (
    <div
      className={`comic flex flex-col justify-between gap-3 rounded-xl bg-card p-4 ${
        pinned ? "ring-2 ring-primary" : ""
      }`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <Icon className={`h-8 w-8 shrink-0 ${pinned ? "text-primary" : "text-muted-foreground"}`} />
        <div className="min-w-0">
          <p className="flex items-center gap-1 truncate text-lg font-extrabold leading-tight">
            {pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />}
            <span className="truncate">{folder.name}</span>
          </p>
          <p className="text-xs font-bold text-muted-foreground">{folder.instrument}</p>
        </div>
      </div>
      <button
        onClick={onOpen}
        className="comic-sm comic-press flex items-center justify-center gap-2 rounded-lg bg-secondary py-2 text-xs font-extrabold uppercase text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
      >
        <GoogleDriveIcon className="h-4 w-4" /> Abrir en Drive
      </button>
    </div>
  );
}

function Partituras() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const folders = useDriveFolders();
  const invalidate = useInvalidate();
  const isTouch = useIsTouch();

  const userInstrument = user?.user_metadata?.["instrument"] as string | undefined;

  const { myFolders, otherFolders } = useMemo(() => {
    const all = folders.data ?? [];
    if (userInstrument) {
      return {
        myFolders: all.filter((f) => f.instrument === userInstrument),
        otherFolders: all.filter((f) => f.instrument !== userInstrument),
      };
    }
    return { myFolders: [], otherFolders: all };
  }, [folders.data, userInstrument]);

  const [openFolder, setOpenFolder] = useState<DriveFolder | null>(null);
  const [showManager, setShowManager] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formInstrument, setFormInstrument] = useState("");
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setEditingId(null);
    setFormInstrument("");
    setFormName("");
    setFormUrl("");
  }

  function openFolderAccess(folder: DriveFolder) {
    if (isTouch) {
      setOpenFolder(folder);
    } else {
      window.open(driveUrl(folder.folder_id), "_blank", "noopener,noreferrer");
    }
  }

  function editFolder(folder: DriveFolder) {
    setEditingId(folder.id);
    setFormInstrument(folder.instrument);
    setFormName(folder.name);
    setFormUrl(folder.folder_id);
  }

  async function saveFolder(e: FormEvent) {
    e.preventDefault();
    if (!formInstrument) {
      toast.error("Selecciona un instrumento");
      return;
    }
    const folderId = extractFolderId(formUrl);
    if (!folderId) {
      toast.error("Introduce el enlace o el ID de la carpeta de Drive");
      return;
    }
    const name = formName.trim() || formInstrument;
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from("drive_folders")
          .update({ instrument: formInstrument, name, folder_id: folderId })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { data: maxData } = await supabase
          .from("drive_folders")
          .select("sort_order")
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle();
        const { error } = await supabase.from("drive_folders").insert({
          instrument: formInstrument,
          name,
          folder_id: folderId,
          sort_order: (maxData?.sort_order ?? 0) + 1,
        });
        if (error) throw error;
      }
      invalidate("drive_folders");
      resetForm();
      toast.success(editingId ? "Carpeta actualizada" : "Carpeta añadida");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar la carpeta");
    } finally {
      setSaving(false);
    }
  }

  async function deleteFolder(folder: DriveFolder) {
    if (!confirm(`¿Eliminar la carpeta "${folder.name}"?`)) return;
    const { error } = await supabase.from("drive_folders").delete().eq("id", folder.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate("drive_folders");
    toast.success("Carpeta eliminada");
  }

  const hasFolders = (folders.data?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Music4 className="h-7 w-7 shrink-0 text-muted-foreground" />
          <div>
            <h1 className="text-3xl font-extrabold leading-none">Partituras</h1>
            <p className="text-xs font-bold text-muted-foreground">
              Carpetas de Google Drive por instrumento
            </p>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowManager(true)}
            className="comic comic-press flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-extrabold uppercase text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Gestionar carpetas
          </button>
        )}
      </div>

      {!userInstrument && (
        <div className="comic flex items-center gap-3 rounded-xl bg-card p-4">
          <Music4 className="h-6 w-6 shrink-0 text-muted-foreground" />
          <p className="text-sm font-bold text-muted-foreground">
            Aún no has elegido tu instrumento.{" "}
            <a href="/ajustes" className="text-primary underline">
              Elíguelo en Ajustes
            </a>{" "}
            para fijar tus carpetas arriba.
          </p>
        </div>
      )}

      {!hasFolders ? (
        <div className="comic rounded-xl bg-card p-8 text-center">
          <Folder className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-lg font-bold">Todavía no hay carpetas de partituras.</p>
          {isAdmin ? (
            <button
              onClick={() => setShowManager(true)}
              className="comic comic-press mt-4 rounded-md bg-primary px-4 py-2 font-extrabold uppercase text-primary-foreground"
            >
              Añadir carpeta
            </button>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Pídele a un administrador que vincule las carpetas de Drive.
            </p>
          )}
        </div>
      ) : (
        <>
          {myFolders.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                <Pin className="h-3.5 w-3.5" /> Tu instrumento
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {myFolders.map((f) => (
                  <DriveFolderCard
                    key={f.id}
                    folder={f}
                    pinned
                    onOpen={() => openFolderAccess(f)}
                  />
                ))}
              </div>
            </section>
          )}

          {otherFolders.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                Otros instrumentos
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {otherFolders.map((f) => (
                  <DriveFolderCard
                    key={f.id}
                    folder={f}
                    pinned={false}
                    onOpen={() => openFolderAccess(f)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Modal carpeta incrustada (móvil/tablet) */}
      {openFolder && (
        <div className="fixed inset-0 z-50 flex flex-col bg-ink/60 p-3 sm:p-6">
          <div className="comic mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden rounded-xl bg-card">
            <div className="flex items-center justify-between gap-2 border-b border-ink/10 px-4 py-3">
              <p className="truncate font-extrabold">{openFolder.name}</p>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={driveUrl(openFolder.folder_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="comic-sm comic-press flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-[11px] font-extrabold uppercase text-secondary-foreground"
                >
                  <GoogleDriveIcon className="h-4 w-4" /> Abrir en Drive
                </a>
                <button
                  onClick={() => setOpenFolder(null)}
                  aria-label="Cerrar"
                  className="comic-sm comic-press rounded-md bg-secondary p-2"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <iframe
              src={embedUrl(openFolder.folder_id)}
              title={openFolder.name}
              className="min-h-[70vh] w-full flex-1"
            />
          </div>
        </div>
      )}

      {/* Modal gestión de carpetas (admin) */}
      {showManager && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/60 p-4 pb-10">
          <div className="comic w-full max-w-md rounded-xl bg-card p-5 mt-4 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-2xl font-extrabold leading-none">Carpetas de Drive</h2>
              <button onClick={() => setShowManager(false)} aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={saveFolder} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase">Instrumento</label>
                <select
                  value={formInstrument}
                  onChange={(e) => setFormInstrument(e.target.value)}
                  className="comic-sm w-full cursor-pointer rounded-md bg-background px-3 py-2 text-base outline-none"
                >
                  <option value="">Selecciona un instrumento...</option>
                  {INSTRUMENTS.map((inst) => (
                    <option key={inst} value={inst}>
                      {inst}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase">Nombre</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Partituras de Trompeta"
                  className="comic-sm w-full rounded-md bg-background px-3 py-2 text-base outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase">
                  Enlace o ID de la carpeta
                </label>
                <input
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="comic-sm w-full rounded-md bg-background px-3 py-2 text-base outline-none"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  La carpeta debe estar compartida como "cualquier persona con el enlace".
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="comic comic-press flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-extrabold uppercase text-primary-foreground disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Añadir carpeta"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="comic-sm comic-press rounded-md bg-secondary px-3 py-2 text-[11px] font-extrabold uppercase text-secondary-foreground"
                  >
                    Cancelar edición
                  </button>
                )}
              </div>
            </form>

            <div className="space-y-1.5 border-t border-ink/10 pt-3">
              {(folders.data ?? []).length === 0 ? (
                <p className="py-3 text-center text-sm text-muted-foreground">
                  No hay carpetas configuradas.
                </p>
              ) : (
                (folders.data ?? []).map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-background px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold">{f.name}</p>
                      <p className="text-[11px] text-muted-foreground">{f.instrument}</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <a
                        href={driveUrl(f.folder_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Abrir ${f.name}`}
                        className="comic-sm comic-press rounded bg-secondary p-2 text-secondary-foreground"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <button
                        onClick={() => editFolder(f)}
                        aria-label={`Editar ${f.name}`}
                        className="comic-sm comic-press rounded bg-secondary p-2"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteFolder(f)}
                        aria-label={`Eliminar ${f.name}`}
                        className="comic-sm comic-press rounded bg-destructive/10 p-2 text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
