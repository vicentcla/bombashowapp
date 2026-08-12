import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CornerDownRight,
  Gamepad2,
  Link2,
  Megaphone,
  MessageCircle,
  Pencil,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
const ANIVERSARIO_SRC = "/logo-x-final-3.png";
import { GlobalSearch } from "@/components/GlobalSearch";
import { GoogleDriveIcon, InstagramIcon } from "@/components/BrandIcons";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import {
  useAddNoticeComment,
  useDeleteNotice,
  useDeleteNoticeComment,
  useNoticeComments,
  useNotices,
  useProfiles,
  useSaveNotice,
  type Notice,
  type NoticeComment,
} from "@/lib/queries";

const DRIVE_URL = "https://drive.google.com/drive/folders/1SJs1eIj7suxJL_eD9W0_m5rCBdva5jUi";
const INSTAGRAM_URL = "https://www.instagram.com/showlabomba?igsh=MTIweG1tM2luN3Jjbw==";
const GAME_URL = "https://aythor.itch.io/la-bomba-show-runner";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Inicio — La Bomba Show" },
      {
        name: "description",
        content: "Panel de la xaranga: letras, repertorio, setlists y contadores.",
      },
      { property: "og:title", content: "Inicio — La Bomba Show" },
      {
        property: "og:description",
        content: "Panel de la xaranga: letras, repertorio, setlists y contadores.",
      },
    ],
  }),
  component: Inicio,
});

function Inicio() {
  const [linksOpen, setLinksOpen] = useState(false);

  useEffect(() => {
    if (!linksOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLinksOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [linksOpen]);

  return (
    <div>
      <div className="comic mb-6 flex items-center gap-4 rounded-xl bg-card p-4">
        <img src={ANIVERSARIO_SRC} alt="Sello 10 aniversario" className="h-20 w-auto shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl leading-none">¡Hola, xaranguer@!</h1>
          <p className="mt-1 text-sm text-muted-foreground">Bienvenid@!</p>
        </div>
      </div>

      <GlobalSearch />

      <NoticeBoard />

      {/* Accesos del grupo (desplegable, solo iconos) */}
      <div className="mt-6 flex justify-center gap-3">
        <a
          href={GAME_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Juego"
          title="Juego"
          className="comic-sm comic-press flex items-center justify-center rounded-lg bg-secondary p-2 text-secondary-foreground"
        >
          <Gamepad2 className="h-5 w-5 shrink-0" />
        </a>
        <div className="relative">
          <button
            type="button"
            onClick={() => setLinksOpen((v) => !v)}
            aria-label="Enlaces del grupo"
            aria-expanded={linksOpen}
            className="comic-sm comic-press flex items-center justify-center rounded-lg bg-secondary p-2 text-secondary-foreground"
          >
            <Link2 className="h-5 w-5 shrink-0" />
          </button>
          {linksOpen && (
            <>
              <div className="fixed inset-0" onClick={() => setLinksOpen(false)} />
              <div className="comic absolute bottom-full left-1/2 z-10 mb-2 flex -translate-x-1/2 gap-1.5 rounded-lg border border-border bg-card p-1.5 shadow-2xl">
                <a
                  href={DRIVE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Google Drive"
                  title="Google Drive"
                  onClick={() => setLinksOpen(false)}
                  className="comic-sm comic-press flex items-center justify-center rounded-md bg-secondary p-2 text-secondary-foreground hover:bg-primary hover:text-primary-foreground"
                >
                  <GoogleDriveIcon className="h-5 w-5" />
                </a>
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  title="Instagram"
                  onClick={() => setLinksOpen(false)}
                  className="comic-sm comic-press flex items-center justify-center rounded-md bg-secondary p-2 text-secondary-foreground hover:bg-primary hover:text-primary-foreground"
                >
                  <InstagramIcon className="h-5 w-5" />
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatCommentDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `hace ${diffDays} d`;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const p0 = parts[0];
  if (!p0) return "?";
  if (parts.length === 1) return p0.slice(0, 2).toUpperCase();
  const p1 = parts[1];
  if (!p1) return p0.slice(0, 2).toUpperCase();
  const char0 = p0[0] ?? "";
  const char1 = p1[0] ?? "";
  return (char0 + char1).toUpperCase() || "?";
}

function NoticeModal({
  open,
  notice,
  onClose,
}: {
  open: boolean;
  notice: Notice | null;
  onClose: () => void;
}) {
  const save = useSaveNotice();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(notice?.title ?? "");
    setBody(notice?.body ?? "");
  }, [open, notice]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function submit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!title.trim()) {
      toast.error("El título no puede estar vacío");
      return;
    }
    const payload: { id?: string; title: string; body: string } = {
      title: title.trim(),
      body: body.trim(),
    };
    if (notice?.id) payload.id = notice.id;
    save.mutate(payload, {
      onSuccess: () => {
        toast.success(notice ? "Aviso actualizado" : "Aviso publicado");
        onClose();
      },
      onError: () => toast.error("No se pudo guardar el aviso"),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-md transition-opacity">
      {/* Clic en el fondo para cerrar */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Ventana emergente modal */}
      <div className="relative z-10 comic w-full max-w-2xl rounded-2xl bg-card p-6 sm:p-7 space-y-5 shadow-2xl border-2 border-border/80 my-auto">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary">
              <Megaphone className="h-5 w-5" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold leading-none">
              {notice ? "Editar aviso" : "Nuevo aviso"}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold uppercase text-muted-foreground">
              Título del aviso
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Escribe un título claro..."
              className="w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-base sm:text-lg font-extrabold focus:border-primary focus:outline-none shadow-xs"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-extrabold uppercase text-muted-foreground">
              Contenido del aviso
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Explica los detalles del aviso para la xaranga..."
              rows={7}
              className="w-full min-h-[160px] sm:min-h-[200px] resize-y rounded-xl border-2 border-border bg-background px-4 py-3 text-sm sm:text-base font-medium focus:border-primary focus:outline-none shadow-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="comic-sm rounded-xl bg-secondary px-5 py-2.5 text-xs font-extrabold uppercase text-secondary-foreground hover:bg-accent transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={save.isPending}
              className="comic-sm comic-press flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-extrabold uppercase text-primary-foreground disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {notice ? "Guardar cambios" : "Publicar aviso"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NoticeItem({
  notice,
  nameMap,
  isAdmin,
  currentUserId,
  onEdit,
  onDelete,
}: {
  notice: Notice;
  nameMap: Record<string, string>;
  isAdmin: boolean;
  currentUserId: string | undefined;
  onEdit: (n: Notice) => void;
  onDelete: (n: Notice) => void;
}) {
  const [showComments, setShowComments] = useState(true);
  const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const commentsQuery = useNoticeComments(notice.id);
  const addComment = useAddNoticeComment();
  const deleteComment = useDeleteNoticeComment();

  const comments = commentsQuery.data ?? [];
  const topComments = useMemo(
    () => comments.filter((c) => !c.parent_id),
    [comments]
  );
  const repliesMap = useMemo(() => {
    const map: Record<string, NoticeComment[]> = {};
    for (const c of comments) {
      if (c.parent_id) {
        const list = map[c.parent_id] ?? [];
        list.push(c);
        map[c.parent_id] = list;
      }
    }
    return map;
  }, [comments]);

  function handleReply(commentId: string, userName: string) {
    setReplyingTo({ id: commentId, name: userName });
    setShowComments(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleSend(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const content = text.trim();
    if (!content) return;

    addComment.mutate(
      {
        notice_id: notice.id,
        content,
        parent_id: replyingTo?.id ?? null,
      },
      {
        onSuccess: () => {
          setText("");
          setReplyingTo(null);
        },
        onError: () => {
          toast.error("No se pudo publicar el comentario");
        },
      }
    );
  }

  function handleDeleteComment(commentId: string) {
    deleteComment.mutate(commentId, {
      onSuccess: () => toast.success("Comentario eliminado"),
      onError: () => toast.error("No se pudo eliminar el comentario"),
    });
  }

  return (
    <article className="rounded-xl border border-border/50 bg-background p-4 shadow-xs">
      {/* Cabecera del aviso */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 font-extrabold text-primary text-xs comic-sm">
            {getInitials(nameMap[notice.created_by] ?? "Admin")}
          </div>
          <div className="min-w-0">
            <h3 className="font-extrabold leading-tight text-base text-foreground">{notice.title}</h3>
            <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
              <span className="font-bold text-foreground/80">{nameMap[notice.created_by] ?? "Admin"}</span> · {formatDate(notice.updated_at)}
            </p>
          </div>
        </div>
        {isAdmin && (
          <div className="flex shrink-0 gap-1">
            <button
              onClick={() => onEdit(notice)}
              aria-label="Editar aviso"
              title="Editar aviso"
              className="p-1 text-muted-foreground transition-colors hover:text-primary"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDelete(notice)}
              aria-label="Eliminar aviso"
              title="Eliminar aviso"
              className="p-1 text-muted-foreground transition-colors hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {notice.body && (
        <p className="mt-3 whitespace-pre-line break-words text-sm font-medium text-foreground/90 pl-11">
          {notice.body}
        </p>
      )}

      {/* Barra de acción: comentarios */}
      <div className="mt-3.5 pt-2.5 border-t border-border/40 flex items-center justify-between">
        <button
          onClick={() => setShowComments((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors"
        >
          <MessageCircle className="h-4 w-4 text-primary" />
          <span>
            {comments.length === 0
              ? "Comentar"
              : comments.length === 1
              ? "1 comentario"
              : `${comments.length} comentarios`}
          </span>
        </button>
      </div>

      {/* Conversación en hilo estilo Instagram */}
      {showComments && (
        <div className="mt-3 pt-3 border-t border-border/30 space-y-3">
          {/* Lista de comentarios */}
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {commentsQuery.isLoading && (
              <p className="text-xs text-muted-foreground font-medium italic">Cargando comentarios...</p>
            )}

            {!commentsQuery.isLoading && comments.length === 0 && (
              <p className="text-xs text-muted-foreground font-medium italic pl-1">
                Sé el primero en comentar este aviso.
              </p>
            )}

            {topComments.map((c) => {
              const authorName = nameMap[c.user_id] ?? "Miembro";
              const replies = repliesMap[c.id] ?? [];
              const canDelete = c.user_id === currentUserId || isAdmin;

              return (
                <div key={c.id} className="space-y-2">
                  {/* Comentario Principal */}
                  <div className="flex items-start gap-2.5 group">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground font-bold text-[10px] border border-border/50">
                      {getInitials(authorName)}
                    </div>
                    <div className="min-w-0 flex-1 text-xs">
                      <div className="rounded-xl bg-muted/40 px-3 py-2 border border-border/30">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold text-foreground">{authorName}</span>
                          <span className="text-[10px] text-muted-foreground">{formatCommentDate(c.created_at)}</span>
                        </div>
                        <p className="mt-0.5 whitespace-pre-line break-words font-medium text-foreground/90">{c.content}</p>
                      </div>
                      <div className="mt-1 flex items-center gap-3 pl-1 text-[11px] font-bold text-muted-foreground">
                        <button
                          onClick={() => handleReply(c.id, authorName)}
                          className="hover:text-primary transition-colors flex items-center gap-1"
                        >
                          <CornerDownRight className="h-3 w-3" /> Responder
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => handleDeleteComment(c.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Respuestas anidadas estilo Instagram */}
                  {replies.length > 0 && (
                    <div className="ml-8 border-l-2 border-primary/20 pl-3 space-y-2 mt-1.5">
                      {replies.map((r) => {
                        const replyAuthor = nameMap[r.user_id] ?? "Miembro";
                        const canDeleteReply = r.user_id === currentUserId || isAdmin;

                        return (
                          <div key={r.id} className="flex items-start gap-2 group">
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary/80 text-secondary-foreground font-bold text-[9px] border border-border/40">
                              {getInitials(replyAuthor)}
                            </div>
                            <div className="min-w-0 flex-1 text-xs">
                              <div className="rounded-xl bg-muted/30 px-2.5 py-1.5 border border-border/20">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-extrabold text-foreground">{replyAuthor}</span>
                                  <span className="text-[9px] text-muted-foreground">{formatCommentDate(r.created_at)}</span>
                                </div>
                                <p className="mt-0.5 whitespace-pre-line break-words font-medium text-foreground/90">
                                  <span className="text-primary font-bold mr-1">@{authorName}</span>
                                  {r.content}
                                </p>
                              </div>
                              <div className="mt-0.5 flex items-center gap-3 pl-1 text-[10px] font-bold text-muted-foreground">
                                <button
                                  onClick={() => handleReply(c.id, replyAuthor)}
                                  className="hover:text-primary transition-colors flex items-center gap-1"
                                >
                                  <CornerDownRight className="h-2.5 w-2.5" /> Responder
                                </button>
                                {canDeleteReply && (
                                  <button
                                    onClick={() => handleDeleteComment(r.id)}
                                    className="text-muted-foreground hover:text-destructive transition-colors"
                                  >
                                    Eliminar
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Formulario de entrada estilo Instagram */}
          <form onSubmit={handleSend} className="space-y-1.5 pt-1">
            {replyingTo && (
              <div className="flex items-center justify-between rounded-lg bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                <span>Respondiendo a <strong className="font-extrabold">@{replyingTo.name}</strong></span>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="hover:bg-primary/20 p-0.5 rounded-full transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={replyingTo ? `Responder a @${replyingTo.name}...` : "Añade un comentario..."}
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium focus:border-primary focus:outline-none"
              />
              <button
                type="submit"
                disabled={!text.trim() || addComment.isPending}
                className="comic-sm comic-press flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
                title="Publicar comentario"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>
        </div>
      )}
    </article>
  );
}

function NoticeBoard() {
  const { isAdmin } = useIsAdmin();
  const { user } = useAuth();
  const notices = useNotices();
  const profiles = useProfiles();
  const deleteNotice = useDeleteNotice();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Notice | null>(null);

  const nameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of profiles.data ?? []) map[p.id] = p.display_name ?? "Miembro";
    return map;
  }, [profiles.data]);

  function handleDelete(n: Notice) {
    if (!confirm(`¿Eliminar el aviso "${n.title}"?`)) return;
    deleteNotice.mutate(n.id, {
      onSuccess: () => toast.success("Aviso eliminado"),
      onError: () => toast.error("No se pudo eliminar el aviso"),
    });
  }

  return (
    <section className="comic mt-8 rounded-xl bg-card p-4 space-y-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-extrabold leading-none">Tablón de avisos</h2>
        </div>
        {isAdmin && (
          <button
            onClick={() => setCreating(true)}
            className="comic-sm comic-press flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-extrabold uppercase text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Nuevo aviso
          </button>
        )}
      </div>

      {notices.data && notices.data.length === 0 && (
        <p className="text-sm font-bold text-muted-foreground">No hay avisos publicados.</p>
      )}

      <div className="space-y-4">
        {notices.data?.map((n) => (
          <NoticeItem
            key={n.id}
            notice={n}
            nameMap={nameMap}
            isAdmin={isAdmin}
            currentUserId={user?.id}
            onEdit={setEditing}
            onDelete={handleDelete}
          />
        ))}
      </div>

      <NoticeModal
        open={creating || !!editing}
        notice={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
    </section>
  );
}
