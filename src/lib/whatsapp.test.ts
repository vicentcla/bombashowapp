import { describe, expect, it } from "vitest";
import { toUnicodeStyle, whatsappToUnicode } from "./format";

describe("whatsappToUnicode", () => {
  it("*hola* sale en negrita", () => {
    expect(whatsappToUnicode("di *hola*")).toBe("di " + toUnicodeStyle("hola", "bold"));
  });
  it("_hola_ sale en cursiva", () => {
    expect(whatsappToUnicode("_hola_")).toBe(toUnicodeStyle("hola", "italic"));
  });
  it("5 * 3 no cambia", () => {
    expect(whatsappToUnicode("5 * 3")).toBe("5 * 3");
  });
});
