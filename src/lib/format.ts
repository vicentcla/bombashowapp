export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${String(rest).padStart(2, "0")}`;
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
  const percentage = targetSeconds > 0 ? Math.min(100, Math.round((addedSeconds / targetSeconds) * 100)) : 0;
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
