import { afterEach, vi } from "vitest";

import { TestCaseNetworkedDOMDocument } from "./TestCaseNetworkedDOMDocument";

describe.each([{ version: 0.1 }, { version: 0.2 }])(
  `EditableNetworkedDOM <> NetworkedDOMWebsocket - hidden-from → visible-to → re-add - $version`,
  ({ version }) => {
    const isV01 = version === 0.1;

    afterEach(() => {
      // Clean up DOM to prevent ID collisions between tests
      document.body.innerHTML = "";
    });

    test("regression test for hidden-from handling", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
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
  
  let step = 0;
  root.addEventListener("click", () => {
    if (step === 0) {
      // Remove from client 1 by making it visible only to client 2
      parent.setAttribute("visible-to", "2");
      root.setAttribute("data-step", "1");
      step = 1;
    } else if (step === 1) {
      // Re-add for client 1 by removing visible-to (still hidden-from=1)
      parent.removeAttribute("visible-to");
      root.setAttribute("data-step", "2");
      step = 2;
    }
  });
</script>`);

      // Wait for initial snapshots to be delivered
      await client1.waitForAllClientMessages(isV01 ? 1 : 1);
      await client2.waitForAllClientMessages(isV01 ? 1 : 1);

      // Click to progress to step 1 (set visible-to="2")
      client1.networkedDOMWebsocket.handleEvent(
        client1.clientElement.querySelector("#root")!,
        new CustomEvent("click"),
      );
      await client1.waitForAllClientMessages(isV01 ? 2 : 5);
      await client2.waitForAllClientMessages(isV01 ? 2 : 5);

      // Click to progress to step 2 (remove visible-to)
      client1.networkedDOMWebsocket.handleEvent(
        client1.clientElement.querySelector("#root")!,
        new CustomEvent("click"),
      );
      await client1.waitForAllClientMessages(isV01 ? 3 : 9);
      await client2.waitForAllClientMessages(isV01 ? 3 : 9);

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  },
);
