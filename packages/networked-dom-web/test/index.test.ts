import { DOMSanitizer } from "../src";

describe("DOMSanitizer", () => {
  test("should sanitise simple 'on' attribute names", () => {
    const el = document.createElement("div");
    el.innerHTML = `<image onerror=alert(document.location)>`;
    expect(el.innerHTML).toEqual(`<img onerror="alert(document.location)">`);
    const sanitised = DOMSanitizer.sanitise(el);
    expect(sanitised.innerHTML).toEqual(`<img>`);
  });

  test("should sanitise obfuscated 'on' attribute names", () => {
    const el = document.createElement("div");
    el.innerHTML = `<image/src/onerror=alert(document.location)>`;
    expect(el.innerHTML).toEqual(`<img src="" onerror="alert(document.location)">`);
    const sanitised = DOMSanitizer.sanitise(el);
    expect(sanitised.innerHTML).toEqual(`<img src="">`);
  });

  test("should sanitise scripts", () => {
    const el = document.createElement("div");
    el.innerHTML = `<div>Foo</div><script>console.log('Bar');</script><span>Baz</span>`;
    expect(el.innerHTML).toEqual(
      `<div>Foo</div><script>console.log('Bar');</script><span>Baz</span>`,
    );
    const sanitised = DOMSanitizer.sanitise(el);
    expect(sanitised.innerHTML).toEqual(`<div>Foo</div><script></script><span>Baz</span>`);
  });

  test("should sanitise iframes", () => {
    const el = document.createElement("div");
    el.innerHTML = `<div>Foo</div><iframe srcdoc="<script>console.log('Bar');</script>"></iframe><span>Baz</span>`;
    expect(el.innerHTML).toEqual(
      `<div>Foo</div><iframe srcdoc="<script>console.log('Bar');</script>"></iframe><span>Baz</span>`,
    );
    const sanitised = DOMSanitizer.sanitise(el);
    expect(sanitised.innerHTML).toEqual(`<div>Foo</div><iframe></iframe><span>Baz</span>`);
  });

  test("should sanitise objects", () => {
    const el = document.createElement("div");
    el.innerHTML = `<div>Foo</div><object src="http://example.com"></object><span>Baz</span>`;
    expect(el.innerHTML).toEqual(
      `<div>Foo</div><object src="http://example.com"></object><span>Baz</span>`,
    );
    const sanitised = DOMSanitizer.sanitise(el);
    expect(sanitised.innerHTML).toEqual(`<div>Foo</div><object></object><span>Baz</span>`);
  });

  test("should sanitise objects", () => {
    const el = document.createElement("div");
    el.innerHTML = `<div>Foo</div><object></object><span>Baz</span>`;
    expect(el.innerHTML).toEqual(`<div>Foo</div><object></object><span>Baz</span>`);
    const sanitised = DOMSanitizer.sanitise(el);
    expect(sanitised.innerHTML).toEqual(`<div>Foo</div><object></object><span>Baz</span>`);
  });

  test("should sanitise applets", () => {
    const el = document.createElement("div");
    el.innerHTML = `<div>Foo</div><applet></applet><span>Baz</span>`;
    expect(el.innerHTML).toEqual(`<div>Foo</div><applet></applet><span>Baz</span>`);
    const sanitised = DOMSanitizer.sanitise(el);
    expect(sanitised.innerHTML).toEqual(`<div>Foo</div><applet></applet><span>Baz</span>`);
  });

  test("should strip invalid attribute names", () => {
    const el = document.createElement("div");
    el.innerHTML = `<div 123-foo="bar" baz="qux"></div>`;
    expect(el.innerHTML).toEqual(`<div 123-foo="bar" baz="qux"></div>`);
    const sanitised = DOMSanitizer.sanitise(el);
    expect(sanitised.innerHTML).toEqual(`<div baz="qux"></div>`);
  });

  test("should replace tags if a prefix is provided", () => {
    const el = document.createElement("div");
    el.innerHTML = `<div t="div" b="1"><m-foo t="foo" b="2"><span t="span" b="3"><m-bar></m-bar></span></m-foo></div>`;
    expect(el.innerHTML).toEqual(
      `<div t="div" b="1"><m-foo t="foo" b="2"><span t="span" b="3"><m-bar></m-bar></span></m-foo></div>`,
    );
    const sanitised = DOMSanitizer.sanitise(el, {
      tagPrefix: "m-",
      replacementTagPrefix: "x-",
    });
    expect(sanitised.innerHTML).toEqual(
      `<x-div b="1" t="div"><m-foo t="foo" b="2"><x-span b="3" t="span"><m-bar></m-bar></x-span></m-foo></x-div>`,
    );
  });
});
