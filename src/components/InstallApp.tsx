import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, MoreVertical, PlusSquare, Share, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type PromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: PromptEvent | null = null;
let installed = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
let listening = false;

function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as PromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    emit();
  });
}
listen();

const DISMISS_KEY = "install_invite_dismissed";

export type Platform = "ios" | "android" | "inapp" | "desktop";

export function detectPlatform(ua: string): Platform {
  if (/FBAN|FBAV|Instagram|WhatsApp|Line\/|Telegram|TikTok|Snapchat|; wv\)/i.test(ua))
    return "inapp";
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua))) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

function isStandalone() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches
  );
}

function useInstallState() {
  const snap = useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => (deferred ? 1 : 0) + (installed ? 2 : 0),
    () => 0,
  );
  const [info, setInfo] = useState<{ platform: Platform; standalone: boolean } | null>(null);
  useEffect(() => {
    const ipad = navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent);
    setInfo({
      platform: ipad ? "ios" : detectPlatform(navigator.userAgent),
      standalone: isStandalone(),
    });
  }, []);
  return {
    canPrompt: (snap & 1) === 1,
    installed: (snap & 2) === 2 || !!info?.standalone,
    platform: info?.platform ?? null,
  };
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground">
        {n}
      </span>
      <span className="min-w-0 text-sm font-bold leading-6">{children}</span>
    </li>
  );
}

function Guide({ platform, onClose }: { platform: Platform; onClose: () => void }) {
  if (platform === "inapp")
    return (
      <div className="space-y-3">
        <p className="text-sm font-bold">
          Estás dentro de otra app (WhatsApp, Instagram…), que no permite instalar páginas.
        </p>
        <ol className="space-y-3">
          <Step n={1}>
            Pulsa el menú <MoreVertical className="inline h-4 w-4" /> o{" "}
            <Share className="inline h-4 w-4" /> de esa app.
          </Step>
          <Step n={2}>
            Elige <b>«Abrir en el navegador»</b> (Safari en iPhone, Chrome en Android).
          </Step>
          <Step n={3}>Ahí vuelve a pulsar «Instalar La Bomba».</Step>
        </ol>
      </div>
    );
  if (platform === "ios")
    return (
      <ol className="space-y-3">
        <Step n={1}>
          Abre esta página en <b>Safari</b>.
        </Step>
        <Step n={2}>
          Pulsa <b>Compartir</b> <Share className="inline h-4 w-4" /> (abajo o arriba de la
          pantalla).
        </Step>
        <Step n={3}>
          Baja y toca <b>«Añadir a pantalla de inicio»</b>{" "}
          <PlusSquare className="inline h-4 w-4" />.
        </Step>
        <Step n={4}>
          Pulsa <b>«Añadir»</b>. Abre La Bomba desde su icono.
        </Step>
      </ol>
    );
  if (platform === "android")
    return (
      <ol className="space-y-3">
        <Step n={1}>
          Abre esta página en <b>Chrome</b>.
        </Step>
        <Step n={2}>
          Pulsa el menú <MoreVertical className="inline h-4 w-4" /> (arriba a la derecha).
        </Step>
        <Step n={3}>
          Toca <b>«Instalar aplicación»</b> o <b>«Añadir a pantalla de inicio»</b>.
        </Step>
      </ol>
    );
  return (
    <div className="space-y-3">
      <ol className="space-y-3">
        <Step n={1}>Usa Chrome o Edge en el ordenador.</Step>
        <Step n={2}>
          Pulsa el icono de instalar <Download className="inline h-4 w-4" /> en la barra de
          direcciones, o menú → «Instalar La Bomba Show».
        </Step>
      </ol>
      <button onClick={onClose} className="sr-only">
        Cerrar
      </button>
    </div>
  );
}

export function InstallButton({ className = "" }: { className?: string }) {
  const { canPrompt, installed, platform } = useInstallState();
  const [open, setOpen] = useState(false);
  if (!platform) return null;
  if (installed)
    return (
      <p className="text-sm font-bold text-muted-foreground">
        Ya estás usando La Bomba como app instalada.
      </p>
    );
  async function click() {
    if (deferred) {
      const ev = deferred;
      await ev.prompt();
      await ev.userChoice.catch(() => null);
      deferred = null;
      emit();
      return;
    }
    setOpen(true);
  }
  return (
    <>
      <button
        type="button"
        onClick={() => void click()}
        className={`comic-sm comic-press flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-extrabold text-primary-foreground ${className}`}
      >
        <Download className="h-4 w-4" />
        Instalar La Bomba
      </button>
      {!canPrompt && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Instalar La Bomba</DialogTitle>
            </DialogHeader>
            <Guide platform={platform} onClose={() => setOpen(false)} />
            <p className="text-xs font-bold text-muted-foreground">
              Cuando aparezca el icono en tu pantalla de inicio, ábrela desde ahí.
            </p>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

export function InstallInvite() {
  const { installed, platform } = useInstallState();
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    setHidden(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);
  if (!platform || installed || hidden || platform === "desktop") return null;
  return (
    <div className="mx-auto mt-2 flex max-w-5xl items-center gap-2 px-3 sm:px-4">
      <div className="glass flex w-full items-center gap-2 rounded-xl px-3 py-2">
        <p className="min-w-0 flex-1 text-xs font-bold">Ten La Bomba en tu pantalla de inicio.</p>
        <InstallButton className="min-h-9 px-3 py-1.5 text-xs" />
        <button
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setHidden(true);
          }}
          aria-label="No mostrar más"
          className="rounded-md p-1.5 text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
