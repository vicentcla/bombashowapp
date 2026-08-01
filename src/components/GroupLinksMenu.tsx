import { useEffect, useState } from "react";
import { Link2, X, FolderOpen, Camera, ExternalLink } from "lucide-react";

type GroupLink = {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
};

const GROUP_LINKS: GroupLink[] = [
  {
    id: "drive",
    label: "Google Drive del grupo",
    href: "https://drive.google.com/drive/folders/1SJs1eIj7suxJL_eD9W0_m5rCBdva5jUi?usp=share_link",
    icon: <FolderOpen className="h-4 w-4" />,
  },
  {
    id: "instagram",
    label: "Instagram de La Bomba Show",
    href: "https://www.instagram.com/showlabomba?igsh=MTIweG1tM2luN3Jjbw==",
    icon: <Camera className="h-4 w-4" />,
  },
];

export function GroupLinksMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="fixed bottom-20 right-3 z-50 md:bottom-6 md:right-6">
      {open && (
        <>
          <div className="fixed inset-0" onClick={() => setOpen(false)} />
          <div className="comic absolute bottom-full right-0 mb-2 w-64 rounded-xl border-2 border-ink bg-card p-1.5 shadow-2xl">
            <p className="px-2.5 pb-1.5 pt-2 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">
              Accesos del grupo
            </p>
            {GROUP_LINKS.map((link) => (
              <a
                key={link.id}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-primary/5"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="shrink-0 text-primary">{link.icon}</span>
                  <span className="truncate text-sm font-extrabold">{link.label}</span>
                </span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </a>
            ))}
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Enlaces del grupo"
        aria-expanded={open}
        className="comic-sm flex items-center gap-1.5 rounded-full border-2 border-ink bg-card/95 px-3 py-2.5 text-muted-foreground shadow-xl backdrop-blur transition-colors hover:text-foreground"
      >
        {open ? <X className="h-5 w-5" /> : <Link2 className="h-5 w-5" />}
        <span className="hidden text-xs font-extrabold uppercase leading-none sm:inline">
          Enlaces
        </span>
      </button>
    </div>
  );
}
