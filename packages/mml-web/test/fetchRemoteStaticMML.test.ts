import { isElementLike } from "@mml-io/networked-dom-web";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { fetchRemoteStaticMML, VirtualDocument, VirtualHTMLElement } from "../build/index";

function mockFetch(html: string) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    text: () => Promise.resolve(html),
  } as Response);
}

function collectTagsDeep(node: { childNodes: ArrayLike<any> }): string[] {
  const tags: string[] = [];
  (function walk(n: { childNodes: ArrayLike<any> }) {
    for (let i = 0; i < n.childNodes.length; i++) {
      const child = n.childNodes[i];
      if (isElementLike(child)) {
        tags.push(child.nodeName.toLowerCase());
        walk(child);
      }
    }
  })(node);
  return tags;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchRemoteStaticMML", () => {
  describe("DOMParser path (no document factory)", () => {
    test("parses MML elements", async () => {
      mockFetch('<m-cube color="red"></m-cube>');
      const result = await fetchRemoteStaticMML("http://test/doc.html");
      const tags = collectTagsDeep(result);
      expect(tags).toContain("m-cube");
    });

    test("strips script tags", async () => {
      mockFetch('<m-cube></m-cube><script>alert("xss")</script>');
      const result = await fetchRemoteStaticMML("http://test/doc.html");
      const scripts = Array.from(result.childNodes as ArrayLike<any>).filter(
        (c: any) => c.nodeName === "SCRIPT",
      );
      for (const s of scripts) {
        expect(s.innerHTML).toBe("");
      }
    });

    test("renames non-m-* tags with x- prefix", async () => {
      mockFetch("<div><m-cube></m-cube></div>");
      const result = await fetchRemoteStaticMML("http://test/doc.html");
      const tags = collectTagsDeep(result);
      expect(tags).toContain("x-div");
      expect(tags).toContain("m-cube");
      expect(tags).not.toContain("div");
    });

    test("strips event handler attributes", async () => {
      mockFetch('<m-cube onclick="alert(1)" color="red"></m-cube>');
      const result = await fetchRemoteStaticMML("http://test/doc.html");
      const tags = collectTagsDeep(result);
      expect(tags).toContain("m-cube");
      const cube = Array.from(result.childNodes as ArrayLike<any>).find(
        (c: any) => c.nodeName?.toLowerCase() === "m-cube",
      );
      expect(cube.getAttribute("color")).toBe("red");
      expect(cube.getAttribute("onclick")).toBeNull();
    });
  });

  describe("DOMParser path (with document factory)", () => {
    let factory: VirtualDocument;

    beforeEach(() => {
      factory = new VirtualDocument();
    });

    test("returns virtual elements", async () => {
      mockFetch('<m-cube color="red"></m-cube>');
      const result = await fetchRemoteStaticMML("http://test/doc.html", factory);
      const child = result.childNodes[0] as VirtualHTMLElement;
      expect(child).toBeInstanceOf(VirtualHTMLElement);
      expect(child.nodeName.toLowerCase()).toBe("m-cube");
      expect(child.getAttribute("color")).toBe("red");
    });

    test("renames non-m-* tags with x- prefix", async () => {
      mockFetch("<div><m-cube></m-cube></div>");
      const result = await fetchRemoteStaticMML("http://test/doc.html", factory);
      const tags = collectTagsDeep(result);
      expect(tags).toContain("x-div");
      expect(tags).toContain("m-cube");
      expect(tags).not.toContain("div");
    });

    test("strips script tags", async () => {
      mockFetch('<m-cube></m-cube><script>alert("xss")</script>');
      const result = await fetchRemoteStaticMML("http://test/doc.html", factory);
      const tags = collectTagsDeep(result);
      expect(tags).toContain("m-cube");
      expect(tags).not.toContain("script");
      expect(tags).not.toContain("x-script");
    });

    test("strips event handler attributes", async () => {
      mockFetch('<m-cube onclick="alert(1)" color="red"></m-cube>');
      const result = await fetchRemoteStaticMML("http://test/doc.html", factory);
      const cube = result.childNodes[0] as VirtualHTMLElement;
      expect(cube.getAttribute("color")).toBe("red");
      expect(cube.getAttribute("onclick")).toBeNull();
    });
  });

  describe("parse5 path (no DOMParser, with document factory)", () => {
    let factory: VirtualDocument;
    const OriginalDOMParser = globalThis.DOMParser;

    beforeEach(() => {
      factory = new VirtualDocument();
      // Reset module cache so fetchRemoteStaticMML starts with a fresh
      // domParser = null, then remove the global so getDOMParser() returns null
      vi.resetModules();
      delete (globalThis as any).DOMParser;
    });

    afterEach(() => {
      globalThis.DOMParser = OriginalDOMParser;
    });

    async function getFreshFetchRemoteStaticMML() {
      const mod = await import("../build/index");
      return mod.fetchRemoteStaticMML;
    }

    test("parses MML elements into virtual tree", async () => {
      mockFetch('<m-cube color="red"><m-label content="hello"></m-label></m-cube>');
      const fn = await getFreshFetchRemoteStaticMML();
      const result = await fn("http://test/doc.html", factory);
      const tags = collectTagsDeep(result);
      expect(tags).toContain("m-cube");
      expect(tags).toContain("m-label");
      const cube = result.childNodes[0] as VirtualHTMLElement;
      expect(cube).toBeInstanceOf(VirtualHTMLElement);
      expect(cube.getAttribute("color")).toBe("red");
      const label = cube.childNodes[0] as VirtualHTMLElement;
      expect(label.getAttribute("content")).toBe("hello");
    });

    test("renames non-m-* tags with x- prefix", async () => {
      mockFetch("<div><m-cube></m-cube></div>");
      const fn = await getFreshFetchRemoteStaticMML();
      const result = await fn("http://test/doc.html", factory);
      const tags = collectTagsDeep(result);
      expect(tags).toContain("x-div");
      expect(tags).toContain("m-cube");
      expect(tags).not.toContain("div");
    });

    test("strips script tags", async () => {
      mockFetch('<m-cube></m-cube><script>alert("xss")</script>');
      const fn = await getFreshFetchRemoteStaticMML();
      const result = await fn("http://test/doc.html", factory);
      const tags = collectTagsDeep(result);
      expect(tags).toContain("m-cube");
      expect(tags).not.toContain("script");
      expect(tags).not.toContain("x-script");
    });

    test("strips object and iframe tags", async () => {
      mockFetch('<m-cube></m-cube><object data="x"></object><iframe src="x"></iframe>');
      const fn = await getFreshFetchRemoteStaticMML();
      const result = await fn("http://test/doc.html", factory);
      const tags = collectTagsDeep(result);
      expect(tags).toContain("m-cube");
      expect(tags).not.toContain("object");
      expect(tags).not.toContain("x-object");
      expect(tags).not.toContain("iframe");
      expect(tags).not.toContain("x-iframe");
    });

    test("strips event handler attributes", async () => {
      mockFetch('<m-cube onclick="alert(1)" color="red"></m-cube>');
      const fn = await getFreshFetchRemoteStaticMML();
      const result = await fn("http://test/doc.html", factory);
      const cube = result.childNodes[0] as VirtualHTMLElement;
      expect(cube.getAttribute("color")).toBe("red");
      expect(cube.getAttribute("onclick")).toBeNull();
    });

    test("throws without document factory when DOMParser is unavailable", async () => {
      mockFetch("<m-cube></m-cube>");
      const fn = await getFreshFetchRemoteStaticMML();
      await expect(fn("http://test/doc.html")).rejects.toThrow("DOMParser");
    });
  });
});
