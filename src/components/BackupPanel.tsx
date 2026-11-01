import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Download, Eye, EyeOff, KeyRound, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { parseBackup, backupSummary, type BackupData } from "@/lib/backup";

function useMasterPassword() {
  return useQuery({
    queryKey: ["master_password"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_master_password");
      if (error) throw error;
      return (data as string | null) ?? null;
    },
  });
}

async function downloadBackup(prefix = "copia") {
  const { data, error } = await supabase.rpc("export_backup");
  if (error) throw error;
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  a.href = url;
  a.download = `la-bomba-${prefix}-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function MasterPasswordSection() {
  const pw = useMasterPassword();
  const qc = useQueryClient();
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  async function save() {
    const { error } = await supabase.rpc("set_master_password", { nueva: value });
    if (error) {
      toast.error(error.message.includes("Mínimo") ? "Mínimo 4 caracteres" : "No se pudo guardar");
      return;
    }
    toast.success("Contraseña maestra guardada");
    setEditing(false);
    setValue("");
    void qc.invalidateQueries({ queryKey: ["master_password"] });
  }

  return (
    <section className="space-y-2">
      <h2 className="section-label">Contraseña maestra</h2>
      <div className="comic space-y-3 rounded-2xl bg-card p-4">
        <p className="text-xs text-muted-foreground">
          Se pide al cargar una copia de seguridad, para no borrar nada por error.
        </p>
        {pw.data && !editing && (
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 text-sm">
              {show ? pw.data : "••••••••"}
            </code>
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Ocultar" : "Mostrar"}
              className="rounded-lg bg-secondary p-2"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(pw.data!);
                toast.success("Copiada");
              }}
              aria-label="Copiar"
              className="rounded-lg bg-secondary p-2"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        )}
        {editing || (!pw.isLoading && !pw.data) ? (
          <div className="flex gap-2">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Nueva contraseña"
              autoComplete="off"
            />
            <Button type="button" onClick={save} disabled={value.length < 4}>
              Guardar
            </Button>
          </div>
        ) : (
          <Button type="button" variant="secondary" className="w-full" onClick={() => setEditing(true)}>
            <KeyRound className="mr-2 h-4 w-4" /> Cambiar contraseña
          </Button>
        )}
      </div>
    </section>
  );
}

export function BackupPanel() {
  const qc = useQueryClient();
  const pw = useMasterPassword();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<BackupData | null>(null);
  const [pass, setPass] = useState("");

  async function onDownload() {
    setBusy(true);
    try {
      await downloadBackup();
      toast.success("Copia descargada");
    } catch {
      toast.error("No se pudo crear la copia");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    try {
      setPending(parseBackup(JSON.parse(await f.text())));
      setPass("");
    } catch {
      toast.error("Este archivo no es una copia de La Bomba Show");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function restore() {
    if (!pending) return;
    setBusy(true);
    try {
      await downloadBackup("antes-de-restaurar");
      const { error } = await supabase.rpc("restore_backup", {
        clave: pass,
        datos: pending as never,
      });
      if (error) {
        toast.error(
          error.message.includes("incorrecta")
            ? "Contraseña maestra incorrecta"
            : "No se pudo restaurar la copia",
        );
        return;
      }
      toast.success("Copia restaurada");
      setPending(null);
      void qc.invalidateQueries();
    } catch {
      toast.error("No se pudo restaurar la copia");
    } finally {
      setBusy(false);
    }
  }

  const summary = pending ? backupSummary(pending) : [];

  return (
    <div className="space-y-4">
      <div className="comic space-y-3 rounded-2xl bg-card p-4">
        <h3 className="font-bold">Descargar copia</h3>
        <p className="text-sm text-muted-foreground">
          Arreglos, calle, letras, setlists, bolos y contadores en un archivo.
        </p>
        <Button type="button" className="w-full" onClick={onDownload} disabled={busy}>
          <Download className="mr-2 h-4 w-4" /> Descargar copia
        </Button>
      </div>
      <div className="comic space-y-3 rounded-2xl bg-card p-4">
        <h3 className="font-bold">Cargar copia</h3>
        <p className="text-sm text-muted-foreground">
          Sustituye todo lo actual por el contenido de la copia. Antes se descarga una copia de lo
          que hay ahora.
        </p>
        {!pw.isLoading && !pw.data ? (
          <p className="text-sm font-semibold text-destructive">
            Primero crea la contraseña maestra en tu perfil.
          </p>
        ) : (
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <Upload className="mr-2 h-4 w-4" /> Elegir archivo
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </div>

      <Dialog open={!!pending} onOpenChange={(v) => !v && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restaurar copia</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Copia del{" "}
              {pending ? new Date(pending.creado).toLocaleString("es-ES") : ""}
            </p>
            <ul className="grid grid-cols-2 gap-1 text-sm">
              {summary.map(([k, n]) => (
                <li key={k}>
                  <b>{n}</b> {k}
                </li>
              ))}
            </ul>
            <p className="rounded-lg bg-destructive/10 p-3 text-sm font-semibold text-destructive">
              Se borrará todo lo actual y se sustituirá por esta copia.
            </p>
            <Input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="Contraseña maestra"
              autoComplete="off"
            />
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              onClick={restore}
              disabled={busy || !pass}
            >
              {busy ? "Restaurando…" : "Sustituir todo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
