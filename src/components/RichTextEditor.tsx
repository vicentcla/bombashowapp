import { useEffect, useRef } from "react";
import { Bold, Italic, Underline, Minus } from "lucide-react";

type Props = {
  value: string;
  onChange: (html: string) => void;
};

export function RichTextEditor({ value, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value;
    }
    // Solo al montar / cuando cambia la letra editada desde fuera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exec = (command: string) => {
    ref.current?.focus();
    document.execCommand(command, false);
    onChange(ref.current?.innerHTML ?? "");
  };

  return (
    <div className="comic-sm overflow-hidden rounded-md bg-card">
      <div className="flex flex-wrap gap-1 border-b border-border bg-secondary p-1">
        <ToolButton onClick={() => exec("bold")} label="Negrita">
          <Bold className="h-4 w-4" />
        </ToolButton>
        <ToolButton onClick={() => exec("italic")} label="Cursiva">
          <Italic className="h-4 w-4" />
        </ToolButton>
        <ToolButton onClick={() => exec("underline")} label="Subrayado">
          <Underline className="h-4 w-4" />
        </ToolButton>
        <ToolButton onClick={() => exec("insertHorizontalRule")} label="Separador">
          <Minus className="h-4 w-4" />
        </ToolButton>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        className="lyrics-body min-h-48 w-full p-3 text-base leading-relaxed outline-none"
        data-placeholder="Escribe aquí la letra…"
      />
    </div>
  );
}

function ToolButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="comic-sm comic-press rounded bg-card p-1.5 text-foreground"
    >
      {children}
    </button>
  );
}
