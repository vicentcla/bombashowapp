import type { ElementType } from "react";
import {
  PercusionIcon,
  TrombonIcon,
  TrompetaIcon,
  SaxoIcon,
  SousaphoneIcon,
} from "@/components/InstrumentIcons";

export const INSTRUMENTS = ["Percusión", "Trombón", "Trompeta", "Saxo", "Sousaphone"] as const;

export const INSTRUMENT_ICONS: Record<string, ElementType> = {
  Percusión: PercusionIcon,
  Trombón: TrombonIcon,
  Trompeta: TrompetaIcon,
  Saxo: SaxoIcon,
  Sousaphone: SousaphoneIcon,
};

export function driveUrl(folderId: string) {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

export function embedUrl(folderId: string) {
  return `https://drive.google.com/embeddedfolderview?id=${folderId}#grid`;
}

export function extractFolderId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (!trimmed.includes("/")) return trimmed;
  const last = trimmed.split("/").filter(Boolean).pop() ?? "";
  return last.split("?")[0] ?? "";
}
