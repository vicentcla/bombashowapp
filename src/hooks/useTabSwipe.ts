import { useRef, type TouchEvent } from "react";

const SWIPE_THRESHOLD_PX = 64;
const MAX_HOLD_MS = 300;

/**
 * Detecta deslices horizontales en el contenido para viajar entre pestañas.
 * `dir` es 1 (siguiente pestaña, deslizar a la izquierda) o -1 (anterior).
 * Devuelve los handlers para extender sobre el contenedor de contenido.
 */
export function useTabSwipe(onSwipe: (dir: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);

  return {
    onTouchStart: (e: TouchEvent<HTMLElement>) => {
      const touch = e.touches[0];
      if (!touch) return;
      start.current = { x: touch.clientX, y: touch.clientY, t: Date.now() };
    },
    onTouchEnd: (e: TouchEvent<HTMLElement>) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - s.x;
      const dy = touch.clientY - s.y;
      if (Date.now() - s.t > MAX_HOLD_MS) return;
      if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) <= Math.abs(dy)) return;
      onSwipe(dx < 0 ? 1 : -1);
    },
  };
}
