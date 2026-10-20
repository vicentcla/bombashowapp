import { useEffect, useRef, useState, type ReactNode } from "react";

const MIN = 1;
const MAX = 4;
const FIT = 2;

type T = { s: number; x: number; y: number };

export function ZoomLayer({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [t, setT] = useState<T>({ s: 1, x: 0, y: 0 });
  const [anim, setAnim] = useState(false);
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const pts = new Map<number, { x: number; y: number }>();
    let start: { d: number; cx: number; cy: number; t: T } | null = null;
    let last: { x: number; y: number } | null = null;
    let lastTap = 0;
    let moved = false;

    const clamp = (n: T): T => {
      const r = el.getBoundingClientRect();
      const s = Math.min(MAX, Math.max(MIN, n.s));
      const minX = r.width - r.width * s;
      const minY = r.height - r.height * s;
      return { s, x: Math.min(0, Math.max(minX, n.x)), y: Math.min(0, Math.max(minY, n.y)) };
    };
    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const zoomAt = (from: T, s: number, px: number, py: number): T => {
      const k = s / from.s;
      return { s, x: px - (px - from.x) * k, y: py - (py - from.y) * k };
    };
    const twoInfo = () => {
      const [a, b] = [...pts.values()];
      return { d: Math.hypot(a!.x - b!.x, a!.y - b!.y), cx: (a!.x + b!.x) / 2, cy: (a!.y + b!.y) / 2 };
    };

    const down = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, local(e));
      setAnim(false);
      if (pts.size === 2) {
        start = { ...twoInfo(), t: tRef.current };
        moved = true;
      } else if (pts.size === 1) {
        last = local(e);
        moved = false;
      }
    };
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      const p = local(e);
      pts.set(e.pointerId, p);
      if (pts.size >= 2 && start) {
        const i = twoInfo();
        const s = Math.min(MAX, Math.max(MIN, start.t.s * (i.d / start.d)));
        const z = zoomAt(start.t, s, start.cx, start.cy);
        setT(clamp({ s, x: z.x + (i.cx - start.cx), y: z.y + (i.cy - start.cy) }));
      } else if (pts.size === 1 && last) {
        const dx = p.x - last.x;
        const dy = p.y - last.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        last = p;
        const c = tRef.current;
        if (c.s > 1) setT(clamp({ s: c.s, x: c.x + dx, y: c.y + dy }));
      }
    };
    const up = (e: PointerEvent) => {
      const p = local(e);
      pts.delete(e.pointerId);
      if (pts.size < 2) start = null;
      if (pts.size === 1) last = [...pts.values()][0]!;
      if (pts.size === 0) {
        last = null;
        if (!moved) {
          const now = Date.now();
          if (now - lastTap < 300) {
            lastTap = 0;
            setAnim(true);
            const c = tRef.current;
            setT(c.s > 1.05 ? { s: 1, x: 0, y: 0 } : clamp(zoomAt(c, FIT, p.x, p.y)));
          } else lastTap = now;
        }
      }
    };
    const block = (e: Event) => e.preventDefault();

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("touchmove", block, { passive: false });
    el.addEventListener("gesturestart", block);
    el.addEventListener("gesturechange", block);
    el.addEventListener("dblclick", block);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("touchmove", block);
      el.removeEventListener("gesturestart", block);
      el.removeEventListener("gesturechange", block);
      el.removeEventListener("dblclick", block);
    };
  }, []);

  return (
    <div ref={box} className="absolute inset-0 touch-none select-none overflow-hidden">
      <div
        className="absolute inset-0 origin-top-left will-change-transform"
        style={{
          transform: `translate3d(${t.x}px, ${t.y}px, 0) scale(${t.s})`,
          transition: anim ? "transform 220ms ease-out" : "none",
        }}
      >
        {children}
      </div>
      {t.s > 1.05 && (
        <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-card/70 px-3 py-1 text-[11px] font-bold backdrop-blur">
          {Math.round(t.s * 100)}%
        </span>
      )}
    </div>
  );
}
