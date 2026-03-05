import { describe, expect, test } from "vitest";

import {
  Cube,
  Group,
  Label,
  MElement,
  Overlay,
  Plane,
  registerCustomElementsToVirtualDocument,
  RemoteDocument,
  Sphere,
  VirtualDocument,
  VirtualNode,
} from "../build/index";

/**
 * These tests verify that MML elements work in virtual mode without JSDOM.
 * They use VirtualDocument + VirtualNode tree with a mock IMMLScene that has
 * no graphics adapter, so elements go through lifecycle callbacks without
 * creating any graphics.
 */

function createMockScene() {
  return {
    hasGraphicsAdapter: () => false,
    getGraphicsAdapter: () => {
      throw new Error("No graphics adapter in virtual mode");
    },
    getUserPositionAndRotation: () => ({
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
    }),
    prompt: () => {},
    link: () => {},
  } as any;
}

/**
 * Sets up a virtual environment with a VirtualDocument, root node, and
 * a RemoteDocument that provides the mock scene to child elements.
 */
function createVirtualEnvironment() {
  const doc = new VirtualDocument();
  registerCustomElementsToVirtualDocument(doc);

  const root = new VirtualNode("root");

  const remoteDoc = doc.createElement("m-remote-document") as RemoteDocument;
  // Append remoteDoc to root before marking root as connected,
  // and call init() to set the scene before connectedCallback fires.
  root.appendChild(remoteDoc);
  const mockScene = createMockScene();
  remoteDoc.init(mockScene, "ws://test.local/doc");
  // Now mark root as connected - this fires connectedCallback on remoteDoc
  // which can now find its scene via getInitiatedRemoteDocument().
  root.setRootConnected(true);

  return { doc, root, remoteDoc, mockScene };
}

describe("Virtual-mode MML elements", () => {
  test("VirtualDocument creates registered element classes", () => {
    const doc = new VirtualDocument();
    registerCustomElementsToVirtualDocument(doc);

    const cube = doc.createElement("m-cube");
    expect(cube).toBeInstanceOf(Cube);
    expect(cube.nodeName).toBe("M-CUBE");
    expect(cube.tagName).toBe("M-CUBE");

    const label = doc.createElement("m-label");
    expect(label).toBeInstanceOf(Label);
    expect(label.nodeName).toBe("M-LABEL");

    const group = doc.createElement("m-group");
    expect(group).toBeInstanceOf(Group);
    expect(group.nodeName).toBe("M-GROUP");

    const sphere = doc.createElement("m-sphere");
    expect(sphere).toBeInstanceOf(Sphere);

    const plane = doc.createElement("m-plane");
    expect(plane).toBeInstanceOf(Plane);
  });

  test("createElement sets ownerDocument", () => {
    const doc = new VirtualDocument();
    registerCustomElementsToVirtualDocument(doc);

    const cube = doc.createElement("m-cube");
    expect(cube.ownerDocument).toBe(doc);
  });

  test("elements can be connected to tree and isConnected tracks correctly", () => {
    const { doc, remoteDoc } = createVirtualEnvironment();

    const cube = doc.createElement("m-cube");
    expect(cube.isConnected).toBe(false);

    remoteDoc.appendChild(cube);
    expect(cube.isConnected).toBe(true);

    remoteDoc.removeChild(cube);
    expect(cube.isConnected).toBe(false);
  });

  test("nested elements track isConnected through tree", () => {
    const { doc, remoteDoc } = createVirtualEnvironment();

    const group = doc.createElement("m-group");
    const cube = doc.createElement("m-cube");
    group.appendChild(cube);

    expect(group.isConnected).toBe(false);
    expect(cube.isConnected).toBe(false);

    remoteDoc.appendChild(group);
    expect(group.isConnected).toBe(true);
    expect(cube.isConnected).toBe(true);

    remoteDoc.removeChild(group);
    expect(group.isConnected).toBe(false);
    expect(cube.isConnected).toBe(false);
  });

  test("setAttribute stores and retrieves values", () => {
    const { doc } = createVirtualEnvironment();

    const cube = doc.createElement("m-cube");
    cube.setAttribute("width", "5");
    cube.setAttribute("height", "3");
    cube.setAttribute("color", "red");

    expect(cube.getAttribute("width")).toBe("5");
    expect(cube.getAttribute("height")).toBe("3");
    expect(cube.getAttribute("color")).toBe("red");
  });

  test("removeAttribute clears values", () => {
    const { doc } = createVirtualEnvironment();

    const cube = doc.createElement("m-cube");
    cube.setAttribute("width", "5");
    expect(cube.hasAttribute("width")).toBe(true);

    cube.removeAttribute("width");
    expect(cube.getAttribute("width")).toBeNull();
    expect(cube.hasAttribute("width")).toBe(false);
  });

  test("getAttributeNames returns all set attributes", () => {
    const { doc } = createVirtualEnvironment();

    const cube = doc.createElement("m-cube");
    cube.setAttribute("width", "5");
    cube.setAttribute("height", "3");
    cube.setAttribute("depth", "2");

    const names = cube.getAttributeNames();
    expect(names).toContain("width");
    expect(names).toContain("height");
    expect(names).toContain("depth");
    expect(names.length).toBe(3);
  });

  test("parent-child traversal with getMElementParent", () => {
    const { doc, remoteDoc } = createVirtualEnvironment();

    const group = doc.createElement("m-group") as Group;
    const cube = doc.createElement("m-cube") as Cube;

    remoteDoc.appendChild(group);
    group.appendChild(cube);

    // cube's MElement parent should be group
    expect(cube.getMElementParent()).toBe(group);
    // group's MElement parent should be the remote document
    expect(group.getMElementParent()).toBe(remoteDoc);
  });

  test("querySelectorAll finds elements by tag name in virtual tree", () => {
    const { doc, remoteDoc } = createVirtualEnvironment();

    const group = doc.createElement("m-group") as Group;
    const cube1 = doc.createElement("m-cube");
    const cube2 = doc.createElement("m-cube");
    const sphere = doc.createElement("m-sphere");

    remoteDoc.appendChild(group);
    group.appendChild(cube1);
    group.appendChild(cube2);
    group.appendChild(sphere);

    const cubes = group.querySelectorAll("m-cube");
    expect(cubes.length).toBe(2);

    const spheres = group.querySelectorAll("m-sphere");
    expect(spheres.length).toBe(1);
  });

  test("querySelectorAll searches nested children", () => {
    const { doc, remoteDoc } = createVirtualEnvironment();

    const outer = doc.createElement("m-group") as Group;
    const inner = doc.createElement("m-group") as Group;
    const cube = doc.createElement("m-cube");

    remoteDoc.appendChild(outer);
    outer.appendChild(inner);
    inner.appendChild(cube);

    const results = outer.querySelectorAll("m-cube");
    expect(results.length).toBe(1);
    expect(results[0]).toBe(cube);
  });

  test("children getter returns only VirtualHTMLElement children", () => {
    const { doc, remoteDoc } = createVirtualEnvironment();

    const group = doc.createElement("m-group") as Group;
    remoteDoc.appendChild(group);

    const cube = doc.createElement("m-cube");
    const textNode = doc.createTextNode("hello");

    group.appendChild(cube);
    group.appendChild(textNode);

    // childNodes includes both
    expect(group.childNodes.length).toBe(2);
    // children should only include element nodes
    expect(group.children.length).toBe(1);
    expect(group.children[0]).toBe(cube);
  });

  test("style property works as property bag", () => {
    const { doc } = createVirtualEnvironment();

    const group = doc.createElement("m-group");
    group.style.display = "none";
    expect(group.style.display).toBe("none");

    group.style.position = "absolute";
    expect(group.style.position).toBe("absolute");
  });

  test("innerHTML = '' clears children", () => {
    const { doc, remoteDoc } = createVirtualEnvironment();

    const group = doc.createElement("m-group") as Group;
    remoteDoc.appendChild(group);

    group.appendChild(doc.createElement("m-cube"));
    group.appendChild(doc.createElement("m-sphere"));
    expect(group.childNodes.length).toBe(2);

    group.innerHTML = "";
    expect(group.childNodes.length).toBe(0);
  });

  test("RemoteDocument provides scene to child elements", () => {
    const { doc, remoteDoc, mockScene } = createVirtualEnvironment();

    const cube = doc.createElement("m-cube") as Cube;
    remoteDoc.appendChild(cube);

    // getScene traverses up to find the RemoteDocument
    expect(cube.getScene()).toBe(mockScene);
  });

  test("getInitiatedRemoteDocument finds parent RemoteDocument", () => {
    const { doc, remoteDoc } = createVirtualEnvironment();

    const group = doc.createElement("m-group") as Group;
    const cube = doc.createElement("m-cube") as Cube;
    remoteDoc.appendChild(group);
    group.appendChild(cube);

    expect(cube.getInitiatedRemoteDocument()).toBe(remoteDoc);
    expect(group.getInitiatedRemoteDocument()).toBe(remoteDoc);
  });

  test("RemoteDocument.getDocumentAddress returns the address", () => {
    const { remoteDoc } = createVirtualEnvironment();
    expect(remoteDoc.getDocumentAddress()).toBe("ws://test.local/doc");
  });

  test("RemoteDocument.getDocumentTimeManager returns time manager", () => {
    const { remoteDoc } = createVirtualEnvironment();
    const timeManager = remoteDoc.getDocumentTimeManager();
    expect(timeManager).toBeDefined();
    expect(typeof timeManager.setDocumentTime).toBe("function");
  });

  test("isMElement static check works for virtual elements", () => {
    const { doc } = createVirtualEnvironment();

    const cube = doc.createElement("m-cube");
    expect(MElement.isMElement(cube)).toBe(true);

    const div = doc.createElement("div");
    expect(MElement.isMElement(div)).toBeFalsy();
  });

  test("event dispatch works on virtual elements", () => {
    const { doc, remoteDoc } = createVirtualEnvironment();

    const cube = doc.createElement("m-cube") as Cube;
    remoteDoc.appendChild(cube);

    const received: string[] = [];
    cube.addEventListener("custom-test", () => {
      received.push("handled");
    });

    cube.dispatchEvent({ type: "custom-test", bubbles: false } as any);
    expect(received).toEqual(["handled"]);
  });

  test("multiple elements can coexist in virtual tree", () => {
    const { doc, remoteDoc } = createVirtualEnvironment();

    const group = doc.createElement("m-group") as Group;
    const cube = doc.createElement("m-cube") as Cube;
    const sphere = doc.createElement("m-sphere") as Sphere;
    const label = doc.createElement("m-label") as Label;
    const plane = doc.createElement("m-plane") as Plane;
    const overlay = doc.createElement("m-overlay") as Overlay;

    remoteDoc.appendChild(group);
    group.appendChild(cube);
    group.appendChild(sphere);
    group.appendChild(label);
    group.appendChild(plane);
    group.appendChild(overlay);

    expect(group.childNodes.length).toBe(5);
    expect(group.children.length).toBe(5);
    expect(group.childNodes[0]).toBe(cube);
    expect(group.childNodes[1]).toBe(sphere);
    expect(group.childNodes[2]).toBe(label);
    expect(group.childNodes[3]).toBe(plane);
    expect(group.childNodes[4]).toBe(overlay);
  });

  test("tree restructuring works: move element between parents", () => {
    const { doc, remoteDoc } = createVirtualEnvironment();

    const group1 = doc.createElement("m-group") as Group;
    const group2 = doc.createElement("m-group") as Group;
    const cube = doc.createElement("m-cube") as Cube;

    remoteDoc.appendChild(group1);
    remoteDoc.appendChild(group2);
    group1.appendChild(cube);

    expect(group1.childNodes.length).toBe(1);
    expect(group2.childNodes.length).toBe(0);
    expect(cube.parentNode).toBe(group1);

    // Move cube from group1 to group2
    group2.appendChild(cube);
    expect(group1.childNodes.length).toBe(0);
    expect(group2.childNodes.length).toBe(1);
    expect(cube.parentNode).toBe(group2);
    expect(cube.isConnected).toBe(true);
  });

  test("nextSibling and previousSibling work for MML elements", () => {
    const { doc, remoteDoc } = createVirtualEnvironment();

    const cube = doc.createElement("m-cube");
    const sphere = doc.createElement("m-sphere");
    const label = doc.createElement("m-label");

    remoteDoc.appendChild(cube);
    remoteDoc.appendChild(sphere);
    remoteDoc.appendChild(label);

    expect(cube.nextSibling).toBe(sphere);
    expect(sphere.nextSibling).toBe(label);
    expect(label.nextSibling).toBeNull();

    expect(cube.previousSibling).toBeNull();
    expect(sphere.previousSibling).toBe(cube);
    expect(label.previousSibling).toBe(sphere);
  });

  test("observedAttributes is defined on element classes", () => {
    expect(Array.isArray(Cube.observedAttributes)).toBe(true);
    expect(Cube.observedAttributes.length).toBeGreaterThan(0);
    expect(Cube.observedAttributes).toContain("width");
    expect(Cube.observedAttributes).toContain("height");
    expect(Cube.observedAttributes).toContain("depth");
    expect(Cube.observedAttributes).toContain("color");

    expect(Array.isArray(Label.observedAttributes)).toBe(true);
    expect(Label.observedAttributes).toContain("content");

    expect(Array.isArray(Group.observedAttributes)).toBe(true);
  });

  test("contentSrcToContentAddress resolves URLs via RemoteDocument", () => {
    const { doc, remoteDoc } = createVirtualEnvironment();

    const cube = doc.createElement("m-cube") as Cube;
    remoteDoc.appendChild(cube);

    // Absolute URL should pass through
    expect(cube.contentSrcToContentAddress("https://example.com/model.glb")).toBe(
      "https://example.com/model.glb",
    );

    // Host-relative path should resolve against document address
    expect(cube.contentSrcToContentAddress("/assets/model.glb")).toBe(
      "http://test.local/assets/model.glb",
    );

    // Relative path should resolve against document address
    expect(cube.contentSrcToContentAddress("model.glb")).toBe("http://test.local/model.glb");
  });
});
