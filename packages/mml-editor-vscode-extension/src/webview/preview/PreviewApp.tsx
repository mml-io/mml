import {
  bodyFromRemoteHolderElement,
  buildSceneData,
  ElementSettingsPanel,
  ensureHTMLDocument,
  getElementPropertyDefinitions,
  mmlPathToElement,
  pathsEqual,
  PreviewToolbar,
  SceneOutlinePanel,
  SidebarLayout,
  type SidebarLayoutState,
  stripScriptTags,
  updateElementsAttributesInCode,
  updateElementTransformInCode,
  useMmlClient,
  useSceneObserver,
  useToolbarStore,
} from "@mml-io/mml-editor-core";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getVscodeApi } from "../utils/vscodeApi";

type PersistedState = {
  content?: string;
  uri?: string;
  snappingEnabled?: boolean;
  snappingConfig?: { translation: number; rotation: number; scale: number };
  visualizersVisible?: boolean;
  gizmoMode?: "translate" | "rotate" | "scale";
  sidebarCollapsed?: boolean;
  sidebarWidth?: number;
  scenePanelCollapsed?: boolean;
  settingsPanelCollapsed?: boolean;
  scenePanelRatio?: number;
};

function toPathKey(authored: string): string {
  const trimmed = (authored ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/")) return trimmed;
  if (trimmed.startsWith("./")) return `/${trimmed.slice(2)}`;
  return `/${trimmed}`;
}

function ensureVscodeAssetRewriteInstalled(targetWindow: Window): void {
  const w = targetWindow as any;
  if (w.__mml_vscode_asset_rewrite_installed) return;
  w.__mml_vscode_asset_rewrite_installed = true;
  w.__mml_vscode_asset_map = {} as Record<string, string>;

  const rewriteUrl = (url: string): string => {
    const map = (w.__mml_vscode_asset_map ?? {}) as Record<string, string>;

    // Fast-path for authored relative/absolute-path style URLs.
    if (url.startsWith("/") || url.startsWith("./")) {
      const mapped = map[toPathKey(url)];
      if (mapped) return mapped;
      return url;
    }

    try {
      const u = new URL(url, targetWindow.location.href);
      if (u.hostname !== "mml-preview.local") return url;
      return map[u.pathname] ?? url;
    } catch {
      return url;
    }
  };

  // Patch fetch
  const originalFetch: typeof fetch | undefined = targetWindow.fetch?.bind(targetWindow);
  if (originalFetch) {
    targetWindow.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      try {
        // Most loaders pass a string URL.
        if (typeof input === "string") {
          const rewritten = rewriteUrl(input);
          return originalFetch(rewritten, init);
        }

        // If a Request is passed, rewrite only if it's a simple GET/HEAD request.
        const RequestCtor = (targetWindow as any).Request;
        if (RequestCtor && input instanceof RequestCtor) {
          const req = input as Request;
          const rewritten = rewriteUrl(req.url);
          if (rewritten === req.url) return originalFetch(req, init);
          const newReq = new RequestCtor(rewritten, {
            method: req.method,
            headers: req.headers,
            mode: req.mode,
            credentials: req.credentials,
            cache: req.cache,
            redirect: req.redirect,
            referrer: req.referrer,
            referrerPolicy: req.referrerPolicy,
            integrity: (req as any).integrity,
            keepalive: (req as any).keepalive,
            signal: req.signal,
          });
          return originalFetch(newReq, init);
        }
      } catch {
        // Fall through to original fetch.
      }
      return originalFetch(input as any, init);
    }) as any;
  }

  // Patch XHR (three.js FileLoader may use XHR in some builds)
  const XHRCtor = (targetWindow as any).XMLHttpRequest;
  if (XHRCtor?.prototype?.open) {
    const originalOpen = XHRCtor.prototype.open;
    XHRCtor.prototype.open = function (
      method: string,
      url: string,
      async?: boolean,
      user?: string | null,
      password?: string | null,
    ) {
      const rewritten = rewriteUrl(String(url));
      return originalOpen.call(this, method, rewritten, async, user, password);
    };
  }
}

function applyVscodeAssetMap(
  targetWindow: Window | null,
  contentAddressMap: Record<string, string>,
) {
  if (!targetWindow) return;
  ensureVscodeAssetRewriteInstalled(targetWindow);

  // Normalize to pathname keys so we can rewrite `https://mml-preview.local/assets/x.glb`
  // using `URL.pathname` (`/assets/x.glb`), and also handle direct `/assets/...` URLs.
  const normalized: Record<string, string> = {};
  for (const [authored, resolved] of Object.entries(contentAddressMap ?? {})) {
    const key = toPathKey(authored);
    if (!key) continue;
    normalized[key] = resolved;
  }

  (targetWindow as any).__mml_vscode_asset_map = normalized;
}

function applyVscodeAssetMapEverywhere(
  remoteHolderElement: HTMLElement | null,
  contentAddressMap: Record<string, string>,
): void {
  // Patch outer webview realm (where ThreeJS loader code executes).
  applyVscodeAssetMap(window, contentAddressMap);

  // Patch the engine iframe realm (where MML elements / document address are derived).
  const engineWindow = remoteHolderElement?.ownerDocument?.defaultView ?? null;
  if (engineWindow) {
    applyVscodeAssetMap(engineWindow, contentAddressMap);
  }
}

export function PreviewApp() {
  const vscode = getVscodeApi();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  const [content, setContent] = useState("");
  const [uri, setUri] = useState<string | null>(null);
  const [lastContentSource, setLastContentSource] = useState<"vscode" | "local">("vscode");
  const [contentAddressMap, setContentAddressMap] = useState<Record<string, string>>({});
  const [selectedPaths, setSelectedPaths] = useState<number[][]>([]);
  const [layout, setLayout] = useState({
    sidebarWidth: 260,
    scenePanelCollapsed: false,
    settingsPanelCollapsed: false,
    scenePanelRatio: 0.5,
  });

  const snappingEnabled = useToolbarStore((s) => s.snappingEnabled);
  const snappingConfig = useToolbarStore((s) => s.snappingConfig);
  const gizmoMode = useToolbarStore((s) => s.gizmoMode);
  const visualizersVisible = useToolbarStore((s) => s.visualizersVisible);
  const sidebarVisible = useToolbarStore((s) => s.sidebarVisible);

  // Track if we're programmatically setting selection to avoid loops
  const settingSelectionRef = useRef(false);
  const handleUpdatePropertyRef = useRef<
    ((propName: string, value: string | undefined) => void) | null
  >(null);

  useEffect(() => {
    setContainer(containerRef.current);
  }, []);

  const handleTransformCommit = useCallback(
    (path: number[], values: Record<string, number | undefined>) => {
      if (!content || !mmlClient.remoteHolderElement) return;
      const root = bodyFromRemoteHolderElement(mmlClient.remoteHolderElement);
      const el = mmlPathToElement(root, path);
      if (!el) return;
      const updated = updateElementTransformInCode(content, el, values);
      if (updated) {
        setContent(updated);
        setLastContentSource("local");
      }
    },
    [content],
  );

  const handleSelectionChange = useCallback((paths: number[][]) => {
    // Skip if we're in the middle of programmatically setting selection
    if (settingSelectionRef.current) return;
    setSelectedPaths(paths);
  }, []);

  const mmlClient = useMmlClient({
    container,
    callbacks: {
      onSelectionChange: handleSelectionChange,
      onTransformCommit: handleTransformCommit,
    },
  });

  const sceneRevision = useSceneObserver(mmlClient.remoteHolderElement);

  useEffect(() => {
    const persisted = vscode.getState() as PersistedState | undefined;
    if (!persisted) return;

    if (persisted.content) setContent(persisted.content);
    if (persisted.uri) setUri(persisted.uri);

    useToolbarStore.getState().hydrate({
      snappingEnabled: persisted.snappingEnabled,
      snappingConfig: persisted.snappingConfig,
      visualizersVisible: persisted.visualizersVisible,
      gizmoMode: persisted.gizmoMode,
      sidebarVisible: persisted.sidebarCollapsed === false,
    });

    setLayout((l) => ({
      ...l,
      sidebarWidth: persisted.sidebarWidth ?? l.sidebarWidth,
      scenePanelCollapsed: persisted.scenePanelCollapsed ?? l.scenePanelCollapsed,
      settingsPanelCollapsed: persisted.settingsPanelCollapsed ?? l.settingsPanelCollapsed,
      scenePanelRatio: persisted.scenePanelRatio ?? l.scenePanelRatio,
    }));
  }, []);

  useEffect(() => {
    const t = useToolbarStore.getState();
    vscode.setState({
      content,
      uri: uri ?? undefined,
      snappingEnabled: t.snappingEnabled,
      snappingConfig: t.snappingConfig,
      visualizersVisible: t.visualizersVisible,
      gizmoMode: t.gizmoMode,
      sidebarCollapsed: !t.sidebarVisible,
      ...layout,
    });
  }, [
    content,
    uri,
    snappingEnabled,
    snappingConfig,
    visualizersVisible,
    gizmoMode,
    sidebarVisible,
    layout,
  ]);

  useEffect(() => {
    if (mmlClient.ready) vscode.postMessage({ type: "ready" });
  }, [mmlClient.ready]);

  // VSCode-only asset fix: rewrite fetch/XHR requests inside the engine iframe from
  // `mml-preview.local/...` to the `asWebviewUri(...)` mapping generated by the extension.
  useEffect(() => {
    if (!mmlClient.ready) return;
    applyVscodeAssetMapEverywhere(mmlClient.remoteHolderElement, contentAddressMap);
  }, [mmlClient.ready, mmlClient.remoteHolderElement, contentAddressMap]);

  useEffect(() => {
    if (lastContentSource === "local") {
      vscode.postMessage({ type: "updateContent", content, uri: uri ?? undefined });
    }
  }, [content, lastContentSource, uri]);

  useEffect(() => {
    vscode.postMessage({ type: "updateSnappingEnabled", enabled: snappingEnabled });
    vscode.postMessage({ type: "updateSnappingConfig", config: snappingConfig });
    vscode.postMessage({ type: "updateVisualizersVisible", visible: visualizersVisible });
    vscode.postMessage({ type: "updateGizmoMode", mode: gizmoMode });
  }, [snappingEnabled, snappingConfig, visualizersVisible, gizmoMode]);

  useEffect(() => {
    if (content && mmlClient.ready) {
      mmlClient.loadContent(ensureHTMLDocument(stripScriptTags(content)));
    }
  }, [content, mmlClient.ready, mmlClient.loadContent]);

  // Sync selection from React state to client
  useEffect(() => {
    if (!mmlClient.ready) return;
    if (settingSelectionRef.current) return;
    settingSelectionRef.current = true;
    mmlClient.setSelectedPaths(selectedPaths);
    // Use microtask to reset flag after React's batch completes
    queueMicrotask(() => {
      settingSelectionRef.current = false;
    });
  }, [selectedPaths, mmlClient.ready, mmlClient.setSelectedPaths]);

  const derived = useMemo(() => {
    const holder = mmlClient.remoteHolderElement;
    const body = holder ? bodyFromRemoteHolderElement(holder) : null;
    const sceneData = body ? buildSceneData(body) : null;
    const sceneTotal = body ? countMmlElements(body) : 0;

    const selectedElements: HTMLElement[] = [];
    for (const path of selectedPaths) {
      const el = mmlPathToElement(body, path);
      if (el) selectedElements.push(el);
    }

    const allProps = selectedElements.map((el) => getElementPropertyDefinitions(el));
    const sharedProps =
      selectedElements.length > 0
        ? allProps.reduce((shared, props) => {
            const names = new Set(props.map((p) => p.name));
            return shared.filter((p) => names.has(p.name));
          }, allProps[0] || [])
        : [];

    const properties = sharedProps.map((prop) => {
      const values = selectedElements.map((el) => el.getAttribute(prop.name));
      const first = values[0] ?? null;
      const allSame = values.every((v) => (v ?? null) === first);
      return {
        name: prop.name,
        label: prop.label,
        type: prop.type,
        value: allSame ? (first ?? "") : "",
        mixed: !allSame,
        step: prop.step,
        min: prop.min,
        max: prop.max,
        defaultValue: prop.defaultValue,
        options: prop.options,
      };
    });

    return {
      sceneData,
      sceneInfo: body ? `${sceneTotal}` : undefined,
      selectedElements,
      selectedElementsData: selectedElements.map((el, i) => ({
        tagName: el.tagName.toLowerCase(),
        id: el.id || undefined,
        path: selectedPaths[i],
      })),
      properties,
    };
  }, [sceneRevision, selectedPaths, mmlClient.remoteHolderElement]);

  useEffect(() => {
    vscode.postMessage({ type: "sceneDataUpdate", sceneData: derived.sceneData });
    vscode.postMessage({
      type: "selectionDataUpdate",
      selectedElements: derived.selectedElementsData,
      elementProperties: derived.properties,
    });
  }, [derived.sceneData, derived.selectedElementsData, derived.properties]);

  const handleUpdateProperty = useCallback(
    (propName: string, value: string | undefined) => {
      for (const el of derived.selectedElements) {
        if (value === undefined) el.removeAttribute(propName);
        else el.setAttribute(propName, value);
      }
      if (!content) return;
      let updated = content;
      for (const el of derived.selectedElements) {
        const result = updateElementsAttributesInCode(updated, [el], { [propName]: value });
        if (result) updated = result;
      }
      if (updated !== content) {
        setContent(updated);
        setLastContentSource("local");
      }
    },
    [content, derived.selectedElements],
  );

  useEffect(() => {
    handleUpdatePropertyRef.current = handleUpdateProperty;
  }, [handleUpdateProperty]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg?.type) return;

      switch (msg.type) {
        case "setContent":
          // Ensure mapping is applied before loadContent triggers loaders in the iframe.
          if (msg.contentAddressMap) {
            applyVscodeAssetMapEverywhere(mmlClient.remoteHolderElement, msg.contentAddressMap);
          }
          setContent(msg.content);
          if (msg.uri) setUri(msg.uri);
          if (msg.contentAddressMap) setContentAddressMap(msg.contentAddressMap);
          setLastContentSource("vscode");
          break;
        case "setContentAddressMap":
          applyVscodeAssetMapEverywhere(mmlClient.remoteHolderElement, msg.contentAddressMap ?? {});
          setContentAddressMap(msg.contentAddressMap ?? {});
          break;
        case "setVisualizersVisible":
          useToolbarStore.getState().setVisualizersVisible(msg.visible);
          break;
        case "setSnappingEnabled":
          useToolbarStore.getState().setSnappingEnabled(msg.enabled);
          break;
        case "setSnappingConfig":
          useToolbarStore.getState().setSnappingConfig(msg.config);
          break;
        case "setGizmoMode":
          useToolbarStore.getState().setGizmoMode(msg.mode);
          break;
        case "selectElementByPath":
          setSelectedPaths((prev) => (msg.addToSelection ? [...prev, msg.path] : [msg.path]));
          break;
        case "clearSelection":
          setSelectedPaths([]);
          break;
        case "updatePropertyFromSidebar":
          handleUpdatePropertyRef.current?.(msg.propName, msg.value);
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleSelectPath = useCallback((path: number[], additive: boolean) => {
    setSelectedPaths((prev) => {
      if (additive) {
        const exists = prev.some((p) => pathsEqual(p, path));
        return exists ? prev.filter((p) => !pathsEqual(p, path)) : [...prev, path];
      }
      return [path];
    });
  }, []);

  const sidebarLayoutState: SidebarLayoutState = { ...layout, sidebarCollapsed: !sidebarVisible };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <PreviewToolbar title="Preview" showSidebarToggle />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div ref={containerRef} className="flex-1 min-w-0 relative bg-white" />
        <SidebarLayout
          state={sidebarLayoutState}
          sceneHeader={{ title: "Scene", info: derived.sceneInfo }}
          settingsHeader={{
            title: "Element",
            info:
              derived.selectedElementsData.length > 0
                ? `${derived.selectedElementsData.length}`
                : "",
          }}
          onToggleSceneCollapsed={() =>
            setLayout((l) => ({ ...l, scenePanelCollapsed: !l.scenePanelCollapsed }))
          }
          onToggleSettingsCollapsed={() =>
            setLayout((l) => ({ ...l, settingsPanelCollapsed: !l.settingsPanelCollapsed }))
          }
          onChangeWidth={(w) => setLayout((l) => ({ ...l, sidebarWidth: w }))}
          onChangeRatio={(r) => setLayout((l) => ({ ...l, scenePanelRatio: r }))}
          scene={
            <SceneOutlinePanel
              sceneData={derived.sceneData}
              selectedPaths={selectedPaths}
              onSelectPath={handleSelectPath}
              onClearSelection={() => setSelectedPaths([])}
              emptyLabel="Scene not ready"
              emptySceneLabel="Empty scene"
            />
          }
          settings={
            <ElementSettingsPanel
              selectedElements={derived.selectedElementsData}
              properties={derived.properties}
              snappingEnabled={snappingEnabled}
              snappingConfig={snappingConfig}
              onUpdateProperty={handleUpdateProperty}
              emptyLabel="Select an element"
            />
          }
        />
      </div>
    </div>
  );
}

function countMmlElements(element: HTMLElement): number {
  let count = 0;
  for (const child of Array.from(element.children)) {
    if (child.tagName.toLowerCase().startsWith("m-")) count += 1;
    count += countMmlElements(child as HTMLElement);
  }
  return count;
}
