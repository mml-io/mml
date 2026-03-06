import { describe, expect, test, vi } from "vitest";

import {
  VIRTUAL_ELEMENT_BRAND,
  VIRTUAL_TEXT_BRAND,
  VirtualCustomEvent,
  VirtualDocument,
  VirtualDocumentFragment,
  VirtualEvent,
  VirtualHTMLElement,
  VirtualNode,
  VirtualTextNode,
} from "../build/index";

describe("VirtualNode", () => {
  test("tree operations: append, remove, insertBefore", () => {
    const parent = new VirtualNode("parent");
    const child1 = new VirtualNode("child1");
    const child2 = new VirtualNode("child2");
    const child3 = new VirtualNode("child3");

    parent.appendChild(child1);
    parent.appendChild(child3);

    expect(parent.childNodes.length).toBe(2);
    expect(child1.parentNode).toBe(parent);
    expect(child3.parentNode).toBe(parent);

    parent.insertBefore(child2, child3);
    expect(parent.childNodes.length).toBe(3);
    expect(parent.childNodes[0]).toBe(child1);
    expect(parent.childNodes[1]).toBe(child2);
    expect(parent.childNodes[2]).toBe(child3);

    parent.removeChild(child2);
    expect(parent.childNodes.length).toBe(2);
    expect(child2.parentNode).toBeNull();
  });

  test("replaceChild", () => {
    const parent = new VirtualNode("parent");
    const child1 = new VirtualNode("child1");
    const child2 = new VirtualNode("child2");

    parent.appendChild(child1);
    parent.replaceChild(child2, child1);

    expect(parent.childNodes.length).toBe(1);
    expect(parent.childNodes[0]).toBe(child2);
    expect(child1.parentNode).toBeNull();
    expect(child2.parentNode).toBe(parent);
  });

  test("nextSibling and previousSibling", () => {
    const parent = new VirtualNode("parent");
    const child1 = new VirtualNode("child1");
    const child2 = new VirtualNode("child2");
    const child3 = new VirtualNode("child3");

    parent.append(child1, child2, child3);

    expect(child1.nextSibling).toBe(child2);
    expect(child2.nextSibling).toBe(child3);
    expect(child3.nextSibling).toBeNull();

    expect(child1.previousSibling).toBeNull();
    expect(child2.previousSibling).toBe(child1);
    expect(child3.previousSibling).toBe(child2);
  });

  test("remove() removes node from parent", () => {
    const parent = new VirtualNode("parent");
    const child = new VirtualNode("child");

    parent.appendChild(child);
    expect(parent.childNodes.length).toBe(1);

    child.remove();
    expect(parent.childNodes.length).toBe(0);
    expect(child.parentNode).toBeNull();
  });

  test("isConnected tracking through tree mutations", () => {
    const root = new VirtualNode("root");
    root.setRootConnected(true);

    const child = new VirtualNode("child");
    const grandchild = new VirtualNode("grandchild");

    child.appendChild(grandchild);
    expect(child.isConnected).toBe(false);
    expect(grandchild.isConnected).toBe(false);

    root.appendChild(child);
    expect(child.isConnected).toBe(true);
    expect(grandchild.isConnected).toBe(true);

    root.removeChild(child);
    expect(child.isConnected).toBe(false);
    expect(grandchild.isConnected).toBe(false);
  });

  test("connectedCallback / disconnectedCallback lifecycle timing", () => {
    const connectedOrder: string[] = [];
    const disconnectedOrder: string[] = [];

    class TestElement extends VirtualHTMLElement {
      static tagName = "test-element";
      name: string;
      constructor(name: string) {
        super();
        this.name = name;
      }
      connectedCallback(): void {
        connectedOrder.push(this.name);
      }
      disconnectedCallback(): void {
        disconnectedOrder.push(this.name);
      }
    }

    const root = new VirtualNode("root");
    root.setRootConnected(true);

    const parent = new TestElement("parent");
    const child = new TestElement("child");
    parent.appendChild(child);

    root.appendChild(parent);
    expect(connectedOrder).toEqual(["parent", "child"]);

    root.removeChild(parent);
    expect(disconnectedOrder).toEqual(["parent", "child"]);
  });

  test("prepend adds children at the start", () => {
    const parent = new VirtualNode("parent");
    const existing = new VirtualNode("existing");
    const prepended = new VirtualNode("prepended");

    parent.appendChild(existing);
    parent.prepend(prepended);

    expect(parent.childNodes[0]).toBe(prepended);
    expect(parent.childNodes[1]).toBe(existing);
  });

  test("textContent setter creates a text node child", () => {
    const parent = new VirtualNode("parent");
    parent.textContent = "hello world";

    expect(parent.childNodes.length).toBe(1);
    expect(parent.childNodes[0].nodeName).toBe("#text");
    expect(parent.childNodes[0].textContent).toBe("hello world");
  });

  test("textContent setter clears existing children and creates text node", () => {
    const parent = new VirtualNode("parent");
    const child = new VirtualNode("child");
    parent.appendChild(child);

    parent.textContent = "replaced";
    expect(parent.childNodes.length).toBe(1);
    expect(parent.childNodes[0].textContent).toBe("replaced");
    expect(child.parentNode).toBeNull();
  });

  test("textContent setter with empty string only clears children", () => {
    const parent = new VirtualNode("parent");
    parent.appendChild(new VirtualNode("child"));
    parent.textContent = "";
    expect(parent.childNodes.length).toBe(0);
  });

  test("textContent setter with null only clears children", () => {
    const parent = new VirtualNode("parent");
    parent.appendChild(new VirtualNode("child"));
    parent.textContent = null;
    expect(parent.childNodes.length).toBe(0);
  });
});

describe("VirtualHTMLElement", () => {
  test("removeEventListener prevents listener from being called", () => {
    const el = new VirtualHTMLElement();
    const received: string[] = [];
    const listener = () => received.push("heard");

    el.addEventListener("test", listener);
    el.dispatchEvent(new VirtualEvent("test"));
    expect(received).toEqual(["heard"]);

    el.removeEventListener("test", listener);
    el.dispatchEvent(new VirtualEvent("test"));
    expect(received).toEqual(["heard"]); // should not have been called again
  });

  test("innerHTML getter serializes children with proper escaping", () => {
    const parent = new VirtualHTMLElement();
    const child = new VirtualHTMLElement();
    (child as any).nodeName = "SPAN";
    child.setAttribute("class", 'foo "bar"');
    parent.appendChild(child);

    const text = new VirtualTextNode("Hello <world> & friends");
    child.appendChild(text);

    const html = parent.innerHTML;
    expect(html).toContain("&lt;world&gt;");
    expect(html).toContain("&amp; friends");
    expect(html).toContain('class="foo &quot;bar&quot;"');
    expect(html).toContain("<span");
    expect(html).toContain("</span>");
  });

  test("outerHTML includes tag and attributes", () => {
    const el = new VirtualHTMLElement();
    (el as any).nodeName = "DIV";
    el.setAttribute("id", "test");
    el.setAttribute("data-val", "a<b");

    const html = el.outerHTML;
    expect(html).toContain('<div id="test"');
    expect(html).toContain("a&lt;b");
    expect(html).toContain("</div>");
  });

  test("querySelector with #id selector", () => {
    const parent = new VirtualHTMLElement();
    const child = new VirtualHTMLElement();
    (child as any).nodeName = "DIV";
    child.setAttribute("id", "my-id");
    parent.appendChild(child);

    expect(parent.querySelector("#my-id")).toBe(child);
    expect(parent.querySelector("#nonexistent")).toBeNull();
  });

  test('querySelector with [attr="value"] selector', () => {
    const parent = new VirtualHTMLElement();
    const child = new VirtualHTMLElement();
    (child as any).nodeName = "DIV";
    child.setAttribute("data-key", "val");
    parent.appendChild(child);

    expect(parent.querySelector('[data-key="val"]')).toBe(child);
    expect(parent.querySelector('[data-key="other"]')).toBeNull();
  });

  test("querySelector with [attr] existence selector", () => {
    const parent = new VirtualHTMLElement();
    const child = new VirtualHTMLElement();
    (child as any).nodeName = "DIV";
    child.setAttribute("disabled", "");
    parent.appendChild(child);

    expect(parent.querySelector("[disabled]")).toBe(child);
    expect(parent.querySelector("[enabled]")).toBeNull();
  });

  test("stopPropagation prevents bubbling but allows remaining listeners on current element", () => {
    const root = new VirtualNode("root");
    root.setRootConnected(true);

    const parent = new VirtualHTMLElement();
    const child = new VirtualHTMLElement();
    root.appendChild(parent);
    parent.appendChild(child);

    const received: string[] = [];
    child.addEventListener("test", (e: any) => {
      received.push("child-first");
      e.stopPropagation();
    });
    child.addEventListener("test", () => {
      received.push("child-second"); // should still fire
    });
    parent.addEventListener("test", () => {
      received.push("parent"); // should NOT fire
    });

    child.dispatchEvent(new VirtualEvent("test", { bubbles: true }));
    expect(received).toEqual(["child-first", "child-second"]);
  });

  test("replaceChild with same node is a no-op", () => {
    const parent = new VirtualNode("parent");
    const child1 = new VirtualNode("child1");
    const child2 = new VirtualNode("child2");
    parent.appendChild(child1);
    parent.appendChild(child2);

    parent.replaceChild(child1, child1);
    expect(parent.childNodes.length).toBe(2);
    expect(parent.childNodes[0]).toBe(child1);
    expect(parent.childNodes[1]).toBe(child2);
  });

  test("innerHTML setter throws on non-empty string", () => {
    const el = new VirtualHTMLElement();
    expect(() => {
      el.innerHTML = "<div>test</div>";
    }).toThrow("VirtualHTMLElement does not support setting innerHTML to non-empty strings");
  });

  test("ownerDocument propagates to descendants on adoption", () => {
    const doc = new VirtualDocument();
    const root = doc.createElement("div");
    const orphanParent = new VirtualHTMLElement();
    const orphanChild = new VirtualHTMLElement();
    orphanParent.appendChild(orphanChild);

    expect(orphanParent.ownerDocument).toBeNull();
    expect(orphanChild.ownerDocument).toBeNull();

    root.appendChild(orphanParent);
    expect(orphanParent.ownerDocument).toBe(doc);
    expect(orphanChild.ownerDocument).toBe(doc);
  });

  test("parentElement returns null for document fragment parent", () => {
    const frag = new VirtualDocumentFragment();
    const child = new VirtualHTMLElement();
    frag.appendChild(child);
    // Fragment is not an element, so parentElement should be null
    expect(child.parentElement).toBeNull();
    // But parentNode should still be the fragment
    expect(child.parentNode).toBe(frag);
  });

  test("setAttribute triggers attributeChangedCallback for observed attributes", () => {
    const callbacks: Array<{ name: string; oldValue: string | null; newValue: string | null }> = [];

    class TestElement extends VirtualHTMLElement {
      static tagName = "test-el";
      static get observedAttributes() {
        return ["color", "size"];
      }
      attributeChangedCallback(
        name: string,
        oldValue: string | null,
        newValue: string | null,
      ): void {
        callbacks.push({ name, oldValue, newValue });
      }
    }

    const el = new TestElement();
    el.setAttribute("color", "red");
    expect(callbacks).toEqual([{ name: "color", oldValue: null, newValue: "red" }]);

    el.setAttribute("color", "blue");
    expect(callbacks).toEqual([
      { name: "color", oldValue: null, newValue: "red" },
      { name: "color", oldValue: "red", newValue: "blue" },
    ]);
  });

  test("setAttribute does NOT trigger attributeChangedCallback for non-observed attributes", () => {
    const callback = vi.fn();

    class TestElement extends VirtualHTMLElement {
      static tagName = "test-el2";
      static get observedAttributes() {
        return ["color"];
      }
      attributeChangedCallback(): void {
        callback();
      }
    }

    const el = new TestElement();
    el.setAttribute("data-foo", "bar");
    expect(callback).not.toHaveBeenCalled();
    expect(el.getAttribute("data-foo")).toBe("bar");
  });

  test("removeAttribute triggers attributeChangedCallback", () => {
    const callbacks: Array<{ name: string; oldValue: string | null; newValue: string | null }> = [];

    class TestElement extends VirtualHTMLElement {
      static tagName = "test-el3";
      static get observedAttributes() {
        return ["color"];
      }
      attributeChangedCallback(
        name: string,
        oldValue: string | null,
        newValue: string | null,
      ): void {
        callbacks.push({ name, oldValue, newValue });
      }
    }

    const el = new TestElement();
    el.setAttribute("color", "red");
    el.removeAttribute("color");
    expect(callbacks).toEqual([
      { name: "color", oldValue: null, newValue: "red" },
      { name: "color", oldValue: "red", newValue: null },
    ]);
  });

  test("getAttributeNames and hasAttribute", () => {
    const el = new VirtualHTMLElement();
    el.setAttribute("a", "1");
    el.setAttribute("b", "2");
    expect(el.getAttributeNames()).toEqual(["a", "b"]);
    expect(el.hasAttribute("a")).toBe(true);
    expect(el.hasAttribute("c")).toBe(false);
  });

  test("event dispatch with bubbling", () => {
    const root = new VirtualNode("root");
    root.setRootConnected(true);

    const parent = new VirtualHTMLElement();
    const child = new VirtualHTMLElement();
    root.appendChild(parent);
    parent.appendChild(child);

    const received: string[] = [];
    parent.addEventListener("test", () => received.push("parent"));
    child.addEventListener("test", () => received.push("child"));

    child.dispatchEvent(new VirtualEvent("test", { bubbles: true }));
    expect(received).toEqual(["child", "parent"]);
  });

  test("event dispatch without bubbling stays local", () => {
    const parent = new VirtualHTMLElement();
    const child = new VirtualHTMLElement();
    parent.appendChild(child);

    const received: string[] = [];
    parent.addEventListener("test", () => received.push("parent"));
    child.addEventListener("test", () => received.push("child"));

    child.dispatchEvent(new VirtualEvent("test", { bubbles: false }));
    expect(received).toEqual(["child"]);
  });

  test("stopImmediatePropagation prevents other listeners", () => {
    const el = new VirtualHTMLElement();
    const received: string[] = [];

    el.addEventListener("test", (e: any) => {
      received.push("first");
      e.stopImmediatePropagation();
    });
    el.addEventListener("test", () => {
      received.push("second");
    });

    el.dispatchEvent(new VirtualEvent("test"));
    expect(received).toEqual(["first"]);
  });

  test("querySelectorAll matches tag names", () => {
    class ParentEl extends VirtualHTMLElement {
      static tagName = "m-model";
    }
    class AnimEl extends VirtualHTMLElement {
      static tagName = "m-animation";
    }

    const parent = new ParentEl();
    const anim1 = new AnimEl();
    const anim2 = new AnimEl();
    const nested = new ParentEl();
    const anim3 = new AnimEl();

    parent.appendChild(anim1);
    parent.appendChild(nested);
    nested.appendChild(anim2);
    nested.appendChild(anim3);

    const results = parent.querySelectorAll("m-animation");
    expect(results.length).toBe(3);
  });

  test("innerHTML = '' clears children and fires disconnectedCallback", () => {
    const disconnected: string[] = [];

    class TestChild extends VirtualHTMLElement {
      static tagName = "test-child";
      disconnectedCallback() {
        disconnected.push(this.nodeName);
      }
    }

    const root = new VirtualNode("root");
    root.setRootConnected(true);

    const parent = new VirtualHTMLElement();
    root.appendChild(parent);

    const child1 = new TestChild();
    const child2 = new TestChild();
    parent.appendChild(child1);
    parent.appendChild(child2);

    expect(parent.childNodes.length).toBe(2);
    parent.innerHTML = "";
    expect(parent.childNodes.length).toBe(0);
    expect(disconnected).toEqual(["TEST-CHILD", "TEST-CHILD"]);
  });

  test("style property acts as a property bag", () => {
    const el = new VirtualHTMLElement();
    el.style.display = "none";
    expect(el.style.display).toBe("none");
    el.style.position = "absolute";
    expect(el.style.position).toBe("absolute");
  });

  test("tagName and children getters", () => {
    class TestEl extends VirtualHTMLElement {
      static tagName = "m-cube";
    }

    const el = new TestEl();
    expect(el.tagName).toBe("M-CUBE");
    expect(el.nodeName).toBe("M-CUBE");
    expect(el.children.length).toBe(0);

    const child = new TestEl();
    el.appendChild(child);
    expect(el.children.length).toBe(1);
  });

  test("has VIRTUAL_ELEMENT_BRAND symbol", () => {
    const el = new VirtualHTMLElement();
    expect((el as any)[VIRTUAL_ELEMENT_BRAND]).toBe(true);
    // Also works via Symbol.for
    expect((el as any)[Symbol.for("mml-virtual-element")]).toBe(true);
  });

  test("subclasses inherit VIRTUAL_ELEMENT_BRAND", () => {
    class TestEl extends VirtualHTMLElement {
      static tagName = "test-el";
    }
    const el = new TestEl();
    expect((el as any)[VIRTUAL_ELEMENT_BRAND]).toBe(true);
  });
});

describe("VirtualTextNode", () => {
  test("textContent getter and setter", () => {
    const text = new VirtualTextNode("hello");
    expect(text.textContent).toBe("hello");
    expect(text.nodeName).toBe("#text");

    text.textContent = "world";
    expect(text.textContent).toBe("world");
  });

  test("has VIRTUAL_TEXT_BRAND symbol", () => {
    const text = new VirtualTextNode("hello");
    expect((text as any)[VIRTUAL_TEXT_BRAND]).toBe(true);
    expect((text as any)[Symbol.for("mml-virtual-text")]).toBe(true);
  });

  test("does not have VIRTUAL_ELEMENT_BRAND", () => {
    const text = new VirtualTextNode("hello");
    expect((text as any)[VIRTUAL_ELEMENT_BRAND]).toBeUndefined();
  });
});

describe("VirtualDocumentFragment", () => {
  test("fragment children move to target on appendChild", () => {
    const parent = new VirtualNode("parent");
    const frag = new VirtualDocumentFragment();
    const child1 = new VirtualNode("child1");
    const child2 = new VirtualNode("child2");

    frag.appendChild(child1);
    frag.appendChild(child2);
    expect(frag.childNodes.length).toBe(2);

    parent.appendChild(frag);
    expect(parent.childNodes.length).toBe(2);
    expect(parent.childNodes[0]).toBe(child1);
    expect(parent.childNodes[1]).toBe(child2);
    expect(frag.childNodes.length).toBe(0);
  });

  test("fragment children move to target on insertBefore", () => {
    const parent = new VirtualNode("parent");
    const existing = new VirtualNode("existing");
    parent.appendChild(existing);

    const frag = new VirtualDocumentFragment();
    const child1 = new VirtualNode("child1");
    const child2 = new VirtualNode("child2");
    frag.append(child1, child2);

    parent.insertBefore(frag, existing);
    expect(parent.childNodes.length).toBe(3);
    expect(parent.childNodes[0]).toBe(child1);
    expect(parent.childNodes[1]).toBe(child2);
    expect(parent.childNodes[2]).toBe(existing);
  });
});

describe("VirtualDocument", () => {
  test("createElement with registered class", () => {
    class TestCube extends VirtualHTMLElement {
      static tagName = "m-cube";
    }

    const doc = new VirtualDocument();
    doc.registerElement("m-cube", TestCube);

    const el = doc.createElement("m-cube");
    expect(el).toBeInstanceOf(TestCube);
    expect(el.nodeName).toBe("M-CUBE");
    expect(el.ownerDocument).toBe(doc);
  });

  test("createElement with unregistered tag returns plain VirtualHTMLElement", () => {
    const doc = new VirtualDocument();
    const el = doc.createElement("div");
    expect(el).toBeInstanceOf(VirtualHTMLElement);
    expect(el.nodeName).toBe("DIV");
  });

  test("createTextNode", () => {
    const doc = new VirtualDocument();
    const text = doc.createTextNode("hello");
    expect(text).toBeInstanceOf(VirtualTextNode);
    expect(text.textContent).toBe("hello");
    expect(text.ownerDocument).toBe(doc);
  });

  test("createDocumentFragment", () => {
    const doc = new VirtualDocument();
    const frag = doc.createDocumentFragment();
    expect(frag).toBeInstanceOf(VirtualDocumentFragment);
    expect(frag.ownerDocument).toBe(doc);
  });

  test("createElementNS", () => {
    const doc = new VirtualDocument();
    const el = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    expect(el).toBeInstanceOf(VirtualHTMLElement);
    expect(el.nodeName).toBe("SVG");
  });

  test("defaultView is null", () => {
    const doc = new VirtualDocument();
    expect(doc.defaultView).toBeNull();
  });
});

describe("VirtualEvent", () => {
  test("VirtualEvent properties", () => {
    const event = new VirtualEvent("click", { bubbles: true });
    expect(event.type).toBe("click");
    expect(event.bubbles).toBe(true);
  });

  test("VirtualCustomEvent detail", () => {
    const event = new VirtualCustomEvent("test", {
      bubbles: false,
      detail: { foo: "bar" },
    });
    expect(event.type).toBe("test");
    expect(event.detail).toEqual({ foo: "bar" });
    expect(event.bubbles).toBe(false);
  });

  test("stopPropagation and preventDefault", () => {
    const event = new VirtualEvent("test");
    expect(event.isPropagationStopped).toBe(false);
    expect(event.isDefaultPrevented).toBe(false);

    event.stopPropagation();
    expect(event.isPropagationStopped).toBe(true);

    event.preventDefault();
    expect(event.isDefaultPrevented).toBe(true);
  });
});
