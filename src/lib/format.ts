export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${String(rest).padStart(2, "0")}`;
}

/** Formatea una cadena de dígitos (mmss) como mm:ss con los dos puntos automáticos. */
export function formatDurationInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (!digits) return "";
  if (digits.length <= 2) return `0:${digits.padStart(2, "0")}`;
  return `${digits.slice(0, -2)}:${digits.slice(-2)}`;
}

/** Convierte los dígitos de un campo mm:ss (p. ej. "245" => 2:45) a segundos. */
export function durationInputToSeconds(raw: string): number {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (!digits) return 0;
  if (digits.length <= 2) return parseInt(digits, 10) || 0;
  return (parseInt(digits.slice(0, -2), 10) || 0) * 60 + (parseInt(digits.slice(-2), 10) || 0);
}

/** Convierte segundos a dígitos para pre-rellenar el campo mm:ss (p. ej. 165 => "245"). */
export function durationSecondsToInput(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return m > 0 ? `${m}${String(rest).padStart(2, "0")}` : String(rest).padStart(2, "0");
}

export function formatLongDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(rest).padStart(2, "0")}s`;
  return `${m}m ${String(rest).padStart(2, "0")}s`;
}

export function formatMinutesToHours(totalMinutes: number): string {
  const m = Math.max(0, Math.floor(totalMinutes));
  const h = Math.floor(m / 60);
  const restM = m % 60;
  if (h > 0) {
    return restM > 0 ? `${h}h ${restM}min` : `${h}h`;
  }
  return `${m}min`;
}

export function formatTimeComparison(addedSeconds: number, targetMinutes: number) {
  const targetSeconds = targetMinutes * 60;
  const percentage =
    targetSeconds > 0 ? Math.min(100, Math.round((addedSeconds / targetSeconds) * 100)) : 0;
  const diffSeconds = addedSeconds - targetSeconds;

  let status: "pending" | "exact" | "exceeded" = "pending";
  if (targetSeconds > 0) {
    if (Math.abs(diffSeconds) <= 60) status = "exact";
    else if (diffSeconds > 60) status = "exceeded";
  }

  return {
    percentage,
    status,
    diffSeconds,
    addedText: formatLongDuration(addedSeconds),
    targetText: formatMinutesToHours(targetMinutes),
    diffText:
      targetSeconds === 0
        ? "Sin objetivo"
        : diffSeconds === 0
          ? "¡Duración exacta!"
          : diffSeconds > 0
            ? `+${formatLongDuration(diffSeconds)}`
            : `-${formatLongDuration(Math.abs(diffSeconds))}`,
  };
}

const ALLOWED_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "P", "BR", "DIV", "HR", "SPAN"]);

/** Limpia el HTML del editor dejando solo negrita, cursiva, subrayado y saltos. */
export function sanitizeLyricsHtml(html: string): string {
  if (typeof document === "undefined") return html;
  const root = document.createElement("div");
  root.innerHTML = html;

  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      walk(child);
      if (!ALLOWED_TAGS.has(child.tagName)) {
        child.replaceWith(...Array.from(child.childNodes));
      } else {
        for (const attr of Array.from(child.attributes)) {
          child.removeAttribute(attr.name);
        }
      }
    }
  };
  walk(root);
  return root.innerHTML;
}

export function htmlToPlainText(html: string): string {
  if (typeof document === "undefined") return html.replace(/<[^>]*>/g, " ");
  const el = document.createElement("div");
  el.innerHTML = html;
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Formatea un texto plano de letra con subtítulos iniciados por '-' en HTML con negritas y separadores. */
export function formatLyricsWithSubtitles(text: string): string {
  if (!text || !text.trim()) return "";

  // Si ya es HTML con etiquetas de párrafo o bloques, retornamos saneado
  if (text.includes("<p>") || text.includes("<div>") || text.includes("<br")) {
    return sanitizeLyricsHtml(text);
  }

  const lines = text.split("\n");
  const htmlParts: string[] = [];
  let currentParagraph: string[] = [];
  let isFirstSubtitle = true;

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      htmlParts.push(`<p>${currentParagraph.join("<br />")}</p>`);
      currentParagraph = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("-")) {
      flushParagraph();
      if (!isFirstSubtitle) {
        htmlParts.push("<hr />");
      }
      isFirstSubtitle = false;
      // Quitar el guión inicial para que el subtítulo muestre solo el texto en negrita
      const subtitleText = trimmed.replace(/^-+\s*/, "").trim();
      htmlParts.push(`<p><strong>${subtitleText}</strong></p>`);
    } else if (trimmed === "") {
      flushParagraph();
    } else {
      currentParagraph.push(trimmed);
    }
  }
  flushParagraph();

  return htmlParts.join("");
}

export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export type UnicodeStyle = "bold" | "italic" | "boldItalic" | "mono";

type UnicodeRanges = {
  upper: [number, number];
  lower: [number, number];
  digits?: [number, number];
};

const UNICODE_STYLE_RANGES: Record<UnicodeStyle, UnicodeRanges> = {
  bold: { upper: [0x1d400, 0x1d419], lower: [0x1d41a, 0x1d433], digits: [0x1d7ce, 0x1d7d7] },
  italic: { upper: [0x1d434, 0x1d44d], lower: [0x1d44e, 0x1d467] },
  boldItalic: { upper: [0x1d468, 0x1d481], lower: [0x1d482, 0x1d49b] },
  mono: { upper: [0x1d670, 0x1d689], lower: [0x1d68a, 0x1d6a3], digits: [0x1d7f6, 0x1d7ff] },
};

// La 'h' minúscula en itálica (U+1D455) no está asignada en este bloque Unicode.
const ITALIC_LOWER_H_GAP = 0x1d455;

/** Convierte un texto a una tipografía Unicode (negrita, cursiva, etc.). */
export function toUnicodeStyle(text: string, style: UnicodeStyle): string {
  const ranges = UNICODE_STYLE_RANGES[style];
  return Array.from(text)
    .map((char) => {
      const cp = char.codePointAt(0)!;
      if (cp >= 0x41 && cp <= 0x5a) return String.fromCodePoint(ranges.upper[0] + (cp - 0x41));
      if (cp >= 0x61 && cp <= 0x7a) {
        const target = ranges.lower[0] + (cp - 0x61);
        if (style === "italic" && target === ITALIC_LOWER_H_GAP) return char;
        return String.fromCodePoint(target);
      }
      if (cp >= 0x30 && cp <= 0x39 && ranges.digits) {
        return String.fromCodePoint(ranges.digits[0] + (cp - 0x30));
      }
      return char;
    })
    .join("");
}

/** Convierte de vuelta a texto plano las tipografías Unicode (quita negrita/cursiva/mono). */
export function cleanUnicodeStyle(text: string): string {
  const reverse = new Map<number, string>();
  for (const style of Object.keys(UNICODE_STYLE_RANGES) as UnicodeStyle[]) {
    const r = UNICODE_STYLE_RANGES[style];
    const add = (start: number, base: number, count: number) => {
      for (let i = 0; i < count; i++) reverse.set(start + i, String.fromCharCode(base + i));
    };
    add(r.upper[0], 0x41, 26);
    add(r.lower[0], 0x61, 26);
    if (r.digits) add(r.digits[0], 0x30, 10);
  }
  return Array.from(text)
    .map((char) => {
      const cp = char.codePointAt(0)!;
      return reverse.get(cp) ?? char;
    })
    .join("");
}
