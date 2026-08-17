import { useNavigate } from "@tanstack/react-router";
import { Pencil, X } from "lucide-react";
import type { Lyric } from "@/lib/queries";
import { useIsAdmin } from "@/hooks/useAuth";
import { sanitizeLyricsHtml } from "@/lib/format";

export function LyricViewerModal({
  title,
  kind,
  lyric,
  onClose,
}: {
  title: string;
  kind: "calle" | "arreglo";
  lyric: Lyric | null;
  onClose: () => void;
}) {
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();

  const handleModify = () => {
    if (!lyric) return;
    const tab = lyric.kind === "calle" ? "calle" : "arreglos";
    const editLyricId: string | undefined =
      (lyric.kind === "calle" ? lyric.street_song_id : lyric.arrangement_id) ?? undefined;

    onClose();
    navigate({
      to: "/repertorio",
      search: { tab, editLyricId },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="comic flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-card p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-border pb-3">
          <div>
            <h2 className="text-3xl font-extrabold leading-tight text-primary">
              {lyric ? lyric.title : title}
            </h2>
            <span className="mt-1 inline-block text-xs font-bold uppercase text-muted-foreground">
              {lyric
                ? lyric.kind === "calle"
                  ? "Canción de calle"
                  : "Arreglo"
                : kind === "calle"
                  ? "Canción de calle"
                  : "Arreglo"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="comic-sm rounded p-1 hover:bg-muted"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="overflow-y-auto py-2">
          {lyric ? (
            <div
              className="lyrics-body text-base leading-relaxed"
              dangerouslySetInnerHTML={{ __html: sanitizeLyricsHtml(lyric.content) }}
            />
          ) : (
            <p className="text-sm font-bold text-muted-foreground">
              Esta canción aún no tiene letra registrada.
            </p>
          )}
        </div>

        {isAdmin && lyric && (
          <div className="mt-4 border-t border-border pt-3">
            <button
              type="button"
              onClick={handleModify}
              className="comic comic-press flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 font-extrabold uppercase text-primary-foreground"
            >
              <Pencil className="h-4 w-4" /> Modificar en Repertorio
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
