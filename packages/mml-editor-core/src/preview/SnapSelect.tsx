import React from "react";

export type SnapSelectProps = {
  label: string;
  value: number | null | undefined;
  options: number[];
  suffix?: string;
  onChange: (value: number | null) => void;
};

export function SnapSelect({ label, value, options, suffix, onChange }: SnapSelectProps) {
  return (
    <label className="flex items-center gap-1 text-[11px] text-[var(--color-text)]">
      <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </span>
      <select
        value={value ?? 0}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          onChange(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
        }}
        className="h-7 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-[11px] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {suffix ? <span className="text-[10px] text-[var(--color-text-muted)]">{suffix}</span> : null}
    </label>
  );
}
