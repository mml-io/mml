import { afterEach } from "vitest";

import { formatHTML } from "./test-util";
import { TestCaseNetworkedDOMDocument } from "./TestCaseNetworkedDOMDocument";

describe.each([{ version: 0.1 }, { version: 0.2 }])(
  `EditableNetworkedDOM <> NetworkedDOMWebsocket - $version`,
  ({ version }) => {
    const isV01 = version === 0.1;

    afterEach(() => {
      // Clean up DOM to prevent ID collisions between tests
      document.body.innerHTML = "";
    });

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
      await client1.waitForAllClientMessages(isV01 ? 5 : 7);
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
      await client1.waitForAllClientMessages(isV01 ? 4 : 6);
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

    test("visible-to with dynamic child addition", async () => {
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
    const newChild = document.createElement("m-cube");
    newChild.setAttribute("color", "blue");
    newChild.setAttribute("y", "1");
    newChild.setAttribute("id", "c3");
    c2.appendChild(newChild);
  }, 1);
</script>`);

      await client1.waitForAllClientMessages(isV01 ? 1 : 1);
      await client2.waitForAllClientMessages(isV01 ? 1 : 1);

      // Initial state: client1 sees the visible-to="1" element, client2 doesn't
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

      // Trigger the addition of a child to the visible-to parent
      client1.networkedDOMWebsocket.handleEvent(
        client1.clientElement.querySelector("#c1")!,
        new CustomEvent("click"),
      );

      await client1.waitForAllClientMessages(isV01 ? 2 : 2);
      await client2.waitForAllClientMessages(isV01 ? 1 : 1);

      // After adding child: client1 sees the new child in the visible-to parent, client2 still doesn't see anything
      expect(client1.getFormattedHTML()).toEqual(
        formatHTML(`<div><html>
  <head>
  </head>
  <body>
    <m-cube color="red" z="2" id="c1">
      <m-cube color="green" x="2" id="c2">
        <m-cube color="blue" y="1" id="c3"></m-cube>
      </m-cube>
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

      // Server's view should show the visible-to attribute and the new child
      expect(testCase.getFormattedAndFilteredHTML()).toEqual(
        formatHTML(`<html>
  <head>
  </head>
  <body>
    <m-cube color="red" z="2" id="c1">
      <m-cube visible-to="1" color="green" x="2" id="c2">
        <m-cube color="blue" y="1" id="c3"></m-cube>
      </m-cube>
    </m-cube>
  </body>
</html>`),
      );
    });

    test("visible-to with cloned element using innerHTML", async () => {
      const testCase = new TestCaseNetworkedDOMDocument();
      const client1 = testCase.createClient(isV01);
      await client1.onConnectionOpened();
      const client2 = testCase.createClient(isV01);
      await client2.onConnectionOpened();

      testCase.doc.load(`
<m-cube color="red" z="2" id="c1">
  <m-cube hidden-from="999" color="blue" x="1" id="source">
    <m-cube color="yellow" y="1" id="child1"></m-cube>
    <m-cube color="purple" y="2" id="child2"></m-cube>
  </m-cube>
</m-cube>

<script>
  const c1 = document.getElementById("c1");
  const source = document.getElementById("source");
  c1.addEventListener("click", () => {
    const cloned = document.createElement("m-cube");
    cloned.innerHTML = source.innerHTML;
    cloned.setAttribute("visible-to", "1");
    cloned.setAttribute("color", "green");
    cloned.setAttribute("x", "3");
    cloned.setAttribute("id", "cloned1");
    c1.appendChild(cloned);
    
    // Add the client's connection ID to the source element's hidden-from
    const currentHiddenFrom = source.getAttribute("hidden-from") || "";
    const newHiddenFrom = currentHiddenFrom ? currentHiddenFrom + ",1" : "1";
    source.setAttribute("hidden-from", newHiddenFrom);
  }, 1);
  
  // Add event listener for client 2's cloning operation
  c1.addEventListener("dblclick", () => {
    const cloned = document.createElement("m-cube");
    cloned.innerHTML = source.innerHTML;
    cloned.setAttribute("visible-to", "2");
    cloned.setAttribute("color", "orange");
    cloned.setAttribute("x", "5");
    cloned.setAttribute("id", "cloned2");
    c1.appendChild(cloned);
    
    // Add client 2's connection ID to the source element's hidden-from
    const currentHiddenFrom = source.getAttribute("hidden-from") || "";
    const newHiddenFrom = currentHiddenFrom.includes("2") ? currentHiddenFrom : currentHiddenFrom + ",2";
    source.setAttribute("hidden-from", newHiddenFrom);
  }, 1);
</script>`);

      await client1.waitForAllClientMessages(isV01 ? 1 : 1);
      await client2.waitForAllClientMessages(isV01 ? 1 : 1);

      // Initial state: both clients see the source element (hidden-from="999" doesn't affect either client)
      expect(client1.getFormattedHTML()).toEqual(
        formatHTML(`<div><html>
  <head>
  </head>
  <body>
    <m-cube color="red" z="2" id="c1">
      <m-cube color="blue" x="1" id="source">
        <m-cube color="yellow" y="1" id="child1"></m-cube>
        <m-cube color="purple" y="2" id="child2"></m-cube>
      </m-cube>
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
      <m-cube color="blue" x="1" id="source">
        <m-cube color="yellow" y="1" id="child1"></m-cube>
        <m-cube color="purple" y="2" id="child2"></m-cube>
      </m-cube>
    </m-cube>
  </body>
</html></div>`),
      );

      // Trigger the cloning operation
      client1.networkedDOMWebsocket.handleEvent(
        client1.clientElement.querySelector("#c1")!,
        new CustomEvent("click"),
      );

      await client1.waitForAllClientMessages(isV01 ? 3 : 5);
      await client2.waitForAllClientMessages(isV01 ? 1 : 1);

      // After cloning: client1 no longer sees the source element (hidden from 1) but sees the cloned element
      expect(client1.getFormattedHTML()).toEqual(
        formatHTML(
          isV01
            ? `<div><html>
  <head>
  </head>
  <body>
    <m-cube color="red" z="2" id="c1">
      <m-cube color="green" x="3" id="cloned1">
        <m-cube color="yellow" y="1" id="child1"></m-cube>
        <m-cube color="purple" y="2" id="child2"></m-cube>
      </m-cube>
    </m-cube>
  </body>
</html></div>`
            : `<div><html>
  <head>
  </head>
  <body>
    <m-cube color="red" z="2" id="c1">
      <x-hidden></x-hidden>
      <m-cube color="green" x="3" id="cloned1">
        <m-cube color="yellow" y="1" id="child1"></m-cube>
        <m-cube color="purple" y="2" id="child2"></m-cube>
      </m-cube>
    </m-cube>
  </body>
</html></div>`,
        ),
      );
      expect(client2.getFormattedHTML()).toEqual(
        formatHTML(`<div><html>
  <head>
  </head>
  <body>
    <m-cube color="red" z="2" id="c1">
      <m-cube color="blue" x="1" id="source">
        <m-cube color="yellow" y="1" id="child1"></m-cube>
        <m-cube color="purple" y="2" id="child2"></m-cube>
      </m-cube>
    </m-cube>
  </body>
</html></div>`),
      );

      // Server's view should show both elements with their respective visibility attributes
      expect(testCase.getFormattedAndFilteredHTML()).toEqual(
        formatHTML(`<html>
  <head>
  </head>
  <body>
    <m-cube color="red" z="2" id="c1">
      <m-cube hidden-from="999,1" color="blue" x="1" id="source">
        <m-cube color="yellow" y="1" id="child1"></m-cube>
        <m-cube color="purple" y="2" id="child2"></m-cube>
      </m-cube>
      <m-cube visible-to="1" color="green" x="3" id="cloned1">
        <m-cube color="yellow" y="1" id="child1"></m-cube>
        <m-cube color="purple" y="2" id="child2"></m-cube>
      </m-cube>
    </m-cube>
  </body>
</html>`),
      );

      // Now trigger client 2's cloning operation
      // Use attribute selector as workaround for jsdom ID indexing issue with duplicate IDs
      client2.networkedDOMWebsocket.handleEvent(
        client2.clientElement.querySelector('[id="c1"]')!,
        new CustomEvent("dblclick"),
      );

      await client1.waitForAllClientMessages(isV01 ? 3 : 5);
      await client2.waitForAllClientMessages(isV01 ? 3 : 5);

      // After client 2's cloning: client1 sees only their clone, client2 sees only their clone, source is hidden from both
      expect(client1.getFormattedHTML()).toEqual(
        formatHTML(
          isV01
            ? `<div><html>
  <head>
  </head>
  <body>
    <m-cube color="red" z="2" id="c1">
      <m-cube color="green" x="3" id="cloned1">
        <m-cube color="yellow" y="1" id="child1"></m-cube>
        <m-cube color="purple" y="2" id="child2"></m-cube>
      </m-cube>
    </m-cube>
  </body>
</html></div>`
            : `<div><html>
  <head>
  </head>
  <body>
    <m-cube color="red" z="2" id="c1">
      <x-hidden></x-hidden>
      <m-cube color="green" x="3" id="cloned1">
        <m-cube color="yellow" y="1" id="child1"></m-cube>
        <m-cube color="purple" y="2" id="child2"></m-cube>
      </m-cube>
    </m-cube>
  </body>
</html></div>`,
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
      <m-cube color="orange" x="5" id="cloned2">
        <m-cube color="yellow" y="1" id="child1"></m-cube>
        <m-cube color="purple" y="2" id="child2"></m-cube>
      </m-cube>
    </m-cube>
  </body>
</html></div>`
            : `<div><html>
  <head>
  </head>
  <body>
    <m-cube color="red" z="2" id="c1">
      <x-hidden></x-hidden>
      <m-cube color="orange" x="5" id="cloned2">
        <m-cube color="yellow" y="1" id="child1"></m-cube>
        <m-cube color="purple" y="2" id="child2"></m-cube>
      </m-cube>
    </m-cube>
  </body>
</html></div>`,
        ),
      );

      // Final server view should show source hidden from both clients and both clones
      expect(testCase.getFormattedAndFilteredHTML()).toEqual(
        formatHTML(`<html>
  <head>
  </head>
  <body>
    <m-cube color="red" z="2" id="c1">
      <m-cube hidden-from="999,1,2" color="blue" x="1" id="source">
        <m-cube color="yellow" y="1" id="child1"></m-cube>
        <m-cube color="purple" y="2" id="child2"></m-cube>
      </m-cube>
      <m-cube visible-to="1" color="green" x="3" id="cloned1">
        <m-cube color="yellow" y="1" id="child1"></m-cube>
        <m-cube color="purple" y="2" id="child2"></m-cube>
      </m-cube>
      <m-cube visible-to="2" color="orange" x="5" id="cloned2">
        <m-cube color="yellow" y="1" id="child1"></m-cube>
        <m-cube color="purple" y="2" id="child2"></m-cube>
      </m-cube>
    </m-cube>
  </body>
</html>`),
      );
    });

    test("multiple visible-to element addition and removal", async () => {
      const testCase = new TestCaseNetworkedDOMDocument();
      const client1 = testCase.createClient(isV01);
      await client1.onConnectionOpened();
      const client2 = testCase.createClient(isV01);
      await client2.onConnectionOpened();

      testCase.doc.load(`<m-cube id="trigger"></m-cube>
<script>
  document.getElementById("trigger").addEventListener("click", (e) => {
    const holder = document.createElement("m-sphere");
    holder.setAttribute("visible-to", String(e.detail?.connectionId));
    holder.setAttribute("id", "holder-" + e.detail?.connectionId);
    document.body.appendChild(holder);
    
    // Add click listener to holder to create child
    holder.addEventListener("click", (holderEvent) => {
      const child = document.createElement("m-cylinder");
      child.setAttribute("id", "child-" + e.detail?.connectionId);
      holder.appendChild(child);
      
      // Add click listener to child to remove itself
      child.addEventListener("click", (childEvent) => {
        childEvent.stopPropagation();
        childEvent.preventDefault();
        child.remove();
      });
    });
  });
</script>`);

      await client1.waitForAllClientMessages(isV01 ? 1 : 1);
      await client2.waitForAllClientMessages(isV01 ? 1 : 1);

      // Initial state: both clients see the trigger
      expect(client1.getFormattedHTML()).toEqual(
        formatHTML(`<div><html>
  <head>
  </head>
  <body>
    <m-cube id="trigger"></m-cube>
  </body>
</html></div>`),
      );
      expect(client2.getFormattedHTML()).toEqual(
        formatHTML(`<div><html>
  <head>
  </head>
  <body>
    <m-cube id="trigger"></m-cube>
  </body>
</html></div>`),
      );

      // Client 1 clicks the trigger to create holder
      client1.networkedDOMWebsocket.handleEvent(
        client1.clientElement.querySelector("#trigger")!,
        new CustomEvent("click"),
      );

      await client1.waitForAllClientMessages(isV01 ? 2 : 2);
      await client2.waitForAllClientMessages(isV01 ? 1 : 1);

      // After client 1's click: client1 should see the holder, client2 sees nothing new
      expect(client1.getFormattedHTML()).toEqual(
        formatHTML(`<div><html>
  <head>
  </head>
  <body>
    <m-cube id="trigger"></m-cube>
    <m-sphere id="holder-1"></m-sphere>
  </body>
</html></div>`),
      );
      expect(client2.getFormattedHTML()).toEqual(
        formatHTML(`<div><html>
  <head>
  </head>
  <body>
    <m-cube id="trigger"></m-cube>
  </body>
</html></div>`),
      );

      // Client 1 clicks the holder to create child
      client1.networkedDOMWebsocket.handleEvent(
        client1.clientElement.querySelector("#holder-1")!,
        new CustomEvent("click"),
      );

      await client1.waitForAllClientMessages(isV01 ? 3 : 3);
      await client2.waitForAllClientMessages(isV01 ? 1 : 1);

      // After creating child: client1 should see holder with child
      expect(client1.getFormattedHTML()).toEqual(
        formatHTML(`<div><html>
  <head>
  </head>
  <body>
    <m-cube id="trigger"></m-cube>
    <m-sphere id="holder-1">
      <m-cylinder id="child-1"></m-cylinder>
    </m-sphere>
  </body>
</html></div>`),
      );

      // Client 1 clicks the child to remove it
      client1.networkedDOMWebsocket.handleEvent(
        client1.clientElement.querySelector("#child-1")!,
        new CustomEvent("click"),
      );

      await client1.waitForAllClientMessages(isV01 ? 4 : 4);
      await client2.waitForAllClientMessages(isV01 ? 1 : 1);

      // After removing child: client1 should see just the holder
      expect(client1.getFormattedHTML()).toEqual(
        formatHTML(`<div><html>
  <head>
  </head>
  <body>
    <m-cube id="trigger"></m-cube>
    <m-sphere id="holder-1"></m-sphere>
  </body>
</html></div>`),
      );

      // Client 2 clicks the trigger to create their holder
      // Use attribute selector as workaround for jsdom ID indexing issue with duplicate IDs
      client2.networkedDOMWebsocket.handleEvent(
        client2.clientElement.querySelector('[id="trigger"]')!,
        new CustomEvent("click"),
      );

      await client1.waitForAllClientMessages(isV01 ? 4 : 4);
      await client2.waitForAllClientMessages(isV01 ? 2 : 2);

      // After client 2's trigger click: client1 sees their holder, client2 sees their holder
      expect(client2.getFormattedHTML()).toEqual(
        formatHTML(`<div><html>
  <head>
  </head>
  <body>
    <m-cube id="trigger"></m-cube>
    <m-sphere id="holder-2"></m-sphere>
  </body>
</html></div>`),
      );

      // Client 2 clicks their holder to create child
      client2.networkedDOMWebsocket.handleEvent(
        client2.clientElement.querySelector("#holder-2")!,
        new CustomEvent("click"),
      );

      await client1.waitForAllClientMessages(isV01 ? 4 : 4);
      await client2.waitForAllClientMessages(isV01 ? 3 : 3);

      // After creating child: client2 should see holder with child
      expect(client2.getFormattedHTML()).toEqual(
        formatHTML(`<div><html>
  <head>
  </head>
  <body>
    <m-cube id="trigger"></m-cube>
    <m-sphere id="holder-2">
      <m-cylinder id="child-2"></m-cylinder>
    </m-sphere>
  </body>
</html></div>`),
      );

      // Client 2 clicks their child to remove it - this should trigger the bug
      client2.networkedDOMWebsocket.handleEvent(
        client2.clientElement.querySelector("#child-2")!,
        new CustomEvent("click"),
      );

      // Wait for messages after client 2's child removal - this should fail due to the bug
      // The test expects these message counts but the bug will cause an error
      await client1.waitForAllClientMessages(isV01 ? 4 : 4);
      await client2.waitForAllClientMessages(isV01 ? 4 : 4);

      // Expected final state (this won't be reached due to the bug)
      expect(client1.getFormattedHTML()).toEqual(
        formatHTML(`<div><html>
  <head>
  </head>
  <body>
    <m-cube id="trigger"></m-cube>
    <m-sphere id="holder-1"></m-sphere>
  </body>
</html></div>`),
      );
      expect(client2.getFormattedHTML()).toEqual(
        formatHTML(`<div><html>
  <head>
  </head>
  <body>
    <m-cube id="trigger"></m-cube>
    <m-sphere id="holder-2"></m-sphere>
  </body>
</html></div>`),
      );

      // Server should show both holders with their respective visible-to attributes
      expect(testCase.getFormattedAndFilteredHTML()).toEqual(
        formatHTML(`<html>
  <head>
  </head>
  <body>
    <m-cube id="trigger"></m-cube>
    <m-sphere visible-to="1" id="holder-1"></m-sphere>
    <m-sphere visible-to="2" id="holder-2"></m-sphere>
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
      await client1.waitForAllClientMessages(isV01 ? 7 : 9);
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
      await client1.waitForAllClientMessages(isV01 ? 3 : 5);
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
