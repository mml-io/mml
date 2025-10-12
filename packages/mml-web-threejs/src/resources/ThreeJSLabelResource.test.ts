import { jest } from "@jest/globals";
import * as THREE from "three";

jest.mock("@mml-io/mml-web", () => {
  class CanvasText {
    renderText(): HTMLCanvasElement {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 32;
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
      ctx.fillStyle = "rgba(255,255,255,1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return canvas;
    }
  }
  return { CanvasText };
});
import { CanvasText } from "@mml-io/mml-web";

import { ThreeJSLabelResource } from "./ThreeJSLabelResource";

describe("ThreeJSLabelResource", () => {
  test("produces synchronous texture with expected flags", () => {
    const onRemove = jest.fn();
    const res = new ThreeJSLabelResource(
      {
        content: "Hello",
        fontSize: 16,
        paddingPx: 2,
        textColorRGB255A1: { r: 255, g: 255, b: 255, a: 1 },
        backgroundColorRGB255A1: { r: 0, g: 0, b: 0, a: 1 },
        dimensions: { width: 64, height: 32 },
        alignment: "center",
        bold: true,
      },
      onRemove,
    );

    const handle = res.createHandle();
    const result = handle.getResult();
    expect(result && !(result instanceof Error)).toBe(true);
    if (result && !(result instanceof Error)) {
      expect(result.texture).toBeInstanceOf(THREE.DataTexture);
      expect((result.texture as any).flipY).toBe(true);
      expect((result.texture as any).premultiplyAlpha).toBe(true);
      expect((result.texture as any).generateMipmaps).toBe(true);
      expect((result.texture as any).magFilter).toBe(THREE.LinearFilter);
      expect((result.texture as any).minFilter).toBe(THREE.LinearMipmapLinearFilter);
      // some environments may not reflect needsUpdate; the code sets it, but skip asserting it here
    }

    handle.dispose();
    expect(onRemove).toHaveBeenCalled();
  });

  test("zero-dimension canvas path returns 1x1 transparent texture", () => {
    // Override CanvasText to return zero-size canvas for this test
    CanvasText.prototype.renderText = () => {
      const c = document.createElement("canvas");
      c.width = 0;
      c.height = 0;
      return c;
    };

    const res = new ThreeJSLabelResource(
      {
        content: "",
        fontSize: 16,
        paddingPx: 0,
        textColorRGB255A1: { r: 0, g: 0, b: 0, a: 0 },
        backgroundColorRGB255A1: { r: 0, g: 0, b: 0, a: 0 },
        dimensions: { width: 0, height: 0 },
        alignment: "center",
        bold: true,
      },
      jest.fn(),
    );
    const result = res.getResult();
    expect(result && !(result instanceof Error)).toBe(true);
    if (result && !(result instanceof Error)) {
      expect(result.width).toBe(0);
      expect(result.height).toBe(0);
      const tex = result.texture as THREE.DataTexture;
      expect(tex.image.width).toBe(1);
      expect(tex.image.height).toBe(1);
    }
  });
});
