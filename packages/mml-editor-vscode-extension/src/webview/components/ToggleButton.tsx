import React from "react";

interface ToggleButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

export function ToggleButton({ active, onClick, children }: ToggleButtonProps) {
  return (
    <button
      type="button"
      className={[
        "rounded px-2 py-1 text-[10px] font-medium transition-colors",
        active
          ? "bg-[var(--color-accent)] text-white"
          : "bg-[var(--color-panel)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-border)]/40",
      ].join(" ")}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
