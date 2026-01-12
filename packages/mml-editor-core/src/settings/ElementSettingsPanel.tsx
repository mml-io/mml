import React, { useEffect, useMemo, useRef, useState } from "react";

import type { ElementPropertyData, SelectedElementData, SnappingConfig } from "../shared/types";

const transformOrder = ["x", "y", "z", "rx", "ry", "rz", "sx", "sy", "sz"];

let colorProbeEl: HTMLDivElement | null = null;

function cssColorStringToHex(color: string): string | null {
  if (typeof document === "undefined") return null;
  const trimmed = color.trim();
  if (!trimmed) return null;

  if (!colorProbeEl) {
    colorProbeEl = document.createElement("div");
    colorProbeEl.style.position = "absolute";
    colorProbeEl.style.left = "-9999px";
    colorProbeEl.style.top = "-9999px";
    colorProbeEl.style.width = "0";
    colorProbeEl.style.height = "0";
    colorProbeEl.style.display = "none";
    document.body?.appendChild(colorProbeEl);
  }

  if (!colorProbeEl) return null;

  colorProbeEl.style.color = "";
  colorProbeEl.style.color = trimmed;
  if (!colorProbeEl.style.color) return null;

  const computed = getComputedStyle(colorProbeEl).color;
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(computed);
  if (!match) return null;

  const r = Math.max(0, Math.min(255, Number(match[1])));
  const g = Math.max(0, Math.min(255, Number(match[2])));
  const b = Math.max(0, Math.min(255, Number(match[3])));
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function toHtmlColorInputValue(value: string | null | undefined): string | null {
  if (value == null) return null;
  const v = value.trim();
  if (!v) return null;

  const hex6 = /^#?([0-9a-f]{6})$/i.exec(v);
  if (hex6) return `#${hex6[1].toLowerCase()}`;

  const hex3 = /^#?([0-9a-f]{3})$/i.exec(v);
  if (hex3) {
    const h = hex3[1].toLowerCase();
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }

  return cssColorStringToHex(v);
}

function getSnapForProp(propName: string, snappingConfig: SnappingConfig): number | undefined {
  if (["x", "y", "z"].includes(propName)) return snappingConfig.translation;
  if (["rx", "ry", "rz"].includes(propName)) return snappingConfig.rotation;
  if (["sx", "sy", "sz"].includes(propName)) return snappingConfig.scale;
  return undefined;
}

function getDecimalPlaces(step: number): number {
  const str = step.toString();
  const decimal = str.split(".")[1];
  return decimal ? Math.min(decimal.length, 6) : 0;
}

function MixedBadge() {
  return (
    <span className="ml-1.5 text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
      mixed
    </span>
  );
}

function DraggableNumberInput({
  propName,
  step,
  value,
  placeholder,
  mixed,
  snappingEnabled,
  snappingConfig,
  onUpdate,
  onCommit,
}: {
  propName: string;
  step: number;
  value: string;
  placeholder: string;
  mixed?: boolean;
  snappingEnabled: boolean;
  snappingConfig: SnappingConfig;
  onUpdate: (newValue: string | undefined) => void;
  onCommit?: (newValue: string | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [textValue, setTextValue] = useState(value);
  const dragRef = useRef<{ startX: number; startValue: number; lastValue: string } | null>(null);

  // Keep the input text in sync with incoming prop changes (e.g. gizmo transforms),
  // but don't clobber the value while the user is actively interacting with the input.
  useEffect(() => {
    if (dragging) return;
    if (typeof document !== "undefined" && document.activeElement === inputRef.current) return;
    setTextValue(value);
  }, [value, dragging]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { startX, startValue } = dragRef.current;
      const delta = e.clientX - startX;
      const multiplier = e.shiftKey ? 0.1 : e.altKey ? 0.01 : 1;
      let next = startValue + delta * step * multiplier;

      if (snappingEnabled) {
        const snap = getSnapForProp(propName, snappingConfig);
        if (snap && snap > 0) {
          next = Math.round(next / snap) * snap;
        }
      }

      const fixed = next.toFixed(getDecimalPlaces(step));
      setTextValue(fixed);
      dragRef.current.lastValue = fixed;
      onUpdate(fixed);
    };

    const onUp = () => {
      if (dragRef.current) {
        const finalValue = dragRef.current.lastValue;
        dragRef.current = null;
        setDragging(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        if (onCommit) {
          onCommit(finalValue);
        }
      }
    };

    if (dragging) {
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      return () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
    }
    return;
  }, [dragging, onUpdate, onCommit, propName, snappingConfig, snappingEnabled, step]);

  return (
    <input
      ref={inputRef}
      type="number"
      step={step}
      value={textValue}
      placeholder={mixed ? "Multiple values" : placeholder}
      onMouseDown={(e) => {
        if (document.activeElement === inputRef.current) return;
        const parsed = Number(textValue);
        const startValue = Number.isFinite(parsed) ? parsed : Number(placeholder || "0") || 0;
        const startValueStr = startValue.toFixed(getDecimalPlaces(step));
        dragRef.current = { startX: e.clientX, startValue, lastValue: startValueStr };
        setDragging(true);
        e.preventDefault();
      }}
      onChange={(e) => {
        const v = e.target.value;
        setTextValue(v);
        onUpdate(v === "" ? undefined : v);
        if (onCommit) {
          onCommit(v === "" ? undefined : v);
        }
      }}
      className="w-full min-w-0 h-[22px] rounded border border-[var(--color-border)] bg-[var(--color-panel)] px-1.5 text-[11px] text-[var(--color-text)] cursor-ew-resize focus:outline-none focus:border-[var(--color-accent)] focus:cursor-text"
    />
  );
}

function groupTransformProps(props: ElementPropertyData[]) {
  const position = props.filter((p) => ["x", "y", "z"].includes(p.name));
  const rotation = props.filter((p) => ["rx", "ry", "rz"].includes(p.name));
  const scale = props.filter((p) => ["sx", "sy", "sz"].includes(p.name));
  return { position, rotation, scale };
}

export function ElementSettingsPanel({
  selectedElements,
  properties,
  snappingEnabled,
  snappingConfig,
  onUpdateProperty,
  onCommitProperty,
  emptyLabel = "Select an element to view its settings.",
}: {
  selectedElements: SelectedElementData[];
  properties: ElementPropertyData[];
  snappingEnabled: boolean;
  snappingConfig: SnappingConfig;
  onUpdateProperty: (propName: string, value: string | undefined) => void;
  onCommitProperty?: (propName: string, value: string | undefined) => void;
  emptyLabel?: string;
}) {
  const selectionSummary = useMemo(() => {
    if (!selectedElements || selectedElements.length === 0) return "";
    const tags = Array.from(new Set(selectedElements.map((e) => e.tagName))).join(", ");
    return `${selectedElements.length} selected (${tags})`;
  }, [selectedElements]);

  const transformProps = useMemo(
    () => properties.filter((p) => transformOrder.includes(p.name)),
    [properties],
  );
  const otherProps = useMemo(
    () => properties.filter((p) => !transformOrder.includes(p.name)),
    [properties],
  );
  const groups = useMemo(() => groupTransformProps(transformProps), [transformProps]);

  if (!selectedElements || selectedElements.length === 0) {
    return <div className="p-3 text-[var(--color-text-muted)] italic">{emptyLabel}</div>;
  }

  if (!properties || properties.length === 0) {
    return <div className="p-3 text-[var(--color-text-muted)] italic">No shared properties</div>;
  }

  const renderTransformGroup = (title: string, props: ElementPropertyData[]) => {
    if (props.length === 0) return null;
    return (
      <div className="mb-2.5">
        <div className="mb-1.5 flex items-center gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {title}
          </div>
          <div className="flex-1 h-px bg-[var(--color-border)]/60" />
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(70px,1fr))] gap-1.5 mb-1.5">
          {props.map((prop) => (
            <div key={prop.name} className="flex flex-col gap-0.5 min-w-0">
              <div className="text-[9px] uppercase text-[var(--color-text-muted)]">
                {prop.name.toUpperCase()}
                {prop.mixed && <MixedBadge />}
              </div>
              <DraggableNumberInput
                propName={prop.name}
                step={prop.step ?? 0.1}
                value={prop.mixed ? "" : prop.value}
                placeholder={prop.defaultValue ?? "0"}
                mixed={prop.mixed}
                snappingEnabled={snappingEnabled}
                snappingConfig={snappingConfig}
                onUpdate={(v) => onUpdateProperty(prop.name, v)}
                onCommit={onCommitProperty ? (v) => onCommitProperty(prop.name, v) : undefined}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderProperty = (prop: ElementPropertyData) => {
    const label = (
      <div className="text-[11px] font-medium text-[var(--color-text)]">
        {prop.label}
        {prop.mixed && <MixedBadge />}
      </div>
    );

    if (prop.type === "boolean") {
      const ref = (el: HTMLInputElement | null) => {
        if (el) el.indeterminate = Boolean(prop.mixed);
      };
      return (
        <div key={prop.name} className="flex items-center justify-between py-1">
          {label}
          <input
            ref={ref}
            type="checkbox"
            checked={!prop.mixed && prop.value === "true"}
            onChange={(e) => onUpdateProperty(prop.name, e.target.checked ? "true" : "false")}
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
        </div>
      );
    }

    if (prop.type === "color") {
      const value = prop.mixed ? "" : prop.value;
      const placeholder = prop.defaultValue ?? "";
      const pickerValue = toHtmlColorInputValue(value || placeholder) ?? "#ffffff";

      return (
        <div key={prop.name} className="flex flex-col gap-1 mb-2 min-w-0">
          {label}
          <div className="flex gap-1.5 items-center min-w-0">
            <input
              type="color"
              value={pickerValue}
              onChange={(e) => onUpdateProperty(prop.name, e.target.value)}
              className="w-9 min-w-9 h-7 rounded border border-[var(--color-border)] bg-[var(--color-panel)] p-0 focus:outline-none focus:border-[var(--color-accent)]"
            />
            <input
              type="text"
              value={value}
              placeholder={prop.mixed ? "Multiple values" : placeholder}
              onChange={(e) => onUpdateProperty(prop.name, e.target.value || undefined)}
              className="w-full min-w-0 h-7 rounded border border-[var(--color-border)] bg-[var(--color-panel)] px-2 text-[11px] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
        </div>
      );
    }

    if (prop.type === "select" && prop.options) {
      return (
        <div key={prop.name} className="flex flex-col gap-1 mb-2 min-w-0">
          {label}
          <select
            value={prop.mixed ? "" : prop.value}
            onChange={(e) => onUpdateProperty(prop.name, e.target.value || undefined)}
            className="w-full min-w-0 h-7 rounded border border-[var(--color-border)] bg-[var(--color-panel)] px-2 text-[11px] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
          >
            {prop.mixed && <option value="">Multiple values</option>}
            {prop.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    const inputType = prop.type === "color" ? "color" : prop.type === "number" ? "number" : "text";
    const value = prop.mixed ? "" : prop.value;
    const placeholder = prop.defaultValue ?? "";

    return (
      <div key={prop.name} className="flex flex-col gap-1 mb-2 min-w-0">
        {label}
        <input
          type={inputType}
          step={prop.step}
          min={prop.min}
          max={prop.max}
          value={value}
          placeholder={prop.mixed ? "Multiple values" : placeholder}
          onChange={(e) => onUpdateProperty(prop.name, e.target.value || undefined)}
          className="w-full min-w-0 h-7 rounded border border-[var(--color-border)] bg-[var(--color-panel)] px-2 text-[11px] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
        />
      </div>
    );
  };

  return (
    <div className="p-2 text-[var(--color-text)]">
      <div className="p-1.5 rounded mb-2 text-[11px] text-[var(--color-text-muted)] bg-[var(--color-border)]/15">
        {selectionSummary}
      </div>

      {renderTransformGroup("Position", groups.position)}
      {renderTransformGroup("Rotation", groups.rotation)}
      {renderTransformGroup("Scale", groups.scale)}

      {otherProps.map(renderProperty)}
    </div>
  );
}
