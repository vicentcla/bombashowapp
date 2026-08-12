import { Home, FileText, Clock, ListMusic, Megaphone, Instagram, Library } from "lucide-react";
import type { ComponentType } from "react";
import { GoogleDriveIcon } from "@/components/BrandIcons";

export type NavTo =
  | "/inicio"
  | "/letras"
  | "/contadores"
  | "/setlists"
  | "/bolo"
  | "/partituras"
  | "/social"
  | "/repertorio";

export type NavItem = {
  to: NavTo;
  label: string;
  icon: ComponentType<{ className?: string }>;
  search?: { tab: "calle"; editLyricId: undefined };
};

/** Todas las pestañas de la app (orden por defecto). */
export const ALL_NAV: NavItem[] = [
  { to: "/inicio", label: "Inicio", icon: Home },
  { to: "/letras", label: "Letras", icon: FileText },
  { to: "/contadores", label: "Contadores", icon: Clock },
  { to: "/setlists", label: "Setlists", icon: ListMusic },
  { to: "/bolo", label: "Bolo", icon: Megaphone },
  { to: "/partituras", label: "Partituras", icon: GoogleDriveIcon },
  { to: "/social", label: "Redes", icon: Instagram },
  {
    to: "/repertorio",
    label: "Repertorio",
    icon: Library,
    search: { tab: "calle", editLyricId: undefined },
  },
];

/** Pestañas que se muestran en la barra superior de escritorio. */
export const DESKTOP_NAV: NavItem[] = ALL_NAV.filter((n) => n.to !== "/repertorio");

/** Orden por defecto de la barra inferior (primeras 4). */
export const DEFAULT_ORDER: NavTo[] = ["/inicio", "/letras", "/contadores", "/partituras"];

/** Número máximo de pestañas que puede mostrar la barra inferior. */
export const BAR_LIMIT = 5;

/** Pestañas que se muestran en la barra sin orden personalizado. */
export const DEFAULT_BAR_COUNT = 4;

/** Aplica el orden guardado del usuario, añadiendo al final las pestañas que falten. */
export function orderNav(userOrder: NavTo[] | null | undefined): NavItem[] {
  const seen = new Set<string>();
  const result: NavItem[] = [];
  for (const to of userOrder ?? []) {
    const item = ALL_NAV.find((n) => n.to === to);
    if (item && !seen.has(item.to)) {
      seen.add(item.to);
      result.push(item);
    }
  }
  const rest = [...DEFAULT_ORDER, ...ALL_NAV.map((n) => n.to)];
  for (const to of rest) {
    const item = ALL_NAV.find((n) => n.to === to);
    if (item && !seen.has(item.to)) {
      seen.add(item.to);
      result.push(item);
    }
  }
  return result;
}
