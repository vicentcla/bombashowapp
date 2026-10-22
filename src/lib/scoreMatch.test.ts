import { describe, expect, it } from "vitest";
import { matchScores, type MatchItem } from "./scoreMatch";

const it_ = (
  id: string,
  title: string,
  position: number,
  arr: string | null = null,
  pass_rank = 0,
): MatchItem => ({
  id,
  title,
  position,
  arrangement_id: arr,
  pass_rank,
});

const files = [
  { id: "f1", name: "Bomba.pdf" },
  { id: "f2", name: "Canción del verano.pdf" },
  { id: "f3", name: "Paquito - Trompeta 1.pdf" },
  { id: "f4", name: "Paquito - Trompeta 2.pdf" },
];

describe("matchScores", () => {
  it("sigue el orden del setlist, no el alfabético", () => {
    const r = matchScores([it_("a", "Cancion del verano", 1), it_("b", "Bomba", 2)], files, []);
    expect(r.map((e) => (e.state === "ok" ? e.file.id : null))).toEqual(["f2", "f1"]);
  });
  it("respeta canciones repetidas", () => {
    const r = matchScores([it_("a", "Bomba", 1), it_("b", "Bomba", 2)], files, []);
    expect(r.filter((e) => e.state === "ok")).toHaveLength(2);
  });
  it("marca ausentes sin omitirlas", () => {
    const r = matchScores([it_("a", "No existe", 1)], files, []);
    expect(r[0]!.state).toBe("missing");
  });
  it("no elige entre varios candidatos", () => {
    const r = matchScores([it_("a", "Paquito", 1)], files, []);
    expect(r[0]!.state).toBe("ambiguous");
  });
  it("usa la asociación guardada", () => {
    const r = matchScores([it_("a", "Paquito", 1, "x")], files, [
      { arrangement_id: "x", file_id: "f4" },
    ]);
    expect(r[0]!.state === "ok" && r[0]!.file.id).toBe("f4");
  });
  it("ordena por pase antes que por posición", () => {
    const r = matchScores([it_("a", "Bomba", 1, null, 1), it_("b", "Paquito", 2, "x", 0)], files, [
      { arrangement_id: "x", file_id: "f3" },
    ]);
    expect(r[0]!.item.id).toBe("b");
  });
});
