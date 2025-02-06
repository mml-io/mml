import { IVect3, TransformableElement } from "@mml-io/mml-web";

export function calculateContentBounds(rootElement: Element): { min: IVect3; max: IVect3 } {
  let minX: number | null = null;
  let minY: number | null = null;
  let minZ: number | null = null;
  let maxX: number | null = null;
  let maxY: number | null = null;
  let maxZ: number | null = null;
  const traverse = (element: ChildNode) => {
    if (TransformableElement.isTransformableElement(element)) {
      const bounds = element.getContentBounds();
      if (bounds) {
        bounds.getCorners().forEach((corner) => {
          if (minX === null || corner.x < minX) {
            minX = corner.x;
          }
          if (minY === null || corner.y < minY) {
            minY = corner.y;
          }
          if (minZ === null || corner.z < minZ) {
            minZ = corner.z;
          }
          if (maxX === null || corner.x > maxX) {
            maxX = corner.x;
          }
          if (maxY === null || corner.y > maxY) {
            maxY = corner.y;
          }
          if (maxZ === null || corner.z > maxZ) {
            maxZ = corner.z;
          }
        });
      }
    }
    element.childNodes.forEach((child) => {
      traverse(child);
    });
  };
  traverse(rootElement);
  if (
    minX === null ||
    minY === null ||
    minZ === null ||
    maxX === null ||
    maxY === null ||
    maxZ === null
  ) {
    // Return a default bounding box if no content was found
    return {
      min: { x: -0.5, y: -0.5, z: -0.5 },
      max: { x: 0.5, y: 0.5, z: 0.5 },
    };
  }

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  };
}
