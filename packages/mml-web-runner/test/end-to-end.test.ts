import { jest } from "@jest/globals";
import { MMLScene, registerCustomElementsToWindow } from "@mml-io/mml-web";
import {
  StandaloneThreeJSAdapter,
  StandaloneThreeJSAdapterControlsType,
} from "@mml-io/mml-web-threejs-standalone";
import { EditableNetworkedDOM } from "@mml-io/networked-dom-document";
import { IframeObservableDOMFactory } from "@mml-io/networked-dom-web-runner";

import { MMLWebRunnerClient } from "../build/index";
import { waitFor } from "./test-util";

jest.unstable_mockModule("three", () => {
  const THREE = jest.requireActual("three") as typeof import("three");
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

beforeAll(() => {});
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

  const element = document.createElement("div");
  element.style.width = "100%";
  element.style.height = "100%";

  const mmlScene = new MMLScene(element);
  mmlScene.init(
    await StandaloneThreeJSAdapter.create(element, {
      controlsType: StandaloneThreeJSAdapterControlsType.DragFly,
    }),
  );
  const client = new MMLWebRunnerClient(windowTarget, clientsHolder, mmlScene);
  clientsHolder.append(element);
  client.connect(networkedDOMDocument);
  mmlScene.fitContainer();

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
