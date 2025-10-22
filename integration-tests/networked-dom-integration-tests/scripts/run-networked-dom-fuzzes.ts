import fs from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";

import type { FuzzScenario, OperationSequence } from "../fuzz";
import type {
  normalizeAttributeOrder as normalizeAttributeOrderType,
  normalizeV02ClientHtml as normalizeV02ClientHtmlType,
  waitFor as waitForType,
} from "../test/test-util";
import type { TestCaseNetworkedDOMClient as TestCaseNetworkedDOMClientType } from "../test/TestCaseNetworkedDOMClient";

let TestCaseNetworkedDOMClient: typeof TestCaseNetworkedDOMClientType;
let createObservableDOMFactoryWithGlobals: (
  globals: Record<string, any>,
) => (observableDOMParameters: any, callback: any) => any;
let splitOperationsAtReloads: (operations: any) => OperationSequence[];
let CLIENT_CONNECTION_IDS: readonly string[] = [];
let buildScenario: (seed: number, operationsCount: number, maxDepth: number) => FuzzScenario;
let createFuzzDocument: (html: string, operations: any) => string;
let createSeededRandom: (seed: number) => () => number;
let waitFor: typeof waitForType;
let normalizeV02ClientHtml: typeof normalizeV02ClientHtmlType;
let normalizeAttributeOrder: typeof normalizeAttributeOrderType;

interface ScriptOptions {
  iterations: number;
  operationsMin: number;
  operationsMax: number;
  maxDepthMin: number;
  maxDepthMax: number;
  outputPath?: string;
  seed?: number;
  versions: number[];
  reproTestsDir?: string;
  maxRepros?: number;
}

interface FuzzFailureRecord {
  version: number;
  seed: number;
  operationsCount: number;
  maxDepth: number;
  error: string;
}

function setupDomEnvironment() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
  const { window: jsdomWindow } = dom;

  (globalThis as any).window = jsdomWindow;
  (globalThis as any).document = jsdomWindow.document;
  (globalThis as any).DOMParser = jsdomWindow.DOMParser;
  (globalThis as any).Event = jsdomWindow.Event;
  (globalThis as any).EventTarget = jsdomWindow.EventTarget;
  (globalThis as any).CloseEvent = jsdomWindow.CloseEvent;
  (globalThis as any).MessageEvent = jsdomWindow.MessageEvent;
  (globalThis as any).CustomEvent = jsdomWindow.CustomEvent;
  (globalThis as any).HTMLElement = jsdomWindow.HTMLElement;
  (globalThis as any).MutationObserver = jsdomWindow.MutationObserver;
  (globalThis as any).DocumentFragment = jsdomWindow.DocumentFragment;
  (globalThis as any).Node = jsdomWindow.Node;
  (globalThis as any).Text = jsdomWindow.Text;
  (globalThis as any).Element = jsdomWindow.Element;
  const requestAnimationFrame =
    jsdomWindow.requestAnimationFrame?.bind(jsdomWindow) ??
    ((callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 16));
  const cancelAnimationFrame =
    jsdomWindow.cancelAnimationFrame?.bind(jsdomWindow) ??
    ((handle: number) => clearTimeout(handle));
  (globalThis as any).requestAnimationFrame = requestAnimationFrame;
  (globalThis as any).cancelAnimationFrame = cancelAnimationFrame;
}

async function loadDependencies() {
  const [fuzzUtils, testUtils, testClientModule] = await Promise.all([
    import("../fuzz"),
    import("../test/test-util"),
    import("../test/TestCaseNetworkedDOMClient"),
  ]);
  TestCaseNetworkedDOMClient = testClientModule.TestCaseNetworkedDOMClient;
  createObservableDOMFactoryWithGlobals = fuzzUtils.createObservableDOMFactoryWithGlobals;
  splitOperationsAtReloads = fuzzUtils.splitOperationsAtReloads;
  CLIENT_CONNECTION_IDS = fuzzUtils.CLIENT_CONNECTION_IDS;
  buildScenario = fuzzUtils.buildScenario;
  createFuzzDocument = fuzzUtils.createFuzzDocument;
  createSeededRandom = fuzzUtils.createSeededRandom;
  waitFor = testUtils.waitFor;
  normalizeV02ClientHtml = testUtils.normalizeV02ClientHtml;
  normalizeAttributeOrder = testUtils.normalizeAttributeOrder;
}

function resolveReproTestsDir(options: ScriptOptions): string {
  const scriptPath = process.argv[1];
  const baseDir = path.dirname(scriptPath);
  const configured = options.reproTestsDir ?? path.resolve(baseDir, "../test/fuzz-repro");
  return path.isAbsolute(configured) ? configured : path.resolve(baseDir, configured);
}

function sanitizeForFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function buildReproTestContents(
  version: number,
  seed: number,
  operationsCount: number,
  maxDepth: number,
  scenario: FuzzScenario,
): string {
  const title = `fuzz repro - v${version} seed ${seed} ops ${operationsCount} depth ${maxDepth}`;
  const isV01Literal = version === 0.1 ? "true" : "false";
  return `import { jest } from "@jest/globals";
import { EditableNetworkedDOM } from "@mml-io/networked-dom-document";
import {
  CLIENT_CONNECTION_IDS,
  createFuzzDocument,
  createObservableDOMFactoryWithGlobals,
  splitOperationsAtReloads,
} from "../../fuzz";
import { TestCaseNetworkedDOMClient } from "../TestCaseNetworkedDOMClient";
import { normalizeV02ClientHtml, waitFor } from "../test-util";

jest.setTimeout(20000);

test(${JSON.stringify(title)}, async () => {
  const isV01 = ${isV01Literal};
  const scenario = ${JSON.stringify(scenario, null, 2)} as const;

  const waitForDocumentDone = () => {
    return new Promise<void>((resolve) => {
      doneCallback = resolve;
    });
  };
  let doneCallback: (() => void) | null = null;

  const factory = createObservableDOMFactoryWithGlobals({
    done: () => {
      if (doneCallback) {
        doneCallback();
      }
    },
  });

  const doc = new EditableNetworkedDOM(
    "http://localhost/test-case-document",
    factory,
    true,
  );
  const clients = CLIENT_CONNECTION_IDS.map((id) => {
    const client = new TestCaseNetworkedDOMClient(isV01);
    doc.addWebSocket(client.fakeWebSocket.serverSideWebsocket as unknown as WebSocket);
    return { id, client };
  });

  await Promise.all(clients.map(({ client }) => client.onConnectionOpened()));

  const sequences = splitOperationsAtReloads(scenario.operations);
  for (const sequence of sequences) {
    const documentHTML = createFuzzDocument(sequence.html, sequence.operations);
    const donePromise = waitForDocumentDone();
    doc.load(documentHTML);
    await donePromise;
  }

  await Promise.all(
    clients.map(({ id, client }) =>
      waitFor(() => {
        const expectedBase = ${isV01Literal}
          ? scenario.expectedClientHTMLByConnection[id]
          : (scenario as any).expectedClientHTMLByConnectionV02[id];
        if (!expectedBase) {
          throw new Error("Missing expected client HTML for connection " + id);
        }
        const actualRaw = client.getFormattedHTML();
        const actual = ${isV01Literal} ? actualRaw : normalizeV02ClientHtml(actualRaw);
        const expected = ${isV01Literal} ? expectedBase : normalizeV02ClientHtml(expectedBase);
        return actual === expected ? true : "client " + id + " waiting for sync. Expected: \\n" + expected + "\\n\\nActual: \\n" + actual;
      }, 5000),
    ),
  );

  // Note: Document HTML check would require accessing internal state
  // Skipping for repro test - client checks are sufficient
});
`;
}

function writeReproTest(
  reproDir: string,
  version: number,
  seed: number,
  operationsCount: number,
  maxDepth: number,
  scenario: FuzzScenario,
): string {
  const fileBase = `fuzz-repro-v${sanitizeForFilename(String(version))}-seed-${seed}-ops-${operationsCount}-depth-${maxDepth}`;
  const filePath = path.join(reproDir, `${fileBase}.test.ts`);
  fs.mkdirSync(reproDir, { recursive: true });
  const contents = buildReproTestContents(version, seed, operationsCount, maxDepth, scenario);
  fs.writeFileSync(filePath, contents, { encoding: "utf8" });
  return filePath;
}

async function runScenario(version: number, scenario: FuzzScenario): Promise<void> {
  const isV01 = version === 0.1;

  const waitForDocumentDone = () => {
    return new Promise<void>((resolve) => {
      doneCallback = resolve;
    });
  };
  let doneCallback: (() => void) | null = null;

  const factory = createObservableDOMFactoryWithGlobals({
    done: () => {
      if (doneCallback) {
        doneCallback();
      }
    },
  });

  const { EditableNetworkedDOM } = await import("@mml-io/networked-dom-document");
  const doc = new EditableNetworkedDOM("http://localhost/test-case-document", factory, true);

  const clients = CLIENT_CONNECTION_IDS.map((id) => {
    const client = new TestCaseNetworkedDOMClient(isV01);
    doc.addWebSocket(client.fakeWebSocket.serverSideWebsocket as unknown as WebSocket);
    return { id, client };
  });

  await Promise.all(clients.map(({ client }) => client.onConnectionOpened()));

  const sequences = splitOperationsAtReloads(scenario.operations);
  for (const sequence of sequences) {
    const documentHTML = createFuzzDocument(sequence.html, sequence.operations);
    const donePromise = waitForDocumentDone();
    doc.load(documentHTML);
    await donePromise;
  }

  await Promise.all(
    clients.map(({ id, client }) =>
      waitFor(() => {
        const expected = isV01
          ? scenario.expectedClientHTMLByConnection[id]
          : (scenario as any).expectedClientHTMLByConnectionV02[id];
        if (!expected) {
          throw new Error(`Missing expected client HTML for connection ${id}`);
        }
        const actualRaw = client.getFormattedHTML();
        const actualCanon = normalizeAttributeOrder(
          isV01 ? actualRaw : normalizeV02ClientHtml(actualRaw),
        );
        const expectedCanon = normalizeAttributeOrder(
          isV01 ? expected : normalizeV02ClientHtml(expected),
        );
        return actualCanon === expectedCanon
          ? true
          : `client ${id} waiting for sync. Expected: \n${expectedCanon}\n\nActual: \n${actualCanon}`;
      }, 5000),
    ),
  );

  for (const { client } of clients) {
    client.clientElement.remove();
  }

  doc.dispose();
}

const options: ScriptOptions = {
  iterations: 1000,
  operationsMin: 8,
  operationsMax: 24,
  maxDepthMin: 2,
  maxDepthMax: 4,
  versions: [0.1, 0.2],
  maxRepros: 10,
};

async function main() {
  setupDomEnvironment();
  await loadDependencies();

  const rng = createSeededRandom(options.seed ?? Date.now());
  const failures: FuzzFailureRecord[] = [];
  let completed = 0;
  const reproDir = resolveReproTestsDir(options);
  let reprosWritten = 0;

  const iterations = options.iterations;

  for (let i = 0; i < iterations; i += 1) {
    const seed = Math.floor(rng() * 0xffffffff);
    const operationsCount =
      Math.floor(rng() * (options.operationsMax - options.operationsMin + 1)) +
      options.operationsMin;
    const maxDepth =
      Math.floor(rng() * (options.maxDepthMax - options.maxDepthMin + 1)) + options.maxDepthMin;

    const scenario = buildScenario(seed, operationsCount, maxDepth);

    for (const version of options.versions) {
      try {
        document.body.innerHTML = "";
        await runScenario(version, scenario);
      } catch (error) {
        const serializedError =
          error instanceof Error
            ? `${error.name}: ${error.message}\n${error.stack ?? ""}`
            : String(error);
        failures.push({
          version,
          seed,
          operationsCount,
          maxDepth,
          error: serializedError,
        });
        if (failures.length <= 20) {
          console.error(`Failure for version ${version} seed ${seed}: ${serializedError}`);
        }
        if (typeof options.maxRepros === "number" && reprosWritten < options.maxRepros) {
          try {
            const reproPath = writeReproTest(
              reproDir,
              version,
              seed,
              operationsCount,
              maxDepth,
              scenario,
            );
            reprosWritten += 1;
            console.error(
              `Wrote repro test to ${reproPath}. Run with: npm --workspace integration-tests/networked-dom-integration-tests run test -- ${reproPath}`,
            );
          } catch (writeError) {
            console.error(
              `Failed to write repro test for version ${version} seed ${seed}: ${writeError}`,
            );
          }
        }
      }
    }

    completed += 1;
    if (completed % 50 === 0 || completed === iterations) {
      console.log(`Completed ${completed}/${iterations} scenarios`);
    }
  }

  const summary = {
    iterations,
    failures,
  };

  if (options.outputPath) {
    const scriptPath = process.argv[1];
    const outputPath = path.isAbsolute(options.outputPath)
      ? options.outputPath
      : path.resolve(path.dirname(scriptPath), options.outputPath);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
    console.log(`Wrote failure summary to ${outputPath}`);
  } else if (failures.length > 0) {
    console.log(JSON.stringify(summary, null, 2));
  }

  if (failures.length > 0) {
    process.exit(1);
    return;
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
