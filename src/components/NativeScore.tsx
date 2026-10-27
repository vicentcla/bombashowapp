import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDriveFile } from "@/lib/drive.functions";
import { ReportProblem } from "@/components/ReportProblem";
import { sanitizeReportText } from "@/lib/reportDiagnostics";

const MIN = 1;
const MAX = 4;
const FIT = 2;
const MAX_PIXELS = 12_000_000;

type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
  destroy: () => Promise<void>;
};
type PdfPage = {
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }) => { promise: Promise<void>; cancel: () => void };
};

function decode(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function NativeScore({ fileId, name }: { fileId: string; name: string }) {
  const fetchFile = useServerFn(getDriveFile);
  const file = useQuery({
    queryKey: ["drive_file", fileId],
    queryFn: () => fetchFile({ data: { fileId } }),
    staleTime: 30 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [scale, setScale] = useState(1);
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [sizes, setSizes] = useState<{ w: number; h: number }[]>([]);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const pendingScroll = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const d = file.data;
    if (!d) return;
    if (d.status !== "ok") {
      setErr(d.message);
      return;
    }
    const bytes = decode(d.base64);
    if (d.mimeType.startsWith("image/")) {
      const url = URL.createObjectURL(new Blob([bytes], { type: d.mimeType }));
      setImgUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    let cancelled = false;
    let loaded: PdfDoc | null = null;
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const pdf = (await pdfjs.getDocument({ data: bytes }).promise) as unknown as PdfDoc;
        loaded = pdf;
        const s: { w: number; h: number }[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const v = (await pdf.getPage(i)).getViewport({ scale: 1 });
          s.push({ w: v.width, h: v.height });
        }
        if (cancelled) return;
        setSizes(s);
        setDoc(pdf);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "No se pudo abrir el PDF");
      }
    })();
    return () => {
      cancelled = true;
      void loaded?.destroy();
    };
  }, [file.data]);

  const pageW = width * scale;

  useEffect(() => {
    if (!doc || !width) return;
    let stop = false;
    const tasks: { cancel: () => void }[] = [];
    const t = setTimeout(async () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      for (let i = 0; i < doc.numPages && !stop; i++) {
        const c = canvases.current[i];
        const sz = sizes[i];
        if (!c || !sz) continue;
        const page = await doc.getPage(i + 1);
        let k = (pageW * dpr) / sz.w;
        const px = sz.w * k * sz.h * k;
        if (px > MAX_PIXELS) k *= Math.sqrt(MAX_PIXELS / px);
        const vp = page.getViewport({ scale: k });
        const off = document.createElement("canvas");
        off.width = Math.floor(vp.width);
        off.height = Math.floor(vp.height);
        const ctx = off.getContext("2d");
        if (!ctx || stop) continue;
        const task = page.render({ canvasContext: ctx, viewport: vp });
        tasks.push(task);
        try {
          await task.promise;
        } catch {
          continue;
        }
        if (stop) return;
        c.width = off.width;
        c.height = off.height;
        c.getContext("2d")?.drawImage(off, 0, 0);
      }
    }, 120);
    return () => {
      stop = true;
      clearTimeout(t);
      tasks.forEach((x) => x.cancel());
    };
  }, [doc, sizes, pageW, width]);

  useLayoutEffect(() => {
    const el = box.current;
    const p = pendingScroll.current;
    if (el && p) {
      el.scrollLeft = p.x;
      el.scrollTop = p.y;
      pendingScroll.current = null;
    }
  }, [scale]);

  useEffect(() => {
    const el = box.current;
    const content = inner.current;
    if (!el || !content) return;
    let pinch: { d: number; fx: number; fy: number; sx: number; sy: number } | null = null;
    let ratio = 1;
    let lastTap = 0;
    let tapStart: { x: number; y: number; t: number } | null = null;

    const dist = (e: TouchEvent) => {
      const a = e.touches[0]!;
      const b = e.touches[1]!;
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    };
    const commit = (next: number, fx: number, fy: number, sx: number, sy: number) => {
      const cur = scaleRef.current;
      const s = Math.min(MAX, Math.max(MIN, next));
      const r = s / cur;
      pendingScroll.current = { x: (sx + fx) * r - fx, y: (sy + fy) * r - fy };
      setScale(s);
    };

    const start = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const r = el.getBoundingClientRect();
        const a = e.touches[0]!;
        const b = e.touches[1]!;
        pinch = {
          d: dist(e),
          fx: (a.clientX + b.clientX) / 2 - r.left,
          fy: (a.clientY + b.clientY) / 2 - r.top,
          sx: el.scrollLeft,
          sy: el.scrollTop,
        };
        ratio = 1;
        tapStart = null;
      } else if (e.touches.length === 1) {
        const t = e.touches[0]!;
        tapStart = { x: t.clientX, y: t.clientY, t: Date.now() };
      }
    };
    const move = (e: TouchEvent) => {
      if (pinch && e.touches.length === 2) {
        e.preventDefault();
        const cur = scaleRef.current;
        ratio = Math.min(MAX / cur, Math.max(MIN / cur, dist(e) / pinch.d));
        content.style.transformOrigin = `${pinch.sx + pinch.fx}px ${pinch.sy + pinch.fy}px`;
        content.style.transform = `scale(${ratio})`;
      } else if (tapStart && e.touches.length === 1) {
        const t = e.touches[0]!;
        if (Math.abs(t.clientX - tapStart.x) + Math.abs(t.clientY - tapStart.y) > 10)
          tapStart = null;
      }
    };
    const end = (e: TouchEvent) => {
      if (pinch && e.touches.length < 2) {
        const p = pinch;
        pinch = null;
        content.style.transform = "";
        commit(scaleRef.current * ratio, p.fx, p.fy, p.sx, p.sy);
        return;
      }
      if (tapStart && e.touches.length === 0 && Date.now() - tapStart.t < 250) {
        const now = Date.now();
        if (now - lastTap < 300) {
          e.preventDefault();
          lastTap = 0;
          const r = el.getBoundingClientRect();
          const cur = scaleRef.current;
          commit(
            cur > 1.05 ? 1 : FIT,
            tapStart.x - r.left,
            tapStart.y - r.top,
            el.scrollLeft,
            el.scrollTop,
          );
        } else lastTap = now;
      }
      tapStart = null;
    };
    const dbl = (e: MouseEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      commit(
        scaleRef.current > 1.05 ? 1 : FIT,
        e.clientX - r.left,
        e.clientY - r.top,
        el.scrollLeft,
        el.scrollTop,
      );
    };
    const block = (e: Event) => e.preventDefault();

    el.addEventListener("touchstart", start, { passive: false });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end, { passive: false });
    el.addEventListener("touchcancel", end);
    el.addEventListener("dblclick", dbl);
    el.addEventListener("gesturestart", block);
    el.addEventListener("gesturechange", block);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
      el.removeEventListener("dblclick", dbl);
      el.removeEventListener("gesturestart", block);
      el.removeEventListener("gesturechange", block);
    };
  }, []);

  const displayError = err || (file.error ? "No se pudo cargar la partitura" : null);
  const loading = !displayError && !imgUrl && !doc;

  return (
    <div
      ref={box}
      className="absolute inset-0 overflow-auto overscroll-contain bg-muted/40"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <div
        ref={inner}
        className="flex flex-col items-start gap-2 py-2"
        style={{ width: pageW || "100%" }}
      >
        {imgUrl && <img src={imgUrl} alt={name} style={{ width: pageW }} className="block" />}
        {doc &&
          sizes.map((sz, i) => (
            <canvas
              key={i}
              ref={(c) => {
                canvases.current[i] = c;
              }}
              className="block bg-white shadow"
              style={{ width: pageW, height: (pageW * sz.h) / sz.w }}
            />
          ))}
      </div>
      {loading && (
        <p className="absolute inset-0 flex items-center justify-center text-sm font-bold text-muted-foreground">
          Abriendo partitura…
        </p>
      )}
      {displayError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-sm font-bold text-muted-foreground">
          <p>{sanitizeReportText(displayError)}</p>
          <div className="w-full max-w-sm">
            <ReportProblem error={sanitizeReportText(displayError)} archivoId={fileId} />
          </div>
        </div>
      )}
      {scale > 1.05 && (
        <span className="pointer-events-none fixed bottom-[max(env(safe-area-inset-bottom),0.75rem)] left-1/2 -translate-x-1/2 rounded-full bg-card/70 px-3 py-1 text-[11px] font-bold backdrop-blur">
          {Math.round(scale * 100)}%
        </span>
      )}
    </div>
  );
}
