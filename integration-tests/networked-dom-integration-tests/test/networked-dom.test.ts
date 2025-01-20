import { formatHTML } from "./test-util";
import { TestCaseNetworkedDOMDocument } from "./TestCaseNetworkedDOMDocument";

describe.each([{ version: 0.1 }, { version: 0.2 }])(
  `EditableNetworkedDOM <> NetworkedDOMWebsocket - $version`,
  ({ version }) => {
    const isV01 = version === 0.1;

    test("simple change on reload", async () => {
      const testCase = new TestCaseNetworkedDOMDocument();
      const client1 = testCase.createClient(isV01);
      await client1.onConnectionOpened();

      testCase.doc.load(`<m-cube></m-cube>`);

      const expected1 = formatHTML(`<html>
  <head>
  </head>
  <body>
    <m-cube></m-cube>
  </body>
</html>`);
      await client1.waitForAllClientMessages(isV01 ? 1 : 1);
      expect(client1.getFormattedHTML()).toEqual(formatHTML(`<div>${expected1}</div>`));
      expect(testCase.getFormattedAndFilteredHTML()).toEqual(expected1);

      // Reload the document with changes
      testCase.doc.load('<m-cube color="red"></m-cube>');

      const expected2 = formatHTML(`<html>
  <head>
  </head>
  <body>
    <m-cube color="red"></m-cube>
  </body>
</html>`);
      await client1.waitForAllClientMessages(isV01 ? 3 : 3);
      expect(client1.getFormattedHTML()).toEqual(formatHTML(`<div>${expected2}</div>`));
      expect(testCase.getFormattedAndFilteredHTML()).toEqual(expected2);
    });

    test("multiple element additions", async () => {
      const testCase = new TestCaseNetworkedDOMDocument();
      const client1 = testCase.createClient(isV01);
      await client1.onConnectionOpened();

      testCase.doc.load(`<m-cube color="red" z="2" id="c1">
  <m-cube color="green" x="2" id="c2">
  </m-cube>
</m-cube>
<script>
  const c1 = document.getElementById("c1");
  const c2 = document.getElementById("c2");
  setTimeout(() => {
    document.body.appendChild(c1);
    document.body.appendChild(c2);
    c1.appendChild(c2);
  }, 1);
</script>`);

      const expected = formatHTML(`<html>
  <head>
  </head>
  <body>
    <m-cube color="red" z="2" id="c1">
      <m-cube color="green" x="2" id="c2">
      </m-cube>
    </m-cube>
  </body>
</html>`);
      await client1.waitForAllClientMessages(isV01 ? 5 : 2);
      expect(client1.getFormattedHTML()).toEqual(formatHTML(`<div>${expected}</div>`));
      expect(testCase.getFormattedAndFilteredHTML()).toEqual(expected);
    });

    test("multiple element additions after removal", async () => {
      const testCase = new TestCaseNetworkedDOMDocument();
      const client1 = testCase.createClient(isV01);
      await client1.onConnectionOpened();

      testCase.doc.load(`
<m-cube color="red" z="2" id="c1">
  <m-cube color="green" x="2" id="c2">
  </m-cube>
</m-cube>

<script>
  const c1 = document.getElementById("c1");
  const c2 = document.getElementById("c2");
  setTimeout(() => {
    c2.remove();
    document.body.appendChild(c1);
    document.body.appendChild(c2);
    c1.appendChild(c2);
  }, 1);
</script>`);

      const expected = formatHTML(`<html>
  <head>
  </head>
  <body>
    <m-cube color="red" z="2" id="c1">
      <m-cube color="green" x="2" id="c2">
      </m-cube>
    </m-cube>
  </body>
</html>`);
      await client1.waitForAllClientMessages(isV01 ? 4 : 2);
      expect(client1.getFormattedHTML()).toEqual(formatHTML(`<div>${expected}</div>`));
      expect(testCase.getFormattedAndFilteredHTML()).toEqual(expected);
    });

    test("visible-to", async () => {
      const testCase = new TestCaseNetworkedDOMDocument();
      const client1 = testCase.createClient(isV01);
      await client1.onConnectionOpened();
      const client2 = testCase.createClient(isV01);
      await client2.onConnectionOpened();

      testCase.doc.load(`
<m-cube color="red" z="2" id="c1">
  <m-cube visible-to="1" color="green" x="2" id="c2">
  </m-cube>
</m-cube>

<script>
  const c1 = document.getElementById("c1");
  const c2 = document.getElementById("c2");
  c1.addEventListener("click", () => {
    c2.setAttribute("visible-to", "2");
  }, 1);
</script>`);

      await client1.waitForAllClientMessages(isV01 ? 1 : 1);
      await client2.waitForAllClientMessages(isV01 ? 1 : 1);

      expect(client1.getFormattedHTML()).toEqual(
        formatHTML(`<div><html>
  <head>
  </head>
  <body>
    <m-cube color="red" z="2" id="c1">
      <m-cube color="green" x="2" id="c2"></m-cube>
    </m-cube>
  </body>
</html></div>`),
      );
      expect(client2.getFormattedHTML()).toEqual(
        formatHTML(`<div><html>
  <head>
  </head>
  <body>
    <m-cube color="red" z="2" id="c1">
    </m-cube>
  </body>
</html></div>`),
      );
      expect(testCase.getFormattedAndFilteredHTML()).toEqual(
        formatHTML(`<html>
  <head>
  </head>
  <body>
    <m-cube color="red" z="2" id="c1">
      <m-cube visible-to="1" color="green" x="2" id="c2">
      </m-cube>
    </m-cube>
  </body>
</html>`),
      );

      client1.networkedDOMWebsocket.handleEvent(
        client1.clientElement.querySelector("#c1")!,
        new CustomEvent("click"),
      );

      await client1.waitForAllClientMessages(isV01 ? 2 : 2);
      await client2.waitForAllClientMessages(isV01 ? 2 : 2);
      expect(client1.getFormattedHTML()).toEqual(
        formatHTML(`<div><html>
  <head>
  </head>
  <body>
    <m-cube color="red" z="2" id="c1"></m-cube>
  </body>
</html></div>`),
      );
      expect(client2.getFormattedHTML()).toEqual(
        formatHTML(`<div><html>
  <head>
  </head>
  <body>
    <m-cube color="red" z="2" id="c1">
      <m-cube color="green" x="2" id="c2">
      </m-cube>
    </m-cube>
  </body>
</html></div>`),
      );
      expect(testCase.getFormattedAndFilteredHTML()).toEqual(
        formatHTML(`<html>
  <head>
  </head>
  <body>
    <m-cube color="red" z="2" id="c1">
      <m-cube visible-to="2" color="green" x="2" id="c2">
      </m-cube>
    </m-cube>
  </body>
</html>`),
      );
    });

    test("hidden-from", async () => {
      const testCase = new TestCaseNetworkedDOMDocument();
      const client1 = testCase.createClient(isV01);
      const client2 = testCase.createClient(isV01);
      await client1.onConnectionOpened();
      await client2.onConnectionOpened();

      testCase.doc.load(`
<m-cube color="red" z="2" id="c1">
  <m-cube hidden-from="2" color="green" x="2" id="c2">
    <m-cube color="purple" y="3" id="c3"></m-cube>
  </m-cube>
</m-cube>

<script>
  const c1 = document.getElementById("c1");
  const c2 = document.getElementById("c2");
  let clickCount = 0;
  c1.addEventListener("click", () => {
    if (clickCount === 0) {
      c2.setAttribute("color", "orange");
    } else {
      c2.setAttribute("hidden-from", "1");
    }
    clickCount++;
  }, 1);
</script>`);

      await client1.waitForAllClientMessages(isV01 ? 1 : 1);
      await client2.waitForAllClientMessages(isV01 ? 1 : 1);

      expect(client1.getFormattedHTML()).toEqual(
        formatHTML(`<div><html>
  <head>
  </head>
  <body>
    <m-cube color="red" z="2" id="c1">
      <m-cube color="green" x="2" id="c2">
        <m-cube color="purple" y="3" id="c3"></m-cube>
      </m-cube>
    </m-cube>
  </body>
</html></div>`),
      );
      expect(client2.getFormattedHTML()).toEqual(
        formatHTML(
          isV01
            ? `<div><html>
  <head>
  </head>
  <body>
    <m-cube color="red" z="2" id="c1">
    </m-cube>
  </body>
</html></div>`
            : `<div><html>
  <head>
  </head>
  <body>
    <m-cube color="red" z="2" id="c1">
    <x-hidden></x-hidden>
    </m-cube>
  </body>
</html></div>`,
        ),
      );
      expect(testCase.getFormattedAndFilteredHTML()).toEqual(
        formatHTML(`<html>
  <head>
  </head>
  <body>
    <m-cube color="red" z="2" id="c1">
      <m-cube hidden-from="2" color="green" x="2" id="c2">
        <m-cube color="purple" y="3" id="c3"></m-cube>
      </m-cube>
    </m-cube>
  </body>
</html>`),
      );

      client1.networkedDOMWebsocket.handleEvent(
        client1.clientElement.querySelector("#c1")!,
        new CustomEvent("click"),
      );

      await client1.waitForAllClientMessages(isV01 ? 2 : 2);
      await client2.waitForAllClientMessages(isV01 ? 1 : 2);
      expect(client1.getFormattedHTML()).toEqual(
        formatHTML(
          isV01
            ? `<div>
  <html>
    <head>
    </head>
    <body>
      <m-cube color="red" z="2" id="c1">
        <m-cube color="orange" x="2" id="c2">
          <m-cube color="purple" y="3" id="c3">
          </m-cube>
        </m-cube>
      </m-cube>
    </body>
  </html>
</div>`
            : `<div>
  <html>
    <head>
    </head>
    <body>
      <m-cube color="red" z="2" id="c1">
        <m-cube color="orange" x="2" id="c2">
          <m-cube color="purple" y="3" id="c3">
          </m-cube>
        </m-cube>
      </m-cube>
    </body>
  </html>
</div>`,
        ),
      );
      expect(client2.getFormattedHTML()).toEqual(
        formatHTML(
          isV01
            ? `<div><html>
  <head>
  </head>
  <body>
    <m-cube color="red" z="2" id="c1">
    </m-cube>
  </body>
</html></div>`
            : `<div><html>
  <head>
  </head>
  <body>
    <m-cube color="red" z="2" id="c1">
      <x-hidden></x-hidden>
    </m-cube>
  </body>
</html></div>`,
        ),
      );
      expect(testCase.getFormattedAndFilteredHTML()).toEqual(
        formatHTML(`<html>
  <head>
  </head>
  <body>
    <m-cube color="red" z="2" id="c1">
      <m-cube hidden-from="2" color="orange" x="2" id="c2">
        <m-cube color="purple" y="3" id="c3">
        </m-cube>
      </m-cube>
    </m-cube>
  </body>
</html>`),
      );

      client1.networkedDOMWebsocket.handleEvent(
        client1.clientElement.querySelector("#c1")!,
        new CustomEvent("click"),
      );

      await client1.waitForAllClientMessages(isV01 ? 3 : 3);
      await client2.waitForAllClientMessages(isV01 ? 2 : 3);
      expect(client1.getFormattedHTML()).toEqual(
        formatHTML(
          isV01
            ? `<div><html>
  <head>
  </head>
  <body>
    <m-cube color="red" z="2" id="c1"></m-cube>
  </body>
</html></div>`
            : `<div><html>
  <head>
  </head>
  <body>
    <m-cube color="red" z="2" id="c1">
      <x-hidden></x-hidden>
    </m-cube>
  </body>
</html></div>`,
        ),
      );
      expect(client2.getFormattedHTML()).toEqual(
        formatHTML(`<div>
  <html>
    <head>
    </head>
    <body>
      <m-cube color="red" z="2" id="c1">
        <m-cube color="orange" x="2" id="c2">
          <m-cube color="purple" y="3" id="c3">
          </m-cube>
        </m-cube>
      </m-cube>
    </body>
  </html>
</div>`),
      );
      expect(testCase.getFormattedAndFilteredHTML()).toEqual(
        formatHTML(`<html>
  <head>
  </head>
  <body>
    <m-cube color="red" z="2" id="c1">
      <m-cube hidden-from="1" color="orange" x="2" id="c2">
        <m-cube color="purple" y="3" id="c3">
        </m-cube>
      </m-cube>
    </m-cube>
  </body>
</html>`),
      );
    });

    test("element addition ordering", async () => {
      const testCase = new TestCaseNetworkedDOMDocument();
      const client1 = testCase.createClient(isV01);
      await client1.onConnectionOpened();

      testCase.doc.load(`
<script>
setTimeout(() => {
  const c1 = document.createElement("m-cube");
  c1.setAttribute("x", "1");
  const c2 = document.createElement("m-cube");
  c2.setAttribute("y", "1");
  document.body.appendChild(c1);
  c1.appendChild(c2);
  c2.setAttribute("y", "2");
}, 1);
</script>`);

      const expected = formatHTML(`<html>
  <head>
  </head>
  <body>
    <m-cube x="1">
      <m-cube y="2">
      </m-cube>
    </m-cube>
  </body>
</html>`);
      await client1.waitForAllClientMessages(isV01 ? 2 : 2);
      expect(client1.getFormattedHTML()).toEqual(formatHTML(`<div>${expected}</div>`));
      expect(testCase.getFormattedAndFilteredHTML()).toEqual(expected);
    });

    test("child addition", async () => {
      const testCase = new TestCaseNetworkedDOMDocument();
      const client1 = testCase.createClient(isV01);
      await client1.onConnectionOpened();

      testCase.doc.load(`
<script>
setTimeout(() => {
  const c1 = document.createElement("m-cube");
  c1.setAttribute("x", "1");
  const c2 = document.createElement("m-cube");
  c2.setAttribute("y", "1");
  document.body.appendChild(c1);
  c1.appendChild(c2);
  c2.setAttribute("y", "2");
}, 1);
</script>`);

      const expected = formatHTML(`<html>
  <head>
  </head>
  <body>
    <m-cube x="1">
      <m-cube y="2">
      </m-cube>
    </m-cube>
  </body>
</html>`);
      await client1.waitForAllClientMessages(isV01 ? 2 : 2);
      expect(client1.getFormattedHTML()).toEqual(formatHTML(`<div>${expected}</div>`));
      expect(testCase.getFormattedAndFilteredHTML()).toEqual(expected);
    });

    test("element insertion ordering", async () => {
      const testCase = new TestCaseNetworkedDOMDocument();
      const client1 = testCase.createClient(isV01);
      await client1.onConnectionOpened();

      testCase.doc.load(`
<m-cube color="red" z="2" id="c1">
  <m-cube color="green" x="2" id="c2"></m-cube>
  <m-cube color="orange" x="4" id="c3"></m-cube>
  <m-cube color="pink" x="6" id="c4"></m-cube>
  <m-cube color="purple" x="8" id="c5"></m-cube>
</m-cube>

<m-cube color="black" z="-2" id="t1">
</m-cube>

<script>
  const c1 = document.getElementById("c1");
  const c2 = document.getElementById("c2");
  const c3 = document.getElementById("c3");
  const c4 = document.getElementById("c4");
  const c5 = document.getElementById("c5");
  const t1 = document.getElementById("t1");
  setTimeout(() => {
    t1.appendChild(c3);
    t1.appendChild(c5);
    t1.insertBefore(c4, c3);
  }, 1);
</script>`);

      const expected = formatHTML(`<html>
  <head>
  </head>
  <body>
    <m-cube color="red" z="2" id="c1">
      <m-cube color="green" x="2" id="c2">
      </m-cube>
    </m-cube>
    <m-cube color="black" z="-2" id="t1">
      <m-cube color="pink" x="6" id="c4">
      </m-cube>
      <m-cube color="orange" x="4" id="c3">
      </m-cube>
      <m-cube color="purple" x="8" id="c5">
      </m-cube>
    </m-cube>
  </body>
</html>`);
      await client1.waitForAllClientMessages(isV01 ? 7 : 2);
      expect(client1.getFormattedHTML()).toEqual(formatHTML(`<div>${expected}</div>`));
      expect(testCase.getFormattedAndFilteredHTML()).toEqual(expected);
    });

    test("multiple element creations with removal of previous sibling", async () => {
      const testCase = new TestCaseNetworkedDOMDocument();
      const client1 = testCase.createClient(isV01);
      await client1.onConnectionOpened();

      testCase.doc.load(`
<m-group id="holder">
</m-group>

<script>
  const holder = document.getElementById("holder");
  const c0 = document.createElement("m-cube");
  c0.setAttribute("color", "black");
  c0.setAttribute("z", "1");
  const c1 = document.createElement("m-cube");
  c1.setAttribute("color", "red");
  c1.setAttribute("z", "2");
  const c2 = document.createElement("m-cube");
  c2.setAttribute("color", "green");
  c2.setAttribute("x", "2");
  const c3 = document.createElement("m-cube");
  c3.setAttribute("color", "blue");
  c3.setAttribute("y", "2");
  setTimeout(() => {
    holder.appendChild(c0);
    holder.appendChild(c1);
    holder.appendChild(c2);
    holder.insertBefore(c3, c2);
    c1.remove();
  }, 1);
</script>`);

      const expected = formatHTML(`<html>
    <head>
    </head>
    <body>
      <m-group id="holder">
        <m-cube color="black" z="1">
        </m-cube>
        <m-cube color="blue" y="2">
        </m-cube>
        <m-cube color="green" x="2">
        </m-cube>
      </m-group>
    </body>
  </html>`);
      await client1.waitForAllClientMessages(isV01 ? 3 : 2);
      expect(testCase.getFormattedAndFilteredHTML()).toEqual(expected);
      expect(client1.getFormattedHTML()).toEqual(formatHTML(`<div>${expected}</div>`));
    });

    test("add child to node with existing children", async () => {
      const testCase = new TestCaseNetworkedDOMDocument();
      const client1 = testCase.createClient(isV01);
      await client1.onConnectionOpened();

      testCase.doc.load(`<m-model></m-model>`);

      const expected1 = formatHTML(`<html>
  <head>
  </head>
  <body>
    <m-model></m-model>
  </body>
</html>`);
      await client1.waitForAllClientMessages(isV01 ? 1 : 1);
      expect(client1.getFormattedHTML()).toEqual(formatHTML(`<div>${expected1}</div>`));
      expect(testCase.getFormattedAndFilteredHTML()).toEqual(expected1);

      // Reload the document with changes
      testCase.doc.load("<m-cube></m-cube><m-model></m-model>");

      const expected2 = formatHTML(`<html>
  <head>
  </head>
  <body>
    <m-cube></m-cube>
    <m-model></m-model>
  </body>
</html>`);
      await client1.waitForAllClientMessages(isV01 ? 5 : 5);
      expect(client1.getFormattedHTML()).toEqual(formatHTML(`<div>${expected2}</div>`));
      expect(testCase.getFormattedAndFilteredHTML()).toEqual(expected2);
    });
  },
);
