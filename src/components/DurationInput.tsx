import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number;
  onValueChange: (value: number) => void;
  mode?: "mmss" | "hmm";
};

export function digitsToValue(digits: string): number {
  const d = digits.replace(/\D/g, "").slice(-4);
  if (!d) return 0;
  const hi = d.length > 2 ? parseInt(d.slice(0, -2), 10) || 0 : 0;
  const lo = parseInt(d.slice(-2), 10) || 0;
  return hi * 60 + lo;
}

export function valueToDigits(value: number): string {
  const v = Math.max(0, Math.floor(value));
  if (!v) return "";
  const hi = Math.floor(v / 60);
  const lo = v % 60;
  return hi > 0 ? `${hi}${String(lo).padStart(2, "0")}` : String(lo);
}

function display(digits: string): string {
  if (!digits) return "";
  const d = digits.padStart(3, "0");
  return `${parseInt(d.slice(0, -2), 10)}:${d.slice(-2)}`;
}

export function DurationInput({ value, onValueChange, mode = "mmss", onBlur, ...rest }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [digits, setDigits] = useState(() => valueToDigits(value));

  useEffect(() => {
    if (digitsToValue(digits) !== value) setDigits(valueToDigits(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const toEnd = () => {
    const el = ref.current;
    if (!el) return;
    requestAnimationFrame(() => {
      const n = el.value.length;
      el.setSelectionRange(n, n);
    });
  };

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={rest.placeholder ?? (mode === "hmm" ? "0:00 h" : "0:00")}
      value={display(digits)}
      onFocus={toEnd}
      onClick={toEnd}
      onSelect={toEnd}
      onKeyDown={(e) => {
        if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault();
          const next = digits.slice(0, -1);
          setDigits(next);
          onValueChange(digitsToValue(next));
        }
      }}
      onChange={(e) => {
        const typed = e.target.value.replace(/\D/g, "");
        const shown = digits.padStart(3, "0");
        let next: string;
        if (typed.length < shown.length) next = digits.slice(0, -1);
        else {
          const added = typed.startsWith(shown) ? typed.slice(shown.length) : typed.slice(-1);
          next = (digits + added).replace(/^0+/, "").slice(0, 4);
        }
        setDigits(next);
        onValueChange(digitsToValue(next));
        toEnd();
      }}
      onBlur={(e) => {
        setDigits(valueToDigits(digitsToValue(digits)));
        onBlur?.(e);
      }}
    />
  );
}
