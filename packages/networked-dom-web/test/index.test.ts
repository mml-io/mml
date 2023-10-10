import { DOMSanitizer } from "../src";

describe("DOMSanitizer", () => {
  test("should sanitise simple 'on' attribute names", () => {
    const el = document.createElement("div");
    el.innerHTML = `<image onerror=alert(document.location)>`;
    expect(el.innerHTML).toEqual(`<img onerror="alert(document.location)">`);
    DOMSanitizer.sanitise(el);
    expect(el.innerHTML).toEqual(`<img>`);
  });

  test("should sanitise obfuscated 'on' attribute names", () => {
    const el = document.createElement("div");
    el.innerHTML = `<image/src/onerror=alert(document.location)>`;
    expect(el.innerHTML).toEqual(`<img src="" onerror="alert(document.location)">`);
    DOMSanitizer.sanitise(el);
    expect(el.innerHTML).toEqual(`<img src="">`);
  });

  test("should sanitise scripts", () => {
    const el = document.createElement("div");
    el.innerHTML = `<div>Foo</div><script>console.log('Bar');</script><span>Baz</span>`;
    expect(el.innerHTML).toEqual(
      `<div>Foo</div><script>console.log('Bar');</script><span>Baz</span>`,
    );
    DOMSanitizer.sanitise(el);
    expect(el.innerHTML).toEqual(`<div>Foo</div><script></script><span>Baz</span>`);
  });

  test("should sanitise iframes", () => {
    const el = document.createElement("div");
    el.innerHTML = `<div>Foo</div><iframe srcdoc="<script>console.log('Bar');</script>"></iframe><span>Baz</span>`;
    expect(el.innerHTML).toEqual(
      `<div>Foo</div><iframe srcdoc="<script>console.log('Bar');</script>"></iframe><span>Baz</span>`,
    );
    DOMSanitizer.sanitise(el);
    expect(el.innerHTML).toEqual(`<div>Foo</div><iframe></iframe><span>Baz</span>`);
  });

  test("should sanitise objects", () => {
    const el = document.createElement("div");
    el.innerHTML = `<div>Foo</div><object src="http://example.com"></object><span>Baz</span>`;
    expect(el.innerHTML).toEqual(
      `<div>Foo</div><object src="http://example.com"></object><span>Baz</span>`,
    );
    DOMSanitizer.sanitise(el);
    expect(el.innerHTML).toEqual(`<div>Foo</div><object></object><span>Baz</span>`);
  });

  test("should sanitise objects", () => {
    const el = document.createElement("div");
    el.innerHTML = `<div>Foo</div><object></object><span>Baz</span>`;
    expect(el.innerHTML).toEqual(`<div>Foo</div><object></object><span>Baz</span>`);
    DOMSanitizer.sanitise(el);
    expect(el.innerHTML).toEqual(`<div>Foo</div><object></object><span>Baz</span>`);
  });

  test("should sanitise applets", () => {
    const el = document.createElement("div");
    el.innerHTML = `<div>Foo</div><applet></applet><span>Baz</span>`;
    expect(el.innerHTML).toEqual(`<div>Foo</div><applet></applet><span>Baz</span>`);
    DOMSanitizer.sanitise(el);
    expect(el.innerHTML).toEqual(`<div>Foo</div><applet></applet><span>Baz</span>`);
  });

  test("should strip invalid attribute names", () => {
    const el = document.createElement("div");
    el.innerHTML = `<div 123-foo="bar" baz="qux"></div>`;
    expect(el.innerHTML).toEqual(`<div 123-foo="bar" baz="qux"></div>`);
    DOMSanitizer.sanitise(el);
    expect(el.innerHTML).toEqual(`<div baz="qux"></div>`);
  });
});
