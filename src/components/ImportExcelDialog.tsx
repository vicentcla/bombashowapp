import { useState } from "react";
import { X, Upload, Check, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type ImportItem = {
  title: string;
  duration_seconds: number;
  alPuesto: string;
};

// Arreglos preprocesados de la tabla proporcionada por el usuario (68 elementos válidos)
const PRESET_DATA: ImportItem[] = [
  { title: "80'S DANCE", duration_seconds: 270, alPuesto: "SÍ" },
  { title: "80'S POP", duration_seconds: 360, alPuesto: "SÍ" },
  { title: "ABBA GOLD", duration_seconds: 360, alPuesto: "SÍ" },
  { title: "ANDY Y LUCAS", duration_seconds: 220, alPuesto: "SÍ" },
  { title: "ANIMALITOS", duration_seconds: 0, alPuesto: "+ O -" },
  { title: "BAILA CON LA BOMBA", duration_seconds: 240, alPuesto: "+ O -" },
  { title: "BAKALAO SALAO", duration_seconds: 360, alPuesto: "" },
  { title: "BLACK IS BLACK", duration_seconds: 240, alPuesto: "SÍ" },
  { title: "BOMBA ESPAÑA", duration_seconds: 390, alPuesto: "SÍ" },
  { title: "BOMBA INDIE", duration_seconds: 450, alPuesto: "SÍ" },
  { title: "BOMBA KING", duration_seconds: 210, alPuesto: "+ O -" },
  { title: "BOMBA ROCK", duration_seconds: 420, alPuesto: "+ O -" },
  { title: "CAMELA", duration_seconds: 300, alPuesto: "SÍ" },
  { title: "CAÑA DE ESPAÑA", duration_seconds: 300, alPuesto: "+ O -" },
  { title: "CARIBE MIX", duration_seconds: 405, alPuesto: "SÍ" },
  { title: "CIAO CIAO MANU", duration_seconds: 360, alPuesto: "+ O -" },
  { title: "CLASSICAL ROCK", duration_seconds: 240, alPuesto: "+ O -" },
  { title: "CLASSICS", duration_seconds: 300, alPuesto: "SÍ" },
  { title: "CLAVADO EN UN BAR", duration_seconds: 180, alPuesto: "SÍ" },
  { title: "COMANDANTE CHE GUEVARA + LA BOLSA", duration_seconds: 240, alPuesto: "SÍ" },
  { title: "CORAZON ESPINADO", duration_seconds: 240, alPuesto: "+ O -" },
  { title: "CORAZON PARTIDO", duration_seconds: 250, alPuesto: "+ O -" },
  { title: "DISNEY", duration_seconds: 585, alPuesto: "SÍ" },
  { title: "EL CANTO DEL LOCO", duration_seconds: 210, alPuesto: "SÍ" },
  { title: "EL REY", duration_seconds: 180, alPuesto: "+ O -" },
  { title: "EL SUEÑO DE MORFEO", duration_seconds: 360, alPuesto: "+ O -" },
  { title: "ESCÁNDALO", duration_seconds: 0, alPuesto: "" },
  { title: "ESTOPA", duration_seconds: 270, alPuesto: "+ O -" },
  { title: "EXTREMODURO", duration_seconds: 390, alPuesto: "+ O -" },
  { title: "FIESTA", duration_seconds: 150, alPuesto: "SÍ" },
  { title: "FITOTERAPIA", duration_seconds: 390, alPuesto: "SÍ" },
  { title: "GIRLS", duration_seconds: 330, alPuesto: "+ O -" },
  { title: "HIMNO DE MI PEÑA", duration_seconds: 0, alPuesto: "" },
  { title: "INDIETOP", duration_seconds: 280, alPuesto: "SÍ" },
  { title: "INSURRECCIÓN", duration_seconds: 210, alPuesto: "+ O -" },
  { title: "LA CHOMBA", duration_seconds: 0, alPuesto: "" },
  { title: "LA MOROCHA", duration_seconds: 0, alPuesto: "" },
  { title: "LA OREJA", duration_seconds: 480, alPuesto: "SÍ" },
  { title: "LA PEGATINA", duration_seconds: 420, alPuesto: "+ O -" },
  { title: "LES POP QUE FALTAVEN", duration_seconds: 360, alPuesto: "SÍ" },
  { title: "MAMBOLINO", duration_seconds: 210, alPuesto: "+ O -" },
  { title: "MARTA, SEBAS, GUILLE Y LOS DEMÁS", duration_seconds: 150, alPuesto: "+ O -" },
  { title: "MEDITERRÀNIA", duration_seconds: 0, alPuesto: "" },
  { title: "MECANO", duration_seconds: 240, alPuesto: "+ O -" },
  { title: "MELIANDI", duration_seconds: 390, alPuesto: "SÍ" },
  { title: "MELIANDI 2.0", duration_seconds: 315, alPuesto: "SÍ" },
  { title: "MILONGA SENTIMENTAL", duration_seconds: 180, alPuesto: "SÍ" },
  { title: "MINIATURAS + UMBRELLA", duration_seconds: 180, alPuesto: "SÍ" },
  { title: "Mix Popu 2", duration_seconds: 440, alPuesto: "SÍ" },
  { title: "NENA", duration_seconds: 210, alPuesto: "+ O -" },
  { title: "NEW REMEMBER", duration_seconds: 300, alPuesto: "SÍ" },
  { title: "NIRVANA", duration_seconds: 150, alPuesto: "SÍ" },
  { title: "NO DUDARIA", duration_seconds: 210, alPuesto: "+ O -" },
  { title: "PEREZA", duration_seconds: 390, alPuesto: "SÍ" },
  { title: "POTRA SALVAJE", duration_seconds: 0, alPuesto: "" },
  { title: "RASPUTIN", duration_seconds: 210, alPuesto: "+ O -" },
  { title: "REGGAETON", duration_seconds: 300, alPuesto: "SÍ" },
  { title: "REMEMBER 3D", duration_seconds: 300, alPuesto: "+ O -" },
  { title: "ROCK DE CALLE", duration_seconds: 0, alPuesto: "" },
  { title: "SARANBOMBA", duration_seconds: 300, alPuesto: "SÍ" },
  { title: "SHAKIMIX", duration_seconds: 360, alPuesto: "" },
  { title: "SHINE ON + REMEMBER", duration_seconds: 390, alPuesto: "+ O -" },
  { title: "SKA-P", duration_seconds: 390, alPuesto: "+ O -" },
  { title: "TELEVISHOW", duration_seconds: 300, alPuesto: "SÍ" },
  { title: "TERUEL", duration_seconds: 0, alPuesto: "" },
  { title: "TOBOGÁN", duration_seconds: 0, alPuesto: "" },
  { title: "VERBENAS", duration_seconds: 360, alPuesto: "+ O -" },
  { title: "YOUNGBLOOD", duration_seconds: 255, alPuesto: "+ O -" },
];

function parseDurationText(str: string): number {
  if (!str || !str.trim()) return 0;
  const parts = str.trim().split(":");
  if (parts.length >= 2) {
    const mins = parseInt(parts[0], 10) || 0;
    const secs = parseInt(parts[1], 10) || 0;
    return mins * 60 + secs;
  }
  return 0;
}

function parsePastedTable(text: string): ImportItem[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const items: ImportItem[] = [];

  for (const line of lines) {
    // Si es cabecera, saltar
    if (line.toLowerCase().includes("nombre del arreglo") || line.startsWith("| ---")) continue;

    // Separar por tubos | o tabuladores
    const parts = line.includes("|")
      ? line.split("|").map((p) => p.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
      : line.split("\t").map((p) => p.trim());

    if (parts.length >= 1) {
      const title = parts[0];
      if (!title) continue;

      const durStr = parts[1] || "";
      const alPuesto = parts[2] || "";

      // Si AL PUESTO es NO, no añadir
      if (alPuesto.toUpperCase().trim() === "NO") continue;

      items.push({
        title: title.replace(/^"|"$/g, ""),
        duration_seconds: parseDurationText(durStr),
        alPuesto,
      });
    }
  }

  return items;
}

export function ImportExcelDialog({
  onClose,
  onImported,
  existingTitles,
}: {
  onClose: () => void;
  onImported: () => void;
  existingTitles: Set<string>;
}) {
  const [mode, setMode] = useState<"preset" | "paste">("preset");
  const [pastedText, setPastedText] = useState("");
  const [busy, setBusy] = useState(false);

  const itemsToImport =
    mode === "preset" ? PRESET_DATA : parsePastedTable(pastedText);

  // Filtrar los que no existan aún en la base de datos
  const newItems = itemsToImport.filter(
    (item) => !existingTitles.has(item.title.toUpperCase().trim())
  );

  async function handleImport() {
    if (newItems.length === 0) {
      toast.info("No hay canciones nuevas para importar (todas ya están en el repertorio).");
      return;
    }

    setBusy(true);
    try {
      const payload = newItems.map((item, idx) => ({
        title: item.title,
        duration_seconds: item.duration_seconds,
        tags: [],
        sort_order: existingTitles.size + idx + 1,
      }));

      const { error } = await supabase.from("arrangements").insert(payload);
      if (error) throw error;

      toast.success(`¡Se han añadido ${newItems.length} canciones al repertorio!`);
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
            <h2 className="text-2xl font-extrabold leading-none">Importar Arreglos</h2>
          </div>
          <button onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Pestañas de modo */}
        <div className="comic-sm flex rounded-md bg-muted p-1">
          <button
            onClick={() => setMode("preset")}
            className={`flex-1 rounded py-1.5 text-xs font-bold uppercase ${
              mode === "preset" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            Tabla proporcionada ({PRESET_DATA.length})
          </button>
          <button
            onClick={() => setMode("paste")}
            className={`flex-1 rounded py-1.5 text-xs font-bold uppercase ${
              mode === "paste" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            Pegar otro Excel / CSV
          </button>
        </div>

        {mode === "preset" ? (
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            <p className="text-xs text-muted-foreground font-semibold">
              Se han procesado las 68 canciones de tu lista (filtradas excluyendo las de "AL PUESTO = NO"):
            </p>
            <div className="comic-sm flex-1 overflow-y-auto rounded-md bg-background p-3 text-xs space-y-1.5 max-h-60">
              {PRESET_DATA.map((item, idx) => {
                const exists = existingTitles.has(item.title.toUpperCase().trim());
                const mins = Math.floor(item.duration_seconds / 60);
                const secs = item.duration_seconds % 60;
                const durFormatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-1.5 rounded ${
                      exists ? "opacity-40 bg-muted" : "bg-card"
                    }`}
                  >
                    <span className="font-bold">{item.title}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{durFormatted}</span>
                      {exists && <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded font-extrabold">Ya existe</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-2 flex-1 flex flex-col">
            <label className="text-xs font-bold uppercase">
              Pega aquí el contenido copiado de Excel / Tabla:
            </label>
            <textarea
              rows={6}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Pega las filas aquí..."
              className="comic-sm w-full rounded-md bg-background p-3 text-xs outline-none font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              Canciones válidas a añadir: <strong className="text-primary">{newItems.length}</strong>
            </p>
          </div>
        )}

        {/* Resumen e importación */}
        <div className="pt-2 border-t flex items-center justify-between gap-3">
          <span className="text-xs font-bold text-muted-foreground">
            {newItems.length} {newItems.length === 1 ? "canción nueva" : "canciones nuevas"}
          </span>
          <button
            onClick={handleImport}
            disabled={busy || newItems.length === 0}
            className="comic comic-press flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-xs font-extrabold uppercase text-primary-foreground disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {busy ? "Importando..." : `Importar ${newItems.length} arreglos`}
          </button>
        </div>
      </div>
    </div>
  );
}
