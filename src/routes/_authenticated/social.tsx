import { createFileRoute, useNavigate } from "@tanstack/react-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  Check,
  Copy,
  Eraser,
  Eye,
  Instagram,
  MessageCircle,
  MessageSquare,
  Music2,
  Save,
  Send,
  Sparkles,
  User,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAddComment,
  useDeleteComment,
  useDeleteSocialPost,
  useProfiles,
  useSaveSocialPost,
  useSocialComments,
  useSocialPosts,
  type SocialNetwork,
  type SocialPost,
  type SocialPostStatus,
} from "@/lib/queries";
import { cleanUnicodeStyle, toUnicodeStyle, type UnicodeStyle } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/social")({
  validateSearch: (search: Record<string, unknown>): { open?: string } =>
    typeof search["open"] === "string" ? { open: search["open"] } : {},

  head: () => ({
    meta: [
      { title: "Redes Sociales — La Bomba Show" },
      {
        name: "description",
        content: "Textos y copies para las redes sociales de la xaranga.",
      },
    ],
  }),
  component: SocialPage,
});

const NETWORKS: { value: SocialNetwork; label: string; icon: typeof Instagram }[] = [
  { value: "instagram", label: "Instagram", icon: Instagram },
  { value: "tiktok", label: "TikTok", icon: Music2 },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
];

const STATUSES: { value: SocialPostStatus; label: string; className: string }[] = [
  { value: "borrador", label: "Borrador", className: "bg-secondary text-secondary-foreground" },
  {
    value: "en_revision",
    label: "En revisión",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  {
    value: "aprobado",
    label: "Aprobado",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
];

const STYLES: { value: UnicodeStyle; label: string; className: string; title: string }[] = [
  { value: "bold", label: "B", className: "font-extrabold", title: "Negrita" },
  { value: "italic", label: "I", className: "italic", title: "Cursiva" },
  {
    value: "boldItalic",
    label: "B I",
    className: "font-extrabold italic",
    title: "Negrita cursiva",
  },
  { value: "mono", label: "A", className: "font-mono", title: "Monoespaciada" },
];

function networkMetaOf(value: SocialNetwork): (typeof NETWORKS)[number] {
  return (
    NETWORKS.find((n) => n.value === value) ?? {
      value,
      label: "Instagram",
      icon: Instagram,
    }
  );
}

function statusMetaOf(value: SocialPostStatus): (typeof STATUSES)[number] {
  return (
    STATUSES.find((s) => s.value === value) ?? {
      value,
      label: "Borrador",
      className: "bg-secondary text-secondary-foreground",
    }
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

// ─── Componente Principal SocialPage ────────────────────────────────────────────

function SocialPage() {
  const posts = useSocialPosts();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [selected, setSelected] = useState<string | null>(search.open ?? null);
  const [creating, setCreating] = useState(false);
  const [networkFilter, setNetworkFilter] = useState<"todas" | SocialNetwork>("todas");
  const [statusFilter, setStatusFilter] = useState<"todos" | SocialPostStatus>("todos");

  const deletePost = useDeleteSocialPost();

  function openPost(id: string) {
    setSelected(id);
    navigate({ to: "/social", search: { open: id } });
  }

  function closePost() {
    setSelected(null);
    navigate({ to: "/social", search: {} });
  }


  function startCreating() {
    setCreating(true);
  }

  function stopCreating() {
    setCreating(false);
  }

  function removePost(post: SocialPost) {
    if (!confirm(`¿Eliminar el texto "${post.title}"?`)) return;
    deletePost.mutate(post.id, {
      onSuccess: () => toast.success("Texto eliminado"),
      onError: () => toast.error("No se pudo eliminar el texto"),
    });
  }

  if (selected) return <SocialDetail postId={selected} onBack={closePost} />;
  if (creating) return <SocialDetail postId={null} onBack={stopCreating} />;

  const all = posts.data ?? [];
  const visible = all.filter((p) => {
    if (networkFilter !== "todas" && p.network !== networkFilter) return false;
    if (statusFilter !== "todos" && p.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Instagram className="h-7 w-7 shrink-0 text-muted-foreground" />
          <div>
            <h1 className="text-3xl font-extrabold leading-none">Redes</h1>
            <p className="text-xs font-bold text-muted-foreground">
              Escribe y revisa los textos para Instagram, TikTok y WhatsApp
            </p>
          </div>
        </div>

        <button
          onClick={startCreating}
          className="comic comic-press flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-extrabold uppercase text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Nuevo texto
        </button>
      </div>

      {/* Filtros por red */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setNetworkFilter("todas")}
          className={`comic-sm comic-press rounded-lg px-3 py-1.5 text-xs font-extrabold uppercase transition-colors ${
            networkFilter === "todas"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-accent"
          }`}
        >
          Todas
        </button>
        {NETWORKS.map((n) => (
          <button
            key={n.value}
            onClick={() => setNetworkFilter((v) => (v === n.value ? "todas" : n.value))}
            className={`comic-sm comic-press flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-extrabold uppercase transition-colors ${
              networkFilter === n.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            <n.icon className="h-3.5 w-3.5" /> {n.label}
          </button>
        ))}

        <span className="mx-1 h-5 w-px bg-border" />

        {/* Filtros por estado */}
        <button
          onClick={() => setStatusFilter("todos")}
          className={`comic-sm comic-press rounded-lg px-3 py-1.5 text-xs font-extrabold uppercase transition-colors ${
            statusFilter === "todos"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-accent"
          }`}
        >
          Todos
        </button>
        {STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter((v) => (v === s.value ? "todos" : s.value))}
            className={`comic-sm comic-press rounded-lg px-3 py-1.5 text-xs font-extrabold uppercase transition-colors ${
              statusFilter === s.value
                ? s.className + " ring-2 ring-ink/40"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="comic rounded-xl bg-card p-8 text-center">
          <Sparkles className="mx-auto mb-3 h-10 w-10 text-primary/60" />
          <p className="text-lg font-bold">Todavía no hay textos publicados.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Crea el primer copy para las redes sociales de la xaranga.
          </p>
          <button
            onClick={startCreating}
            className="comic comic-press mt-4 rounded-md bg-primary px-4 py-2 font-extrabold uppercase text-primary-foreground"
          >
            Crear mi primer texto
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {visible.map((post) => (
          <SocialCard
            key={post.id}
            post={post}
            onSelect={() => openPost(post.id)}
            onDelete={() => removePost(post)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Tarjeta de texto ───────────────────────────────────────────────────────────

function SocialCard({
  post,
  onSelect,
  onDelete,
}: {
  post: SocialPost;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const profiles = useProfiles();
  const networkMeta = networkMetaOf(post.network);
  const statusMeta = statusMetaOf(post.status);
  const NetworkIcon = networkMeta.icon;
  const commentCount = post.comments?.[0]?.count ?? 0;
  const authorName =
    profiles.data?.find((p) => p.id === post.created_by)?.display_name?.trim() || "Miembro";
  const [copied, setCopied] = useState(false);

  async function copyText() {
    try {
      await navigator.clipboard.writeText(post.content);
      setCopied(true);
      toast.success("Texto copiado");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar el texto");
    }
  }

  return (
    <div className="comic flex flex-col justify-between rounded-xl bg-card p-4 space-y-3">
      <div>
        <div className="flex items-start justify-between gap-2">
          <button onClick={onSelect} className="group min-w-0 text-left">
            <h2 className="truncate text-lg font-extrabold group-hover:text-primary transition-colors">
              {post.title}
            </h2>
            <p className="flex items-center gap-1 text-xs font-bold text-muted-foreground mt-0.5">
              <User className="h-3.5 w-3.5" /> {authorName}
            </p>
          </button>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={copyText}
              aria-label="Copiar texto"
              title="Copiar texto"
              className="comic-sm comic-press rounded-md bg-secondary p-2 text-secondary-foreground hover:bg-accent transition-colors"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={onDelete}
              aria-label="Eliminar texto"
              title="Eliminar texto"
              className="comic-sm comic-press rounded-md bg-destructive/10 p-2 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <p className="mt-2 line-clamp-3 whitespace-pre-line text-xs font-medium text-muted-foreground">
          {post.content.trim() ? post.content : "Sin contenido"}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="comic-sm flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[11px] font-extrabold uppercase">
            <NetworkIcon className="h-3 w-3" /> {networkMeta.label}
          </span>
          <span
            className={`comic-sm rounded px-2 py-0.5 text-[11px] font-extrabold uppercase ${statusMeta.className}`}
          >
            {statusMeta.label}
          </span>
          {commentCount > 0 && (
            <span className="comic-sm flex items-center gap-1 rounded bg-accent px-2 py-0.5 text-[11px] font-extrabold uppercase">
              <MessageSquare className="h-3 w-3" /> {commentCount}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
        <span className="text-[11px] font-bold text-muted-foreground">
          Actualizado {formatDate(post.updated_at)}
        </span>
        <button
          onClick={onSelect}
          className="comic-sm comic-press rounded-lg bg-primary/10 hover:bg-primary py-1.5 px-3 text-xs font-extrabold uppercase text-primary hover:text-primary-foreground transition-colors"
        >
          Editar →
        </button>
      </div>
    </div>
  );
}

// ─── Detalle / Editor de texto ──────────────────────────────────────────────────

function SocialDetail({ postId, onBack }: { postId: string | null; onBack: () => void }) {
  const posts = useSocialPosts();
  const comments = useSocialComments(postId);
  const profiles = useProfiles();
  const savePost = useSaveSocialPost();
  const deletePost = useDeleteSocialPost();
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();

  const isNew = postId === null;
  const post = isNew ? undefined : posts.data?.find((p) => p.id === postId);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [network, setNetwork] = useState<SocialNetwork>("instagram");
  const [status, setStatus] = useState<SocialPostStatus>("borrador");
  const [comment, setComment] = useState("");
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!post) return;
    setTitle(post.title);
    setContent(post.content);
    setNetwork(post.network);
    setStatus(post.status);
  }, [post]);

  const nameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of profiles.data ?? []) map[p.id] = p.display_name?.trim() || "Miembro";
    return map;
  }, [profiles.data]);

  const networkMeta = networkMetaOf(network);

  function applyStyle(style: UnicodeStyle) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.slice(start, end);
    if (!selected) {
      toast("Selecciona parte del texto para aplicar el estilo");
      return;
    }
    const styled = toUnicodeStyle(selected, style);
    setContent(content.slice(0, start) + styled + content.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start, start + styled.length);
    });
  }

  function cleanFormat() {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.slice(start, end);
    if (!selected) return;
    const cleaned = cleanUnicodeStyle(selected);
    setContent(content.slice(0, start) + cleaned + content.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start, start + cleaned.length);
    });
  }

  async function copyContent() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Texto copiado");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar el texto");
    }
  }

  function handleSave() {
    if (!title.trim()) {
      toast.error("Escribe un título");
      return;
    }
    if (!content.trim()) {
      toast.error("Escribe el texto");
      return;
    }
    const payload = post
      ? { id: post.id, title: title.trim(), content, network, status }
      : { title: title.trim(), content, network, status };
    savePost.mutate(payload, {
      onSuccess: () => {
        toast.success(isNew ? "Texto creado" : "Texto guardado");
        onBack();
      },
      onError: () => toast.error("No se pudo guardar el texto"),
    });
  }

  function handleDelete() {
    if (!post) return;
    if (!confirm(`¿Eliminar el texto "${post.title}"?`)) return;
    deletePost.mutate(post.id, {
      onSuccess: () => {
        toast.success("Texto eliminado");
        onBack();
      },
      onError: () => toast.error("No se pudo eliminar el texto"),
    });
  }

  function handleAddComment() {
    const body = comment.trim();
    if (!body || !postId) return;
    addComment.mutate(
      { postId, body },
      {
        onSuccess: () => {
          setComment("");
          toast.success("Comentario añadido");
        },
        onError: () => toast.error("No se pudo añadir el comentario"),
      },
    );
  }

  function handleDeleteComment(id: string) {
    if (!postId) return;
    if (!confirm("¿Eliminar este comentario?")) return;
    deleteComment.mutate(
      { id, postId },
      {
        onSuccess: () => toast.success("Comentario eliminado"),
        onError: () => toast.error("No se pudo eliminar el comentario"),
      },
    );
  }

  if (postId && posts.isLoading) {
    return (
      <div className="comic rounded-xl bg-card p-8 text-center text-sm font-bold text-muted-foreground">
        Cargando...
      </div>
    );
  }

  if (postId && !post) {
    return (
      <div className="space-y-6">
        <button
          onClick={onBack}
          className="comic-sm comic-press flex items-center gap-1.5 rounded-lg bg-card px-3 py-1.5 text-xs font-extrabold uppercase hover:bg-accent"
        >
          ← Volver a Redes
        </button>
        <div className="comic rounded-xl bg-card p-8 text-center">
          <p className="text-lg font-bold">Texto no encontrado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabecera: volver + acciones */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={onBack}
          className="comic-sm comic-press flex items-center gap-1.5 rounded-lg bg-card px-3 py-1.5 text-xs font-extrabold uppercase hover:bg-accent"
        >
          ← Volver a Redes
        </button>

        <div className="flex items-center gap-2">
          {!isNew && (
            <button
              onClick={handleDelete}
              className="comic-sm comic-press flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-extrabold uppercase text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" /> Eliminar
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={savePost.isPending}
            className="comic-sm comic-press flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-extrabold uppercase text-primary-foreground disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" /> {isNew ? "Crear" : "Guardar"}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="comic rounded-xl bg-card p-4 sm:p-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-[11px] font-extrabold uppercase text-muted-foreground">
            Título
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="P. ej. Concierto en las fiestas de..."
            className="w-full rounded-lg border-2 border-border bg-background px-3 py-2 text-sm font-bold focus:border-primary focus:outline-none"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold uppercase text-muted-foreground">
              Red social
            </label>
            <div className="flex flex-wrap gap-1.5">
              {NETWORKS.map((n) => (
                <button
                  key={n.value}
                  onClick={() => setNetwork(n.value)}
                  className={`comic-sm comic-press flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-extrabold uppercase transition-colors ${
                    network === n.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-accent"
                  }`}
                >
                  <n.icon className="h-3.5 w-3.5" /> {n.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold uppercase text-muted-foreground">
              Estado
            </label>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStatus(s.value)}
                  className={`comic-sm comic-press rounded-lg px-3 py-1.5 text-xs font-extrabold uppercase transition-colors ${
                    status === s.value
                      ? s.className + " ring-2 ring-ink/40"
                      : "bg-secondary text-secondary-foreground hover:bg-accent"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-extrabold uppercase text-muted-foreground">
            Texto del copy
          </label>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Escribe aquí el texto... Selecciona una parte y aplica negrita/cursiva con los botones de abajo."
            rows={6}
            className="w-full resize-y rounded-lg border-2 border-border bg-background px-3 py-2 text-sm font-medium focus:border-primary focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {STYLES.map((s) => (
              <button
                key={s.value}
                onClick={() => applyStyle(s.value)}
                title={s.title}
                className={`comic-sm comic-press flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-sm font-bold text-secondary-foreground hover:bg-accent ${s.className}`}
              >
                {s.label}
              </button>
            ))}
            <button
              onClick={cleanFormat}
              title="Quitar formato"
              className="comic-sm comic-press flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-secondary-foreground hover:bg-accent"
            >
              <Eraser className="h-4 w-4" />
            </button>

            <span className="mx-1 h-5 w-px bg-border" />

            <button
              onClick={() => setShowPreview((v) => !v)}
              className={`comic-sm comic-press flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-extrabold uppercase transition-colors ${
                showPreview
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              <Eye className="h-3.5 w-3.5" /> Vista previa
            </button>
            <button
              onClick={copyContent}
              className="comic-sm comic-press flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-extrabold uppercase bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              Copiar
            </button>
          </div>
        </div>

        {showPreview && (
          <div className="rounded-xl border-2 border-border bg-background p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <networkMeta.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold leading-tight">
                  {title.trim() ? title : "Sin título"}
                </p>
                <p className="text-[11px] font-bold text-muted-foreground">La Bomba Show</p>
              </div>
            </div>
            <p className="whitespace-pre-line break-words text-sm font-medium">
              {content || "Sin contenido"}
            </p>
          </div>
        )}
      </div>

      {/* Comentarios */}
      <div className="comic rounded-xl bg-card p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2 border-b border-border/40 pb-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-extrabold uppercase">
            Comentarios ({comments.data?.length ?? 0})
          </h2>
        </div>

        <div className="max-h-64 space-y-2.5 overflow-y-auto pr-1">
          {(comments.data ?? []).map((c) => (
            <div
              key={c.id}
              className="flex items-start gap-2 rounded-lg border border-border/40 bg-background p-2.5"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-extrabold uppercase">
                {(nameMap[c.user_id] ?? "?").slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold uppercase text-muted-foreground">
                    {nameMap[c.user_id] ?? "Miembro"}
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground/70">
                    {formatDate(c.created_at)}
                  </span>
                </div>
                <p className="whitespace-pre-line break-words text-sm font-medium">{c.body}</p>
              </div>
              <button
                onClick={() => handleDeleteComment(c.id)}
                aria-label="Eliminar comentario"
                title="Eliminar comentario"
                className="shrink-0 p-1 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {comments.data && comments.data.length === 0 && (
            <p className="py-2 text-center text-xs font-bold text-muted-foreground">
              Sin comentarios todavía.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddComment();
            }}
            placeholder="Añade un comentario..."
            className="flex-1 rounded-lg border-2 border-border bg-background px-3 py-2 text-sm font-medium focus:border-primary focus:outline-none"
          />
          <button
            onClick={handleAddComment}
            disabled={addComment.isPending || !comment.trim()}
            className="comic-sm comic-press flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-extrabold uppercase text-primary-foreground disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" /> Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
