import { useState, useMemo, useEffect } from "react";
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatLyricsWithSubtitles, htmlToPlainText } from "@/lib/format";

type ImportStreetItem = {
  title: string;
  lyric?: string | undefined;
  tags?: string[] | undefined;
};

function parseStreetSongsText(text: string): ImportStreetItem[] {
  if (!text || !text.trim()) return [];

  const rawLines = text.split("\n");
  const items: ImportStreetItem[] = [];

  // Detectar si se está usando formato de bloques (# Titulo, === Titulo, [Titulo], o ---)
  const isBlockFormat =
    text.includes("---") ||
    /^#\s+/m.test(text) ||
    /^===\s*/m.test(text) ||
    /^\[.+\]/m.test(text) ||
    /^(cancion|canción|título|titulo):/im.test(text);

  if (isBlockFormat) {
    let currentTitle = "";
    let currentLyricLines: string[] = [];
    let currentTags: string[] = [];

    const flushCurrent = () => {
      if (currentTitle.trim()) {
        const lyricText = currentLyricLines.join("\n").trim();
        items.push({
          title: currentTitle.trim(),
          lyric: lyricText || undefined,
          tags: currentTags.length > 0 ? Array.from(new Set(currentTags)) : undefined,
        });
      }
      currentTitle = "";
      currentLyricLines = [];
      currentTags = [];
    };

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i] ?? "";
      const trimmed = line.trim();

      // Separador explícito de bloque ---
      if (trimmed === "---" || trimmed.startsWith("===")) {
        flushCurrent();
        continue;
      }

      // Cabecera con # Título, [Título], Título:
      const headerMatch =
        trimmed.match(/^#+\s*(.+)$/) ||
        trimmed.match(/^\[(.+)\]$/) ||
        trimmed.match(/^(?:cancion|canción|título|titulo):\s*(.+)$/i);

      if (headerMatch) {
        flushCurrent();
        currentTitle = (headerMatch[1] ?? "").replace(/^["'“'”]|["'“'”]$/g, "").trim();
        continue;
      }

      // Detección de etiquetas entre comillas: "Starter, Trios" o “Starter, Trios”
      const quoteTagsMatch = trimmed.match(/^["“]([^"”]+)["”]$/);
      if (quoteTagsMatch) {
        const extracted = (quoteTagsMatch[1] ?? "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        if (extracted.length > 0) {
          currentTags.push(...extracted);
          continue; // No incluir esta línea como texto de la letra
        }
      }

      // Si aún no tenemos título en el bloque y la línea no está vacía
      if (!currentTitle && trimmed) {
        currentTitle = trimmed;
        continue;
      }

      // Si ya tenemos título, acumular las líneas de letra (manteniendo saltos)
      if (currentTitle) {
        currentLyricLines.push(line);
      }
    }
    flushCurrent();
  } else {
    // Formato de lista simple (una línea por canción o separadas por / o |)
    for (const line of rawLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.toLowerCase().includes("título") || trimmed.startsWith("| ---"))
        continue;

      let parts: string[];
      if (trimmed.includes("|") || trimmed.includes("/")) {
        const normalized = trimmed.replace(/\//g, "|");
        parts = normalized
          .split("|")
          .map((p) => p.trim())
          .filter((p, idx, arr) => {
            if ((idx === 0 || idx === arr.length - 1) && p === "") return false;
            return true;
          });
      } else {
        parts = [trimmed];
      }

      const title = (parts[0] || trimmed).replace(/^["'“'”]|["'“'”]$/g, "").trim();
      if (!title) continue;

      let lyric = parts[1] || undefined;
      let tags: string[] | undefined = undefined;

      // Si la tercera columna venía entre comillas "Starter, Trios"
      if (parts[2]) {
        const qm = parts[2].match(/^["“]?([^"”]+)["”]?$/);
        if (qm) {
          tags = (qm[1] ?? "")
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
        }
      } else if (lyric) {
        const qm = lyric.match(/^["“]([^"”]+)["”]$/);
        if (qm) {
          tags = (qm[1] ?? "")
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
          lyric = undefined;
        }
      }

      items.push({ title, lyric, tags });
    }
  }

  return items;
}

export function ImportCalleDialog({
  onClose,
  onImported,
  existingTitles,
}: {
  onClose: () => void;
  onImported: () => void;
  existingTitles: Set<string>;
}) {
  const [pastedText, setPastedText] = useState("");
  const [selectedTitles, setSelectedTitles] = useState<Set<string>>(new Set());
  const [expandedPreview, setExpandedPreview] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const rawItems = useMemo(() => parseStreetSongsText(pastedText), [pastedText]);

  // Canciones elegibles (las que NO existen en la base de datos)
  const eligibleItems = useMemo(
    () => rawItems.filter((item) => !existingTitles.has(item.title.toUpperCase().trim())),
    [rawItems, existingTitles],
  );

  // Al cambiar la lista procesada, seleccionar por defecto todos los no duplicados
  useEffect(() => {
    setSelectedTitles(new Set(eligibleItems.map((item) => item.title)));
  }, [eligibleItems]);

  const allEligibleSelected =
    eligibleItems.length > 0 && eligibleItems.every((item) => selectedTitles.has(item.title));

  function toggleSelectAll() {
    if (allEligibleSelected) {
      setSelectedTitles(new Set());
    } else {
      setSelectedTitles(new Set(eligibleItems.map((item) => item.title)));
    }
  }

  function toggleItem(title: string) {
    setSelectedTitles((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  }

  function togglePreview(title: string) {
    setExpandedPreview((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  const finalItemsToImport = useMemo(
    () => eligibleItems.filter((item) => selectedTitles.has(item.title)),
    [eligibleItems, selectedTitles],
  );

  async function handleImport() {
    if (finalItemsToImport.length === 0) {
      toast.info("No has seleccionado ninguna canción nueva para importar.");
      return;
    }

    setBusy(true);
    try {
      // 1. Insertar canciones de calle con sus etiquetas si las hay
      const payloadSongs = finalItemsToImport.map((item, idx) => ({
        title: item.title,
        tags: item.tags || [],
        sort_order: existingTitles.size + idx + 1,
      }));

      let { data: insertedSongs, error: songErr } = await supabase
        .from("street_songs")
        .insert(payloadSongs)
        .select();

      // Fallback por si la columna 'tags' no se ha migrado aún en el esquema remoto de Supabase
      if (songErr && songErr.message?.toLowerCase().includes("tags")) {
        const fallbackSongs = finalItemsToImport.map((item, idx) => ({
          title: item.title,
          sort_order: existingTitles.size + idx + 1,
        }));
        const fallbackRes = await supabase.from("street_songs").insert(fallbackSongs).select();
        insertedSongs = fallbackRes.data;
        songErr = fallbackRes.error;
      }

      if (songErr) throw songErr;

      // 2. Si venía alguna letra, convertirla a HTML y guardarla en la tabla lyrics
      const lyricsToInsert = (insertedSongs || [])
        .map((song) => {
          const matched = finalItemsToImport.find(
            (i) => i.title.toUpperCase().trim() === song.title.toUpperCase().trim(),
          );
          if (matched?.lyric) {
            const htmlContent = formatLyricsWithSubtitles(matched.lyric);
            return {
              kind: "calle" as const,
              title: song.title,
              content: htmlContent,
              plain_text: htmlToPlainText(htmlContent),
              street_song_id: song.id,
            };
          }
          return null;
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x));

      if (lyricsToInsert.length > 0) {
        await supabase.from("lyrics").insert(lyricsToInsert);
      }

      toast.success(`¡Se han añadido ${finalItemsToImport.length} canciones de calle!`);
      onImported();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al importar canciones");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="comic w-full max-w-lg rounded-xl bg-card p-5 space-y-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-extrabold leading-none">Importar Canciones de Calle</h2>
          </div>
          <button onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase block">
            Escribe o pega tus canciones con letra y etiquetas:
          </label>
          <p className="text-[11px] text-muted-foreground font-medium leading-normal">
            Escribe <strong># Nombre</strong> para el título. Usa <strong>- SUBTÍTULO</strong> para
            secciones en negrita. Usa <strong>"Starter, Trios"</strong> (entre comillas) para añadir
            etiquetas. Separa varias canciones con <strong>---</strong> o con otro{" "}
            <strong>#</strong>.
          </p>
          <textarea
            rows={8}
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder={`# Los Negros\n- LAS NEGRAS\nLas negras de la Guayaba,\nTienen el chocho pelao x2\n\n"Starter, Trios"\n\n- TODO LO QUE ENTRA\nTodo lo que entra sale,\nPero se queda un ratito\n\n---\n\n# Otra Canción de Calle\n"Pack, Arreglo"\nLetra de la canción aquí`}
            className="comic-sm w-full rounded-md bg-background p-2.5 text-xs outline-none font-mono placeholder:text-muted-foreground/60 leading-relaxed"
          />
        </div>

        {/* Lista de selección individual */}
        <div className="space-y-2 flex-1 overflow-hidden flex flex-col min-h-[180px]">
          <div className="flex items-center justify-between px-1 text-xs font-bold">
            <span className="text-muted-foreground">
              Canciones detectadas: {selectedTitles.size} de {eligibleItems.length}
            </span>

            {eligibleItems.length > 0 && (
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1 text-primary hover:underline"
              >
                {allEligibleSelected ? (
                  <>
                    <CheckSquare className="h-3.5 w-3.5" /> Desmarcar todos
                  </>
                ) : (
                  <>
                    <Square className="h-3.5 w-3.5" /> Seleccionar todos
                  </>
                )}
              </button>
            )}
          </div>

          <div className="comic-sm flex-1 overflow-y-auto rounded-md bg-background p-2 text-xs space-y-1.5 max-h-56">
            {rawItems.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Escribe o pega tus canciones arriba para previsualizarlas aquí.
              </div>
            ) : (
              rawItems.map((item, idx) => {
                const exists = existingTitles.has(item.title.toUpperCase().trim());
                const isSelected = selectedTitles.has(item.title);
                const isExpanded = expandedPreview.has(item.title);

                return (
                  <div
                    key={idx}
                    className={`p-2 rounded-lg transition-colors border ${
                      exists
                        ? "opacity-40 bg-muted cursor-not-allowed border-transparent"
                        : isSelected
                          ? "bg-primary/10 border-primary/30"
                          : "bg-card hover:bg-accent/40 border-transparent"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <label
                        onClick={(e) => {
                          if (exists) e.preventDefault();
                        }}
                        className="flex items-start gap-2.5 min-w-0 flex-1 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={exists ? false : isSelected}
                          disabled={exists}
                          onChange={() => !exists && toggleItem(item.title)}
                          className="h-4 w-4 mt-0.5 rounded accent-primary cursor-pointer disabled:cursor-not-allowed"
                        />
                        <div className="min-w-0">
                          <span className="font-bold truncate text-sm block leading-tight">
                            {item.title}
                          </span>
                          {!!item.tags?.length && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {item.tags.map((t) => (
                                <span
                                  key={t}
                                  className="comic-sm rounded bg-secondary px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-secondary-foreground"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </label>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {item.lyric && (
                          <button
                            type="button"
                            onClick={() => togglePreview(item.title)}
                            className="flex items-center gap-1 text-[10px] bg-accent px-2 py-0.5 rounded font-extrabold text-accent-foreground hover:opacity-80"
                          >
                            <span>
                              Con letra ({item.lyric.split("\n").filter(Boolean).length} líneas)
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </button>
                        )}
                        {exists && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-extrabold">
                            Ya existe
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Previsualización desplegable de la letra */}
                    {item.lyric && isExpanded && (
                      <div
                        className="mt-2 p-2 rounded bg-card/80 border text-[11px] text-muted-foreground lyrics-body leading-snug"
                        dangerouslySetInnerHTML={{ __html: formatLyricsWithSubtitles(item.lyric) }}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Resumen e importación */}
        <div className="pt-3 border-t flex items-center justify-between gap-3">
          <span className="text-xs font-bold text-muted-foreground">
            {finalItemsToImport.length}{" "}
            {finalItemsToImport.length === 1 ? "seleccionada" : "seleccionadas"}
          </span>
          <button
            onClick={handleImport}
            disabled={busy || finalItemsToImport.length === 0}
            className="comic comic-press flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-xs font-extrabold uppercase text-primary-foreground disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {busy ? "Importando..." : `Importar ${finalItemsToImport.length} canciones`}
          </button>
        </div>
      </div>
    </div>
  );
}
