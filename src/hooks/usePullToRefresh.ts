import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

const PULL_THRESHOLD = 72; // px necesarios para activar el refresco
const MAX_PULL = 110; // máximo desplazamiento visual

export function usePullToRefresh() {
  const queryClient = useQueryClient();
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (window.scrollY > 0) return;
      const touch = e.touches[0];
      if (!touch) return;
      startY.current = touch.clientY;
      pulling.current = true;
    }

    function onTouchMove(e: TouchEvent) {
      if (!pulling.current || refreshing) return;
      const touch = e.touches[0];
      if (!touch) return;
      const delta = touch.clientY - startY.current;
      if (delta <= 0) {
        setPullY(0);
        return;
      }
      // Resistencia progresiva (rubber-band)
      const capped = Math.min(delta * 0.45, MAX_PULL);
      setPullY(capped);
    }

    async function onTouchEnd() {
      if (!pulling.current) return;
      pulling.current = false;
      if (pullY >= PULL_THRESHOLD && !refreshing) {
        setRefreshing(true);
        try {
          await queryClient.invalidateQueries();
        } finally {
          setRefreshing(false);
        }
      }
      setPullY(0);
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [pullY, refreshing, queryClient]);

  return { pullY, refreshing, threshold: PULL_THRESHOLD };
}
