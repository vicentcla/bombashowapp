import { describe, expect, it } from "vitest";
import { generateSetlist } from "./setlistGenerator";

const songs = Array.from({ length: 30 }, (_, i) => ({ id: `s${i}`, duration: 150 + (i % 7) * 30 }));

describe("generateSetlist", () => {
  it("nunca sobrepasa el objetivo y queda como mucho 5 minutos por debajo", () => {
    for (const minutes of [30, 45, 60]) {
      const r = generateSetlist({ songs, history: [], targetSeconds: minutes * 60 });
      expect(r.total).toBeLessThanOrEqual(minutes * 60);
      expect(minutes * 60 - r.total).toBeLessThanOrEqual(300);
    }
  });

  it("no repite canciones", () => {
    const r = generateSetlist({ songs, history: [], targetSeconds: 60 * 60 });
    expect(new Set(r.ids).size).toBe(r.ids.length);
  });

  it("mantiene transiciones de setlists anteriores", () => {
    const history = [
      ["s1", "s2"],
      ["s1", "s2"],
      ["s1", "s2"],
    ];
    const two = [
      { id: "s1", duration: 600 },
      { id: "s2", duration: 600 },
      { id: "s3", duration: 600 },
    ];
    const r = generateSetlist({ songs: two, history, targetSeconds: 1200, random: () => 0 });
    expect(r.ids).toEqual(["s1", "s2"]);
  });
});
