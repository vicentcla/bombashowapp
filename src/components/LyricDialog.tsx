import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RichTextEditor } from "@/components/RichTextEditor";
import { htmlToPlainText, sanitizeLyricsHtml } from "@/lib/format";
import { useInvalidate, type Lyric, type Scope } from "@/lib/queries";

export function LyricDialog({
  kind,
  refId,
  defaultTitle,
  existing,
  onClose,
}: {
  kind: Scope;
  refId: string;
  defaultTitle: string;
  existing: Lyric | null;
  onClose: () => void;
}) {
  const invalidate = useInvalidate();
  const [content, setContent] = useState(existing?.content ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const clean = sanitizeLyricsHtml(content);
    const payload = {
      kind,
      title: defaultTitle,
      content: clean,
      plain_text: htmlToPlainText(clean),
      arrangement_id: kind === "arreglo" ? refId : null,
      street_song_id: kind === "calle" ? refId : null,
      updated_at: new Date().toISOString(),
    };
    const { error } = existing
      ? await supabase.from("lyrics").update(payload).eq("id", existing.id)
      : await supabase.from("lyrics").insert(payload);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate("lyrics");
    toast.success("Letra guardada");
    onClose();
  }

  async function remove() {
    if (!existing || !confirm("¿Eliminar la letra?")) return;
    const { error } = await supabase.from("lyrics").delete().eq("id", existing.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate("lyrics");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/60 p-4">
      <div className="comic w-full max-w-2xl rounded-xl bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="mr-auto text-2xl leading-none">Letra de {defaultTitle}</h2>
          <button onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <RichTextEditor value={content} onChange={setContent} />

        <div className="mt-4 flex gap-2">
          <button
            onClick={save}
            disabled={busy}
            className="comic comic-press flex-1 rounded-md bg-primary px-4 py-2 font-extrabold uppercase text-primary-foreground disabled:opacity-60"
          >
            Guardar letra
          </button>
          {existing && (
            <button
              onClick={remove}
              className="comic comic-press rounded-md bg-destructive px-4 py-2 font-extrabold uppercase text-destructive-foreground"
            >
              Borrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
