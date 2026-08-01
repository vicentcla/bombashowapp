import { useState, useMemo, useEffect } from "react";
import { X, Upload, FileSpreadsheet, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type ImportStreetItem = {
  title: string;
  lyric?: string;
};

function parseStreetSongsText(text: string): ImportStreetItem[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const items: ImportStreetItem[] = [];

  for (const line of lines) {
    if (line.toLowerCase().includes("título") || line.startsWith("| ---")) continue;

    // Si tiene barras | o /, separar por título y letra (si la hay)
    let parts: string[];
    if (line.includes("|") || line.includes("/")) {
      const normalized = line.replace(/\//g, "|");
      parts = normalized
        .split("|")
        .map((p) => p.trim())
        .filter((p, idx, arr) => {
          if ((idx === 0 || idx === arr.length - 1) && p === "") return false;
          return true;
        });
    } else {
      // O separar por comas/pestañas
      parts = line.split(/[\t,]/).map((p) => p.trim());
    }

    const title = (parts[0] || line).replace(/^["']|["']$/g, "").trim();
    if (!title) continue;

    const lyric = parts[1] || undefined;

    items.push({ title, lyric });
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
  const [busy, setBusy] = useState(false);

  const rawItems = useMemo(() => parseStreetSongsText(pastedText), [pastedText]);

  // Canciones elegibles (las que NO existen en la base de datos)
  const eligibleItems = useMemo(
    () => rawItems.filter((item) => !existingTitles.has(item.title.toUpperCase().trim())),
    [rawItems, existingTitles]
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

  const finalItemsToImport = useMemo(
    () => eligibleItems.filter((item) => selectedTitles.has(item.title)),
    [eligibleItems, selectedTitles]
  );

  async function handleImport() {
    if (finalItemsToImport.length === 0) {
      toast.info("No has seleccionado ninguna canción nueva para importar.");
      return;
    }

    setBusy(true);
    try {
      // 1. Insertar canciones de calle
      const payloadSongs = finalItemsToImport.map((item, idx) => ({
        title: item.title,
        sort_order: existingTitles.size + idx + 1,
      }));

      const { data: insertedSongs, error: songErr } = await supabase
        .from("street_songs")
        .insert(payloadSongs)
        .select();

      if (songErr) throw songErr;

      // 2. Si venía alguna letra, insertarla en la tabla lyrics
      const lyricsToInsert = (insertedSongs || [])
        .map((song) => {
          const matched = finalItemsToImport.find(
            (i) => i.title.toUpperCase().trim() === song.title.toUpperCase().trim()
          );
          if (matched?.lyric) {
            return {
              kind: "calle",
              title: song.title,
              content: matched.lyric,
              plain_text: matched.lyric,
              street_song_id: song.id,
            };
          }
          return null;
        })
        .filter(Boolean);

      if (lyricsToInsert.length > 0) {
        await supabase.from("lyrics").insert(lyricsToInsert as any);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
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
            Pega aquí las canciones (una por línea):
          </label>
          <p className="text-[11px] text-muted-foreground font-medium leading-normal">
            Puedes pegar los títulos directamente (uno por línea), o separados por <strong>/</strong> o <strong>|</strong> si quieres añadir también la letra (ej: <em>Título / Letra</em>).
          </p>
          <textarea
            rows={5}
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder={`Pega aquí la lista de canciones:\nCanción de Calle 1\nCanción de Calle 2\nCanción 3 / Letra de la canción 3`}
            className="comic-sm w-full rounded-md bg-background p-2.5 text-xs outline-none font-mono placeholder:text-muted-foreground/60"
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

          <div className="comic-sm flex-1 overflow-y-auto rounded-md bg-background p-2 text-xs space-y-1 max-h-56">
            {rawItems.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Escribe o pega una lista de canciones arriba para previsualizar.
              </div>
            ) : (
              rawItems.map((item, idx) => {
                const exists = existingTitles.has(item.title.toUpperCase().trim());
                const isSelected = selectedTitles.has(item.title);

                return (
                  <label
                    key={idx}
                    onClick={(e) => {
                      if (exists) e.preventDefault();
                    }}
                    className={`flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer ${
                      exists
                        ? "opacity-40 bg-muted cursor-not-allowed"
                        : isSelected
                        ? "bg-primary/10 border border-primary/30"
                        : "bg-card hover:bg-accent/40"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={exists ? false : isSelected}
                        disabled={exists}
                        onChange={() => !exists && toggleItem(item.title)}
                        className="h-4 w-4 rounded accent-primary cursor-pointer disabled:cursor-not-allowed"
                      />
                      <span className="font-bold truncate">{item.title}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {item.lyric && (
                        <span className="text-[10px] bg-accent px-1.5 py-0.5 rounded font-extrabold text-accent-foreground">
                          Con letra
                        </span>
                      )}
                      {exists && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-extrabold">
                          Ya existe
                        </span>
                      )}
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Resumen e importación */}
        <div className="pt-3 border-t flex items-center justify-between gap-3">
          <span className="text-xs font-bold text-muted-foreground">
            {finalItemsToImport.length} {finalItemsToImport.length === 1 ? "seleccionada" : "seleccionadas"}
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
