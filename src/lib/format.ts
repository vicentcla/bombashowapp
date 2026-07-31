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

export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
