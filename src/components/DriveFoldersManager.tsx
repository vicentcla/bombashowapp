import { useState, type FormEvent } from "react";
import { Pencil, Trash2, Save, ExternalLink, Folder } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDriveFolders, useInvalidate, type DriveFolder } from "@/lib/queries";
import { INSTRUMENTS, driveUrl, extractFolderId } from "@/lib/drive";

export function DriveFoldersManager() {
  const folders = useDriveFolders();
  const invalidate = useInvalidate();

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

  function editFolder(folder: DriveFolder) {
    setEditingId(folder.id);
    setFormInstrument(folder.instrument);
    setFormName(folder.name);
    setFormUrl(folder.folder_id);
  }

  function errorMessage(err: unknown) {
    const msg = (err as { message?: string } | null)?.message;
    return msg || "Error al guardar la carpeta";
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
        const { data: maxData, error: maxError } = await supabase
          .from("drive_folders")
          .select("sort_order")
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (maxError) throw maxError;
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
      toast.error(errorMessage(err));
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

  return (
    <div className="space-y-4">
      <form onSubmit={saveFolder} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
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
          <div className="flex flex-col items-center py-6 text-center">
            <Folder className="mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-bold text-muted-foreground">No hay carpetas configuradas.</p>
          </div>
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
  );
}
