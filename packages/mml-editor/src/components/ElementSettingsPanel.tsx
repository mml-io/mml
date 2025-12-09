import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ElementPropertyDefinition,
  getDefaultValueForProperty,
  getSharedElementPropertyDefinitions,
} from "../lib/elementProperties";
import { AttributeValue, resolvePathsToElements, updateElementsAttributesInCode } from "../lib/domUtils";
import { useEditorStore } from "../state/editorStore";

type SharedValue = {
  value: string;
  mixed: boolean;
};

const transformOrder = ["x", "y", "z", "rx", "ry", "rz", "sx", "sy", "sz"];
const transformGroups = [
  { title: "Position", keys: ["x", "y", "z"] },
  { title: "Rotation", keys: ["rx", "ry", "rz"] },
  { title: "Scale", keys: ["sx", "sy", "sz"] },
];
const scaleKeys = ["sx", "sy", "sz"] as const;
type ScaleKey = (typeof scaleKeys)[number];
type ScaleAttributes = Record<ScaleKey, string | null>;
const scalePropNames = new Set<ScaleKey>(scaleKeys);

const isScalePropName = (name: string): name is ScaleKey => scalePropNames.has(name as ScaleKey);

type BasicMouseEvent = {
  button: number;
  clientX: number;
  clientY: number;
};

const useClickSelectAll = <T extends HTMLInputElement | HTMLTextAreaElement>(
  ref: React.RefObject<T>,
  dragTolerance = 3,
) => {
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const recordMouseDown = (event: BasicMouseEvent) => {
    if (event.button !== 0) {
      return;
    }
    startRef.current = { x: event.clientX, y: event.clientY };
  };

  const selectAllIfNoDrag = (event: BasicMouseEvent) => {
    if (event.button !== 0) {
      startRef.current = null;
      return;
    }
    const start = startRef.current;
    startRef.current = null;
    if (!start || !ref.current) {
      return;
    }
    const moved =
      Math.abs(event.clientX - start.x) > dragTolerance || Math.abs(event.clientY - start.y) > dragTolerance;
    if (moved) {
      return;
    }
    const input = ref.current;
    if (document.activeElement !== input) {
      input.focus({ preventScroll: true });
    }
    input.select();
  };

  const onMouseDown: React.MouseEventHandler<T> = (event) => recordMouseDown(event);
  const onMouseUp: React.MouseEventHandler<T> = (event) => selectAllIfNoDrag(event);

  return { onMouseDown, onMouseUp, recordMouseDown, selectAllIfNoDrag };
};

function getElementValue(element: HTMLElement, prop: ElementPropertyDefinition): string {
  const attrValue = element.getAttribute(prop.name);
  if (attrValue !== null) {
    return attrValue;
  }

  // Provide sensible defaults for transformable attributes that may be omitted from markup
  if (prop.name === "visible") {
    return "true";
  }

  return getDefaultValueForProperty(prop);
}

function MixedBadge() {
  return <span className="ml-2 text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">mixed</span>;
}

function PropertyRow({
  prop,
  sharedValue,
  onChange,
}: {
  prop: ElementPropertyDefinition;
  sharedValue: SharedValue;
  onChange: (newValue: string | boolean) => void;
}) {
  const checkboxRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const clickSelectHandlers = useClickSelectAll(inputRef);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = sharedValue.mixed;
    }
  }, [sharedValue.mixed]);

  const label = (
    <label className="text-xs font-semibold text-[var(--color-text)] flex items-center gap-1">
      {prop.label}
      {sharedValue.mixed && <MixedBadge />}
    </label>
  );

  if (prop.type === "boolean") {
    return (
      <div className="flex items-center justify-between py-2">
        {label}
        <input
          ref={checkboxRef}
          type="checkbox"
          className="w-4 h-4 accent-[var(--color-accent)]"
          checked={sharedValue.value === "true"}
          onChange={(e) => onChange(e.target.checked)}
        />
      </div>
    );
  }

  if (prop.type === "select") {
    return (
      <div className="flex flex-col gap-1 py-2">
        {label}
        <select
          className="w-full bg-[var(--color-panel)] border border-[var(--color-border)] rounded px-2 py-1 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
          value={sharedValue.mixed ? "" : sharedValue.value}
          onChange={(e) => onChange(e.target.value)}
        >
          {sharedValue.mixed && <option value="">Multiple values</option>}
          {prop.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const inputType = prop.type === "color" ? "color" : prop.type === "number" ? "number" : "text";
  const resolvedValue = sharedValue.mixed ? "" : sharedValue.value;
  const inputValue =
    prop.type === "color" && resolvedValue === "" ? getDefaultValueForProperty(prop) || "#ffffff" : resolvedValue;

  return (
    <div className="flex flex-col gap-1 py-2">
      {label}
      <input
        type={inputType}
        step={prop.step}
        min={prop.min}
        max={prop.max}
        className="w-full bg-[var(--color-panel)] border border-[var(--color-border)] rounded px-2 py-1 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
        value={inputValue}
        placeholder={sharedValue.mixed ? "Multiple values" : prop.placeholder}
        onChange={(e) => onChange(e.target.value)}
        ref={inputRef}
        onMouseDown={clickSelectHandlers.onMouseDown}
        onMouseUp={clickSelectHandlers.onMouseUp}
      />
    </div>
  );
}

const clamp = (value: number, min?: number, max?: number) => {
  let result = value;
  if (min !== undefined) {
    result = Math.max(min, result);
  }
  if (max !== undefined) {
    result = Math.min(max, result);
  }
  return result;
};

const getStepPrecision = (step?: number) => {
  if (!Number.isFinite(step)) {
    return 6;
  }
  const asString = step!.toString();
  const decimal = asString.split(".")[1];
  return Math.min(10, Math.max(0, decimal ? decimal.length : 0));
};

const roundToPrecision = (value: number, precision: number) => {
  return Number(value.toFixed(precision));
};

function DraggableNumberInput({
  prop,
  sharedValue,
  onStart,
  onPreview,
  onCommit,
  onCancel,
  snappingEnabled,
  snapIncrement,
}: {
  prop: ElementPropertyDefinition;
  sharedValue: SharedValue;
  onStart: (initialValue: string) => void;
  onPreview: (newValue: string) => void;
  onCommit: (newValue: string) => void;
  onCancel: (initialValue: string) => void;
  snappingEnabled: boolean;
  snapIncrement?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const startXRef = useRef(0);
  const startValueRef = useRef(0);
  const startSerializedRef = useRef<string>("");
  const pendingDragRef = useRef(false);
  const draggingRef = useRef(false);
  const previousUserSelectRef = useRef<string | null>(null);
  const [previewValue, setPreviewValue] = useState<string | null>(null);
  const keydownAttachedRef = useRef(false);
  const clickSelectHandlers = useClickSelectAll(inputRef);

  const currentValue = previewValue ?? (sharedValue.mixed ? "" : sharedValue.value);
  const displayValue = currentValue === "" ? getDefaultValueForProperty(prop) : currentValue;

  const step = prop.step ?? 0.1;
  const stepPrecision = getStepPrecision(prop.step ?? 0.1);
  const snapPrecision = snapIncrement ? getStepPrecision(snapIncrement) : 0;
  const roundingPrecision = Math.max(stepPrecision, snapPrecision);
  const dragThreshold = 2;

  const applySnapping = (value: number) => {
    if (!snappingEnabled || snapIncrement === undefined || snapIncrement <= 0) {
      return value;
    }
    const snapped = Math.round(value / snapIncrement) * snapIncrement;
    return roundToPrecision(snapped, roundingPrecision);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!draggingRef.current) {
      return;
    }
    if (event.key === "Escape") {
      setPreviewValue(startSerializedRef.current);
      onCancel(startSerializedRef.current);
      finishDrag();
      event.preventDefault();
    }
  };

  const cleanupKeydown = () => {
    if (keydownAttachedRef.current) {
      window.removeEventListener("keydown", handleKeyDown);
      keydownAttachedRef.current = false;
    }
  };

  const finishDrag = () => {
    pendingDragRef.current = false;
    draggingRef.current = false;
    cleanupKeydown();
    if (previousUserSelectRef.current !== null) {
      document.body.style.userSelect = previousUserSelectRef.current;
      previousUserSelectRef.current = null;
    }
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (!pendingDragRef.current && !draggingRef.current) {
      return;
    }

    const deltaX = event.clientX - startXRef.current;

    if (!draggingRef.current) {
      if (Math.abs(deltaX) < dragThreshold) {
        return;
      }
      draggingRef.current = true;
      startSerializedRef.current = displayValue ?? "";
      onStart(startSerializedRef.current);
      window.addEventListener("keydown", handleKeyDown);
      keydownAttachedRef.current = true;
      inputRef.current?.blur();
      previousUserSelectRef.current = document.body.style.userSelect;
      document.body.style.userSelect = "none";
      window.getSelection()?.removeAllRanges();
    }

    const multiplier = event.shiftKey ? step * 0.1 : event.altKey ? step * 0.01 : step;
    const unclamped = startValueRef.current + deltaX * multiplier;
    const clamped = clamp(unclamped, prop.min, prop.max);
    const snapped = applySnapping(clamped);
    const finalValue = clamp(snapped, prop.min, prop.max);
    const rounded = roundToPrecision(finalValue, roundingPrecision);
    const asString = rounded.toString();
    setPreviewValue(asString);
    onPreview(asString);
    event.preventDefault();
  };

  const handleMouseUp = (event: MouseEvent) => {
    if (pendingDragRef.current && !draggingRef.current) {
      // Click without dragging: manually focus so the caret shows only after mouse up.
      pendingDragRef.current = false;
      clickSelectHandlers.selectAllIfNoDrag(event);
    }

    if (draggingRef.current) {
      // Ensure the final value reflects the total drag distance even if there was no final mousemove.
      const deltaX = event.clientX - startXRef.current;
      const multiplier = event.shiftKey ? step * 0.1 : event.altKey ? step * 0.01 : step;
      const unclamped = startValueRef.current + deltaX * multiplier;
      const clamped = clamp(unclamped, prop.min, prop.max);
      const snapped = applySnapping(clamped);
      const finalValue = clamp(snapped, prop.min, prop.max);
      const rounded = roundToPrecision(finalValue, roundingPrecision);
      const asString = rounded.toString();
      setPreviewValue(null);
      onCommit(asString);
    }

    pendingDragRef.current = false;
    draggingRef.current = false;
    finishDrag();
  };

  const handleMouseDown: React.MouseEventHandler<HTMLInputElement> = (event) => {
    clickSelectHandlers.recordMouseDown(event);
    const parsed = Number(displayValue);
    startValueRef.current = Number.isFinite(parsed) ? parsed : 0;
    startXRef.current = event.clientX;
    pendingDragRef.current = true;
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    // Prevent immediate focus so caret does not appear while determining drag.
    event.preventDefault();
  };

  // Cleanup listeners if the component unmounts mid-drag.
  useEffect(() => {
    return () => {
      if (pendingDragRef.current || draggingRef.current) {
        finishDrag();
      }
    };
    // Intentionally empty dependency array so cleanup only runs on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <input
      ref={inputRef}
      type="number"
      step={prop.step}
      min={prop.min}
      max={prop.max}
      className="w-full bg-[var(--color-panel)] border border-[var(--color-border)] rounded px-2 py-1 text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] cursor-ew-resize focus:cursor-text"
      value={currentValue}
      placeholder={sharedValue.mixed ? "Multiple" : prop.placeholder}
      onChange={(e) => onCommit(e.target.value)}
      onMouseDown={handleMouseDown}
    />
  );
}

function TransformGroupRow({
  title,
  props,
  sharedValues,
  onStart,
  onPreview,
  onCommit,
  onCancel,
  snappingEnabled,
  getSnapIncrement,
  headerAddon,
}: {
  title: string;
  props: ElementPropertyDefinition[];
  sharedValues: Record<string, SharedValue>;
  onStart: (prop: ElementPropertyDefinition, value: string) => void;
  onPreview: (prop: ElementPropertyDefinition, value: string) => void;
  onCommit: (prop: ElementPropertyDefinition, value: string) => void;
  onCancel: (prop: ElementPropertyDefinition, value: string) => void;
  snappingEnabled: boolean;
  getSnapIncrement: (propName: string) => number | undefined;
  headerAddon?: React.ReactNode;
}) {
  if (props.length === 0) {
    return null;
  }

  return (
    <div className="py-2">
      <div className="text-[11px] font-semibold text-[var(--color-text-muted)] mb-1 uppercase tracking-wide flex items-center justify-between gap-2">
        <span>{title}</span>
        {headerAddon}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {props.map((prop) => (
          <div key={prop.name} className="flex flex-col gap-1">
            <div className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase">{prop.name}</div>
            <DraggableNumberInput
              prop={prop}
              sharedValue={sharedValues[prop.name] ?? { value: "", mixed: false }}
              onStart={(value) => onStart(prop, value)}
              onPreview={(value) => onPreview(prop, value)}
              onCommit={(value) => onCommit(prop, value)}
              onCancel={(value) => onCancel(prop, value)}
              snappingEnabled={snappingEnabled}
              snapIncrement={getSnapIncrement(prop.name)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

type ElementSettingsPanelProps = {
  className?: string;
};

export function ElementSettingsPanel({ className }: ElementSettingsPanelProps) {
  const { pathSelection, remoteHolderElement, code, setCode, snappingEnabled, snappingConfig } = useEditorStore();
  const [selectionAttrVersion, setSelectionAttrVersion] = useState(0);
  const [scaleLocked, setScaleLocked] = useState(false);
  const scaleLockStartValuesRef = useRef<Map<HTMLElement, ScaleAttributes> | null>(null);

  const selectedElements = useMemo(
    () => resolvePathsToElements(remoteHolderElement, pathSelection.selectedPaths),
    [remoteHolderElement, pathSelection.selectedPaths],
  );

  // Watch attribute changes on selected elements so the panel reflects live edits (e.g., color picker).
  useEffect(() => {
    if (selectedElements.length === 0) {
      return;
    }

    const observers = selectedElements.map((el) => {
      const observer = new MutationObserver(() => {
        setSelectionAttrVersion((v) => v + 1);
      });
      observer.observe(el, { attributes: true });
      return observer;
    });

    return () => {
      observers.forEach((o) => o.disconnect());
    };
  }, [selectedElements]);

  const sharedProperties = useMemo(
    () => getSharedElementPropertyDefinitions(selectedElements),
    [selectedElements, selectionAttrVersion],
  );

  const transformProps = useMemo(
    () => sharedProperties.filter((prop) => transformOrder.includes(prop.name)),
    [sharedProperties],
  );

  const otherProps = useMemo(
    () => sharedProperties.filter((prop) => !transformOrder.includes(prop.name)),
    [sharedProperties],
  );

  const sharedValues = useMemo(() => {
    const values: Record<string, SharedValue> = {};
    sharedProperties.forEach((prop) => {
      const allValues = selectedElements.map((el) => getElementValue(el, prop));
      const first = allValues[0] ?? "";
      const mixed = allValues.some((val) => val !== first);
      values[prop.name] = {
        value: mixed ? "" : first,
        mixed,
      };
    });
    return values;
  }, [selectedElements, sharedProperties]);

  const normalizeSnapValue = (value: number | null | undefined) => {
    return typeof value === "number" ? value : undefined;
  };

  const getSnapIncrement = useCallback(
    (propName: string) => {
      if (!snappingEnabled) {
        return undefined;
      }
      if (["x", "y", "z"].includes(propName)) {
        return normalizeSnapValue(snappingConfig.translation);
      }
      if (["rx", "ry", "rz"].includes(propName)) {
        return normalizeSnapValue(snappingConfig.rotation);
      }
      if (isScalePropName(propName)) {
        return normalizeSnapValue(snappingConfig.scale);
      }
      return undefined;
    },
    [snappingConfig, snappingEnabled],
  );

  const handleChange = (prop: ElementPropertyDefinition, rawValue: string | boolean) => {
    if (!code || selectedElements.length === 0) {
      return;
    }

    let serialized: AttributeValue = rawValue as AttributeValue;
    if (prop.type === "boolean") {
      serialized = rawValue ? "true" : "false";
    } else if (typeof rawValue === "string") {
      if (prop.type === "number") {
        if (rawValue.trim() === "") {
          serialized = undefined;
        } else {
          const precision = prop.step !== undefined ? getStepPrecision(prop.step) : 6;
          const rounded = roundToPrecision(Number(rawValue), precision);
          serialized = rounded.toString();
        }
      } else {
        serialized = rawValue.trim() === "" ? undefined : rawValue;
      }
    }

    // Apply to live elements immediately for instant feedback (and to trigger observer updates)
    selectedElements.forEach((el) => {
      if (serialized === undefined || serialized === null) {
        el.removeAttribute(prop.name);
      } else {
        el.setAttribute(prop.name, serialized as string);
      }
    });

    const updated = updateElementsAttributesInCode(code, selectedElements, {
      [prop.name]: serialized,
    });

    if (updated) {
      setCode(updated);
    }
  };

  const applyLockedScaleChange = (rawValue: string) => {
    scaleKeys.forEach((key) => {
      const scaleProp = transformProps.find((p) => p.name === key);
      if (scaleProp) {
        handleChange(scaleProp, rawValue);
      }
    });
    scaleLockStartValuesRef.current = null;
  };

  const handleTransformChange = (prop: ElementPropertyDefinition, rawValue: string) => {
    if (scaleLocked && isScalePropName(prop.name)) {
      applyLockedScaleChange(rawValue);
      return;
    }
    handleChange(prop, rawValue);
  };

  const handleTransformStart = (prop: ElementPropertyDefinition, _startValue: string) => {
    if (scaleLocked && isScalePropName(prop.name) && selectedElements.length > 0) {
      const initial = new Map<HTMLElement, ScaleAttributes>();
      selectedElements.forEach((el) => {
        initial.set(el, {
          sx: el.getAttribute("sx"),
          sy: el.getAttribute("sy"),
          sz: el.getAttribute("sz"),
        });
      });
      scaleLockStartValuesRef.current = initial;
      return;
    }
    scaleLockStartValuesRef.current = null;
  };

  const handleTransformPreview = (prop: ElementPropertyDefinition, rawValue: string) => {
    if (selectedElements.length === 0) {
      return;
    }

    if (scaleLocked && isScalePropName(prop.name)) {
      const trimmed = rawValue.trim();
      const serialized = trimmed === "" ? undefined : trimmed;

      selectedElements.forEach((el) => {
        scaleKeys.forEach((key) => {
          if (serialized === undefined) {
            el.removeAttribute(key);
          } else {
            el.setAttribute(key, serialized);
          }
        });
      });
      return;
    }

    const trimmed = rawValue.trim();
    const serialized = trimmed === "" ? undefined : trimmed;

    selectedElements.forEach((el) => {
      if (serialized === undefined) {
        el.removeAttribute(prop.name);
      } else {
        el.setAttribute(prop.name, serialized);
      }
    });
  };

  const handleTransformCancel = (prop: ElementPropertyDefinition, startValue: string) => {
    if (selectedElements.length === 0) {
      return;
    }
    if (scaleLocked && isScalePropName(prop.name) && scaleLockStartValuesRef.current) {
      scaleLockStartValuesRef.current.forEach((values, el) => {
        scaleKeys.forEach((key) => {
          const startAttr = values[key];
          if (startAttr === null) {
            el.removeAttribute(key);
          } else {
            el.setAttribute(key, startAttr);
          }
        });
      });
      scaleLockStartValuesRef.current = null;
      setSelectionAttrVersion((v) => v + 1);
      return;
    }
    const trimmed = startValue.trim();
    const serialized = trimmed === "" ? undefined : trimmed;
    selectedElements.forEach((el) => {
      if (serialized === undefined) {
        el.removeAttribute(prop.name);
      } else {
        el.setAttribute(prop.name, serialized);
      }
    });
    setSelectionAttrVersion((v) => v + 1);
  };

  const selectionSummary = useMemo(() => {
    if (selectedElements.length === 0) {
      return "Nothing selected";
    }
    const tags = Array.from(
      new Set(selectedElements.map((el) => el.tagName.toLowerCase())),
    ).join(", ");
    return `${selectedElements.length} selected (${tags})`;
  }, [selectedElements]);

  const containerClass =
    className ??
    "w-[320px] max-w-[360px] min-w-[280px] border-l-2 border-[var(--color-border)] bg-[var(--color-panel)] flex flex-col";

  return (
    <div className={containerClass}>
      <div className="h-10 flex items-center px-4 border-b-2 border-[var(--color-border)] text-sm font-bold text-[var(--color-text)] uppercase tracking-widest bg-[var(--color-bg)]">
        Element Settings
      </div>
      <div className="px-4 py-3 border-b border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
        {selectionSummary}
        {selectedElements.length > 1 && (
          <div className="text-[10px] mt-1 text-[var(--color-text-muted)]">
            Showing properties shared by all selected elements.
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-4">
        {selectedElements.length === 0 && (
          <div className="text-sm text-[var(--color-text-muted)] py-6">
            Select one or more elements to view their settings.
          </div>
        )}
        {selectedElements.length > 0 && sharedProperties.length === 0 && (
          <div className="text-sm text-[var(--color-text-muted)] py-6">
            No shared editable properties for the current selection.
          </div>
        )}
        {transformProps.length > 0 && (
          <div className="pb-2">
            {transformGroups.map((group) => {
              const propsInGroup = group.keys
                .map((key) => transformProps.find((p) => p.name === key))
                .filter((p): p is ElementPropertyDefinition => Boolean(p));
              const headerAddon =
                group.title === "Scale"
                  ? (
                      <button
                        type="button"
                        aria-pressed={scaleLocked}
                        onClick={() => setScaleLocked((locked) => !locked)}
                        className={`text-[10px] px-2 py-[3px] rounded border transition-colors ${
                          scaleLocked
                            ? "bg-[var(--color-accent)] text-[var(--color-bg)] border-[var(--color-accent)]"
                            : "bg-[var(--color-panel)] text-[var(--color-text)] border-[var(--color-border)] hover:border-[var(--color-accent)]"
                        }`}
                        title="When enabled, scale axes update together"
                      >
                        {scaleLocked ? "Uniform on" : "Uniform off"}
                      </button>
                    )
                  : undefined;
              return (
                <TransformGroupRow
                  key={group.title}
                  title={group.title}
                  props={propsInGroup}
                  sharedValues={sharedValues}
                  onStart={handleTransformStart}
                  onPreview={handleTransformPreview}
                  onCommit={handleTransformChange}
                  onCancel={handleTransformCancel}
                  snappingEnabled={snappingEnabled}
                  getSnapIncrement={getSnapIncrement}
                  headerAddon={headerAddon}
                />
              );
            })}
          </div>
        )}
        {otherProps.map((prop) => (
          <PropertyRow
            key={prop.name}
            prop={prop}
            sharedValue={sharedValues[prop.name] ?? { value: "", mixed: false }}
            onChange={(value) => handleChange(prop, value)}
          />
        ))}
      </div>
    </div>
  );
}

export default ElementSettingsPanel;

