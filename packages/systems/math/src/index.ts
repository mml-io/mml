export { Quat } from "./Quat";
export { Vec3 } from "./Vec3";

import { ElementSystem, initElementSystem } from "mml-game-systems-common";

import { Quat } from "./Quat";
import { Vec3 } from "./Vec3";

/** Return n if it is finite, otherwise fallback. */
export function clampFinite(n: number, fallback: number): number {
  return Number.isFinite(n) ? n : fallback;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

const VALID_ELEMENT_TAGS = [
  "M-GROUP",
  "M-CUBE",
  "M-SPHERE",
  "M-MODEL",
  "M-CYLINDER",
  "M-PLANE",
  "M-CAPSULE",
];

/** Whether an element participates in 3D transform calculations. */
export function isValidElementForTransform(element: Element): boolean {
  return VALID_ELEMENT_TAGS.includes(element.tagName);
}

/** Parse a numeric attribute, falling back when missing or invalid. */
export function parseNumberAttr(element: Element, name: string, fallback: number): number {
  const raw = element.getAttribute(name);
  if (raw === null || raw === undefined || raw === "") return fallback;
  const v = parseFloat(raw);
  return Number.isFinite(v) ? v : fallback;
}

/**
 * Read local transform from element attributes.
 * Attributes: x,y,z (position); rx,ry,rz (degrees); sx,sy,sz (scale).
 */
export function getLocalTransformFromElement(
  element: Element,
  options?: { includeSize?: boolean },
): {
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
} {
  if (!isValidElementForTransform(element)) {
    return {
      position: Vec3.zero(),
      rotation: Quat.identity(),
      scale: Vec3.one(),
    };
  }

  const x = parseNumberAttr(element, "x", 0);
  const y = parseNumberAttr(element, "y", 0);
  const z = parseNumberAttr(element, "z", 0);

  const rx = parseNumberAttr(element, "rx", 0);
  const ry = parseNumberAttr(element, "ry", 0);
  const rz = parseNumberAttr(element, "rz", 0);

  const sx = parseNumberAttr(element, "sx", 1);
  const sy = parseNumberAttr(element, "sy", 1);
  const sz = parseNumberAttr(element, "sz", 1);

  const includeSize = options?.includeSize === true;
  let sizeX = 1;
  let sizeY = 1;
  let sizeZ = 1;

  if (includeSize) {
    const tag = element.tagName.toLowerCase();
    if (tag === "m-cube") {
      sizeX = parseNumberAttr(element, "width", 1);
      sizeY = parseNumberAttr(element, "height", 1);
      sizeZ = parseNumberAttr(element, "depth", 1);
    } else if (tag === "m-sphere") {
      const radius = parseNumberAttr(element, "radius", 0.5);
      const diameter = radius * 2;
      sizeX = diameter;
      sizeY = diameter;
      sizeZ = diameter;
    } else if (tag === "m-cylinder") {
      const radius = parseNumberAttr(element, "radius", 0.5);
      const height = parseNumberAttr(element, "height", 1);
      sizeX = radius * 2;
      sizeZ = radius * 2;
      sizeY = height;
    } else if (tag === "m-plane") {
      // Match physics interpretation: plane spans X (width) and Z (depth), Y acts as thickness/height
      sizeX = parseNumberAttr(element, "width", 10);
      sizeZ = parseNumberAttr(element, "depth", 10);
      sizeY = parseNumberAttr(element, "height", 1);
    } else if (tag === "m-capsule") {
      const radius = parseNumberAttr(element, "radius", 0.5);
      const height = parseNumberAttr(element, "height", 1);
      // Capsule total height = middle section height + 2 * radius (for the hemispherical caps)
      sizeX = radius * 2;
      sizeZ = radius * 2;
      sizeY = height + radius * 2;
    }
  }

  return {
    position: new Vec3(x, y, z),
    rotation: Quat.fromEulerDegrees(rx, ry, rz),
    scale: new Vec3(sx * sizeX, sy * sizeY, sz * sizeZ),
  };
}

/**
 * Compute world-space transform by walking up the DOM tree and composing
 * local transforms. If a physics body is provided for a node, that body
 * overrides the node's local transform for position/rotation.
 */
export function computeWorldTransformFor(
  element: Element | null,
  options?: {
    getBodyForElement?: (el: Element) => {
      translation: () => { x: number; y: number; z: number };
      rotation: () => { x: number; y: number; z: number; w: number };
      isValid: () => boolean;
    } | null;
  },
): { position: Vec3; rotation: Quat; scale: Vec3 } {
  if (!element) {
    return {
      position: Vec3.zero(),
      rotation: Quat.identity(),
      scale: Vec3.one(),
    };
  }

  const getBody = options?.getBodyForElement;

  const path: Element[] = [];
  let current: Element | null = element;
  while (current) {
    path.push(current);
    current = current.parentElement;
  }
  path.reverse();

  let worldPosition: Vec3 = Vec3.zero();
  let worldRotation: Quat = Quat.identity();
  let worldScale: Vec3 = Vec3.one();

  for (let i = 0; i < path.length; i++) {
    const node = path[i];
    const isLeaf = i === path.length - 1;
    // Only include size on the leaf element (target) when requested; never on ancestors
    const local = getLocalTransformFromElement(node, { includeSize: isLeaf });

    const maybeBody = getBody ? getBody(node) : null;
    if (maybeBody && maybeBody.isValid()) {
      const t = maybeBody.translation();
      const r = maybeBody.rotation();
      worldPosition = new Vec3(t.x, t.y, t.z);
      worldRotation = new Quat(r.x, r.y, r.z, r.w).normalize();
      worldScale = local.scale.clone();
      continue;
    }

    const rotatedLocalPosition = worldRotation.rotateVector(local.position.mul(worldScale));
    worldPosition = worldPosition.add(rotatedLocalPosition);
    worldRotation = worldRotation.multiply(local.rotation).normalize();
    worldScale = worldScale.mul(local.scale);
  }

  return { position: worldPosition, rotation: worldRotation, scale: worldScale };
}

/** Convert quaternion to Euler angles (radians), order XYZ. */
export function quaternionToEulerXYZ(q: Quat) {
  return q.toEulerXYZ();
}

/**
 * Transform an m-cylinder so it spans between two 3D points.
 * The cylinder's local +Y axis is aligned along the segment from start to end,
 * with its position placed at the segment midpoint and its height set to the segment length.
 */
export function transformCylinderBetweenPoints(
  cylinderElement: Element,
  start: { x: number; y: number; z: number },
  end: { x: number; y: number; z: number },
): void {
  const tag = cylinderElement.tagName.toLowerCase();
  if (tag !== "m-cylinder") {
    return;
  }

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;

  const length = Math.hypot(dx, dy, dz);

  // Midpoint position
  const midX = (start.x + end.x) * 0.5;
  const midY = (start.y + end.y) * 0.5;
  const midZ = (start.z + end.z) * 0.5;

  // Default rotation (identity) when length is zero or near-zero
  let qx = 0;
  let qy = 0;
  let qz = 0;
  let qw = 1;

  // Align cylinder local +Y axis (0,1,0) to the direction (dx,dy,dz)
  const invLen = length > 1e-8 ? 1 / length : 0;
  const ux = 0,
    uy = 1,
    uz = 0; // from vector (up)
  const vx = dx * invLen,
    vy = dy * invLen,
    vz = dz * invLen; // to vector (normalized segment dir)

  const dot = ux * vx + uy * vy + uz * vz; // dot(u, v)

  if (dot < -0.999999) {
    // 180° rotation: choose any axis orthogonal to u
    // Pick axis by crossing with X or Z depending on u
    let ax = 1,
      ay = 0,
      az = 0;
    if (Math.abs(ux) > 0.9) {
      ax = 0;
      ay = 0;
      az = 1;
    }
    // cross(u, a)
    const cx = uy * az - uz * ay;
    const cy = uz * ax - ux * az;
    const cz = ux * ay - uy * ax;
    const cLen = Math.hypot(cx, cy, cz) || 1;
    qx = cx / cLen;
    qy = cy / cLen;
    qz = cz / cLen;
    qw = 0;
  } else {
    // Standard case
    // q = (cross(u, v), 1 + dot(u, v)) normalized
    const cx = uy * vz - uz * vy;
    const cy = uz * vx - ux * vz;
    const cz = ux * vy - uy * vx;
    const w = 1 + dot;
    const invNorm = 1 / Math.hypot(cx, cy, cz, w);
    qx = cx * invNorm;
    qy = cy * invNorm;
    qz = cz * invNorm;
    qw = w * invNorm;
  }

  // Convert quaternion to Euler XYZ in degrees
  const eulerRad = quaternionToEulerXYZ(new Quat(qx, qy, qz, qw));
  const rxDeg = (eulerRad.x * 180) / Math.PI;
  const ryDeg = (eulerRad.y * 180) / Math.PI;
  const rzDeg = (eulerRad.z * 180) / Math.PI;

  // Apply attributes on the element
  cylinderElement.setAttribute("x", midX.toFixed(3));
  cylinderElement.setAttribute("y", midY.toFixed(3));
  cylinderElement.setAttribute("z", midZ.toFixed(3));
  cylinderElement.setAttribute("height", length.toFixed(3));
  cylinderElement.setAttribute("rx", rxDeg.toFixed(3));
  cylinderElement.setAttribute("ry", ryDeg.toFixed(3));
  cylinderElement.setAttribute("rz", rzDeg.toFixed(3));
}

class MathSystem implements ElementSystem {
  init = () => Promise.resolve();
  processElement = (
    _element: Element,
    _attributes: Array<{ attributeName: string; value: any }>,
  ) => {
    void 0;
  };
  onElementRemoved = (_element: Element) => {
    void 0;
  };
  start = () => {
    void 0;
  };
  step = (_deltaTime: number | undefined) => {
    void 0;
  };
  dispose = () => {
    void 0;
  };
  transformCylinderBetweenPoints = transformCylinderBetweenPoints;
}

const mathSystem = new MathSystem();
initElementSystem("math", mathSystem, []);

export default mathSystem;
