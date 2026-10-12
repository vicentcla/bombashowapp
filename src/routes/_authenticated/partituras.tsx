import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Music4, Folder, Pin, X, Plus } from "lucide-react";
import { GoogleDriveIcon } from "@/components/BrandIcons";
import { DriveFoldersManager } from "@/components/DriveFoldersManager";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { useDriveFolders, type DriveFolder } from "@/lib/queries";
import { INSTRUMENT_EMOJIS } from "@/lib/drive";
import { ScoreViewer } from "@/components/ScoreViewer";

export const Route = createFileRoute("/_authenticated/partituras")({
  head: () => ({
    meta: [
      { title: "Partituras — La Bomba Show" },
      {
        name: "description",
        content: "Carpetas de partituras por instrumento, vinculadas a Google Drive.",
      },
    ],
  }),
  component: Partituras,
});

function DriveFolderCard({
  folder,
  pinned,
  onOpen,
}: {
  folder: DriveFolder;
  pinned: boolean;
  onOpen: () => void;
}) {
  return (
    <div
      className={`comic flex flex-col justify-between gap-3 rounded-xl bg-card p-4 ${
        pinned ? "ring-2 ring-primary" : ""
      }`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <span className="h-8 w-8 shrink-0 text-2xl leading-none">
          {INSTRUMENT_EMOJIS[folder.instrument] || "🎵"}
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1 truncate text-lg font-extrabold leading-tight">
            {pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />}
            <span className="truncate">{folder.name}</span>
          </p>
          <p className="text-xs font-bold text-muted-foreground">{folder.instrument}</p>
        </div>
      </div>
      <button
        onClick={onOpen}
        className="comic-sm comic-press flex items-center justify-center gap-2 rounded-lg bg-secondary py-2 text-xs font-extrabold uppercase text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
      >
        <GoogleDriveIcon className="h-4 w-4" /> Abrir partituras
      </button>
    </div>
  );
}

function Partituras() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const folders = useDriveFolders();

  const userInstrument = user?.user_metadata?.["instrument"] as string | undefined;

  const { myFolders, otherFolders } = useMemo(() => {
    const all = folders.data ?? [];
    if (userInstrument) {
      return {
        myFolders: all.filter((f) => f.instrument === userInstrument),
        otherFolders: all.filter((f) => f.instrument !== userInstrument),
      };
    }
    return { myFolders: [], otherFolders: all };
  }, [folders.data, userInstrument]);

  const [openFolder, setOpenFolder] = useState<DriveFolder | null>(null);
  const [showManager, setShowManager] = useState(false);

  function openFolderAccess(folder: DriveFolder) {
    setOpenFolder(folder);
  }

  const hasFolders = (folders.data?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <GoogleDriveIcon className="h-7 w-7 shrink-0 text-muted-foreground" />
          <div>
            <h1 className="text-3xl font-extrabold leading-none">Partituras</h1>
            <p className="text-xs font-bold text-muted-foreground">
              Carpetas de Google Drive por instrumento
            </p>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowManager(true)}
            className="comic comic-press flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-extrabold uppercase text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Gestionar carpetas
          </button>
        )}
      </div>

      {!userInstrument && (
        <div className="comic flex items-center gap-3 rounded-xl bg-card p-4">
          <Music4 className="h-6 w-6 shrink-0 text-muted-foreground" />
          <p className="text-sm font-bold text-muted-foreground">
            Aún no has elegido tu instrumento.{" "}
            <Link to="/centro" search={{ tab: "perfil" }} className="text-primary underline">
              Elíguelo en Ajustes
            </Link>{" "}
            para fijar tus carpetas arriba.
          </p>
        </div>
      )}

      {!hasFolders ? (
        <div className="comic rounded-xl bg-card p-8 text-center">
          <Folder className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-lg font-bold">Todavía no hay carpetas de partituras.</p>
          {isAdmin ? (
            <button
              onClick={() => setShowManager(true)}
              className="comic comic-press mt-4 rounded-md bg-primary px-4 py-2 font-extrabold uppercase text-primary-foreground"
            >
              Añadir carpeta
            </button>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Pídele a un administrador que añada las carpetas desde esta misma página.
            </p>
          )}
        </div>
      ) : (
        <>
          {myFolders.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                <Pin className="h-3.5 w-3.5" />
                {userInstrument && INSTRUMENT_EMOJIS[userInstrument] ? (
                  <span className="text-2xl leading-none">{INSTRUMENT_EMOJIS[userInstrument]}</span>
                ) : (
                  <span className="text-2xl leading-none">🎵</span>
                )}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {myFolders.map((f) => (
                  <DriveFolderCard
                    key={f.id}
                    folder={f}
                    pinned
                    onOpen={() => openFolderAccess(f)}
                  />
                ))}
              </div>
            </section>
          )}

          {otherFolders.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                Otros instrumentos
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {otherFolders.map((f) => (
                  <DriveFolderCard
                    key={f.id}
                    folder={f}
                    pinned={false}
                    onOpen={() => openFolderAccess(f)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {openFolder && <ScoreViewer folder={openFolder} onClose={() => setOpenFolder(null)} />}

      {/* Modal gestión de carpetas (admin) */}
      {showManager && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4 pb-10">
          <div className="comic w-full max-w-md rounded-xl bg-card p-5 mt-4 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-2xl font-extrabold leading-none">Carpetas de Drive</h2>
              <button onClick={() => setShowManager(false)} aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <DriveFoldersManager />
          </div>
        </div>
      )}
    </div>
  );
}
