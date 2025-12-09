import * as playcanvas from "playcanvas";

/**
 * Polyfill for BasicMaterial which was removed in PlayCanvas v2.
 * See https://github.com/playcanvas/engine/issues/6835
 *
 * BasicMaterial was a simple unlit material that supported:
 * - A single color
 * - Optional texture (map)
 * - Vertex colors
 *
 * This polyfill uses StandardMaterial with lighting disabled
 * and emissive properties to achieve the same effect. We only
 * use this material in MML for debug visualizations, like
 * ThreeJS's wireframe.
 */

/**
 * BasicMaterial polyfill class that extends StandardMaterial.
 * Provides the same API as the removed BasicMaterial class.
 */
export class BasicMaterial extends playcanvas.StandardMaterial {
  constructor() {
    super();
    // completely disable lighting and use only emissive
    this.useLighting = false;
    this.useFog = false;
    this.useTonemap = false;
    this.useSkybox = false;

    // set diffuse/ambient to black to prevent any light influence
    this.diffuse = new playcanvas.Color(0, 0, 0);
    this.ambient = new playcanvas.Color(0, 0, 0);

    // use emissive for the actual color
    this.emissive = new playcanvas.Color(1, 1, 1);
    this.emissiveVertexColor = true;
    this.emissiveIntensity = 1.0;

    this.update();
  }

  set color(value: playcanvas.Color) {
    this.emissive.copy(value);
    this.update();
  }

  get color(): playcanvas.Color {
    return this.emissive;
  }

  set map(value: playcanvas.Texture | null) {
    this.emissiveMap = value;
  }

  get map(): playcanvas.Texture | null {
    return this.emissiveMap;
  }

  set vertexColors(value: boolean) {
    this.emissiveVertexColor = value;
  }

  get vertexColors(): boolean {
    return this.emissiveVertexColor;
  }
}
