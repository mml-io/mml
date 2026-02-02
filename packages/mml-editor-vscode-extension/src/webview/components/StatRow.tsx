import React from "react";

interface StatRowProps {
  label: string;
  value: string | number;
}

export function StatRow({ label, value }: StatRowProps) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className="text-[var(--color-text)]">{value}</span>
    </div>
  );
}
