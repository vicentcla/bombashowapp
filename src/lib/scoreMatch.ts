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
  | { item: MatchItem; state: "ok"; file: MatchFile; linked: boolean }
  | { item: MatchItem; state: "missing" }
  | { item: MatchItem; state: "ambiguous"; candidates: MatchFile[] };

const clean = (s: string) =>
  normalize(s.replace(/\.(pdf|png|jpe?g|webp)$/i, ""))
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();

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
    const t = clean(item.title);
    if (!t) return { item, state: "missing" };
    const exact = files.filter((f) => clean(f.name) === t);
    const cands = exact.length ? exact : files.filter((f) => ` ${clean(f.name)} `.includes(` ${t} `));
    if (cands.length === 1) return { item, state: "ok", file: cands[0]!, linked: false };
    if (cands.length === 0) return { item, state: "missing" };
    return { item, state: "ambiguous", candidates: cands };
  });
}
