import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  Copy,
  MapPin,
  Megaphone,
  MessageCircle,
  RefreshCw,
  Save,
  Shirt,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { TagInput } from "@/components/TagInput";
import {
  useBoloMessages,
  useDeleteBoloMessage,
  useSaveBoloMessage,
  type BoloMessage,
} from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/bolo")({
  head: () => ({
    meta: [
      { title: "Bolo — La Bomba Show" },
      {
        name: "description",
        content: "Constructor de mensajes de bolo listos para enviar por WhatsApp.",
      },
    ],
  }),
  component: Bolo,
});

const EMPTY_FORM = {
  title: "",
  day: "",
  time: "",
  location: "",
  maps_url: "",
  attendees: [] as string[],
  clothing: "",
};

type Form = typeof EMPTY_FORM;

function buildMapsLink(value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (/^www\./i.test(v)) return `https://${v}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v)}`;
}

function buildMessage(f: Form): string {
  const lines: string[] = [];
  lines.push(`🎺 BOLO: ${f.title}`);
  lines.push("");
  if (f.day || f.time) {
    lines.push(`📅 Día y hora: ${[f.day, f.time].filter(Boolean).join(" · ")}`);
  }
  if (f.location) lines.push(`📍 Lugar: ${f.location}`);
  const maps = buildMapsLink(f.maps_url);
  if (maps) lines.push(`🗺️ Mapa: ${maps}`);
  if (f.attendees.length > 0) {
    lines.push("");
    lines.push("👥 Asisten:");
    for (const name of f.attendees) lines.push(`   • ${name}`);
  }
  if (f.clothing) {
    lines.push("");
    lines.push(`👕 Ropa: ${f.clothing}`);
  }
  lines.push("");
  lines.push("¡Confirmad por aquí! 👇");
  return lines.join("\n");
}

function formFromMessage(m: BoloMessage): Form {
  return {
    title: m.title,
    day: m.day,
    time: m.time,
    location: m.location,
    maps_url: m.maps_url,
    attendees: [...m.attendees],
    clothing: m.clothing,
  };
}

function Bolo() {
  const messages = useBoloMessages();
  const saveBolo = useSaveBoloMessage();
  const deleteBolo = useDeleteBoloMessage();
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const message = useMemo(() => buildMessage(form), [form]);

  const hasTitle = form.title.trim().length > 0;
  const hasAnyField = Object.values(form).some((v) =>
    Array.isArray(v) ? v.length > 0 : v.trim().length > 0,
  );

  function setField<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success("Mensaje copiado");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar el mensaje");
    }
  }

  async function copyMessageFrom(m: BoloMessage) {
    try {
      await navigator.clipboard.writeText(m.message);
      toast.success("Mensaje copiado");
    } catch {
      toast.error("No se pudo copiar el mensaje");
    }
  }

  function openWhatsApp() {
    if (!hasAnyField) {
      toast.error("Rellena los campos para generar el mensaje");
      return;
    }
    window.open(
      `https://wa.me/?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function handleSave() {
    if (!form.title.trim()) {
      toast.error("Escribe el título del bolo");
      return;
    }
    saveBolo.mutate(
      { ...form, message, ...(editingId ? { id: editingId } : {}) },
      {
        onSuccess: () => {
          toast.success(editingId ? "Convocatoria actualizada" : "Convocatoria guardada");
          setEditingId(null);
          setForm(EMPTY_FORM);
        },
        onError: () => toast.error("No se pudo guardar la convocatoria"),
      },
    );
  }

  function reuse(m: BoloMessage) {
    setEditingId(m.id);
    setForm(formFromMessage(m));
    toast.success("Convocatoria cargada para editar");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleDelete(m: BoloMessage) {
    if (!confirm(`¿Eliminar la convocatoria "${m.title}"?`)) return;
    deleteBolo.mutate(m.id, {
      onSuccess: () => toast.success("Convocatoria eliminada"),
      onError: () => toast.error("No se pudo eliminar la convocatoria"),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Megaphone className="h-7 w-7 shrink-0 text-muted-foreground" />
          <div>
            <h1 className="text-3xl font-extrabold leading-none">Bolo</h1>
            <p className="text-xs font-bold text-muted-foreground">
              Constructor de mensajes para el grupo de WhatsApp
            </p>
          </div>
        </div>

        {hasAnyField && (
          <button
            onClick={() => {
              setForm(EMPTY_FORM);
              setEditingId(null);
            }}
            className="comic-sm comic-press flex items-center gap-1.5 rounded-md bg-secondary px-3 py-2 text-xs font-extrabold uppercase text-secondary-foreground hover:bg-accent"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Limpiar
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Formulario */}
        <div className="comic space-y-4 rounded-xl bg-card p-4">
          <h2 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" /> Datos del bolo
          </h2>

          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold uppercase text-muted-foreground">
              Título del bolo *
            </label>
            <input
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="Ej. Fiestas de San Juan — Plaza Mayor"
              className="comic-sm w-full rounded-md border-2 border-border bg-background px-3 py-2 text-sm font-medium focus:border-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-extrabold uppercase text-muted-foreground">
                Día
              </label>
              <input
                value={form.day}
                onChange={(e) => setField("day", e.target.value)}
                placeholder="Sábado 12 de agosto"
                className="comic-sm w-full rounded-md border-2 border-border bg-background px-3 py-2 text-sm font-medium focus:border-primary focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-extrabold uppercase text-muted-foreground">
                Hora
              </label>
              <input
                value={form.time}
                onChange={(e) => setField("time", e.target.value)}
                placeholder="21:30"
                className="comic-sm w-full rounded-md border-2 border-border bg-background px-3 py-2 text-sm font-medium focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase text-muted-foreground">
              <MapPin className="h-3 w-3" /> Ubicación
            </label>
            <input
              value={form.location}
              onChange={(e) => setField("location", e.target.value)}
              placeholder="Ej. Plaza del Ayuntamiento, Valencia"
              className="comic-sm w-full rounded-md border-2 border-border bg-background px-3 py-2 text-sm font-medium focus:border-primary focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase text-muted-foreground">
              <MapPin className="h-3 w-3" /> Enlace a Google Maps
            </label>
            <input
              value={form.maps_url}
              onChange={(e) => setField("maps_url", e.target.value)}
              placeholder="Pega un enlace o escribe una dirección/búsqueda"
              className="comic-sm w-full rounded-md border-2 border-border bg-background px-3 py-2 text-sm font-medium focus:border-primary focus:outline-none"
            />
            <p className="text-[11px] text-muted-foreground">
              Si pegas solo una dirección, se genera el enlace de búsqueda automáticamente.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase text-muted-foreground">
              <Users className="h-3 w-3" /> Personas que asisten
            </label>
            <TagInput
              tags={form.attendees}
              onChange={(tags) => setField("attendees", tags)}
              placeholder="Nombre de cada asistente..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase text-muted-foreground">
              <Shirt className="h-3 w-3" /> Ropa
            </label>
            <input
              value={form.clothing}
              onChange={(e) => setField("clothing", e.target.value)}
              placeholder="Ej. Polo negro y pantalón azul"
              className="comic-sm w-full rounded-md border-2 border-border bg-background px-3 py-2 text-sm font-medium focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-2 border-t border-ink/10 pt-3">
            <button
              onClick={handleSave}
              disabled={!hasTitle || saveBolo.isPending}
              className="comic comic-press flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-extrabold uppercase text-primary-foreground disabled:opacity-40"
            >
              <Save className="h-4 w-4" />{" "}
              {editingId ? "Actualizar convocatoria" : "Guardar convocatoria"}
            </button>
          </div>
        </div>

        {/* Vista previa + acciones */}
        <div className="space-y-3">
          <div className="comic space-y-3 rounded-xl bg-card p-4">
            <h2 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              <MessageCircle className="h-3.5 w-3.5" /> Mensaje generado
            </h2>
            {hasAnyField ? (
              <div className="whitespace-pre-line rounded-lg border border-ink/10 bg-background p-3 text-sm font-medium">
                {message}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-ink/20 bg-background p-3 text-sm font-bold text-muted-foreground">
                Rellena los campos para ir generando el mensaje...
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                onClick={copyMessage}
                disabled={!hasAnyField}
                className="comic-sm comic-press flex items-center gap-1.5 rounded-md bg-secondary px-3 py-2 text-xs font-extrabold uppercase text-secondary-foreground hover:bg-accent disabled:opacity-40"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copiado" : "Copiar"}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!hasAnyField) {
                    e.preventDefault();
                    toast.error("Rellena los campos para generar el mensaje");
                  }
                }}
                className="comic-sm comic-press flex items-center gap-1.5 rounded-md bg-[#25D366] px-3 py-2 text-xs font-extrabold uppercase text-white hover:brightness-95 disabled:pointer-events-none disabled:opacity-40"
              >
                <MessageCircle className="h-3.5 w-3.5" /> Abrir en WhatsApp
              </a>
            </div>
          </div>

          {/* Historial */}
          <div className="comic space-y-3 rounded-xl bg-card p-4">
            <h2 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              <Save className="h-3.5 w-3.5" /> Historial de convocatorias
            </h2>

            {messages.isLoading ? (
              <p className="text-sm font-bold text-muted-foreground">Cargando...</p>
            ) : (messages.data?.length ?? 0) === 0 ? (
              <p className="rounded-lg border border-dashed border-ink/20 bg-background p-3 text-sm font-bold text-muted-foreground">
                Todavía no hay convocatorias guardadas.
              </p>
            ) : (
              <div className="space-y-2">
                {messages.data?.map((m) => (
                  <div key={m.id} className="rounded-lg border border-ink/10 bg-background p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-extrabold">{m.title}</p>
                        <p className="mt-0.5 text-xs font-bold text-muted-foreground">
                          {[m.day, m.time].filter(Boolean).join(" · ") || "Sin fecha"}
                          {m.attendees.length > 0 &&
                            ` · ${m.attendees.length} ${m.attendees.length === 1 ? "asistente" : "asistentes"}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => reuse(m)}
                          title="Reutilizar"
                          className="comic-sm comic-press rounded-md bg-secondary p-1.5 text-secondary-foreground hover:bg-accent"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => copyMessageFrom(m)}
                          title="Copiar"
                          className="comic-sm comic-press rounded-md bg-secondary p-1.5 text-secondary-foreground hover:bg-accent"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(m)}
                          title="Eliminar"
                          className="comic-sm comic-press rounded-md bg-destructive p-1.5 text-destructive-foreground hover:brightness-95"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
