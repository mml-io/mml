import { jest } from "@jest/globals";

import { TestCaseNetworkedDOMDocument } from "./TestCaseNetworkedDOMDocument";

describe.each([{ version: 0.1 }, { version: 0.2 }])(
  `EditableNetworkedDOM <> NetworkedDOMWebsocket - hidden-from → visible-to → re-add - $version`,
  ({ version }) => {
    const isV01 = version === 0.1;

    test("regression test for hidden-from handling", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const testCase = new TestCaseNetworkedDOMDocument();
      const client1 = testCase.createClient(isV01);
      await client1.onConnectionOpened();
      const client2 = testCase.createClient(isV01);
      await client2.onConnectionOpened();

      // Initial state: element is hidden-from client 1, and has children
      // Then: set visible-to="2" (removes it from client 1 entirely)
      // Finally: remove visible-to (re-adds it for client 1, still hidden-from), which triggers the bug
      testCase.doc.load(`
<m-cube id="root">
  <m-cube id="parent" hidden-from="1">
    <m-cube id="child-1"></m-cube>
    <m-cube id="child-2"></m-cube>
  </m-cube>
</m-cube>

<script>
  const root = document.getElementById("root");
  const parent = document.getElementById("parent");
  // Remove from client 1 by making it visible only to client 2
  setTimeout(() => {
    parent.setAttribute("visible-to", "2");
    root.setAttribute("data-step", "1");
    // Re-add for client 1 by removing visible-to (still hidden-from=1)
    setTimeout(() => {
      parent.removeAttribute("visible-to");
      root.setAttribute("data-step", "2");
    }, 100);
  }, 100);
</script>`);

      // Wait for initial snapshots to be delivered
      await client1.waitForAllClientMessages(isV01 ? 1 : 1);
      await client2.waitForAllClientMessages(isV01 ? 1 : 1);

      // Now let the scripted attribute changes execute.
      await client1.waitForAllClientMessages(isV01 ? 3 : 9, 2000);
      await client2.waitForAllClientMessages(isV01 ? 3 : 9, 2000);

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  },
);
