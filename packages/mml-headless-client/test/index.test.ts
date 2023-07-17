import { HeadlessClient } from "../src/HeadlessClient";

/**
 * @jest-environment jsdom
 */
describe("HeadlessClient", () => {
  test("should connect", async () => {
    const client = new HeadlessClient("wss://mmleditor.com/v0/api/documents/upset-gray-horse");

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(client.getInteractions().length).toBeGreaterThan(0);

    client.performInteraction(client.getInteractions()[0]);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(client.dom.querySelector("m-cube").getAttribute("color")).toBe("red");

    client.performInteraction(client.getInteractions()[1]);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(client.dom.querySelector("m-cube").getAttribute("color")).toBe("green");
  });
});
