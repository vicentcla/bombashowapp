import { describe, expect, it } from "vitest";
import { matchScores } from "./scoreMatch";
import { digitsToValue, valueToDigits } from "@/components/DurationInput";

const item = (title: string) => ({
  id: title,
  title,
  position: 1,
  arrangement_id: null,
  pass_rank: 0,
});
const files = [
  { id: "a", name: "80s Dance-Saxo_1.pdf" },
  { id: "b", name: "Bombarock - Saxo 1.pdf" },
  { id: "c", name: "Mix Popular 2 - Saxo 1.pdf" },
  { id: "d", name: "Saranbomba-Percu.pdf" },
  { id: "e", name: "Saranbomba-Tuba.pdf" },
  { id: "f", name: "Miniaturas - Saxo.pdf" },
  { id: "g", name: "Umbrella - Sax 1.pdf" },
];
const ids = (t: string) => {
  const [r] = matchScores([item(t)], files, []);
  return r?.state === "ok" ? [r.file.id, ...(r.extra ?? []).map((f) => f.id)] : r?.state;
};

describe("nombres de partituras", () => {
  it("80'S DANCE encuentra 80s Dance", () => expect(ids("80'S DANCE")).toEqual(["a"]));
  it("BOMBA ROCK encuentra Bombarock", () => expect(ids("BOMBA ROCK")).toEqual(["b"]));
  it("Mix Popu 2 encuentra Mix Popular 2", () => expect(ids("Mix Popu 2")).toEqual(["c"]));
  it("SARANBOMBA prefiere la del instrumento y no la de percu", () =>
    expect(ids("SARANBOMBA")).toEqual(["e"]));
  it("MINIATURAS + UMBRELLA muestra las dos", () =>
    expect(ids("MINIATURAS + UMBRELLA")).toEqual(["f", "g"]));
});

describe("minutaje", () => {
  it("630 son 6 min 30 s", () => expect(digitsToValue("630")).toBe(390));
  it("130 en horas son 90 min", () => expect(digitsToValue("130")).toBe(90));
  it("63 s se muestra como 1:03", () => expect(valueToDigits(63)).toBe("103"));
});
