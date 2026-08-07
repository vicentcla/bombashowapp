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
  Search,
  Send,
  Sparkles,
  User,
  Archive,
  ChevronDown,
  LayoutTemplate,
  Type,
  X,
  Heart,
  Bookmark,
  Loader2,
  Quote,
  RefreshCw,
  PenLine,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAddComment,
  useDeleteComment,
  useDeleteSocialPost,
  useProfiles,
  useSaveSocialPost,
  useSaveSocialTemplate,
  useSocialComments,
  useSocialPosts,
  useSocialTemplates,
  type SocialComment,
  type SocialNetwork,
  type SocialPost,
  type SocialPostStatus,
  type SocialTemplate,
} from "@/lib/queries";
import {
  cleanUnicodeStyle,
  composeUnicodeStyle,
  supportsUnicodeStyle,
  toUnicodeStyle,
  type UnicodeFontFamily,
  type UnicodeFontStyle,
} from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { useSocialPostChanges, useSocialPresence } from "@/hooks/useSocialRealtime";
import { supabase } from "@/integrations/supabase/client";
import { TabStrip } from "@/components/TabStrip";

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

type NetworkMeta = { value: string; label: string; icon: typeof Instagram };

const NETWORKS: NetworkMeta[] = [
  { value: "instagram", label: "Instagram", icon: Instagram },
  { value: "tiktok", label: "TikTok", icon: Music2 },
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

const FONT_FAMILIES: { value: UnicodeFontFamily; name: string }[] = [
  { value: "normal", name: "Normal" },
  { value: "sans", name: "Sans serif" },
  { value: "fullwidth", name: "Ancho completo" },
  { value: "sansBold", name: "Sans negrita" },
  { value: "sansBoldItalic", name: "Sans negrita cursiva" },
  { value: "mono", name: "Monoespaciada" },
  { value: "script", name: "Escritura a mano" },
  { value: "scriptBold", name: "Escritura a mano negrita" },
  { value: "fraktur", name: "Gótica" },
  { value: "doubleStruck", name: "Doble trazo" },
  { value: "circled", name: "Círculos" },
  { value: "squared", name: "Cuadrados" },
  { value: "squaredNegative", name: "Cuadrados negros" },
  { value: "parenthesized", name: "Paréntesis" },
];

const FONT_STYLES: { value: UnicodeFontStyle; name: string }[] = [
  { value: "normal", name: "Normal" },
  { value: "bold", name: "Negrita" },
  { value: "italic", name: "Cursiva" },
  { value: "boldItalic", name: "Negrita cursiva" },
];

function familySample(family: UnicodeFontFamily): string {
  const style = composeUnicodeStyle(family, "normal");
  return style ? toUnicodeStyle("Aa 01", style) : "Aa 01";
}

function networkMetaOf(value: string): NetworkMeta {
  if (value === "whatsapp") return { value, label: "WhatsApp", icon: MessageCircle };
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

type Highlight = { start: number; end: number; active: boolean };
type Segment = { text: string; state: 0 | 1 | 2 };

function buildHighlightSegments(content: string, highlights: Highlight[]): Segment[] {
  const segs: Segment[] = [];
  let state: 0 | 1 | 2 = 0;
  let buf = "";
  let offset = 0;
  const push = () => {
    if (buf) {
      segs.push({ text: buf, state });
      buf = "";
    }
  };
  for (const ch of content) {
    let next: 0 | 1 | 2 = 0;
    for (const h of highlights) {
      if (offset >= h.start && offset < h.end) {
        next = h.active ? 2 : 1;
        break;
      }
    }
    if (next === state) {
      buf += ch;
    } else {
      push();
      state = next;
      buf = ch;
    }
    offset += ch.length;
  }
  push();
  return segs;
}

function HighlightRuns({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((s, i) =>
        s.state === 2 ? (
          <mark key={i} className="rounded bg-amber-300/60 px-0.5">
            {s.text}
          </mark>
        ) : s.state === 1 ? (
          <mark key={i} className="rounded bg-primary/10 px-0.5">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

// ─── Componente Principal SocialPage ────────────────────────────────────────────

function SocialPage() {
  const queryClient = useQueryClient();
  const posts = useSocialPosts();
  const templates = useSocialTemplates();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [selected, setSelected] = useState<string | null>(search.open ?? null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<{
    title: string;
    content: string;
    network: SocialNetwork;
  } | null>(null);
  const [networkFilter, setNetworkFilter] = useState<"todas" | SocialNetwork>("todas");
  const [statusFilter, setStatusFilter] = useState<"todos" | SocialPostStatus>("todos");
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showCopyFrom, setShowCopyFrom] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);

  const deletePost = useDeleteSocialPost();

  useEffect(() => {
    const channel = supabase
      .channel("social-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "social_posts" }, () => {
        queryClient.invalidateQueries({ queryKey: ["social_posts"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "social_comments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["social_posts"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  function openPost(id: string) {
    setSelected(id);
    navigate({ to: "/social", search: { open: id } });
  }

  function closePost() {
    setSelected(null);
    navigate({ to: "/social", search: {} });
  }

  function startCreating() {
    setDraft(null);
    setCreating(true);
  }

  function startFromPost(post: SocialPost) {
    const network = NETWORKS.some((n) => n.value === post.network)
      ? (post.network as SocialNetwork)
      : "instagram";
    setDraft({ title: post.title, content: post.content, network });
    setCreating(true);
  }

  function startFromTemplate(t: SocialTemplate) {
    setDraft({ title: t.name, content: t.content, network: t.network });
    setCreating(true);
  }

  function stopCreating() {
    setCreating(false);
    setDraft(null);
  }

  function removePost(post: SocialPost) {
    if (!confirm(`¿Eliminar el texto "${post.title}"?`)) return;
    deletePost.mutate(post.id, {
      onSuccess: () => toast.success("Texto eliminado"),
      onError: () => toast.error("No se pudo eliminar el texto"),
    });
  }

  if (selected) return <SocialDetail postId={selected} onBack={closePost} />;
  if (creating) {
    return draft ? (
      <SocialDetail postId={null} onBack={stopCreating} initialDraft={draft} />
    ) : (
      <SocialDetail postId={null} onBack={stopCreating} />
    );
  }

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
              Construye el texto de los posts editando la tipografía (negrita, cursiva...)
            </p>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowNewMenu((v) => !v)}
            className="comic comic-press flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-extrabold uppercase text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Nuevo texto <ChevronDown className="h-4 w-4" />
          </button>

          {showNewMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNewMenu(false)} />
              <div className="comic fixed left-1/2 top-1/2 z-50 w-64 max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-ink/10 bg-card shadow-lg sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-1.5 sm:w-60 sm:max-w-none sm:translate-x-0 sm:translate-y-0">
                <button
                  onClick={() => {
                    setShowNewMenu(false);
                    startCreating();
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-extrabold uppercase transition-colors hover:bg-accent"
                >
                  <Plus className="h-4 w-4 text-primary" /> Nuevo
                </button>
                <button
                  onClick={() => {
                    setShowNewMenu(false);
                    setShowCopyFrom(true);
                  }}
                  className="flex w-full items-center gap-2.5 border-t border-ink/10 px-4 py-3 text-left text-sm font-extrabold uppercase transition-colors hover:bg-accent"
                >
                  <Archive className="h-4 w-4 text-primary" /> A partir de...
                </button>

                <div className="border-t border-ink/10">
                  <p className="flex items-center gap-2 px-4 pt-3 text-[10px] font-extrabold uppercase text-muted-foreground">
                    <LayoutTemplate className="h-3.5 w-3.5" /> Plantillas
                  </p>
                  <div className="max-h-44 overflow-y-auto">
                    {templates.data?.map((t) => {
                      const meta = networkMetaOf(t.network);
                      return (
                        <button
                          key={t.id}
                          onClick={() => {
                            setShowNewMenu(false);
                            startFromTemplate(t);
                          }}
                          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-bold transition-colors hover:bg-accent"
                        >
                          <meta.icon className="h-4 w-4 shrink-0 text-primary" /> {t.name}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => {
                      setShowNewMenu(false);
                      setShowCreateTemplate(true);
                    }}
                    className="flex w-full items-center gap-2.5 border-t border-ink/10 px-4 py-3 text-left text-sm font-extrabold uppercase text-primary transition-colors hover:bg-accent"
                  >
                    <Plus className="h-4 w-4" /> Crear plantilla
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sub-pestañas por red */}
      <TabStrip
        tabs={[
          { id: "todas", label: "Todas" },
          { id: "instagram", label: "Instagram", icon: <Instagram className="h-4 w-4" /> },
          { id: "tiktok", label: "TikTok", icon: <Music2 className="h-4 w-4" /> },
        ]}
        active={networkFilter}
        onChange={setNetworkFilter}
      />

      {/* Filtros por estado */}
      <div className="flex flex-wrap items-center gap-1.5">
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

      {showCopyFrom && (
        <CopyFromModal onPick={startFromPost} onClose={() => setShowCopyFrom(false)} />
      )}
      {showCreateTemplate && <CreateTemplateModal onClose={() => setShowCreateTemplate(false)} />}
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

// ─── Detalle / Editor colaborativo ──────────────────────────────────────────────

function SocialDetail({
  postId: initialPostId,
  onBack,
  initialDraft,
}: {
  postId: string | null;
  onBack: () => void;
  initialDraft?: { title: string; content: string; network: SocialNetwork };
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const posts = useSocialPosts();
  const savePost = useSaveSocialPost();
  const deletePost = useDeleteSocialPost();
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();
  const profiles = useProfiles();

  const [currentId, setCurrentId] = useState<string | null>(initialPostId);
  const isNew = currentId === null;
  const comments = useSocialComments(currentId);
  const post = isNew ? undefined : posts.data?.find((p) => p.id === currentId);

  const [title, setTitle] = useState(initialDraft?.title ?? "");
  const [content, setContent] = useState(initialDraft?.content ?? "");
  const [network, setNetwork] = useState<SocialNetwork>(initialDraft?.network ?? "instagram");
  const [status, setStatus] = useState<SocialPostStatus>("borrador");
  const [fontFamily, setFontFamily] = useState<UnicodeFontFamily>("normal");
  const [fontStyle, setFontStyle] = useState<UnicodeFontStyle>("normal");
  const [liveMode, setLiveMode] = useState(false);
  const [showFamilyMenu, setShowFamilyMenu] = useState(false);
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [comment, setComment] = useState("");
  const [anchorComment, setAnchorComment] = useState("");
  const [copied, setCopied] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [pendingRemote, setPendingRemote] = useState<Partial<SocialPost> | null>(null);
  const [anchor, setAnchor] = useState<{ start: number; end: number; snippet: string } | null>(
    null,
  );
  const [activeHighlight, setActiveHighlight] = useState<{ start: number; end: number } | null>(
    null,
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const pendingEditRef = useRef<Set<"title" | "content">>(new Set());
  const prevContentRef = useRef(content);
  const lastSavedSnapshotRef = useRef<{
    title: string;
    content: string;
    network: SocialNetwork;
    status: SocialPostStatus;
  } | null>(null);
  const myLastSaveRef = useRef<{
    title: string;
    content: string;
    network: SocialNetwork;
    status: SocialPostStatus;
  } | null>(null);
  const loadedRef = useRef(false);
  const justCreatedRef = useRef(false);

  const nameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of profiles.data ?? []) map[p.id] = p.display_name?.trim() || "Miembro";
    return map;
  }, [profiles.data]);

  const networkMeta = networkMetaOf(network);

  const self = useMemo(
    () => (user ? { user_id: user.id, name: nameMap[user.id] ?? "Miembro" } : null),
    [user, nameMap],
  );
  const { users, setEditing } = useSocialPresence(currentId, self);
  const presenceOthers = users.filter((u) => u.user_id !== user?.id);

  // Carga inicial: sincroniza el editor con el post (solo la primera vez)
  useEffect(() => {
    if (!post || loadedRef.current) return;
    loadedRef.current = true;
    justCreatedRef.current = false;
    setTitle(post.title);
    setContent(post.content);
    setNetwork(post.network);
    setStatus(post.status);
    const snapshot = {
      title: post.title,
      content: post.content,
      network: post.network,
      status: post.status,
    };
    lastSavedSnapshotRef.current = snapshot;
    myLastSaveRef.current = snapshot;
  }, [post]);

  // Mantiene el valor anterior del editor al día para el modo escritura directa
  useEffect(() => {
    prevContentRef.current = content;
  }, [content]);

  // Realtime: cambios del post y de sus comentarios
  useSocialPostChanges({
    postId: currentId,
    onPostUpdate: (row) => {
      const last = myLastSaveRef.current;
      const isOwnEcho =
        last &&
        row.title === last.title &&
        row.content === last.content &&
        row.network === last.network &&
        row.status === last.status;
      if (isOwnEcho) return;

      const patch: Partial<SocialPost> = {};
      if (row.title !== undefined && !pendingEditRef.current.has("title")) {
        setTitle(row.title);
      } else if (row.title !== undefined) {
        patch.title = row.title;
      }
      if (row.content !== undefined && !pendingEditRef.current.has("content")) {
        setContent(row.content);
      } else if (row.content !== undefined) {
        patch.content = row.content;
      }
      if (row.network !== undefined) setNetwork(row.network);
      if (row.status !== undefined) setStatus(row.status);
      if (patch.title !== undefined || patch.content !== undefined) {
        setPendingRemote((p) => ({ ...p, ...patch }));
      }
    },
    onCommentsChanged: () => {
      queryClient.invalidateQueries({ queryKey: ["social_comments", currentId] });
      queryClient.invalidateQueries({ queryKey: ["social_posts"] });
    },
  });

  // Autoguardado con debounce
  useEffect(() => {
    if (isNew || !post) return;
    const current = { title, content, network, status };
    const last = lastSavedSnapshotRef.current;
    if (
      last &&
      last.title === current.title &&
      last.content === current.content &&
      last.network === current.network &&
      last.status === current.status
    ) {
      return;
    }
    const t = setTimeout(() => {
      lastSavedSnapshotRef.current = current;
      setSaveState("saving");
      savePost.mutate(
        { id: post.id, ...current },
        {
          onSuccess: () => {
            myLastSaveRef.current = current;
            setSaveState("saved");
            setLastSavedAt(new Date());
          },
          onError: () => {
            lastSavedSnapshotRef.current = last;
            setSaveState("idle");
            toast.error("No se pudo guardar el texto");
          },
        },
      );
    }, 800);
    return () => clearTimeout(t);
  }, [title, content, network, status, isNew, post, savePost]);

  function handleCreate() {
    if (!title.trim()) {
      toast.error("Escribe un título");
      return;
    }
    if (!content.trim()) {
      toast.error("Escribe el texto");
      return;
    }
    const payload = { title: title.trim(), content, network, status };
    savePost.mutate(payload, {
      onSuccess: (id) => {
        toast.success("Texto creado");
        justCreatedRef.current = true;
        lastSavedSnapshotRef.current = payload;
        myLastSaveRef.current = payload;
        setCurrentId(id);
        navigate({ to: "/social", search: { open: id } });
      },
      onError: () => toast.error("No se pudo crear el texto"),
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

  function applyStyleToSelection(family: UnicodeFontFamily, style: UnicodeFontStyle) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.slice(start, end);
    if (!selected) return;
    const composed = composeUnicodeStyle(family, style);
    const cleaned = cleanUnicodeStyle(selected);
    const styled = composed ? toUnicodeStyle(cleaned, composed) : cleaned;
    const next = content.slice(0, start) + styled + content.slice(end);
    setContent(next);
    prevContentRef.current = next;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start, start + styled.length);
    });
  }

  function applyTypography() {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.slice(start, end);
    if (!selected) {
      toast("Selecciona parte del texto para aplicar el estilo");
      return;
    }
    applyStyleToSelection(fontFamily, fontStyle);
  }

  function changeFamily(family: UnicodeFontFamily) {
    setShowFamilyMenu(false);
    const style = supportsUnicodeStyle(family, fontStyle) ? fontStyle : "normal";
    setFontFamily(family);
    setFontStyle(style);
    applyStyleToSelection(family, style);
  }

  function changeStyle(style: UnicodeFontStyle) {
    setShowStyleMenu(false);
    setFontStyle(style);
    applyStyleToSelection(fontFamily, style);
  }

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const el = e.target;
    const newVal = el.value;
    const composed = liveMode ? composeUnicodeStyle(fontFamily, fontStyle) : null;
    if (!composed) {
      prevContentRef.current = newVal;
      setContent(newVal);
      return;
    }
    const prev = prevContentRef.current;
    let prefix = 0;
    const maxPrefix = Math.min(prev.length, newVal.length);
    while (prefix < maxPrefix && prev.charCodeAt(prefix) === newVal.charCodeAt(prefix)) prefix++;
    let suffix = 0;
    const maxSuffix = Math.min(prev.length, newVal.length) - prefix;
    while (
      suffix < maxSuffix &&
      prev.charCodeAt(prev.length - 1 - suffix) === newVal.charCodeAt(newVal.length - 1 - suffix)
    ) {
      suffix++;
    }
    const inserted = newVal.slice(prefix, newVal.length - suffix);
    if (!inserted) {
      prevContentRef.current = newVal;
      setContent(newVal);
      return;
    }
    const styled = toUnicodeStyle(inserted, composed);
    const next = newVal.slice(0, prefix) + styled + newVal.slice(newVal.length - suffix);
    prevContentRef.current = next;
    setContent(next);
    const caret = prefix + styled.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
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

  function trackSelection() {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start === end) {
      setAnchor(null);
      return;
    }
    const snippet = content.slice(start, end).slice(0, 120);
    if (!snippet.trim()) {
      setAnchor(null);
      return;
    }
    setAnchor({ start, end, snippet });
  }

  function submitAnchoredComment() {
    const body = anchorComment.trim();
    if (!body || !currentId || !anchor) return;
    addComment.mutate(
      {
        postId: currentId,
        body,
        anchor: { start_offset: anchor.start, end_offset: anchor.end, snippet: anchor.snippet },
      },
      {
        onSuccess: () => {
          setAnchorComment("");
          setAnchor(null);
          toast.success("Comentario añadido");
        },
        onError: () => toast.error("No se pudo añadir el comentario"),
      },
    );
  }

  function handleAddComment() {
    const body = comment.trim();
    if (!body || !currentId) return;
    addComment.mutate(
      { postId: currentId, body },
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
    if (!currentId) return;
    if (!confirm("¿Eliminar este comentario?")) return;
    deleteComment.mutate(
      { id, postId: currentId },
      {
        onSuccess: () => toast.success("Comentario eliminado"),
        onError: () => toast.error("No se pudo eliminar el comentario"),
      },
    );
  }

  function applyPendingRemote() {
    if (!pendingRemote) return;
    if (pendingRemote.title !== undefined) setTitle(pendingRemote.title);
    if (pendingRemote.content !== undefined) setContent(pendingRemote.content);
    pendingEditRef.current.clear();
    setPendingRemote(null);
  }

  function toggleHighlight(c: SocialComment) {
    if (c.start_offset == null || c.end_offset == null) return;
    const isActive =
      activeHighlight?.start === c.start_offset && activeHighlight?.end === c.end_offset;
    setActiveHighlight(isActive ? null : { start: c.start_offset, end: c.end_offset });
    if (!isActive) {
      previewRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
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

  if (currentId && posts.isLoading) {
    return (
      <div className="comic rounded-xl bg-card p-8 text-center text-sm font-bold text-muted-foreground">
        Cargando...
      </div>
    );
  }

  if (currentId && !post && posts.data && !justCreatedRef.current) {
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

  const highlights: Highlight[] = [];
  for (const c of comments.data ?? []) {
    if (c.start_offset == null || c.end_offset == null) continue;
    if (c.start_offset >= 0 && c.end_offset <= content.length && c.start_offset < c.end_offset) {
      highlights.push({
        start: c.start_offset,
        end: c.end_offset,
        active: activeHighlight?.start === c.start_offset && activeHighlight?.end === c.end_offset,
      });
    }
  }

  const lastEditorName =
    post?.updated_by && post.updated_by !== user?.id ? nameMap[post.updated_by] : null;

  return (
    <div className="space-y-6">
      {/* Cabecera: volver + presencia + acciones */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={onBack}
          className="comic-sm comic-press flex items-center gap-1.5 rounded-lg bg-card px-3 py-1.5 text-xs font-extrabold uppercase hover:bg-accent"
        >
          ← Volver a Redes
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {!isNew && saveState !== "idle" && (
            <span className="text-[10px] font-extrabold uppercase text-muted-foreground">
              {saveState === "saving" ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Guardando…
                </span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3 w-3" /> Guardado
                  {lastSavedAt ? ` ${formatDate(lastSavedAt.toISOString())}` : ""}
                </span>
              )}
            </span>
          )}
          {lastEditorName && (
            <span
              className="comic-sm rounded bg-secondary px-2 py-1 text-[10px] font-extrabold uppercase text-secondary-foreground"
              title="Última edición"
            >
              Editado por {lastEditorName}
            </span>
          )}
          {presenceOthers.length > 0 && (
            <div
              className="flex -space-x-1.5"
              title={`Editando ahora: ${presenceOthers.map((u) => u.name).join(", ")}`}
            >
              {presenceOthers.slice(0, 3).map((u) => (
                <span
                  key={u.user_id}
                  className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-secondary text-[8px] font-extrabold uppercase"
                >
                  {u.name.slice(0, 2)}
                </span>
              ))}
              {presenceOthers.length > 3 && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-accent text-[8px] font-extrabold">
                  +{presenceOthers.length - 3}
                </span>
              )}
            </div>
          )}
          {!isNew && (
            <button
              onClick={handleDelete}
              className="comic-sm comic-press flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-extrabold uppercase text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" /> Eliminar
            </button>
          )}
          {isNew && (
            <button
              onClick={handleCreate}
              disabled={savePost.isPending}
              className="comic-sm comic-press flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-extrabold uppercase text-primary-foreground disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" /> Crear
            </button>
          )}
        </div>
      </div>

      {/* Aviso de versión remota más reciente */}
      {pendingRemote && (
        <div className="comic flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-500/15 px-3 py-2 text-xs font-extrabold text-amber-700 dark:text-amber-300">
          <span>Alguien ha actualizado este texto mientras lo editabas.</span>
          <button
            onClick={applyPendingRemote}
            className="comic-sm comic-press flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-1 uppercase"
          >
            <RefreshCw className="h-3 w-3" /> Cargar cambios
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Editor */}
        <div className="order-1 space-y-4 lg:order-none lg:col-start-1 lg:row-start-1">
          <div className="comic rounded-xl bg-card p-4 sm:p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-extrabold uppercase text-muted-foreground">
                Título
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onFocus={() => {
                  pendingEditRef.current.add("title");
                  setEditing(true);
                }}
                onBlur={() => {
                  pendingEditRef.current.delete("title");
                  setEditing(false);
                }}
                placeholder="P. ej. Concierto en las fiestas de..."
                className="w-full rounded-lg border-2 border-border bg-background px-3 py-2 text-sm font-bold focus:border-primary focus:outline-none"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold uppercase text-muted-foreground">
                  Red social
                </label>
                <div className="flex gap-1.5">
                  {NETWORKS.map((n) => (
                    <button
                      key={n.value}
                      type="button"
                      onClick={() => setNetwork(n.value as SocialNetwork)}
                      className={`comic-sm comic-press flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-extrabold uppercase transition-colors ${
                        network === n.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground hover:bg-accent"
                      }`}
                    >
                      <n.icon className="h-4 w-4" /> {n.label}
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
                onChange={handleContentChange}
                onFocus={() => {
                  pendingEditRef.current.add("content");
                  setEditing(true);
                }}
                onBlur={() => {
                  pendingEditRef.current.delete("content");
                  setEditing(false);
                }}
                onMouseUp={trackSelection}
                onKeyUp={trackSelection}
                placeholder="Escribe aquí el texto... Activa el modo escritura directa para escribir con la tipografía elegida, o selecciona una palabra y elige una tipografía llamativa."
                rows={7}
                className="w-full resize-y rounded-lg border-2 border-border bg-background px-3 py-2 text-sm font-medium focus:border-primary focus:outline-none"
              />

              {/* Selectores tipografía + estilo */}
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowFamilyMenu((v) => !v);
                      setShowStyleMenu(false);
                    }}
                    className={`comic-sm comic-press flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-extrabold uppercase transition-colors ${
                      showFamilyMenu
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-accent"
                    }`}
                  >
                    <Type className="h-3.5 w-3.5" />
                    {FONT_FAMILIES.find((f) => f.value === fontFamily)?.name ?? "Tipografía"}
                    <ChevronDown className="h-3 w-3" />
                  </button>

                  {showFamilyMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowFamilyMenu(false)}
                      />
                      <div className="comic absolute left-0 top-full z-50 mt-1.5 max-h-72 w-64 overflow-y-auto rounded-xl border border-ink/10 bg-card py-1 shadow-lg">
                        {FONT_FAMILIES.map((f) => (
                          <button
                            key={f.value}
                            onClick={() => changeFamily(f.value)}
                            className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent ${
                              f.value === fontFamily ? "bg-accent" : ""
                            }`}
                          >
                            <span className="w-36 shrink-0 text-[10px] font-extrabold uppercase text-muted-foreground">
                              {f.name}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-base leading-tight">
                              {familySample(f.value)}
                            </span>
                            {f.value === fontFamily && (
                              <Check className="h-4 w-4 shrink-0 text-primary" />
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="relative">
                  <button
                    onClick={() => {
                      setShowStyleMenu((v) => !v);
                      setShowFamilyMenu(false);
                    }}
                    className={`comic-sm comic-press flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-extrabold uppercase transition-colors ${
                      showStyleMenu
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-accent"
                    }`}
                  >
                    <span>{FONT_STYLES.find((s) => s.value === fontStyle)?.name ?? "Estilo"}</span>{" "}
                    <ChevronDown className="h-3 w-3" />
                  </button>

                  {showStyleMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowStyleMenu(false)} />
                      <div className="comic absolute left-0 top-full z-50 mt-1.5 w-48 overflow-hidden rounded-xl border border-ink/10 bg-card py-1 shadow-lg">
                        {FONT_STYLES.map((s) => {
                          const supported = supportsUnicodeStyle(fontFamily, s.value);
                          return (
                            <button
                              key={s.value}
                              disabled={!supported}
                              onClick={() => changeStyle(s.value)}
                              title={supported ? undefined : "No disponible para esta tipografía"}
                              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-bold transition-colors hover:bg-accent ${
                                supported ? "" : "cursor-not-allowed opacity-40"
                              }`}
                            >
                              {s.name}
                              {!supported && <X className="h-3 w-3 text-muted-foreground" />}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={() => setLiveMode((v) => !v)}
                  title={
                    liveMode
                      ? "Escribir con la tipografía actual: activado"
                      : "Escribir con la tipografía actual: desactivado"
                  }
                  className={`comic-sm comic-press flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-extrabold uppercase transition-colors ${
                    liveMode
                      ? "bg-primary text-primary-foreground ring-2 ring-ink/30"
                      : "bg-secondary text-secondary-foreground hover:bg-accent"
                  }`}
                >
                  <PenLine className="h-3.5 w-3.5" /> Escribir directo
                </button>

                <button
                  onClick={applyTypography}
                  title="Aplicar tipografía y estilo a la selección"
                  className="comic-sm comic-press rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-extrabold uppercase text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Aplicar
                </button>

                <button
                  onClick={cleanFormat}
                  title="Quitar formato"
                  className="comic-sm comic-press flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-secondary-foreground hover:bg-accent"
                >
                  <Eraser className="h-4 w-4" />
                </button>
              </div>

              {/* Comentario anclado a la selección */}
              {anchor && (
                <div className="comic space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 text-[11px] italic text-muted-foreground line-clamp-2">
                      <Quote className="mr-1 inline h-3 w-3 text-primary" />
                      {anchor.snippet}
                    </p>
                    <button onClick={() => setAnchor(null)} aria-label="Cancelar ancla">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={anchorComment}
                      onChange={(e) => setAnchorComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitAnchoredComment();
                      }}
                      placeholder="Comenta este fragmento..."
                      className="min-w-0 flex-1 rounded-lg border-2 border-border bg-background px-2.5 py-1.5 text-sm font-medium focus:border-primary focus:outline-none"
                    />
                    <button
                      onClick={submitAnchoredComment}
                      disabled={addComment.isPending || !anchorComment.trim()}
                      className="comic-sm comic-press flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-extrabold uppercase text-primary-foreground disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Vista previa en vivo */}
        <div
          ref={previewRef}
          className="order-2 space-y-3 lg:order-none lg:col-start-2 lg:row-start-1 lg:sticky lg:top-6 lg:self-start"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold uppercase">Vista previa</h2>
            <button
              onClick={copyContent}
              className="comic-sm comic-press flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-extrabold uppercase text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-200" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              Copiar
            </button>
          </div>
          <PhonePreview network={network} title={title} content={content} highlights={highlights} />
          <p className="text-center text-[10px] font-bold text-muted-foreground">
            El texto copiado conserva los estilos al pegarlo en redes.
          </p>
        </div>

        {/* Comentarios */}
        <div className="order-3 space-y-3 lg:order-none lg:col-start-1 lg:row-start-2">
          <div className="comic rounded-xl bg-card p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2 border-b border-border/40 pb-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-extrabold uppercase">
                Comentarios ({comments.data?.length ?? 0})
              </h2>
            </div>

            <div className="max-h-64 space-y-2.5 overflow-y-auto pr-1">
              {(comments.data ?? []).map((c) => {
                const hasAnchor = c.start_offset != null && c.end_offset != null;
                return (
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
                      {c.snippet && (
                        <div className="mt-1 rounded border-l-2 border-primary/50 bg-primary/5 px-2 py-1 text-[11px] italic text-muted-foreground line-clamp-2">
                          {c.snippet}
                        </div>
                      )}
                      <p className="whitespace-pre-line break-words text-sm font-medium mt-1">
                        {c.body}
                      </p>
                      {hasAnchor && (
                        <button
                          onClick={() => toggleHighlight(c)}
                          className="mt-1 flex items-center gap-1 text-[10px] font-extrabold uppercase text-primary"
                        >
                          <Eye className="h-3 w-3" />
                          {activeHighlight?.start === c.start_offset
                            ? "Quitar resaltado"
                            : "Ver en el texto"}
                        </button>
                      )}
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
                );
              })}
              {comments.data && comments.data.length === 0 && (
                <p className="py-2 text-center text-xs font-bold text-muted-foreground">
                  Sin comentarios todavía. Selecciona un trozo del texto para comentarlo.
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
                placeholder="Añade un comentario general..."
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
      </div>
    </div>
  );
}

// ─── Vista previa estilo móvil ──────────────────────────────────────────────────

function PhonePreview({
  network,
  title,
  content,
  highlights,
}: {
  network: SocialNetwork;
  title: string;
  content: string;
  highlights: Highlight[];
}) {
  const meta = networkMetaOf(network);
  const segments = buildHighlightSegments(content, highlights);

  return (
    <div className="mx-auto w-full max-w-[340px]">
      <div className="comic rounded-[2rem] border-[6px] border-ink/20 bg-card p-3 shadow-xl">
        <div className="mb-2 flex justify-center">
          <div className="h-1.5 w-20 rounded-full bg-border" />
        </div>

        {network === "instagram" ? (
          <div className="flex items-center gap-2 px-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <meta.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-extrabold">labombashow</p>
              <p className="text-[10px] font-bold text-muted-foreground">La Bomba Show</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-1">
            <div className="min-w-0 flex-1 text-right">
              <p className="truncate text-xs font-extrabold">labombashow</p>
              <p className="flex items-center justify-end gap-1 text-[10px] font-bold text-muted-foreground">
                <Music2 className="h-3 w-3" /> La Bomba Show
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <meta.icon className="h-4 w-4" />
            </div>
          </div>
        )}

        <div className="mt-2 flex h-36 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 via-primary/5 to-accent">
          <Instagram className="h-8 w-8 text-primary/40" />
        </div>

        <div className="mt-2 flex items-center gap-3 px-1 text-ink">
          <Heart className="h-4 w-4" />
          <MessageCircle className="h-4 w-4" />
          <Send className="h-4 w-4" />
          <div className="flex-1" />
          <Bookmark className="h-4 w-4" />
        </div>

        <div className="mt-2 space-y-1 px-1">
          <p className="text-[10px] font-extrabold uppercase text-muted-foreground">
            {title.trim() || "Sin título"}
          </p>
          <p className="whitespace-pre-line break-words text-xs leading-relaxed">
            <HighlightRuns segments={segments} />
          </p>
          <p className="text-[9px] font-bold text-muted-foreground/70">Hace 1 hora</p>
        </div>
      </div>
    </div>
  );
}

// ─── Modal "A partir de..." – copiar un texto existente ─────────────────────────

function CopyFromModal({
  onPick,
  onClose,
}: {
  onPick: (post: SocialPost) => void;
  onClose: () => void;
}) {
  const posts = useSocialPosts();
  const [search, setSearch] = useState("");
  const q = search.toLowerCase().trim();
  const filtered = q
    ? (posts.data ?? []).filter((p) => (p.title ?? "").toLowerCase().includes(q))
    : (posts.data ?? []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/60 p-4 pb-10">
      <div className="comic mt-4 w-full max-w-md space-y-4 rounded-xl bg-card p-5">
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="text-2xl font-extrabold leading-none">A partir de...</h2>
          <button onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-xs font-medium text-muted-foreground">
          Selecciona un texto para copiar su título y contenido como punto de partida.
        </p>

        <div className="flex items-center gap-2 rounded-lg border border-ink/10 bg-background px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar texto..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            autoFocus
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {filtered.length === 0 && (
            <p className="py-2 text-center text-xs font-bold text-muted-foreground">
              No hay textos que coincidan.
            </p>
          )}
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => onPick(p)}
              className="w-full rounded-lg border border-ink/10 bg-background px-4 py-3 text-left transition-all hover:border-primary/60 hover:bg-primary/5"
            >
              <p className="truncate text-sm font-extrabold">{p.title || "(sin título)"}</p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                {networkMetaOf(p.network).label}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Modal crear plantilla (nombre + red) ───────────────────────────────────────

function CreateTemplateModal({ onClose }: { onClose: () => void }) {
  const save = useSaveSocialTemplate();
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [network, setNetwork] = useState<SocialNetwork>("instagram");

  function submit() {
    if (!name.trim()) {
      toast.error("Ponle un nombre a la plantilla");
      return;
    }
    save.mutate(
      { name: name.trim(), content, network },
      {
        onSuccess: () => {
          toast.success("Plantilla creada");
          onClose();
        },
        onError: () => toast.error("No se pudo crear la plantilla"),
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/60 p-4 pb-10">
      <div className="comic mt-4 w-full max-w-sm space-y-4 rounded-xl bg-card p-5">
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="text-2xl font-extrabold leading-none">Crear plantilla</h2>
          <button onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-extrabold uppercase text-muted-foreground">
            Nombre
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="P. ej. Concierto"
            autoFocus
            className="w-full rounded-lg border-2 border-border bg-background px-3 py-2 text-sm font-bold focus:border-primary focus:outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-extrabold uppercase text-muted-foreground">
            Texto del copy
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Escribe el texto base del post..."
            rows={4}
            className="w-full resize-y rounded-lg border-2 border-border bg-background px-3 py-2 text-sm font-bold focus:border-primary focus:outline-none"
          />
          <p className="text-[10px] font-bold text-muted-foreground">
            Se copiará al crear un texto nuevo desde esta plantilla.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-extrabold uppercase text-muted-foreground">
            Red social
          </label>
          <div className="flex gap-1.5">
            {NETWORKS.map((n) => (
              <button
                key={n.value}
                type="button"
                onClick={() => setNetwork(n.value as SocialNetwork)}
                className={`comic-sm comic-press flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-extrabold uppercase transition-colors ${
                  network === n.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-accent"
                }`}
              >
                <n.icon className="h-4 w-4" /> {n.label}
              </button>
            ))}
          </div>
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
            <Save className="h-3.5 w-3.5" /> Crear
          </button>
        </div>
      </div>
    </div>
  );
}
