import React, { useState, KeyboardEvent } from "react";
import { X, Plus } from "lucide-react";
import { normalize } from "@/lib/format";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export function TagInput({
  tags,
  onChange,
  placeholder = "Escribe una etiqueta...",
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");

  const addTag = (rawTag: string) => {
    const trimmed = rawTag.trim();
    if (!trimmed) return;

    // Permite pegar etiquetas separadas por comas
    const newItems = trimmed
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const updated = [...tags];
    for (const item of newItems) {
      const itemNorm = normalize(item);
      // Evita duplicados sin distinguir mayús/minús ni acentos
      const exists = updated.some((t) => normalize(t) === itemNorm);
      if (!exists) {
        updated.push(item);
      }
    }

    onChange(updated);
    setInputValue("");
  };

  const removeTag = (indexToRemove: number) => {
    onChange(tags.filter((_, idx) => idx !== indexToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(inputValue);
    }
  };

  return (
    <div className="space-y-2">
      {/* Contenedor de etiquetas (chips) */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-1 rounded-md bg-background/50 border border-border/60 min-h-[36px] items-center">
          {tags.map((tag, idx) => (
            <span
              key={`${tag}-${idx}`}
              className="comic-sm inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary border border-primary/20"
            >
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => removeTag(idx)}
                className="rounded-full p-0.5 hover:bg-primary/20 transition-colors"
                title={`Eliminar ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input para nueva etiqueta */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="comic-sm min-w-0 flex-1 rounded-md bg-background px-3 py-2 text-sm font-normal outline-none border border-border focus:border-primary"
        />
        <button
          type="button"
          onClick={() => addTag(inputValue)}
          disabled={!inputValue.trim()}
          className="comic-sm comic-press flex items-center gap-1 rounded-md bg-primary/20 px-3 py-2 text-xs font-extrabold uppercase text-primary hover:bg-primary/30 disabled:opacity-40 disabled:pointer-events-none shrink-0"
        >
          <Plus className="h-3.5 w-3.5" /> Añadir
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground font-medium">
        Pulsa <kbd className="font-mono bg-muted px-1 rounded text-[10px]">Intro</kbd> o{" "}
        <kbd className="font-mono bg-muted px-1 rounded text-[10px]">,</kbd> para guardar la
        etiqueta e ingresar otra.
      </p>
    </div>
  );
}
