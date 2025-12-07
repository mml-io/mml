import React, { useEffect, useMemo, useRef, useState } from "react";

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

const PropertyRow: React.FC<{
  prop: ElementPropertyDefinition;
  sharedValue: SharedValue;
  onChange: (newValue: string | boolean) => void;
}> = ({ prop, sharedValue, onChange }) => {
  const checkboxRef = useRef<HTMLInputElement>(null);

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
      />
    </div>
  );
};

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

const DraggableNumberInput: React.FC<{
  prop: ElementPropertyDefinition;
  sharedValue: SharedValue;
  onChange: (newValue: string) => void;
}> = ({ prop, sharedValue, onChange }) => {
  const startXRef = useRef(0);
  const startValueRef = useRef(0);
  const draggingRef = useRef(false);

  const currentValue = sharedValue.mixed ? "" : sharedValue.value;
  const displayValue = currentValue === "" ? getDefaultValueForProperty(prop) : currentValue;

  const step = prop.step ?? 0.1;

  const handleMouseMove = (event: MouseEvent) => {
    if (!draggingRef.current) {
      return;
    }
    const deltaX = event.clientX - startXRef.current;
    const multiplier = event.shiftKey ? step * 0.1 : event.altKey ? step * 0.01 : step;
    const nextValue = clamp(startValueRef.current + deltaX * multiplier, prop.min, prop.max);
    onChange(nextValue.toString());
  };

  const handleMouseUp = () => {
    if (!draggingRef.current) {
      return;
    }
    draggingRef.current = false;
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  };

  const handleMouseDown: React.MouseEventHandler<HTMLInputElement> = (event) => {
    const parsed = Number(displayValue);
    startValueRef.current = Number.isFinite(parsed) ? parsed : 0;
    startXRef.current = event.clientX;
    draggingRef.current = true;
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    event.preventDefault();
  };

  useEffect(
    () => () => {
      if (draggingRef.current) {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        draggingRef.current = false;
      }
    },
    [handleMouseMove, handleMouseUp],
  );

  return (
    <input
      type="number"
      step={prop.step}
      min={prop.min}
      max={prop.max}
      className="w-full bg-[var(--color-panel)] border border-[var(--color-border)] rounded px-2 py-1 text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
      value={currentValue}
      placeholder={sharedValue.mixed ? "Multiple" : prop.placeholder}
      onChange={(e) => onChange(e.target.value)}
      onMouseDown={handleMouseDown}
    />
  );
};

const TransformGroupRow: React.FC<{
  title: string;
  props: ElementPropertyDefinition[];
  sharedValues: Record<string, SharedValue>;
  onChange: (prop: ElementPropertyDefinition, value: string) => void;
}> = ({ title, props, sharedValues, onChange }) => {
  if (props.length === 0) {
    return null;
  }

  return (
    <div className="py-2">
      <div className="text-[11px] font-semibold text-[var(--color-text-muted)] mb-1 uppercase tracking-wide">
        {title}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {props.map((prop) => (
          <div key={prop.name} className="flex flex-col gap-1">
            <div className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase">{prop.name}</div>
            <DraggableNumberInput
              prop={prop}
              sharedValue={sharedValues[prop.name] ?? { value: "", mixed: false }}
              onChange={(value) => onChange(prop, value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

type ElementSettingsPanelProps = {
  className?: string;
};

export const ElementSettingsPanel: React.FC<ElementSettingsPanelProps> = ({ className }) => {
  const { pathSelection, remoteHolderElement, code, setCode } = useEditorStore();
  const [selectionAttrVersion, setSelectionAttrVersion] = useState(0);

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

  const handleChange = (prop: ElementPropertyDefinition, rawValue: string | boolean) => {
    if (!code || selectedElements.length === 0) {
      return;
    }

    let serialized: AttributeValue = rawValue as AttributeValue;
    if (prop.type === "boolean") {
      serialized = rawValue ? "true" : "false";
    } else if (typeof rawValue === "string") {
      if (prop.type === "number") {
        serialized = rawValue.trim() === "" ? undefined : Number(rawValue).toString();
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

  const handleTransformChange = (prop: ElementPropertyDefinition, rawValue: string) => {
    handleChange(prop, rawValue);
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
              return (
                <TransformGroupRow
                  key={group.title}
                  title={group.title}
                  props={propsInGroup}
                  sharedValues={sharedValues}
                  onChange={handleTransformChange}
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
};

export default ElementSettingsPanel;

