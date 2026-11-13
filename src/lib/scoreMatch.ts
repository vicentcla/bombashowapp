import { normalize } from "@/lib/format";

export type MatchFile = { id: string; name: string };
export type MatchItem = {
  id: string;
  position: number;
  arrangement_id: string | null;
  title: string;
  pass_rank: number;
};
export type MatchEntry =
  | { item: MatchItem; state: "ok"; file: MatchFile; linked: boolean; extra?: MatchFile[] }
  | { item: MatchItem; state: "missing" }
  | { item: MatchItem; state: "ambiguous"; candidates: MatchFile[] };

const clean = (s: string) =>
  normalize(s.replace(/\.(pdf|png|jpe?g|webp)$/i, ""))
    .toLowerCase()
    .replace(/['’´`]/g, "")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .replace(/\bpopu\b/g, "popular")
    .trim();

const OTHER_PART = /\b(percu\w*|bateria|drum|bombo|caja)\b/;

function findFiles(title: string, files: MatchFile[]): MatchFile[] {
  const t = clean(title);
  if (!t) return [];
  const names = files.map((f) => ({ f, c: clean(f.name) }));
  let cands = names.filter((n) => n.c === t);
  if (!cands.length) cands = names.filter((n) => ` ${n.c} `.includes(` ${t} `));
  if (!cands.length) {
    const ts = t.replace(/ /g, "");
    cands = names.filter((n) => n.c.replace(/ /g, "").includes(ts));
  }
  if (cands.length > 1) {
    const pref = cands.filter((n) => !OTHER_PART.test(n.c));
    if (pref.length) cands = pref;
  }
  return cands.map((n) => n.f);
}

export function passRanks(notes: string | null): Record<string, number> {
  try {
    const n = JSON.parse(notes ?? "") as {
      section_order?: string[];
      passes?: { id: string }[];
      item_pass_map?: Record<string, string>;
    };
    const passIds = new Set((n.passes ?? []).map((p) => p.id));
    const order = (n.section_order ?? (n.passes ?? []).map((p) => p.id)).filter((id) =>
      passIds.has(id),
    );
    const out: Record<string, number> = {};
    for (const [item, pass] of Object.entries(n.item_pass_map ?? {})) {
      const r = order.indexOf(pass);
      out[item] = r < 0 ? 0 : r;
    }
    return out;
  } catch {
    return {};
  }
}

export function matchScores(
  items: MatchItem[],
  files: MatchFile[],
  links: { arrangement_id: string; file_id: string }[],
): MatchEntry[] {
  const sorted = [...items].sort((a, b) => a.pass_rank - b.pass_rank || a.position - b.position);
  return sorted.map((item) => {
    const link = item.arrangement_id
      ? links.find((l) => l.arrangement_id === item.arrangement_id)
      : undefined;
    const linked = link && files.find((f) => f.id === link.file_id);
    if (linked) return { item, state: "ok", file: linked, linked: true };
    const cands = findFiles(item.title, files);
    if (cands.length === 1) return { item, state: "ok", file: cands[0]!, linked: false };
    if (cands.length > 1) return { item, state: "ambiguous", candidates: cands };
    if (item.title.includes("+")) {
      const parts = item.title.split("+").map((p) => findFiles(p, files));
      const found = parts.filter((c) => c.length === 1).map((c) => c[0]!);
      if (found.length)
        return { item, state: "ok", file: found[0]!, linked: false, extra: found.slice(1) };
    }
    return { item, state: "missing" };
  });
}
