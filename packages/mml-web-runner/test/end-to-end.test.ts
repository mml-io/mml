/**
 * @jest-environment jsdom
 */

import { registerCustomElementsToWindow } from "@mml-io/mml-web";
import { EditableNetworkedDOM } from "@mml-io/networked-dom-document";
import { IframeObservableDOMFactory } from "@mml-io/networked-dom-web-runner";
import { AudioContext } from "standardized-audio-context-mock";

import { waitFor } from "./test-util";
import { MMLWebRunnerClient } from "../build/index";

jest.mock("three", () => {
  const THREE = jest.requireActual("three");
  return {
    ...THREE,
    WebGLRenderer: jest.fn().mockReturnValue({
      domElement: document.createElement("div"), // create a fake div
      setSize: jest.fn(),
      setPixelRatio: jest.fn(),
      setClearColor: jest.fn(),
      render: jest.fn(),
      shadowMap: {
        enabled: false,
        type: THREE.PCFSoftShadowMap,
      },
    }),
  };
});

beforeAll(() => {
  (window as any).AudioContext = AudioContext;
});
test("mml-web-runner end-to-end", async () => {
  const networkedDOMDocument = new EditableNetworkedDOM(
    "http://example.com/index.html",
    IframeObservableDOMFactory,
    true,
  );

  const clientsHolder = document.createElement("div");
  document.body.append(clientsHolder);

  const windowTarget = window;
  registerCustomElementsToWindow(windowTarget);

  const client = new MMLWebRunnerClient(windowTarget, clientsHolder);
  clientsHolder.append(client.element);
  client.connect(networkedDOMDocument);

  networkedDOMDocument.load(
    "<m-cube color=\"red\" onclick=\"this.setAttribute('color','green')\"></m-cube>",
  );

  await waitFor(() => {
    return clientsHolder.querySelectorAll("m-cube").length > 0;
  });
  const cube = clientsHolder.querySelectorAll("m-cube")[0];
  expect(cube.getAttribute("color")).toEqual("red");
  cube.dispatchEvent(new MouseEvent("click", { bubbles: true }));

  await waitFor(() => cube.getAttribute("color") === "green");
  expect(cube.getAttribute("color")).toEqual("green");

  networkedDOMDocument.dispose();
});
