export type HapticKind = "light" | "medium" | "success" | "selection" | "double";

const PATTERNS: Record<HapticKind, number | number[]> = {
  light: 12,
  selection: 8,
  medium: 20,
  double: [10, 60, 10],
  success: [15, 50, 25],
};

export function haptic(kind: HapticKind = "light") {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    /* sin soporte */
  }
}
