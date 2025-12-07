import { MMLColor } from "../color";
import { LightTypes } from "../elements/Light";
import {
  BillboardVisualizerDescriptor,
  PointLightHelperDescriptor,
  SpotLightHelperDescriptor,
  VisualizerDescriptor,
} from "./VisualDescriptor";

/**
 * SVG icon for a light bulb, used as the visual representation of lights in editor mode.
 * Simple stylized bulb shape that renders well at small sizes.
 */
const lightBulbSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7zm2 14h-4v-1h4v1zm0-2h-4v-1h4v1zm-1.5 5h-1c-.28 0-.5-.22-.5-.5s.22-.5.5-.5h1c.28 0 .5.22.5.5s-.22.5-.5.5zm1.5-1h-3c-.55 0-1-.45-1-1h5c0 .55-.45 1-1 1z"/>
  <circle cx="12" cy="9" r="3" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.5"/>
</svg>`;

/**
 * Default size for the light icon billboard in world units.
 */
const LIGHT_ICON_SIZE = 0.5;

/**
 * Creates a billboard visualizer descriptor for a light icon.
 */
export function createLightIconDescriptor(color: MMLColor): BillboardVisualizerDescriptor {
  return {
    type: "billboard",
    svgContent: lightBulbSvg,
    size: LIGHT_ICON_SIZE,
    color,
  };
}

/**
 * Creates a helper visualizer descriptor for a point light.
 */
export function createPointLightHelperDescriptor(
  distance: number | null,
  color: MMLColor,
): PointLightHelperDescriptor {
  return {
    type: "pointLightHelper",
    distance,
    color,
  };
}

/**
 * Creates a helper visualizer descriptor for a spotlight.
 */
export function createSpotLightHelperDescriptor(
  angleDeg: number,
  distance: number | null,
  color: MMLColor,
): SpotLightHelperDescriptor {
  return {
    type: "spotLightHelper",
    angleDeg,
    distance,
    color,
  };
}

/**
 * Gets the default visualizer for a light element.
 * Returns a billboard light bulb icon colored with the light's color.
 */
export function getLightVisualizer(color: MMLColor): VisualizerDescriptor {
  return createLightIconDescriptor(color);
}

/**
 * Gets the selected visualizer for a light element.
 * Returns the appropriate helper (point light sphere or spotlight cone) with the light's color.
 */
export function getLightSelectedVisualizer(
  lightType: LightTypes,
  color: MMLColor,
  angleDeg: number,
  distance: number | null,
): VisualizerDescriptor {
  return lightType === LightTypes.point
    ? createPointLightHelperDescriptor(distance, color)
    : createSpotLightHelperDescriptor(angleDeg, distance, color);
}
