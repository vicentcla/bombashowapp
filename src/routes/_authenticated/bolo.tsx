import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Check,
  Clock,
  Copy,
  MapPin,
  Megaphone,
  MessageCircle,
  Music2,
  Plus,
  RefreshCw,
  Save,
  Shirt,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { TagInput } from "@/components/TagInput";
import { INSTRUMENT_ICONS } from "@/lib/drive";
import {
  TURNOS_SUGERIDOS,
  PLANTILLA_FIELDS,
  buildFiestasMessage,
  buildGenericMessage,
  buildSueltoMessage,
  emptyFiestas,
  emptyFiestasDay,
  emptyGeneric,
  emptyPlantilla,
  emptySuelto,
  fiestasHasContent,
  genericHasContent,
  sueltoHasContent,
  type BoloTemplate,
  type FiestasData,
  type FiestasDay,
  type FiestasRopaTurno,
  type GenericForm,
  type Plantilla,
  type SueltoData,
} from "@/lib/bolo";
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

const TEMPLATE_TABS: { value: BoloTemplate; label: string }[] = [
  { value: "fiestas", label: "Fiestas" },
  { value: "suelto", label: "Bolo suelto" },
  { value: "generico", label: "Genérico" },
];

const TEMPLATE_LABELS: Record<BoloTemplate, string> = {
  fiestas: "Fiestas",
  suelto: "Bolo",
  generico: "Genérico",
};

function fiestasFromMessage(m: BoloMessage): FiestasData {
  const d = m.data as unknown as Partial<FiestasData> | undefined;
  if (d && Array.isArray(d.days)) {
    return {
      name: d.name ?? "",
      emojiL: d.emojiL ?? "🚨🪣💦",
      emojiR: d.emojiR ?? "💦🪣🚨",
      days: d.days.map((day) => ({
        dayName: day?.dayName ?? "",
        dayNum: day?.dayNum ?? "",
        month: day?.month ?? "",
        hours: day?.hours ?? "",
        plantilla: { ...emptyPlantilla(), ...(day?.plantilla ?? {}) },
        ropa: (day?.ropa ?? []).map((t) => ({
          label: t?.label ?? "",
          pantalon: t?.pantalon ?? "",
          camiseta: t?.camiseta ?? "",
          sabates: t?.sabates ?? "",
        })),
      })),
    };
  }
  return emptyFiestas();
}

function sueltoFromMessage(m: BoloMessage): SueltoData {
  const d = m.data as unknown as Partial<SueltoData> | undefined;
  if (d && typeof d.title === "string") {
    return {
      ...emptySuelto(),
      ...d,
      plantilla: { ...emptyPlantilla(), ...(d.plantilla ?? {}) },
    };
  }
  return emptySuelto();
}

function genericFromMessage(m: BoloMessage): GenericForm {
  const d = m.data as unknown as Partial<GenericForm> | undefined;
  if (d && Array.isArray(d.attendees)) {
    return { ...emptyGeneric, ...d, attendees: d.attendees ?? [] };
  }
  return {
    title: m.title,
    day: m.day,
    time: m.time,
    location: m.location,
    maps_url: m.maps_url,
    attendees: [...(m.attendees ?? [])],
    clothing: m.clothing,
  };
}

function Bolo() {
  const messages = useBoloMessages();
  const saveBolo = useSaveBoloMessage();
  const deleteBolo = useDeleteBoloMessage();

  const [template, setTemplate] = useState<BoloTemplate>("fiestas");
  const [fiestas, setFiestas] = useState<FiestasData>(() => emptyFiestas());
  const [suelto, setSuelto] = useState<SueltoData>(() => emptySuelto());
  const [generic, setGeneric] = useState<GenericForm>(emptyGeneric);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const message = useMemo(() => {
    if (template === "fiestas") return buildFiestasMessage(fiestas);
    if (template === "suelto") return buildSueltoMessage(suelto);
    return buildGenericMessage(generic);
  }, [template, fiestas, suelto, generic]);

  const hasContent =
    template === "fiestas"
      ? fiestasHasContent(fiestas)
      : template === "suelto"
        ? sueltoHasContent(suelto)
        : genericHasContent(generic);

  const currentTitle =
    template === "fiestas" ? fiestas.name : template === "suelto" ? suelto.title : generic.title;

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

  function switchTemplate(t: BoloTemplate) {
    setTemplate(t);
    setEditingId(null);
  }

  function resetForm() {
    setEditingId(null);
    if (template === "fiestas") setFiestas(emptyFiestas());
    else if (template === "suelto") setSuelto(emptySuelto());
    else setGeneric(emptyGeneric);
  }

  function handleSave() {
    if (!currentTitle.trim()) {
      toast.error("Escribe el título");
      return;
    }
    const data = template === "fiestas" ? fiestas : template === "suelto" ? suelto : generic;
    saveBolo.mutate(
      {
        ...(editingId ? { id: editingId } : {}),
        title: currentTitle.trim(),
        template,
        data,
        message,
      },
      {
        onSuccess: () => {
          toast.success(editingId ? "Convocatoria actualizada" : "Convocatoria guardada");
          setEditingId(null);
          resetForm();
        },
        onError: () => toast.error("No se pudo guardar la convocatoria"),
      },
    );
  }

  function reuse(m: BoloMessage) {
    setTemplate(m.template);
    setEditingId(m.id);
    if (m.template === "fiestas") setFiestas(fiestasFromMessage(m));
    else if (m.template === "suelto") setSuelto(sueltoFromMessage(m));
    else setGeneric(genericFromMessage(m));
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

        {hasContent && (
          <button
            onClick={resetForm}
            className="comic-sm comic-press flex items-center gap-1.5 rounded-md bg-secondary px-3 py-2 text-xs font-extrabold uppercase text-secondary-foreground hover:bg-accent"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Limpiar
          </button>
        )}
      </div>

      {/* Selector de plantilla */}
      <div className="flex gap-1.5 rounded-xl bg-secondary/40 p-1">
        {TEMPLATE_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => switchTemplate(t.value)}
            className={`comic-sm comic-press flex-1 rounded-lg px-3 py-2 text-xs font-extrabold uppercase transition-colors ${
              template === t.value
                ? "bg-primary text-primary-foreground"
                : "text-secondary-foreground hover:bg-accent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Formulario */}
        <div className="comic space-y-4 rounded-xl bg-card p-4">
          {template === "fiestas" && <FiestasForm value={fiestas} onChange={setFiestas} />}
          {template === "suelto" && <SueltoForm value={suelto} onChange={setSuelto} />}
          {template === "generico" && <GenericFormSection value={generic} onChange={setGeneric} />}

          <div className="flex flex-wrap gap-2 border-t border-ink/10 pt-3">
            <button
              onClick={handleSave}
              disabled={!currentTitle.trim() || saveBolo.isPending}
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
            {hasContent ? (
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
                disabled={!hasContent}
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
                  if (!hasContent) {
                    e.preventDefault();
                    toast.error("Rellena los campos para generar el mensaje");
                  }
                }}
                className="comic-sm comic-press flex items-center gap-1.5 rounded-md bg-[#25D366] px-3 py-2 text-xs font-extrabold uppercase text-white hover:brightness-95"
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
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase">
                            {TEMPLATE_LABELS[m.template]}
                          </span>{" "}
                          {[m.day, m.time].filter(Boolean).join(" · ") || "Sin fecha"}
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

  async function copyMessageFrom(m: BoloMessage) {
    try {
      await navigator.clipboard.writeText(m.message);
      toast.success("Mensaje copiado");
    } catch {
      toast.error("No se pudo copiar el mensaje");
    }
  }
}

// ─── Editor de plantilla (por instrumento) ────────────────────────────────────

function PlantillaEditor({
  value,
  onChange,
}: {
  value: Plantilla;
  onChange: (p: Plantilla) => void;
}) {
  return (
    <div className="space-y-2">
      {PLANTILLA_FIELDS.map(({ key, label, instrument }) => {
        const Icon = INSTRUMENT_ICONS[instrument] ?? Music2;
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="flex w-28 shrink-0 items-center gap-1.5 text-xs font-extrabold uppercase text-muted-foreground">
              <Icon className="h-4 w-4 shrink-0" /> {label}
            </span>
            <input
              value={value[key]}
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
              placeholder="Nombre1, Nombre2..."
              className="comic-sm w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm font-medium focus:border-primary focus:outline-none"
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Turno de ropa (fiestas) ──────────────────────────────────────────────────

function TurnoRopaCard({
  value,
  onChange,
  onRemove,
}: {
  value: FiestasRopaTurno;
  onChange: (t: FiestasRopaTurno) => void;
  onRemove: () => void;
}) {
  const set = <K extends keyof FiestasRopaTurno>(key: K, v: FiestasRopaTurno[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="rounded-lg border border-ink/10 bg-background p-2.5">
      <div className="flex items-center gap-2">
        <input
          value={value.label}
          onChange={(e) => set("label", e.target.value)}
          placeholder="Turno (Matí, Vesprada...)"
          className="comic-sm min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm font-extrabold uppercase focus:border-primary focus:outline-none"
        />
        <button
          onClick={onRemove}
          title="Quitar turno"
          className="comic-sm comic-press rounded-md bg-destructive p-1.5 text-destructive-foreground"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-2 space-y-1.5">
        <input
          value={value.pantalon}
          onChange={(e) => set("pantalon", e.target.value)}
          placeholder="🩳 Pantaló"
          className="comic-sm w-full rounded-md border border-ink/10 bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
        />
        <input
          value={value.camiseta}
          onChange={(e) => set("camiseta", e.target.value)}
          placeholder="🎽 Camiseta"
          className="comic-sm w-full rounded-md border border-ink/10 bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
        />
        <input
          value={value.sabates}
          onChange={(e) => set("sabates", e.target.value)}
          placeholder="👟 Sabates"
          className="comic-sm w-full rounded-md border border-ink/10 bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
        />
      </div>
    </div>
  );
}

// ─── Formulario de fiestas ────────────────────────────────────────────────────

function FiestasForm({
  value,
  onChange,
}: {
  value: FiestasData;
  onChange: (v: FiestasData) => void;
}) {
  function updateDay(i: number, day: FiestasDay) {
    onChange({ ...value, days: value.days.map((d, idx) => (idx === i ? day : d)) });
  }

  function copyPlantillaFromPrev(i: number) {
    if (i === 0) return;
    const prev = value.days[i - 1];
    const current = value.days[i];
    if (!prev || !current) return;
    updateDay(i, { ...current, plantilla: { ...prev.plantilla } });
    toast.success("Plantilla copiada del día anterior");
  }

  function copyRopaFromPrev(i: number) {
    if (i === 0) return;
    const prev = value.days[i - 1];
    const current = value.days[i];
    if (!prev || !current) return;
    updateDay(i, {
      ...current,
      ropa: prev.ropa.map((t) => ({ ...t })),
    });
    toast.success("Ropa copiada del día anterior");
  }

  function addTurno(i: number, label: string) {
    const day = value.days[i];
    if (!day) return;
    if (day.ropa.some((t) => t.label.trim().toLowerCase() === label.toLowerCase())) return;
    updateDay(i, {
      ...day,
      ropa: [...day.ropa, { label, pantalon: "", camiseta: "", sabates: "" }],
    });
  }

  function addDay() {
    const prev = value.days[value.days.length - 1] ?? emptyFiestasDay();
    onChange({
      ...value,
      days: [
        ...value.days,
        {
          ...emptyFiestasDay(),
          plantilla: { ...prev.plantilla },
          ropa: prev.ropa.map((t) => ({ ...t })),
        },
      ],
    });
  }

  function removeDay(i: number) {
    onChange({ ...value, days: value.days.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <label className="text-[11px] font-extrabold uppercase text-muted-foreground">
            Nombre de las fiestas
          </label>
          <input
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder="PENYES DE LA VALL"
            className="comic-sm w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-extrabold uppercase focus:border-primary focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <input
            value={value.emojiL}
            onChange={(e) => onChange({ ...value, emojiL: e.target.value })}
            title="Emojis de apertura del título"
            className="comic-sm w-20 rounded-md border border-ink/10 bg-background px-2 py-2 text-center text-sm focus:border-primary focus:outline-none"
          />
          <span className="text-muted-foreground">*</span>
          <input
            value={value.emojiR}
            onChange={(e) => onChange({ ...value, emojiR: e.target.value })}
            title="Emojis de cierre del título"
            className="comic-sm w-20 rounded-md border border-ink/10 bg-background px-2 py-2 text-center text-sm focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-3">
        {value.days.map((day, i) => (
          <div key={i} className="space-y-3 rounded-lg border border-ink/10 bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-extrabold uppercase text-muted-foreground">Día {i + 1}</p>
              {value.days.length > 1 && (
                <button
                  onClick={() => removeDay(i)}
                  title="Quitar día"
                  className="comic-sm comic-press rounded-md bg-destructive p-1.5 text-destructive-foreground"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                value={day.dayName}
                onChange={(e) => updateDay(i, { ...day, dayName: e.target.value })}
                placeholder="DIUMENGE"
                className="comic-sm rounded-md border border-ink/10 bg-background px-2.5 py-1.5 text-sm font-bold uppercase focus:border-primary focus:outline-none"
              />
              <div className="flex gap-2">
                <input
                  value={day.dayNum}
                  onChange={(e) => updateDay(i, { ...day, dayNum: e.target.value })}
                  placeholder="Nº"
                  className="comic-sm w-14 rounded-md border border-ink/10 bg-background px-2.5 py-1.5 text-sm text-center font-bold focus:border-primary focus:outline-none"
                />
                <input
                  value={day.month}
                  onChange={(e) => updateDay(i, { ...day, month: e.target.value })}
                  placeholder="AGOST"
                  className="comic-sm min-w-0 flex-1 rounded-md border border-ink/10 bg-background px-2.5 py-1.5 text-sm font-bold uppercase focus:border-primary focus:outline-none"
                />
              </div>
              <input
                value={day.hours}
                onChange={(e) => updateDay(i, { ...day, hours: e.target.value })}
                placeholder="DE 16:00 A 21:00"
                className="comic-sm col-span-2 rounded-md border border-ink/10 bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-extrabold uppercase text-muted-foreground">
                Plantilla
              </p>
              <PlantillaEditor
                value={day.plantilla}
                onChange={(p) => updateDay(i, { ...day, plantilla: p })}
              />
              <button
                onClick={() => copyPlantillaFromPrev(i)}
                disabled={i === 0}
                className="comic-sm comic-press flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1.5 text-[11px] font-extrabold uppercase text-secondary-foreground hover:bg-accent disabled:opacity-40"
              >
                <Copy className="h-3 w-3" /> Copiar plantilla del día anterior
              </button>
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-extrabold uppercase text-muted-foreground">
                Ropa (por turnos)
              </p>
              {day.ropa.length > 0 && (
                <div className="space-y-2">
                  {day.ropa.map((t, ti) => (
                    <TurnoRopaCard
                      key={ti}
                      value={t}
                      onChange={(nt) =>
                        updateDay(i, {
                          ...day,
                          ropa: day.ropa.map((x, xi) => (xi === ti ? nt : x)),
                        })
                      }
                      onRemove={() =>
                        updateDay(i, { ...day, ropa: day.ropa.filter((_, xi) => xi !== ti) })
                      }
                    />
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-extrabold uppercase text-muted-foreground">
                  + Turno:
                </span>
                {TURNOS_SUGERIDOS.map((t) => (
                  <button
                    key={t}
                    onClick={() => addTurno(i, t)}
                    className="comic-sm comic-press flex items-center gap-1 rounded-md bg-primary/15 px-2.5 py-1 text-[11px] font-extrabold uppercase text-primary hover:bg-primary/25"
                  >
                    <Plus className="h-3 w-3" /> {t}
                  </button>
                ))}
                <button
                  onClick={() => copyRopaFromPrev(i)}
                  disabled={i === 0}
                  className="comic-sm comic-press flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-[11px] font-extrabold uppercase text-secondary-foreground hover:bg-accent disabled:opacity-40"
                >
                  <Copy className="h-3 w-3" /> Copiar ropa del anterior
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addDay}
        className="comic-sm comic-press flex items-center gap-1.5 rounded-md bg-primary/15 px-3 py-2 text-xs font-extrabold uppercase text-primary hover:bg-primary/25"
      >
        <Plus className="h-3.5 w-3.5" /> Añadir día
      </button>
    </div>
  );
}

// ─── Formulario de bolo suelto ────────────────────────────────────────────────

function SueltoForm({ value, onChange }: { value: SueltoData; onChange: (v: SueltoData) => void }) {
  const set = <K extends keyof SueltoData>(key: K, v: SueltoData[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-[11px] font-extrabold uppercase text-muted-foreground">
          Título / lugar del bolo
        </label>
        <input
          value={value.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="JÉRICA"
          className="comic-sm w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-extrabold uppercase focus:border-primary focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[11px] font-extrabold uppercase text-muted-foreground">
            Fecha
          </label>
          <input
            value={value.date}
            onChange={(e) => set("date", e.target.value)}
            placeholder="25 JULIOL"
            className="comic-sm w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-bold uppercase focus:border-primary focus:outline-none"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-extrabold uppercase text-muted-foreground">
            Horario
          </label>
          <input
            value={value.hours}
            onChange={(e) => set("hours", e.target.value)}
            placeholder="12:30 A 19:30"
            className="comic-sm w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase text-muted-foreground">
          <Clock className="h-3 w-3" /> Hora de quedada
        </label>
        <input
          value={value.meetTime}
          onChange={(e) => set("meetTime", e.target.value)}
          placeholder="A les 11:15 h al family"
          className="comic-sm w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase text-muted-foreground">
            <MapPin className="h-3 w-3" /> Ubicación
          </label>
          <input
            value={value.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="Plaza Mayor"
            className="comic-sm w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase text-muted-foreground">
            <MapPin className="h-3 w-3" /> Enlace a Google Maps
          </label>
          <input
            value={value.mapsUrl}
            onChange={(e) => set("mapsUrl", e.target.value)}
            placeholder="Enlace o dirección"
            className="comic-sm w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-extrabold uppercase text-muted-foreground">Plantilla</p>
        <PlantillaEditor value={value.plantilla} onChange={(p) => set("plantilla", p)} />
      </div>

      <div className="space-y-1.5">
        <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase text-muted-foreground">
          <Shirt className="h-3 w-3" /> Ropa
        </p>
        <div className="space-y-2 rounded-lg border border-ink/10 bg-background p-2.5">
          <input
            value={value.pantalon}
            onChange={(e) => set("pantalon", e.target.value)}
            placeholder="🩳 Pantaló: NEGRE"
            className="comic-sm w-full rounded-md border border-ink/10 bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
          />
          <input
            value={value.camisetaMati}
            onChange={(e) => set("camisetaMati", e.target.value)}
            placeholder="🎽 Camiseta matí"
            className="comic-sm w-full rounded-md border border-ink/10 bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
          />
          <input
            value={value.camisetaVesprada}
            onChange={(e) => set("camisetaVesprada", e.target.value)}
            placeholder="🎽 Camiseta vesprada"
            className="comic-sm w-full rounded-md border border-ink/10 bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
          />
          <input
            value={value.ropaNota}
            onChange={(e) => set("ropaNota", e.target.value)}
            placeholder="Nota (opcional): (ens canviarem de camiseta després de dinar)"
            className="comic-sm w-full rounded-md border border-dashed border-ink/20 bg-background px-2.5 py-1.5 text-xs italic text-muted-foreground focus:border-primary focus:outline-none"
          />
          <input
            value={value.sabates}
            onChange={(e) => set("sabates", e.target.value)}
            placeholder="👟 Sabates: NEGRES"
            className="comic-sm w-full rounded-md border border-ink/10 bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Formulario genérico ──────────────────────────────────────────────────────

function GenericFormSection({
  value,
  onChange,
}: {
  value: GenericForm;
  onChange: (v: GenericForm) => void;
}) {
  const set = <K extends keyof GenericForm>(key: K, v: GenericForm[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-[11px] font-extrabold uppercase text-muted-foreground">
          Título del bolo *
        </label>
        <input
          value={value.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Ej. Fiestas de San Juan — Plaza Mayor"
          className="comic-sm w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-medium focus:border-primary focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[11px] font-extrabold uppercase text-muted-foreground">Día</label>
          <input
            value={value.day}
            onChange={(e) => set("day", e.target.value)}
            placeholder="Sábado 12 de agosto"
            className="comic-sm w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-medium focus:border-primary focus:outline-none"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-extrabold uppercase text-muted-foreground">Hora</label>
          <input
            value={value.time}
            onChange={(e) => set("time", e.target.value)}
            placeholder="21:30"
            className="comic-sm w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-medium focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase text-muted-foreground">
            <MapPin className="h-3 w-3" /> Ubicación
          </label>
          <input
            value={value.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="Ej. Plaza del Ayuntamiento, Valencia"
            className="comic-sm w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-medium focus:border-primary focus:outline-none"
          />
        </div>
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase text-muted-foreground">
            <MapPin className="h-3 w-3" /> Enlace a Google Maps
          </label>
          <input
            value={value.maps_url}
            onChange={(e) => set("maps_url", e.target.value)}
            placeholder="Pega un enlace o escribe una dirección"
            className="comic-sm w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-medium focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase text-muted-foreground">
          <Users className="h-3 w-3" /> Personas que asisten
        </label>
        <TagInput
          tags={value.attendees}
          onChange={(tags) => set("attendees", tags)}
          placeholder="Nombre de cada asistente..."
        />
      </div>

      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase text-muted-foreground">
          <Shirt className="h-3 w-3" /> Ropa
        </label>
        <input
          value={value.clothing}
          onChange={(e) => set("clothing", e.target.value)}
          placeholder="Ej. Polo negro y pantalón azul"
          className="comic-sm w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-medium focus:border-primary focus:outline-none"
        />
      </div>
    </div>
  );
}
