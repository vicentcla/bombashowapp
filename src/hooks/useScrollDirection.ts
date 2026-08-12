import { useEffect, useRef, useState } from "react";

type ScrollState = "up" | "down" | "idle";

const IDLE_DELAY = 1400; // ms sin scroll → "idle"
const THRESHOLD = 6;     // px mínimos para considerar dirección

export function useScrollDirection(): ScrollState {
  const [state, setState] = useState<ScrollState>("idle");
  const lastY = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function clearIdle() {
      if (idleTimer.current) {
        clearTimeout(idleTimer.current);
        idleTimer.current = null;
      }
    }

    function scheduleIdle() {
      clearIdle();
      idleTimer.current = setTimeout(() => setState("idle"), IDLE_DELAY);
    }

    function onScroll() {
      const y = window.scrollY;
      const delta = y - lastY.current;

      if (Math.abs(delta) >= THRESHOLD) {
        setState(delta > 0 ? "down" : "up");
        lastY.current = y;
      }

      scheduleIdle();
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    scheduleIdle(); // empieza en idle

    return () => {
      window.removeEventListener("scroll", onScroll);
      clearIdle();
    };
  }, []);

  return state;
}
