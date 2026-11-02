import { describe, expect, it } from "vitest";
import { backupSummary, parseBackup } from "./backup";

describe("parseBackup", () => {
  it("rechaza archivos que no son de la app", () => {
    expect(() => parseBackup({ app: "otra", version: 1 })).toThrow();
  });
  it("rechaza versiones futuras", () => {
    expect(() => parseBackup({ app: "la-bomba-show", version: 2 })).toThrow();
  });
  it("acepta una copia válida y cuenta sus filas", () => {
    const d = parseBackup({
      app: "la-bomba-show",
      version: 1,
      creado: "x",
      arrangements: [{}, {}],
    });
    expect(backupSummary(d)[0]).toEqual(["arreglos", 2]);
  });
});
