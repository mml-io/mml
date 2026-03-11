import { afterEach, describe, expect, test, vi } from "vitest";

import {
  consumeEventEventName,
  Cube,
  Group,
  IMMLScene,
  MElement,
  registerCustomElementsToVirtualDocument,
  registerCustomElementsToWindow,
  RemoteDocument,
  VirtualCustomEvent,
  VirtualDocument,
  VirtualHTMLElement,
} from "../src";
import { MML_ELEMENTS } from "../src/elements/mml-element-list";

function createMockScene(): IMMLScene {
  return {
    hasGraphicsAdapter: () => false,
    getGraphicsAdapter: () => {
      throw new Error("No graphics adapter");
    },
    getUserPositionAndRotation: () => ({
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
    }),
    prompt: () => {},
    link: () => {},
    getLoadingProgressManager: () => null,
  } as IMMLScene;
}

function createDOMRemoteDocument(): RemoteDocument {
  const remoteDoc = document.createElement("m-remote-document") as unknown as RemoteDocument;
  remoteDoc.init(createMockScene(), "ws://test.local/doc");
  document.body.appendChild(remoteDoc as unknown as Node);
  return remoteDoc;
}

function createMElement<T>(tag: string): T {
  return document.createElement(tag) as unknown as T;
}

function asNode(el: unknown): Node {
  return el as unknown as Node;
}

function asHTMLElement(el: unknown): HTMLElement {
  return el as unknown as HTMLElement;
}

function switchToDOMMode() {
  const targetHTMLElement = (window as unknown as { HTMLElement: typeof HTMLElement }).HTMLElement;
  MElement.overwriteSuperclass(targetHTMLElement, window);
}

registerCustomElementsToWindow(window);

describe("createConsumeEvent", () => {
  describe("DOM mode", () => {
    test("returns a CustomEvent with correct type and detail", () => {
      const cube = createMElement<Cube>("m-cube");
      const originalEvent = new CustomEvent("click", { bubbles: true });
      const consumeEvent = MElement.createConsumeEvent(cube, originalEvent);

      expect(consumeEvent).toBeInstanceOf(CustomEvent);
      expect(consumeEvent.type).toBe(consumeEventEventName);
      expect(consumeEvent.bubbles).toBe(false);
      expect((consumeEvent as CustomEvent).detail).toEqual({
        element: cube,
        originalEvent,
      });
    });

    test("event is accepted by native HTMLElement.prototype.dispatchEvent", () => {
      const target = document.createElement("div");
      const cube = createMElement<Cube>("m-cube");
      const consumeEvent = MElement.createConsumeEvent(
        cube,
        new CustomEvent("click", { bubbles: true }),
      );

      const listener = vi.fn();
      target.addEventListener(consumeEventEventName, listener);
      target.dispatchEvent(consumeEvent as CustomEvent);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].detail.element).toBe(cube);
    });

    test("uses domModeWindow's CustomEvent constructor", () => {
      expect(MElement.domModeWindow).toBe(window);
      const cube = createMElement<Cube>("m-cube");
      const consumeEvent = MElement.createConsumeEvent(cube, new CustomEvent("test"));
      expect(consumeEvent).toBeInstanceOf(window.CustomEvent);
    });
  });

  describe("virtual mode", () => {
    afterEach(() => {
      switchToDOMMode();
    });

    test("returns a VirtualCustomEvent when not in DOM mode", () => {
      MElement.resetToVirtualMode();

      const mockElement = {} as VirtualHTMLElement;
      const originalEvent = new VirtualCustomEvent("click", { bubbles: true });
      const consumeEvent = MElement.createConsumeEvent(mockElement, originalEvent);

      expect(consumeEvent).toBeInstanceOf(VirtualCustomEvent);
      expect(consumeEvent.type).toBe(consumeEventEventName);
      expect(consumeEvent.bubbles).toBe(false);
      expect((consumeEvent as VirtualCustomEvent).detail).toEqual({
        element: mockElement,
        originalEvent,
      });
    });
  });
});

describe("overwriteSuperclass", () => {
  test("sets isDOMMode and domModeWindow", () => {
    expect(MElement.isDOMMode).toBe(true);
    expect(MElement.domModeWindow).toBe(window);
  });

  test("MElement prototype chain extends the target HTMLElement", () => {
    const targetHTMLElement = (window as unknown as { HTMLElement: typeof HTMLElement })
      .HTMLElement;
    expect(Object.getPrototypeOf(MElement.prototype)).toBe(targetHTMLElement.prototype);
    expect(Object.getPrototypeOf(MElement)).toBe(targetHTMLElement);
  });

  test("elements created after overwrite are instanceof HTMLElement", () => {
    const cube = document.createElement("m-cube");
    expect(cube).toBeInstanceOf(HTMLElement);
  });

  test("invalidates getBaseDispatchEvent cache", () => {
    const first = MElement.getBaseDispatchEvent();
    expect(typeof first).toBe("function");

    switchToDOMMode();

    const second = MElement.getBaseDispatchEvent();
    expect(typeof second).toBe("function");
  });
});

describe("resetToVirtualMode", () => {
  afterEach(() => {
    switchToDOMMode();
  });

  test("clears isDOMMode and domModeWindow", () => {
    MElement.resetToVirtualMode();
    expect(MElement.isDOMMode).toBe(false);
    expect(MElement.domModeWindow).toBeNull();
  });

  test("restores VirtualHTMLElement as the superclass", () => {
    MElement.resetToVirtualMode();
    expect(Object.getPrototypeOf(MElement)).not.toBe(
      (window as unknown as { HTMLElement: typeof HTMLElement }).HTMLElement,
    );
  });
});

describe("getBaseDispatchEvent", () => {
  test("repeated calls return the same cached function", () => {
    const first = MElement.getBaseDispatchEvent();
    const second = MElement.getBaseDispatchEvent();
    expect(first).toBe(second);
  });

  test("resolves to HTMLElement.prototype.dispatchEvent in DOM mode", () => {
    const fn = MElement.getBaseDispatchEvent();
    expect(fn).toBe(HTMLElement.prototype.dispatchEvent);
  });
});

describe("consume-event dispatch flow (DOM mode)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("dispatching on an MElement sends consume-event to RemoteDocument", () => {
    const remoteDoc = createDOMRemoteDocument();
    const cube = createMElement<Cube>("m-cube");
    asHTMLElement(remoteDoc).appendChild(asNode(cube));

    const received: Array<{
      element: MElement | VirtualHTMLElement;
      originalEvent: Event | VirtualCustomEvent;
    }> = [];
    asHTMLElement(remoteDoc).addEventListener(consumeEventEventName, ((e: CustomEvent) =>
      received.push(e.detail)) as EventListener);

    const event = new CustomEvent("click", { bubbles: true });
    cube.dispatchEvent(event);

    expect(received).toHaveLength(1);
    expect(received[0].element).toBe(cube);
    expect(received[0].originalEvent).toBe(event);
  });

  test("consume-event is only sent once per dispatch, not per ancestor", () => {
    const remoteDoc = createDOMRemoteDocument();
    const group = createMElement<Group>("m-group");
    const cube = createMElement<Cube>("m-cube");
    asHTMLElement(remoteDoc).appendChild(asNode(group));
    asHTMLElement(group).appendChild(asNode(cube));

    const received: Array<{ element: MElement | VirtualHTMLElement }> = [];
    asHTMLElement(remoteDoc).addEventListener(consumeEventEventName, ((e: CustomEvent) =>
      received.push(e.detail)) as EventListener);

    cube.dispatchEvent(new CustomEvent("click", { bubbles: true }));

    expect(received).toHaveLength(1);
    expect(received[0].element).toBe(cube);
  });

  test("RemoteDocument stops consume-event propagation", () => {
    const remoteDoc = createDOMRemoteDocument();
    const cube = createMElement<Cube>("m-cube");
    asHTMLElement(remoteDoc).appendChild(asNode(cube));

    const bodyListener = vi.fn();
    document.body.addEventListener(consumeEventEventName, bodyListener);

    cube.dispatchEvent(new CustomEvent("click", { bubbles: true }));
    expect(bodyListener).not.toHaveBeenCalled();

    document.body.removeEventListener(consumeEventEventName, bodyListener);
  });
});

describe("registerCustomElementsToWindow", () => {
  test("all MML elements are registered as custom elements", () => {
    for (const Element of MML_ELEMENTS) {
      expect(window.customElements.get(Element.tagName)).toBeDefined();
    }
  });
});

describe("registerCustomElementsToVirtualDocument", () => {
  afterEach(() => {
    switchToDOMMode();
  });

  test("all MML elements can be created from a registered VirtualDocument", () => {
    MElement.resetToVirtualMode();
    const doc = new VirtualDocument();
    registerCustomElementsToVirtualDocument(doc);

    for (const Element of MML_ELEMENTS) {
      const el = doc.createElement(Element.tagName);
      expect(el.tagName).toBe(Element.tagName.toUpperCase());
    }
  });
});
