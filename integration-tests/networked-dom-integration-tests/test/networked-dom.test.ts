import { formatHTML } from "./test-util";
import { TestCaseNetworkedDOMDocument } from "./TestCaseNetworkedDOMDocument";

describe("EditableNetworkedDOM <> NetworkedDOMWebsocket", () => {
  test("simple change on reload", async () => {
    const testCase = new TestCaseNetworkedDOMDocument();
    const client1 = testCase.createClient();

    testCase.doc.load(`<m-cube></m-cube>`);

    const expected1 = formatHTML(`<html>
  <head>
  </head>
  <body>
    <m-cube></m-cube>
  </body>
</html>`);
    await client1.waitForAllClientMessages(1);
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
    await client1.waitForAllClientMessages(2);
    expect(client1.getFormattedHTML()).toEqual(formatHTML(`<div>${expected2}</div>`));
    expect(testCase.getFormattedAndFilteredHTML()).toEqual(expected2);
  });

  test("multiple element additions", async () => {
    const testCase = new TestCaseNetworkedDOMDocument();
    const client1 = testCase.createClient();

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
    await client1.waitForAllClientMessages(5);
    expect(client1.getFormattedHTML()).toEqual(formatHTML(`<div>${expected}</div>`));
    expect(testCase.getFormattedAndFilteredHTML()).toEqual(expected);
  });

  test("multiple element additions after removal", async () => {
    const testCase = new TestCaseNetworkedDOMDocument();
    const client1 = testCase.createClient();

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
    await client1.waitForAllClientMessages(4);
    expect(client1.getFormattedHTML()).toEqual(formatHTML(`<div>${expected}</div>`));
    expect(testCase.getFormattedAndFilteredHTML()).toEqual(expected);
  });

  test("element addition ordering", async () => {
    const testCase = new TestCaseNetworkedDOMDocument();
    const client1 = testCase.createClient();

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
    await client1.waitForAllClientMessages(3);
    expect(client1.getFormattedHTML()).toEqual(formatHTML(`<div>${expected}</div>`));
    expect(testCase.getFormattedAndFilteredHTML()).toEqual(expected);
  });

  test("child addition", async () => {
    const testCase = new TestCaseNetworkedDOMDocument();
    const client1 = testCase.createClient();

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
    await client1.waitForAllClientMessages(3);
    expect(client1.getFormattedHTML()).toEqual(formatHTML(`<div>${expected}</div>`));
    expect(testCase.getFormattedAndFilteredHTML()).toEqual(expected);
  });

  test("element insertion ordering", async () => {
    const testCase = new TestCaseNetworkedDOMDocument();
    const client1 = testCase.createClient();

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
    await client1.waitForAllClientMessages(7);
    expect(client1.getFormattedHTML()).toEqual(formatHTML(`<div>${expected}</div>`));
    expect(testCase.getFormattedAndFilteredHTML()).toEqual(expected);
  });

  test("multiple element creations with removal of previous sibling", async () => {
    const testCase = new TestCaseNetworkedDOMDocument();
    const client1 = testCase.createClient();

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
    await client1.waitForAllClientMessages(4);
    expect(testCase.getFormattedAndFilteredHTML()).toEqual(expected);
    expect(client1.getFormattedHTML()).toEqual(formatHTML(`<div>${expected}</div>`));
  });
});
