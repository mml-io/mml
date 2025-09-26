import { TestCaseNetworkedDOMDocument } from "./TestCaseNetworkedDOMDocument";

/*
 This test uncovered a bug where remapped nodes could cause conflicts on reload
 and is kept for regression testing
*/
describe.each([{ version: 0.1 }, { version: 0.2 }])(
  `EditableNetworkedDOM <> NetworkedDOMWebsocket - nested + reload + text - $version`,
  ({ version }) => {
    const isV01 = version === 0.1;

    test("click - reload - click", async () => {
      const testDocument = `
<m-overlay anchor="center">
  <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
    <filter id="level-1"></filter>
    <circle id="add-level-2"/>
    <clipPath id="add-sibling"/>
    <path id="sibling-container"></path>
    <text id="status">Ready</text>
  </svg>
</m-overlay>

<script>
  const level1Container = document.getElementById("level-1");
  const addLevel2Button = document.getElementById("add-level-2");
  const addSiblingButton = document.getElementById("add-sibling");
  const statusText = document.getElementById("status");
  const siblingContainer = document.getElementById("sibling-container");
  
  addLevel2Button.addEventListener("click", () => {
    const level2Group = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const removeLevel2Button = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    level2Group.appendChild(removeLevel2Button);
    level1Container.appendChild(level2Group);
  });

  addSiblingButton.addEventListener("click", () => {
    siblingContainer.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "g"));
    statusText.textContent = "foo";
  });
</script>`;

      const testCase = new TestCaseNetworkedDOMDocument(false);
      const client1 = testCase.createClient(isV01);
      await client1.onConnectionOpened();

      testCase.doc.load(testDocument);

      await client1.waitForAllClientMessages(isV01 ? 1 : 1);

      client1.networkedDOMWebsocket.handleEvent(
        client1.clientElement.querySelector("#add-sibling")!,
        new CustomEvent("click"),
      );

      await client1.waitForAllClientMessages(isV01 ? 4 : 6);

      // Reload the document without any changes - this causes a node remapping
      testCase.doc.load(testDocument);

      await client1.waitForAllClientMessages(isV01 ? 7 : 9);

      client1.networkedDOMWebsocket.handleEvent(
        client1.clientElement.querySelector("#add-level-2")!,
        new CustomEvent("click"),
      );

      await client1.waitForAllClientMessages(isV01 ? 8 : 10);
    });
  },
);
