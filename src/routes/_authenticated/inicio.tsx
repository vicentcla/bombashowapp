import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Gamepad2,
  Heart,
  Link2,
  Megaphone,
  MessageCircle,
  Pencil,
  Plus,
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
  useAllNoticeComments,
  useDeleteNotice,
  useDeleteNoticeComment,
  useNoticeLikes,
  useNotices,
  useProfiles,
  useSaveNotice,
  useToggleNoticeLike,
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
    </div>
  );
}

type CommentNode = NoticeComment & { children: CommentNode[] };

function buildCommentTree(list: NoticeComment[]): CommentNode[] {
  const byId = new Map<string, CommentNode>();
  for (const c of list) byId.set(c.id, { ...c, children: [] });
  const roots: CommentNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parent_id ? byId.get(node.parent_id) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function LikeButton({
  count,
  liked,
  onClick,
  disabled,
}: {
  count: number;
  liked: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={liked}
      aria-label={liked ? "Quitar me gusta" : "Me gusta"}
      className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-extrabold transition-colors disabled:opacity-50 ${
        liked ? "text-destructive" : "text-muted-foreground hover:text-destructive"
      }`}
    >
      <Heart className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} />
      {count > 0 && count}
    </button>
  );
}

function CommentItem({
  node,
  depth,
  nameMap,
  canDelete,
  likesFor,
  onToggleLike,
  onDelete,
  onReply,
  replyingTo,
  replyBody,
  setReplyBody,
  onSubmitReply,
  onCancelReply,
  busy,
}: {
  node: CommentNode;
  depth: number;
  nameMap: Record<string, string>;
  canDelete: (userId: string) => boolean;
  likesFor: (commentId: string) => { count: number; likeId: string | null };
  onToggleLike: (commentId: string) => void;
  onDelete: (id: string) => void;
  onReply: (id: string) => void;
  replyingTo: string | null;
  replyBody: string;
  setReplyBody: (v: string) => void;
  onSubmitReply: () => void;
  onCancelReply: () => void;
  busy: boolean;
}) {
  const { count, likeId } = likesFor(node.id);
  return (
    <div className={depth > 0 ? "ml-4 border-l border-border/40 pl-3" : ""}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 break-words text-sm font-medium">
          <span className="mr-1 font-extrabold">{nameMap[node.user_id] ?? "Miembro"}:</span>
          {node.content}
        </p>
        {canDelete(node.user_id) && (
          <button
            onClick={() => onDelete(node.id)}
            aria-label="Eliminar comentario"
            className="shrink-0 p-1 text-muted-foreground transition-colors hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1">
        <LikeButton
          count={count}
          liked={!!likeId}
          onClick={() => onToggleLike(node.id)}
          disabled={busy}
        />
        <button
          type="button"
          onClick={() => onReply(node.id)}
          className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-extrabold text-muted-foreground transition-colors hover:text-primary"
        >
          <MessageCircle className="h-3.5 w-3.5" /> Responder
        </button>
      </div>

      {replyingTo === node.id && (
        <div className="mb-2 space-y-2">
          <textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            placeholder={`Responder a ${nameMap[node.user_id] ?? "Miembro"}...`}
            rows={2}
            autoFocus
            className="w-full resize-none rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-medium focus:border-primary focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={onSubmitReply}
              disabled={busy || !replyBody.trim()}
              className="comic-sm rounded-lg bg-primary px-2.5 py-1.5 text-xs font-extrabold uppercase text-primary-foreground disabled:opacity-50"
            >
              Responder
            </button>
            <button
              onClick={onCancelReply}
              className="comic-sm rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-medium text-secondary-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {node.children.length > 0 && (
        <div className="space-y-1">
          {node.children.map((child) => (
            <CommentItem
              key={child.id}
              node={child}
              depth={depth + 1}
              nameMap={nameMap}
              canDelete={canDelete}
              likesFor={likesFor}
              onToggleLike={onToggleLike}
              onDelete={onDelete}
              onReply={onReply}
              replyingTo={replyingTo}
              replyBody={replyBody}
              setReplyBody={setReplyBody}
              onSubmitReply={onSubmitReply}
              onCancelReply={onCancelReply}
              busy={busy}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NoticeBoard() {
  const { isAdmin } = useIsAdmin();
  const { user } = useAuth();
  const notices = useNotices();
  const profiles = useProfiles();
  const deleteNotice = useDeleteNotice();
  const comments = useAllNoticeComments();
  const addComment = useAddNoticeComment();
  const deleteComment = useDeleteNoticeComment();
  const likes = useNoticeLikes();
  const toggleLike = useToggleNoticeLike();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Notice | null>(null);

  const [addingComment, setAddingComment] = useState<{ noticeId: string } | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [replyingTo, setReplyingTo] = useState<{ noticeId: string; commentId: string } | null>(
    null,
  );
  const [replyBody, setReplyBody] = useState("");

  const nameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of profiles.data ?? []) map[p.id] = p.display_name ?? "Miembro";
    return map;
  }, [profiles.data]);

  const likeIndex = useMemo(() => {
    const notice: Record<string, { count: number; likeId: string | null }> = {};
    const comment: Record<string, { count: number; likeId: string | null }> = {};
    for (const l of likes.data ?? []) {
      const bucket = l.notice_id ? notice : comment;
      const key = (l.notice_id ?? l.comment_id)!;
      const entry = (bucket[key] ??= { count: 0, likeId: null });
      entry.count += 1;
      if (l.user_id === user?.id) entry.likeId = l.id;
    }
    return { notice, comment };
  }, [likes.data, user?.id]);

  function noticeLikes(id: string) {
    return likeIndex.notice[id] ?? { count: 0, likeId: null };
  }
  function commentLikes(id: string) {
    return likeIndex.comment[id] ?? { count: 0, likeId: null };
  }

  function handleToggleNoticeLike(id: string) {
    const { likeId } = noticeLikes(id);
    toggleLike.mutate(
      { noticeId: id, likeId },
      { onError: () => toast.error("No se pudo actualizar el me gusta") },
    );
  }

  function handleToggleCommentLike(id: string) {
    const { likeId } = commentLikes(id);
    toggleLike.mutate(
      { commentId: id, likeId },
      { onError: () => toast.error("No se pudo actualizar el me gusta") },
    );
  }

  function handleDelete(n: Notice) {
    if (!confirm(`¿Eliminar el aviso "${n.title}"?`)) return;
    deleteNotice.mutate(n.id, {
      onSuccess: () => toast.success("Aviso eliminado"),
      onError: () => toast.error("No se pudo eliminar el aviso"),
    });
  }

  function handleCloseComment() {
    setAddingComment(null);
    setCommentBody("");
  }

  function handleSubmitComment() {
    if (!addingComment || !commentBody.trim()) return;
    addComment.mutate(
      { noticeId: addingComment.noticeId, content: commentBody.trim() },
      {
        onSuccess: () => {
          toast.success("Comentario publicado");
          handleCloseComment();
        },
        onError: () => toast.error("Error al publicar el comentario"),
      },
    );
  }

  function handleSubmitReply() {
    if (!replyingTo || !replyBody.trim()) return;
    addComment.mutate(
      {
        noticeId: replyingTo.noticeId,
        content: replyBody.trim(),
        parentId: replyingTo.commentId,
      },
      {
        onSuccess: () => {
          toast.success("Respuesta publicada");
          setReplyingTo(null);
          setReplyBody("");
        },
        onError: () => toast.error("Error al publicar la respuesta"),
      },
    );
  }

  function handleDeleteComment(id: string) {
    if (!confirm("¿Eliminar este comentario?")) return;
    deleteComment.mutate(
      { id },
      {
        onSuccess: () => toast.success("Comentario eliminado"),
        onError: () => toast.error("No se pudo eliminar el comentario"),
      },
    );
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
        {notices.data?.map((n) => {
          const tree = buildCommentTree(comments.data?.[n.id] ?? []);
          const nl = noticeLikes(n.id);
          return (
            <article key={n.id} className="rounded-lg border border-border/40 bg-background p-3.5">
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
                      className="p-2 text-muted-foreground transition-colors hover:text-primary"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(n)}
                      aria-label="Eliminar aviso"
                      title="Eliminar aviso"
                      className="p-2 text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              {n.body && (
                <p className="mt-2 whitespace-pre-line break-words text-sm font-medium">{n.body}</p>
              )}

              <div className="mt-2">
                <LikeButton
                  count={nl.count}
                  liked={!!nl.likeId}
                  onClick={() => handleToggleNoticeLike(n.id)}
                  disabled={toggleLike.isPending}
                />
              </div>

              <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
                {tree.map((node) => (
                  <CommentItem
                    key={node.id}
                    node={node}
                    depth={0}
                    nameMap={nameMap}
                    canDelete={(uid) => isAdmin || uid === user?.id}
                    likesFor={commentLikes}
                    onToggleLike={handleToggleCommentLike}
                    onDelete={handleDeleteComment}
                    onReply={(commentId) => {
                      setReplyingTo({ noticeId: n.id, commentId });
                      setReplyBody("");
                    }}
                    replyingTo={replyingTo?.commentId ?? null}
                    replyBody={replyBody}
                    setReplyBody={setReplyBody}
                    onSubmitReply={handleSubmitReply}
                    onCancelReply={() => {
                      setReplyingTo(null);
                      setReplyBody("");
                    }}
                    busy={addComment.isPending || toggleLike.isPending}
                  />
                ))}

                <textarea
                  value={addingComment?.noticeId === n.id ? commentBody : ""}
                  onChange={(e) => {
                    if (addingComment?.noticeId !== n.id) setAddingComment({ noticeId: n.id });
                    setCommentBody(e.target.value);
                  }}
                  onFocus={() => {
                    if (addingComment?.noticeId !== n.id) {
                      setAddingComment({ noticeId: n.id });
                      setCommentBody("");
                    }
                  }}
                  placeholder="Escribe un comentario..."
                  rows={2}
                  className="w-full resize-none rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-medium focus:border-primary focus:outline-none"
                  disabled={addComment.isPending}
                />
                {addingComment?.noticeId === n.id && (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={handleSubmitComment}
                      disabled={addComment.isPending || !commentBody.trim()}
                      className="comic-sm flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-extrabold uppercase text-primary-foreground disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" /> Enviar
                    </button>
                    <button
                      onClick={handleCloseComment}
                      className="comic-sm rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
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
