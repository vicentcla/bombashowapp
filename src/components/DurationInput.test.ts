import { describe, expect, it } from "vitest";
import { digitsToValue, nextDurationDigits } from "./DurationInput";

describe("entrada de minutaje", () => {
  it("permite escribir 630 desde un campo vacío como 6 minutos y 30 segundos", () => {
    let digits = nextDurationDigits("", "6");
    expect(digits).toBe("6");
    digits = nextDurationDigits(digits, "0:063");
    expect(digits).toBe("63");
    digits = nextDurationDigits(digits, "0:630");
    expect(digits).toBe("630");
    expect(digitsToValue(digits)).toBe(390);
  });

  it("permite pegar 630 en un campo vacío", () => {
    expect(digitsToValue(nextDurationDigits("", "630"))).toBe(390);
  });

  it("permite borrar el último dígito y volver a escribir desde vacío", () => {
    expect(nextDurationDigits("6", "0:0")).toBe("");
    expect(nextDurationDigits("", "3")).toBe("3");
  });
});
