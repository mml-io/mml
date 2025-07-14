import { Animation } from "../src/elements/Animation";
import { createTestScene } from "./scene-test-utils";

describe("Animation", () => {
  it("should create an animation element with default properties", async () => {
    const { remoteDocument } = await createTestScene();
    const animation = document.createElement("m-animation") as Animation<any>;
    remoteDocument.appendChild(animation);

    expect(animation.props.src).toBe(null);
    expect(animation.props.weight).toBe(0);
  });

  it("should set src attribute", async () => {
    const { remoteDocument } = await createTestScene();
    const animation = document.createElement("m-animation") as Animation<any>;
    remoteDocument.appendChild(animation);

    animation.setAttribute("src", "test.glb");
    expect(animation.props.src).toBe("test.glb");
  });

  it("should set weight attribute", async () => {
    const { remoteDocument } = await createTestScene();
    const animation = document.createElement("m-animation") as Animation<any>;
    remoteDocument.appendChild(animation);

    animation.setAttribute("weight", "0.5");
    expect(animation.props.weight).toBe(0.5);
  });

  it("should have correct tag name", () => {
    expect(Animation.tagName).toBe("m-animation");
  });

  it("should be identifiable as animation", async () => {
    const { remoteDocument } = await createTestScene();
    const animation = document.createElement("m-animation") as Animation<any>;
    remoteDocument.appendChild(animation);

    expect(Animation.isAnimation(animation)).toBe(true);
    expect(animation.isAnimation).toBe(true);
  });
});
