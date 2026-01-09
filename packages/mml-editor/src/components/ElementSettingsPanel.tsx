import {
  type AttributeValue,
  type ElementPropertyData,
  type ElementPropertyDefinition,
  ElementSettingsPanel as SharedElementSettingsPanel,
  getDefaultValueForProperty,
  getSharedElementPropertyDefinitions,
  resolveMmlPathsToElements,
  updateElementsAttributesInCode,
  useToolbarStore,
} from "@mml-io/mml-editor-core";
import React, { useEffect, useMemo, useState } from "react";

import { useEditorStore } from "../state/editorStore";

type SharedValue = {
  value: string;
  mixed: boolean;
};

const getStepPrecision = (step?: number) => {
  if (step === undefined || !Number.isFinite(step)) {
    return 6;
  }
  const asString = step.toString();
  const decimal = asString.split(".")[1];
  return Math.min(10, Math.max(0, decimal ? decimal.length : 0));
};

const roundToPrecision = (value: number, precision: number) => {
  return Number(value.toFixed(precision));
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

export function ElementSettingsPanel({ className }: { className?: string }) {
  const { pathSelection, remoteHolderElement, code, setCode } = useEditorStore();
  const snappingEnabled = useToolbarStore((s) => s.snappingEnabled);
  const snappingConfig = useToolbarStore((s) => s.snappingConfig);
  const [selectionAttrVersion, setSelectionAttrVersion] = useState(0);

  const selectedElements = useMemo(
    () => resolveMmlPathsToElements(remoteHolderElement, pathSelection.selectedPaths),
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

  const sidebarProperties = useMemo<ElementPropertyData[]>(() => {
    return sharedProperties.map((prop) => ({
      name: prop.name,
      label: prop.label,
      type: prop.type,
      value: sharedValues[prop.name]?.value ?? "",
      mixed: sharedValues[prop.name]?.mixed ?? false,
      step: prop.step,
      min: prop.min,
      max: prop.max,
      defaultValue: prop.defaultValue,
      options: prop.options,
    }));
  }, [sharedProperties, sharedValues]);

  const serializeValue = (
    prop: ElementPropertyDefinition,
    rawValue: string | boolean,
  ): AttributeValue => {
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
    return serialized;
  };

  const handleLiveUpdate = (prop: ElementPropertyDefinition, rawValue: string | boolean) => {
    if (selectedElements.length === 0) {
      return;
    }

    const serialized = serializeValue(prop, rawValue);

    selectedElements.forEach((el) => {
      if (serialized === undefined || serialized === null) {
        el.removeAttribute(prop.name);
      } else {
        el.setAttribute(prop.name, serialized as string);
      }
    });
  };

  const handleCommit = (prop: ElementPropertyDefinition, rawValue: string | boolean) => {
    if (!code || selectedElements.length === 0) {
      return;
    }

    const serialized = serializeValue(prop, rawValue);

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

  const containerClass =
    className ??
    "w-[320px] max-w-[360px] min-w-[280px] border-l-2 border-[var(--color-border)] bg-[var(--color-panel)] flex flex-col";

  // Shared panel UI (also used by VS Code extension sidebars)
  return (
    <div className={containerClass}>
      <div className="h-10 flex items-center px-4 border-b-2 border-[var(--color-border)] text-sm font-bold text-[var(--color-text)] uppercase tracking-widest bg-[var(--color-bg)]">
        Element Settings
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <SharedElementSettingsPanel
          selectedElements={pathSelection.selectedPaths.map((path, index) => ({
            tagName: selectedElements[index]?.tagName.toLowerCase() ?? "m-element",
            id: selectedElements[index]?.id || undefined,
            path,
          }))}
          properties={sidebarProperties}
          snappingEnabled={snappingEnabled}
          snappingConfig={snappingConfig}
          onUpdateProperty={(propName, value) => {
            const def = sharedProperties.find((p) => p.name === propName);
            if (!def) return;
            if (def.type === "boolean") {
              handleLiveUpdate(def, value === "true");
            } else {
              handleLiveUpdate(def, value ?? "");
            }
          }}
          onCommitProperty={(propName, value) => {
            const def = sharedProperties.find((p) => p.name === propName);
            if (!def) return;
            if (def.type === "boolean") {
              handleCommit(def, value === "true");
            } else {
              handleCommit(def, value ?? "");
            }
          }}
          emptyLabel="Select one or more elements to view their settings."
        />
      </div>
    </div>
  );
}

export default ElementSettingsPanel;
