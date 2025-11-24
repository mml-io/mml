export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Rotation {
  x: number;
  y: number;
  z: number;
}

export interface Transform {
  position: Position;
  rotation: Rotation;
}

export function distance3D(pos1: Position, pos2: Position): number {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  const dz = pos1.z - pos2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function distance2D(pos1: Position, pos2: Position): number {
  const dx = pos1.x - pos2.x;
  const dz = pos1.z - pos2.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function normalizeVector(vec: Vector3): Vector3 {
  const length = Math.sqrt(vec.x * vec.x + vec.y * vec.y + vec.z * vec.z);

  if (length === 0) {
    return { x: 0, y: 0, z: 0 };
  }

  return {
    x: vec.x / length,
    y: vec.y / length,
    z: vec.z / length,
  };
}

export function angleFromDirection(dx: number, dz: number): number {
  return (Math.atan2(dx, dz) * 180) / Math.PI + 90;
}

export function getElementPosition(element: HTMLElement): Position {
  return {
    x: parseFloat(element.getAttribute("x") || "0"),
    y: parseFloat(element.getAttribute("y") || "0"),
    z: parseFloat(element.getAttribute("z") || "0"),
  };
}

export function getElementRotation(element: HTMLElement): Rotation {
  return {
    x: parseFloat(element.getAttribute("rx") || "0"),
    y: parseFloat(element.getAttribute("ry") || "0"),
    z: parseFloat(element.getAttribute("rz") || "0"),
  };
}

export function setElementPosition(element: HTMLElement, pos: Position, ry?: number): void {
  element.setAttribute("x", pos.x.toString());
  element.setAttribute("y", pos.y.toString());
  element.setAttribute("z", pos.z.toString());
  if (ry !== undefined) {
    element.setAttribute("ry", ry.toString());
  }
}

export function calculateWorldPosition(element: HTMLElement): Transform {
  const transforms: Array<{
    x: number;
    y: number;
    z: number;
    rx: number;
    ry: number;
    rz: number;
    sx: number;
    sy: number;
    sz: number;
  }> = [];

  let currentElement: HTMLElement | null = element;

  while (currentElement && currentElement.tagName && currentElement.tagName.startsWith("M-")) {
    transforms.push({
      x: parseFloat(currentElement.getAttribute("x") || "0"),
      y: parseFloat(currentElement.getAttribute("y") || "0"),
      z: parseFloat(currentElement.getAttribute("z") || "0"),
      rx: parseFloat(currentElement.getAttribute("rx") || "0"),
      ry: parseFloat(currentElement.getAttribute("ry") || "0"),
      rz: parseFloat(currentElement.getAttribute("rz") || "0"),
      sx: parseFloat(currentElement.getAttribute("sx") || "1"),
      sy: parseFloat(currentElement.getAttribute("sy") || "1"),
      sz: parseFloat(currentElement.getAttribute("sz") || "1"),
    });
    currentElement = currentElement.parentElement;
  }

  const pos = {
    x: transforms[0].x,
    y: transforms[0].y,
    z: transforms[0].z,
  };

  const rot = {
    x: transforms[0].rx,
    y: transforms[0].ry,
    z: transforms[0].rz,
  };

  for (let i = 1; i < transforms.length; i++) {
    const parent = transforms[i];

    if (parent.ry !== 0) {
      const ryRad = (parent.ry * Math.PI) / 180;
      const cosY = Math.cos(ryRad);
      const sinY = Math.sin(ryRad);
      const newX = pos.x * cosY + pos.z * sinY;
      const newZ = -pos.x * sinY + pos.z * cosY;
      pos.x = newX;
      pos.z = newZ;
    }

    if (parent.rx !== 0) {
      const rxRad = (parent.rx * Math.PI) / 180;
      const cosX = Math.cos(rxRad);
      const sinX = Math.sin(rxRad);
      const newY = pos.y * cosX - pos.z * sinX;
      const newZ = pos.y * sinX + pos.z * cosX;
      pos.y = newY;
      pos.z = newZ;
    }

    if (parent.rz !== 0) {
      const rzRad = (parent.rz * Math.PI) / 180;
      const cosZ = Math.cos(rzRad);
      const sinZ = Math.sin(rzRad);
      const newX = pos.x * cosZ - pos.y * sinZ;
      const newY = pos.x * sinZ + pos.y * cosZ;
      pos.x = newX;
      pos.y = newY;
    }

    rot.x += parent.rx;
    rot.y += parent.ry;
    rot.z += parent.rz;

    pos.x *= parent.sx;
    pos.y *= parent.sy;
    pos.z *= parent.sz;

    pos.x += parent.x;
    pos.y += parent.y;
    pos.z += parent.z;
  }

  return {
    position: pos,
    rotation: rot,
  };
}

export interface ExplosionOptions {
  elements: HTMLElement[];
  explosionOrigin: Position;
  force: number;
  forceY: number;
  calculateWorldPositionFn: (element: HTMLElement) => Transform;
  tickRate: number;
  scaleDecrement?: number;
  maxLifeMin?: number;
  maxLifeRandom?: number;
}

export function explodePhysicsObject(options: ExplosionOptions): void {
  const {
    elements,
    explosionOrigin,
    force,
    forceY,
    calculateWorldPositionFn,
    tickRate,
    scaleDecrement = 0.05,
    maxLifeMin = 20,
    maxLifeRandom = 20,
  } = options;

  elements.forEach((element) => {
    const piecePos = calculateWorldPositionFn(element).position;
    const dirX = piecePos.x - explosionOrigin.x;
    const dirY = piecePos.y - explosionOrigin.y;
    const dirZ = piecePos.z - explosionOrigin.z;
    const dist = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ) || 1;

    const actualForce = force + Math.random() * 2;
    const velocity = {
      x: (dirX / dist) * actualForce,
      y: (dirY / dist) * actualForce + forceY,
      z: (dirZ / dist) * actualForce,
    };

    let life = 0;
    let scale = 1;
    const rotationDelta = 3 + Math.random() * 10;
    const maxLife = maxLifeMin + Math.random() * maxLifeRandom;

    const interval = setInterval(() => {
      life++;
      scale -= scaleDecrement;

      if (life >= maxLife || !element.parentNode) {
        clearInterval(interval);
        if (element.parentNode) {
          element.remove();
        }
        return;
      }

      const currentX = parseFloat(element.getAttribute("x") || "0");
      const currentY = parseFloat(element.getAttribute("y") || "0");
      const currentZ = parseFloat(element.getAttribute("z") || "0");

      velocity.y -= 1.25;

      element.setAttribute("x", (currentX + velocity.x * 0.1).toString());
      element.setAttribute("y", (currentY + velocity.y * 0.1).toString());
      element.setAttribute("z", (currentZ + velocity.z * 0.1).toString());

      element.setAttribute("sx", Math.max(0, scale).toString());
      element.setAttribute("sy", Math.max(0, scale).toString());
      element.setAttribute("sz", Math.max(0, scale).toString());

      const currentRX = parseFloat(element.getAttribute("rx") || "0");
      const currentRY = parseFloat(element.getAttribute("ry") || "0");
      const currentRZ = parseFloat(element.getAttribute("rz") || "0");
      element.setAttribute("rx", (currentRX + rotationDelta).toString());
      element.setAttribute("ry", (currentRY + rotationDelta).toString());
      element.setAttribute("rz", (currentRZ + rotationDelta).toString());
    }, tickRate);
  });
}

export function lerp(current: number, target: number, deltaTime: number): number {
  const rate = 0.5;
  const lerpFactor = rate * (deltaTime / 100);
  return current + (target - current) * lerpFactor;
}
