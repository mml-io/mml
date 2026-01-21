import { EditableNetworkedDOM } from "@mml-io/networked-dom-document";
import { afterEach, vi } from "vitest";

import {
  buildScenario,
  createFuzzDocument,
  createObservableDOMFactoryWithGlobals,
  splitOperationsAtReloads,
} from "../fuzz";
import { normalizeV02ClientHtml, waitFor } from "./test-util";
import { TestCaseNetworkedDOMDocument } from "./TestCaseNetworkedDOMDocument";

vi.setConfig({ testTimeout: 20000 });

describe.each([{ version: 0.1 }, { version: 0.2 }])(
  `EditableNetworkedDOM <> NetworkedDOMWebsocket - fuzzed hierarchy updates - $version`,
  ({ version }) => {
    const isV01 = version === 0.1;

    afterEach(() => {
      // Clean up DOM to prevent ID collisions between tests
      document.body.innerHTML = "";
    });

    test("fuzz add/remove with reload and multiple clients", async () => {
      const scenarioA = buildScenario(1234, 12, 3);
      const scenarioB = buildScenario(5678, 10, 4);

      // Helper to wait for document completion
      const waitForDocumentDone = () => {
        return new Promise<void>((resolve) => {
          doneCallback = resolve;
        });
      };
      let doneCallback: (() => void) | null = null;

      // Create a factory with globals including the done callback
      const factory = createObservableDOMFactoryWithGlobals({
        done: () => {
          if (doneCallback) {
            doneCallback();
          }
        },
      });

      // Create test case with custom factory
      const doc = new EditableNetworkedDOM("http://localhost/test-case-document", factory, true);

      const testCase = new TestCaseNetworkedDOMDocument(true);
      // Replace the doc with our custom one
      (testCase as any).doc = doc;

      const client1 = testCase.createClient(isV01);
      const client2 = testCase.createClient(isV01);
      await Promise.all([client1.onConnectionOpened(), client2.onConnectionOpened()]);

      // Run scenario A sequences
      const sequencesA = splitOperationsAtReloads(scenarioA.operations);
      for (const sequence of sequencesA) {
        const documentHTML = createFuzzDocument(sequence.html, sequence.operations);
        const donePromise = waitForDocumentDone();
        testCase.doc.load(documentHTML);
        await donePromise;
      }

      const expectedScenarioAClient1 = isV01
        ? scenarioA.expectedClientHTMLByConnection["1"]
        : (scenarioA as any).expectedClientHTMLByConnectionV02["1"];
      const expectedScenarioAClient2 = isV01
        ? scenarioA.expectedClientHTMLByConnection["2"]
        : (scenarioA as any).expectedClientHTMLByConnectionV02["2"];
      if (!expectedScenarioAClient1 || !expectedScenarioAClient2) {
        throw new Error("Missing expected client HTML for scenario A");
      }

      await waitFor(() => {
        const current = client1.getFormattedHTML();
        const actual = isV01 ? current : normalizeV02ClientHtml(current);
        const expected = isV01
          ? expectedScenarioAClient1
          : normalizeV02ClientHtml(expectedScenarioAClient1);
        if (actual === expected) {
          return true;
        }
        return `client 1 waiting for scenario A: ${actual}. Expected: ${expected}`;
      }, 5000);

      await waitFor(() => {
        const current = client2.getFormattedHTML();
        const actual = isV01 ? current : normalizeV02ClientHtml(current);
        const expected = isV01
          ? expectedScenarioAClient2
          : normalizeV02ClientHtml(expectedScenarioAClient2);
        return actual === expected
          ? true
          : `client 2 waiting for scenario A: ${actual}. Expected: ${expected}`;
      }, 5000);

      await waitFor(() => {
        const current = testCase.getFormattedAndFilteredHTML();
        const actual = isV01 ? current : normalizeV02ClientHtml(current);
        const expected = isV01
          ? scenarioA.expectedDocumentHTML
          : normalizeV02ClientHtml(scenarioA.expectedDocumentHTML);
        if (actual === expected) {
          return true;
        }
        return `document waiting for scenario A: ${actual}. Expected: ${expected}`;
      }, 5000);

      // Run scenario B sequences
      const sequencesB = splitOperationsAtReloads(scenarioB.operations);
      for (const sequence of sequencesB) {
        const documentHTML = createFuzzDocument(sequence.html, sequence.operations);
        const donePromise = waitForDocumentDone();
        testCase.doc.load(documentHTML);
        await donePromise;
      }

      const expectedScenarioBClient1 = isV01
        ? scenarioB.expectedClientHTMLByConnection["1"]
        : (scenarioB as any).expectedClientHTMLByConnectionV02["1"];
      const expectedScenarioBClient2 = isV01
        ? scenarioB.expectedClientHTMLByConnection["2"]
        : (scenarioB as any).expectedClientHTMLByConnectionV02["2"];
      if (!expectedScenarioBClient1 || !expectedScenarioBClient2) {
        throw new Error("Missing expected client HTML for scenario B");
      }

      await waitFor(() => {
        const current = client1.getFormattedHTML();
        const actual = isV01 ? current : normalizeV02ClientHtml(current);
        const expected = isV01
          ? expectedScenarioBClient1
          : normalizeV02ClientHtml(expectedScenarioBClient1);
        return actual === expected
          ? true
          : `client 1 waiting for scenario B: ${actual}. Expected: ${expected}`;
      }, 5000);

      await waitFor(() => {
        const current = client2.getFormattedHTML();
        const actual = isV01 ? current : normalizeV02ClientHtml(current);
        const expected = isV01
          ? expectedScenarioBClient2
          : normalizeV02ClientHtml(expectedScenarioBClient2);
        return actual === expected
          ? true
          : `client 2 waiting for scenario B: ${actual}. Expected: ${expected}`;
      }, 5000);

      await waitFor(() => {
        const current = testCase.getFormattedAndFilteredHTML();
        const actual = isV01 ? current : normalizeV02ClientHtml(current);
        const expected = isV01
          ? scenarioB.expectedDocumentHTML
          : normalizeV02ClientHtml(scenarioB.expectedDocumentHTML);
        return actual === expected
          ? true
          : `document waiting for scenario B: ${actual}. Expected: ${expected}`;
      }, 5000);
    });
  },
);
