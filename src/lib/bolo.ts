/** Plantillas y constructores de mensajes de bolo. */

export type BoloTemplate = "fiestas" | "suelto" | "generico";

export const TURNOS_SUGERIDOS = ["Matí", "Vesprada", "Nit"] as const;

export type Plantilla = {
  percus: string;
  trombons: string;
  trompetes: string;
  saxos: string;
  sousa: string;
};

export const PLANTILLA_FIELDS: { key: keyof Plantilla; label: string; instrument: string }[] = [
  { key: "percus", label: "Percu", instrument: "Percusión" },
  { key: "trombons", label: "Trombons", instrument: "Trombón" },
  { key: "trompetes", label: "Trompetes", instrument: "Trompeta" },
  { key: "saxos", label: "Saxos", instrument: "Saxo" },
  { key: "sousa", label: "Sousa", instrument: "Sousaphone" },
];

export type FiestasRopaTurno = {
  label: string;
  pantalon: string;
  camiseta: string;
  sabates: string;
};

export type FiestasDay = {
  dayName: string;
  dayNum: string;
  month: string;
  hours: string;
  plantilla: Plantilla;
  ropa: FiestasRopaTurno[];
};

export type FiestasData = {
  name: string;
  emojiL: string;
  emojiR: string;
  days: FiestasDay[];
};

export type SueltoData = {
  title: string;
  date: string;
  hours: string;
  meetTime: string;
  location: string;
  mapsUrl: string;
  plantilla: Plantilla;
  pantalon: string;
  camisetaMati: string;
  camisetaVesprada: string;
  ropaNota: string;
  sabates: string;
};

export type GenericForm = {
  title: string;
  day: string;
  time: string;
  location: string;
  maps_url: string;
  attendees: string[];
  clothing: string;
};

export function emptyPlantilla(): Plantilla {
  return { percus: "", trombons: "", trompetes: "", saxos: "", sousa: "" };
}

export function emptyFiestasDay(): FiestasDay {
  return {
    dayName: "",
    dayNum: "",
    month: "",
    hours: "",
    plantilla: emptyPlantilla(),
    ropa: [],
  };
}

export function emptyFiestas(): FiestasData {
  return {
    name: "",
    emojiL: "🚨🪣💦",
    emojiR: "💦🪣🚨",
    days: [emptyFiestasDay()],
  };
}

export function emptySuelto(): SueltoData {
  return {
    title: "",
    date: "",
    hours: "",
    meetTime: "",
    location: "",
    mapsUrl: "",
    plantilla: emptyPlantilla(),
    pantalon: "",
    camisetaMati: "",
    camisetaVesprada: "",
    ropaNota: "",
    sabates: "",
  };
}

export const emptyGeneric: GenericForm = {
  title: "",
  day: "",
  time: "",
  location: "",
  maps_url: "",
  attendees: [],
  clothing: "",
};

export function buildMapsLink(value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (/^www\./i.test(v)) return `https://${v}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v)}`;
}

function plantillaLines(p: Plantilla): string[] {
  const lines: string[] = [];
  for (const { key, label } of PLANTILLA_FIELDS) {
    const names = p[key].trim();
    if (names) lines.push(`-${label}: ${names}`);
  }
  return lines;
}

function ropaLine(label: string, value: string): string {
  return `${label}: ${value.trim()}`;
}

export function buildFiestasMessage(f: FiestasData): string {
  const out: string[] = [];
  const name = f.name.trim();
  if (name) out.push(`${f.emojiL.trim()}*${name}* ${f.emojiR.trim()}`);
  out.push("");

  f.days.forEach((d, i) => {
    if (i > 0) {
      out.push("______________________________");
      out.push("");
    }
    const dayLine = [d.dayName.trim(), d.dayNum.trim(), d.month.trim(), d.hours.trim()]
      .filter(Boolean)
      .join(" ");
    if (dayLine) {
      out.push(`*${dayLine}*`);
      out.push("");
    }

    const plantilla = plantillaLines(d.plantilla);
    if (plantilla.length > 0) {
      out.push("🎺🥁🎷*PLANTILLA*🎺🥁🎷");
      out.push("");
      out.push(...plantilla);
      out.push("");
    }

    if (d.ropa.length > 0) {
      out.push("👟👕🩳 *ROBA*🩳👕👟");
      for (const turno of d.ropa) {
        if (!turno.label.trim()) continue;
        out.push("");
        out.push(`*${turno.label.trim()}*`);
        if (turno.pantalon.trim()) out.push(ropaLine("🩳Pantaló", turno.pantalon));
        if (turno.camiseta.trim()) out.push(ropaLine("🎽Camiseta", turno.camiseta));
        if (turno.sabates.trim()) out.push(ropaLine("👟Sabates", turno.sabates));
      }
    }
  });

  // Recorta las líneas en blanco sobrantes del final
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out.join("\n");
}

export function buildSueltoMessage(s: SueltoData): string {
  const out: string[] = [];
  const title = s.title.trim();
  const date = s.date.trim();
  const hours = s.hours.trim();

  out.push(`🚨🚨🚨🚨🚨🚨🚨🚨🚨 // 🚨${title}🚨`);
  out.push("");
  if (date || hours) {
    out.push(`DIA ${[date, title].filter(Boolean).join(" ")}${hours ? ` DE ${hours} H` : ""}`);
    out.push("");
  }
  if (s.meetTime.trim()) out.push(`⏰ ${s.meetTime.trim()}`);
  out.push(`📍${s.location.trim() ? ` ${s.location.trim()}` : ""}`);
  const maps = buildMapsLink(s.mapsUrl);
  if (maps) out.push(`🗺️ ${maps}`);
  out.push("");

  const plantilla = plantillaLines(s.plantilla);
  if (plantilla.length > 0) {
    out.push("🎺🥁🎷*PLANTILLA*🎺🥁🎷");
    out.push("");
    out.push(...plantilla);
    out.push("");
  }

  const ropa: string[] = [];
  if (s.pantalon.trim()) ropa.push(ropaLine("🩳Pantaló", s.pantalon));
  if (s.camisetaMati.trim()) ropa.push(ropaLine("🎽Camiseta matí", s.camisetaMati));
  if (s.camisetaVesprada.trim()) {
    ropa.push(
      ropaLine(
        "🎽Camiseta vesprada",
        s.camisetaVesprada + (s.ropaNota.trim() ? ` ${s.ropaNota.trim()}` : ""),
      ),
    );
  }
  if (s.sabates.trim()) ropa.push(ropaLine("👟Sabates", s.sabates));
  if (ropa.length > 0) {
    out.push("👟👕🩳 *ROBA*🩳👕👟");
    out.push("");
    out.push(...ropa);
    out.push("");
  }

  out.push("🚨🚨🚨🚨🚨🚨🚨🚨🚨");
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out.join("\n");
}

export function buildGenericMessage(f: GenericForm): string {
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

export function fiestasHasContent(f: FiestasData): boolean {
  if (f.name.trim()) return true;
  return f.days.some((d) => {
    const hasPlantilla = Object.values(d.plantilla).some((v) => v.trim().length > 0);
    const hasRopa = d.ropa.some(
      (t) => t.label.trim() || t.pantalon.trim() || t.camiseta.trim() || t.sabates.trim(),
    );
    return [d.dayName, d.dayNum, d.month, d.hours].some((v) => v.trim()) || hasPlantilla || hasRopa;
  });
}

export function sueltoHasContent(s: SueltoData): boolean {
  const hasPlantilla = Object.values(s.plantilla).some((v) => v.trim().length > 0);
  const hasRopa = [s.pantalon, s.camisetaMati, s.camisetaVesprada, s.sabates].some((v) => v.trim());
  return (
    [s.title, s.date, s.hours, s.meetTime, s.location, s.mapsUrl].some((v) => v.trim()) ||
    hasPlantilla ||
    hasRopa
  );
}

export function genericHasContent(f: GenericForm): boolean {
  return (
    [f.title, f.day, f.time, f.location, f.maps_url, f.clothing].some((v) => v.trim()) ||
    f.attendees.length > 0
  );
}
