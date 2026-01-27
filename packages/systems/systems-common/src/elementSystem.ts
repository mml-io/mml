export type ElementSystem = {
  init: (config: Record<string, unknown>) => Promise<void>;
  processElement: (
    element: Element,
    attributes: Array<{ attributeName: string; value: any }>,
  ) => void;
  onElementRemoved: (element: Element) => void;
  start: () => void;
  step: (deltaTime: number) => void;
  dispose: () => void;
};

declare global {
  interface Window {
    systemsConfig: Record<string, Record<string, unknown>>;
    systems: Record<string, ElementSystem>;
  }
}

export async function initElementSystem(
  systemName: string,
  system: ElementSystem,
  attributeNames: Array<string>,
) {
  if (!window.systemsConfig) {
    window.systemsConfig = {};
  }

  if (!window.systems) {
    window.systems = {};
  }
  const config = window.systemsConfig[systemName] || {};

  // Load system module from server
  console.log("Loaded module", { systemName, config });

  // Expose system API globally under namespace
  if (!window.systems) {
    window.systems = {};
  }
  (window as any)[systemName] = system;
  window.systems[systemName] = system;

  console.log("Exposed system API globally under namespace", { systemName, system });

  // Initialize system
  if (system.init) {
    await system.init(config);
  }

  // Process elements with system attributes
  const processElements = () => {
    if (typeof document === "undefined") {
      return;
    }
    const elements = document.querySelectorAll("*");
    elements.forEach((element) => {
      const attributes = [];

      for (const attr of attributeNames) {
        // Check for ${attr.name} attribute
        if (element.hasAttribute(attr)) {
          const value = element.getAttribute(attr);
          const parsedValue =
            value === "" || value === attr ? true : isNaN(Number(value)) ? value : Number(value);
          attributes.push({
            attributeName: attr,
            value: parsedValue,
          });
        }
      }

      // If element has any system attributes, process it
      if (attributes.length > 0) {
        if (system.processElement) {
          system.processElement(element, attributes);
        }
      }
    });
  };

  // Process existing elements
  processElements();

  // Watch for DOM changes (additions and removals)
  let processingTimeout: NodeJS.Timeout;
  const observer = new MutationObserver((mutations) => {
    let needsProcessing = false;
    mutations.forEach((mutation) => {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        needsProcessing = true;
      }
      if (mutation.type === "childList" && mutation.removedNodes.length > 0) {
        if (system.onElementRemoved) {
          mutation.removedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              try {
                system.onElementRemoved(node as Element);
              } catch (e) {
                console.warn(`(${systemName}) onElementRemoved failed:`, e);
              }
            }
          });
        }
      }
    });

    if (needsProcessing) {
      clearTimeout(processingTimeout);
      processingTimeout = setTimeout(processElements, 16); // ~60fps
    }
  });

  // Wait for document.body to be available before observing
  const startObserving = () => {
    if (typeof document === "undefined") {
      // No document available, retry later
      setTimeout(startObserving, 10);
      return;
    }
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    } else {
      // Retry after a short delay
      setTimeout(startObserving, 10);
    }
  };
  startObserving();

  // Start system if it has a start method
  if (system.start) {
    console.log(`(${systemName}) Starting system`);
    system.start();
  }

  // Set up update loop if system has step method
  if (system.step) {
    console.log(`(${systemName}) Setting up update loop for system`);
    let lastTime: number | null = null;
    const updateLoop = (currentTime: number) => {
      if (lastTime === null) {
        // First frame - skip step and just set lastTime
        lastTime = currentTime;
        setTimeout(updateLoop, 16);
        return;
      }

      const deltaTime = Math.max(0, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      // Cap deltaTime to prevent huge time steps
      const cappedDeltaTime = Math.min(deltaTime, 1 / 30); // Max 30fps equivalent
      system.step(cappedDeltaTime);
      setTimeout(updateLoop, 16);
    };
    setTimeout(updateLoop, 16);
  }
}
