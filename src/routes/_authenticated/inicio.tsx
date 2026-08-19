import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Gamepad2, Link2, Megaphone, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
const ANIVERSARIO_SRC = "/logo-x-final-3.png";
import { GlobalSearch } from "@/components/GlobalSearch";
import { GoogleDriveIcon, InstagramIcon } from "@/components/BrandIcons";
import { useIsAdmin } from "@/hooks/useAuth";
import {
  useDeleteNotice,
  useNotices,
  useProfiles,
  useSaveNotice,
  type Notice,
  useNoticeComments,
  useSaveComment,
  useDeleteNoticeComment,
  useNoticeLikes,
  useSaveLike,
  useDeleteLike,
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

  if (!open) return null;

  function submit() {
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4 pb-10">
      <div className="comic w-full max-w-md rounded-xl bg-card p-5 space-y-4 mt-4">
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="text-2xl font-extrabold leading-none">
            {notice ? "Editar aviso" : "Nuevo aviso"}
          </h2>
          <button onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título del aviso"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium focus:border-primary focus:outline-none"
            autoFocus
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Contenido del aviso..."
            rows={4}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium focus:border-primary focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="comic-sm rounded-lg bg-secondary px-3 py-2 text-xs font-extrabold uppercase text-secondary-foreground"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={save.isPending}
            className="comic-sm comic-press flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-extrabold uppercase text-primary-foreground disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {notice ? "Guardar" : "Publicar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NoticeBoard() {
  const { isAdmin } = useIsAdmin();
  const notices = useNotices();
  const profiles = useProfiles();
  const deleteNotice = useDeleteNotice();
  const saveComment = useSaveComment();
  const deleteComment = useDeleteNoticeComment();
  const saveLike = useSaveLike();
  const deleteLike = useDeleteLike();
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

  function getCommentName(userId: string): string {
    return nameMap[userId] ?? "Desconocido";
  }

  function toggleComment(n: Notice) {
    setAddingComment(prev => prev?.noticeId === n.id ? null : { noticeId: n.id });
  }

  function handleCommentSubmit(comment: { content: string; parentId?: string | null }) {
    if (!comment.content.trim()) return;
    useSaveComment.mutate({
      content: comment.content.trim(),
      notice_id: addingComment!.noticeId,
      parent_id: comment.parentId ?? null,
    });
    toggleComment(addingComment!.noticeId);
  }

  function handleReplySubmit(comment: { content: string; parentId: string }) {
    if (!comment.content.trim()) return;
    useSaveComment.mutate({
      content: comment.content.trim(),
      notice_id: addingComment!.noticeId,
      parent_id: comment.parentId,
    });
    toggleComment(addingComment!.noticeId);
  }

  function handleLikeClick(n: Notice) {
    useSaveLike.mutate(n.id);
  }

  function handleUnlikeClick(n: Notice) {
    useDeleteLike.mutate(n.id);
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

      <div className="space-y-3">
        {notices.data?.map((n) => {
          const comments = useComments(n.id);
          const likes = useLikes(n.id);
          const alreadyLiked = likes.liked;

          return (
            <article
              key={n.id}
              className="rounded-lg border border-border/40 bg-background p-3.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-extrabold leading-tight">{n.title}</h3>
                  <p className="mt-0.5 text-[11px] font-bold text-muted-foreground">
                    {nameMap[n.created_by] ?? "Admin"} · {formatDate(n.updated_at)}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => setEditing(n)}
                      aria-label="Editar aviso"
                      title="Editar aviso"
                      className="p-1 text-muted-foreground transition-colors hover:text-primary"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(n)}
                      aria-label="Eliminar aviso"
                      title="Eliminar aviso"
                      className="p-1 text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              {n.body && (
                <p className="mt-2 whitespace-pre-line break-words text-sm font-medium">{n.body}</p>
              )}

              {/* Comments section */}
              <div className="mt-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase">Comentarios ({likes.count})</h4>
                {comments.data?.map((c) => {
                  const parentReplies = comments.data?.filter(
                    (cm) => cm.parent_id === c.id
                  );
                  const userName = getCommentName(c.user_id);

                  return (
                    <div
                      key={c.id}
                      className="comic rounded-lg border border-border/20 bg-background p-2.5 mb-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{userName}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(c.created_at)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-line break-words text-sm font-medium">
                        {c.content}
                      </p>
                      {isAdmin && (
                        <div className="mt-1 flex gap-1 text-xs">
                          <button
                            onClick={() => useDeleteComment.mutate(c.id)}
                            className="text-destructive hover:text-destructive/80"
                          >
                            Eliminar
                          </button>
                        </div>
                      )}

                      {/* Replies */}
                      {parentReplies?.length > 0 && (
                        <div className="mt-1 pl-3 border-l-2 border-border/50">
                          {parentReplies.map((r) => {
                            const replyUserName = getCommentName(r.user_id);
                            return (
                              <div
                                key={r.id}
                                className="comic rounded-lg border border-border/20 bg-background p-1.5 mb-1 text-xs"
                              >
                                <span className="text-muted-foreground">•</span>
                                <span className="font-medium">{replyUserName}</span>
                                <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
                                <p className="mt-0.5 whitespace-pre-line break-words">
                                  {r.content}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Reply form (only for first level comments) */}
                      {!parentReplies && (
                        <div
                          className="mt-1 flex gap-1 text-xs"
                        >
                          <button
                            onClick={() => setAddingComment(prev => prev?.noticeId === n.id ? null : { noticeId: n.id })}
                            className="text-primary hover:text-primary/80 cursor-pointer"
                          >
                            Responder
                          </button>
                        </div>
                      )}

                      {/* Comment form */}
                      {addingComment?.noticeId === n.id && (
                        <div
                          className="mt-1 rounded-lg border border-border/20 bg-background p-2"
                        >
                          <textarea
                            placeholder="Escribe un comentario..."
                            rows={1}
                            className="w-full resize-none rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-medium focus:border-primary focus:outline-none"
                          />
                          <div className="mt-1 flex gap-1">
                            <button
                              onClick={() => handleCommentSubmit({ content: "", parentId: addingComment?.commentId })}
                              disabled="true"
                              className="comic-sm rounded-lg bg-primary px-2 py-1 text-xs font-bold uppercase text-primary-foreground disabled:opacity-50"
                            >
                              Publicar
                            </button>
                            <button
                              onClick={() => toggleComment(n)}
                              className="text-sm text-muted-foreground"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Like button */}
              <div className="mt-2 flex items-center gap-1">
                <button
                  onClick={alreadyLiked ? handleUnlikeClick : handleLikeClick}
                  className={`
                    comic-sm rounded-lg border border-primary ${
                      alreadyLiked ? "bg-primary text-primary-foreground" : "text-primary hover:text-primary/80"
                    }
                    ${alreadyLiked ? "disabled" : ""}
                  `}
                >
                  {alreadyLiked ? <3 className="h-3 w-3" /> : <Like className="h-3.5 w-3.5" />}
                  {alreadyLiked ? "Ya gustó" : ""}
                </button>
                <span className="text-xs text-muted-foreground">
                  {likes.count}
                </span>
              </div>
            </article>
          );
        })}
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
