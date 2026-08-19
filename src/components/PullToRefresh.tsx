import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

const TRIGGER_PX = 70;
const MAX_PULL_PX = 110;

/**
 * Refrescar deslizando hacia abajo (solo táctil / móvil).
 * Al soltar por encima del umbral, refetch de todas las queries activas.
 */
export function PullToRefresh({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullRef = useRef(0);

  useEffect(() => {
    pullRef.current = pull;
  }, [pull]);

  const onTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (refreshing) return;
      if (typeof window !== "undefined" && window.scrollY > 0) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0]?.clientY ?? null;
    },
    [refreshing],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (startY.current === null || refreshing) return;
      const y = e.touches[0]?.clientY ?? 0;
      const delta = y - startY.current;
      if (delta <= 0) {
        setPull(0);
        return;
      }
      if (window.scrollY > 0) {
        startY.current = null;
        setPull(0);
        return;
      }
      // resistencia elástica
      setPull(Math.min(MAX_PULL_PX, delta * 0.5));
    },
    [refreshing],
  );

  const onTouchEnd = useCallback(async () => {
    const distance = pullRef.current;
    startY.current = null;
    if (distance < TRIGGER_PX) {
      setPull(0);
      return;
    }
    setRefreshing(true);
    setPull(TRIGGER_PX);
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(10);
      await queryClient.refetchQueries({ type: "active" });
    } finally {
      setRefreshing(false);
      setPull(0);
    }
  }, [queryClient]);

  const active = pull > 0 || refreshing;

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      className="w-full"
    >
      <div
        className="pointer-events-none flex items-center justify-center overflow-hidden md:hidden"
        style={{
          height: active ? pull : 0,
          transition: startY.current === null ? "height 200ms ease" : undefined,
        }}
      >
        <span
          className="glass-strong flex h-9 w-9 items-center justify-center rounded-full text-primary"
          style={{ opacity: Math.min(1, pull / TRIGGER_PX) }}
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }}
          />
        </span>
      </div>
      {children}
    </div>
  );
}
