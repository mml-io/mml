import { afterEach } from "vitest";

import { TestCaseNetworkedDOMDocument } from "./TestCaseNetworkedDOMDocument";

const testDocument = `
<m-overlay anchor="center" offset-x="0" offset-y="0" id="hierarchy-overlay">
  <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="400" height="300" fill="rgba(0,0,0,0.8)" rx="8"/>

    <text x="200" y="20" fill="white" font-family="Arial" font-size="14" font-weight="bold" text-anchor="middle">Hierarchy Test</text>

    <rect x="10" y="30" width="380" height="120" fill="none" stroke="#444" rx="4" id="level-1-bg"/>
    <text x="20" y="50" fill="white" font-family="Arial" font-size="12">Level 1 Container</text>

    <g id="level-1" transform="translate(20, 60)">
    </g>

    <rect x="20" y="160" width="80" height="25" fill="#333" rx="3" id="add-level-2" style="cursor: pointer;"/>
    <text x="60" y="177" fill="white" font-family="Arial" font-size="11" text-anchor="middle" style="pointer-events: none;">Add Level 2</text>

    <rect x="110" y="160" width="80" height="25" fill="#333" rx="3" id="add-sibling" style="cursor: pointer;"/>
    <text x="150" y="177" fill="white" font-family="Arial" font-size="11" text-anchor="middle" style="pointer-events: none;">Add Sibling</text>

    <rect x="200" y="160" width="80" height="25" fill="#644" rx="3" id="remove-all" style="cursor: pointer;"/>
    <text x="240" y="177" fill="white" font-family="Arial" font-size="11" text-anchor="middle" style="pointer-events: none;">Remove All</text>

    <g id="sibling-container" transform="translate(10, 200)">
    </g>

    <text x="20" y="280" fill="#ccc" font-family="Arial" font-size="10" id="status">Ready</text>
  </svg>
</m-overlay>

<script>
  let level2Count = 0;
  let level3Count = 0;
  let siblingCount = 0;

  const level1Container = document.getElementById("level-1");
  const addLevel2Button = document.getElementById("add-level-2");
  const addSiblingButton = document.getElementById("add-sibling");
  const removeAllButton = document.getElementById("remove-all");
  const statusText = document.getElementById("status");
  const siblingContainer = document.getElementById("sibling-container");
  const svg = document.querySelector("#hierarchy-overlay svg");

  function updateStatus(message) {
    if (statusText) {
      statusText.textContent = message;
    }
  }

  if (addSiblingButton && siblingContainer) {
    addSiblingButton.addEventListener("click", () => {
      siblingCount++;
      const siblingId = "sibling-" + siblingCount;

      const siblingGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
      siblingGroup.id = siblingId;
      siblingGroup.setAttribute("transform", "translate(0, " + (siblingCount - 1) * 35 + ")");

      const currentHeight = parseInt(svg.getAttribute("height"));
      const neededHeight = 200 + (siblingCount * 35) + 50;
      if (neededHeight > currentHeight) {
        svg.setAttribute("height", neededHeight);
      }

      const siblingBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      siblingBg.setAttribute("x", "0");
      siblingBg.setAttribute("y", "0");
      siblingBg.setAttribute("width", "380");
      siblingBg.setAttribute("height", "30");
      siblingBg.setAttribute("fill", "rgba(0,100,0,0.2)");
      siblingBg.setAttribute("stroke", "#484");
      siblingBg.setAttribute("rx", "4");

      const siblingText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      siblingText.setAttribute("x", "10");
      siblingText.setAttribute("y", "20");
      siblingText.setAttribute("fill", "white");
      siblingText.setAttribute("font-family", "Arial");
      siblingText.setAttribute("font-size", "11");
      siblingText.textContent = "Sibling Container " + siblingCount;

      const removeSiblingButton = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      removeSiblingButton.setAttribute("x", "280");
      removeSiblingButton.setAttribute("y", "6");
      removeSiblingButton.setAttribute("width", "80");
      removeSiblingButton.setAttribute("height", "18");
      removeSiblingButton.setAttribute("fill", "#644");
      removeSiblingButton.setAttribute("rx", "2");
      removeSiblingButton.setAttribute("style", "cursor: pointer;");
      removeSiblingButton.setAttribute("data-target", siblingId);

      const removeSiblingText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      removeSiblingText.setAttribute("x", "320");
      removeSiblingText.setAttribute("y", "17");
      removeSiblingText.setAttribute("fill", "white");
      removeSiblingText.setAttribute("font-family", "Arial");
      removeSiblingText.setAttribute("font-size", "9");
      removeSiblingText.setAttribute("text-anchor", "middle");
      removeSiblingText.setAttribute("style", "pointer-events: none;");
      removeSiblingText.textContent = "Remove";

      siblingGroup.appendChild(siblingBg);
      siblingGroup.appendChild(siblingText);
      siblingGroup.appendChild(removeSiblingButton);
      siblingGroup.appendChild(removeSiblingText);

      siblingContainer.appendChild(siblingGroup);

      removeSiblingButton.addEventListener("click", () => {
        siblingGroup.remove();
        updateStatus("Removed " + siblingId);
      });

      updateStatus("Added sibling container " + siblingCount);
    });
  }

  if (removeAllButton) {
    removeAllButton.addEventListener("click", () => {
      const level2Elements = document.querySelectorAll('[id^="level-2-"]');
      level2Elements.forEach(el => el.remove());

      const siblingElements = document.querySelectorAll('[id^="sibling-"]');
      siblingElements.forEach(el => el.remove());

      svg.setAttribute("height", "300");

      level2Count = 0;
      level3Count = 0;
      siblingCount = 0;

      updateStatus("Removed all dynamic elements");
    });
  }
</script>`;

/*
 * Regression test for a bug where nodeId remappings during document reload
 * were incorrect when array insertions in the rfc6902 diff shifted subsequent
 * operation paths. The shifted paths were being looked up in the original
 * unmodified state, resolving to wrong nodes and producing broken remappings.
 *
 * Repro: connect -> click "Remove All" -> reload document -> click "Add Sibling"
 * Expected: no errors
 * Before fix: "Child element not found: <id>" in handleChildrenRemoved
 */
describe.each([
  { version: 0.2, virtual: false },
  { version: 0.2, virtual: true },
  { version: 0.1, virtual: false },
  { version: 0.1, virtual: true },
])(
  `overlay hierarchy reload - remove all then add sibling - v$version virtual=$virtual`,
  ({ version, virtual }) => {
    const isV01 = version === 0.1;
    const createClient = (testCase: TestCaseNetworkedDOMDocument) =>
      virtual ? testCase.createVirtualClient(isV01) : testCase.createClient(isV01);

    afterEach(() => {
      document.body.innerHTML = "";
    });

    test("remove all - reload - add sibling", async () => {
      const testCase = new TestCaseNetworkedDOMDocument(false);
      const client1 = createClient(testCase);
      await client1.onConnectionOpened();

      // Track errors from the websocket adapter
      const errors: string[] = [];
      const origConsoleError = console.error;
      console.error = (...args: unknown[]) => {
        const msg = args.map((a) => String(a)).join(" ");
        if (
          msg.includes("Error handling websocket message") ||
          msg.includes("Child element not found") ||
          msg.includes("No parent found") ||
          msg.includes("No nodeId in handleNewElement")
        ) {
          errors.push(msg);
        }
      };

      try {
        // Step 1: Load the document
        testCase.doc.load(testDocument);
        await client1.waitForAllClientMessages(1);

        // Step 2: Click "Remove All" (removes sibling-container and changes status text)
        const removeAllEl = client1.querySelector("#remove-all");
        expect(removeAllEl).not.toBeNull();
        client1.networkedDOMWebsocket.handleEvent(removeAllEl! as any, new CustomEvent("click"));

        // Wait for mutations from the Remove All click to settle
        await new Promise((r) => setTimeout(r, 200));

        // Step 3: Reload the document (simulates /reset endpoint)
        testCase.doc.load(testDocument);

        // Wait for reload diff mutations to settle
        await new Promise((r) => setTimeout(r, 200));

        // Step 4: Click "Add Sibling" - this should NOT throw
        const addSiblingEl = client1.querySelector("#add-sibling");
        expect(addSiblingEl).not.toBeNull();
        client1.networkedDOMWebsocket.handleEvent(addSiblingEl! as any, new CustomEvent("click"));

        // Wait for mutations from Add Sibling
        await new Promise((r) => setTimeout(r, 500));

        // Verify no errors occurred during the sequence
        expect(errors).toEqual([]);
      } finally {
        console.error = origConsoleError;
      }
    });
  },
);
