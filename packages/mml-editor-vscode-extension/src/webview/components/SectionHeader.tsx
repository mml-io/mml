import React from "react";

interface SectionHeaderProps {
  title: string;
  collapsed?: boolean;
  onToggle?: () => void;
}

export function SectionHeader({ title, collapsed, onToggle }: SectionHeaderProps) {
  return (
    <div
      className={[
        "mb-1.5 flex items-center gap-2",
        onToggle ? "cursor-pointer select-none" : "",
      ].join(" ")}
      onClick={onToggle}
    >
      {onToggle !== undefined && (
        <svg
          viewBox="0 0 16 16"
          width="10"
          height="10"
          className={[
            "text-[var(--color-text-muted)] transition-transform",
            collapsed ? "" : "rotate-90",
          ].join(" ")}
        >
          <path
            d="M6 3l5 5-5 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {title}
      </div>
      <div className="h-px flex-1 bg-[var(--color-border)]/60" />
    </div>
  );
}
