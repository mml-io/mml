declare module "recast-navigation" {
  export function init(): Promise<void>;

  export class NavMesh {}

  export class NavMeshQuery {
    constructor(navMesh: NavMesh);
    findClosestPoint(position: {
      x: number;
      y: number;
      z: number;
    }): { success: true; point: { x: number; y: number; z: number } } | { success: false } | null;
  }

  export type AgentParameters = {
    radius: number;
    height: number;
    maxAcceleration: number;
    maxSpeed: number;
    collisionQueryRange: number;
    pathOptimizationRange: number;
    separationWeight: number;
  };

  export type Agent = {
    agentIndex: number;
    requestMoveTarget(point: { x: number; y: number; z: number }): void;
    position(): { x: number; y: number; z: number };
  };

  export class Crowd {
    constructor(navMesh: NavMesh, options: { maxAgents: number; maxAgentRadius: number });
    update(dt: number, timeSinceLastFrame?: number, maxSubSteps?: number): void;
    addAgent(position: { x: number; y: number; z: number }, params: AgentParameters): Agent;
    getAgent(agentIndex: number): Agent | null;
    removeAgent(agent: Agent): void;
  }

  export class DebugDrawerUtils {
    drawNavMesh(navMesh: NavMesh): Array<{ type: "lines" | "tris" | "quads"; vertices: any[] }>;
    drawHeightfieldWalkable(
      h: unknown,
    ): Array<{ type: "lines" | "tris" | "quads"; vertices: any[] }>;
    drawHeightfieldSolid(h: unknown): Array<{ type: "lines" | "tris" | "quads"; vertices: any[] }>;
    drawCompactHeightfieldSolid(
      h: unknown,
    ): Array<{ type: "lines" | "tris" | "quads"; vertices: any[] }>;
    drawCompactHeightfieldRegions(
      h: unknown,
    ): Array<{ type: "lines" | "tris" | "quads"; vertices: any[] }>;
    drawCompactHeightfieldDistance(
      h: unknown,
    ): Array<{ type: "lines" | "tris" | "quads"; vertices: any[] }>;
    drawNavMeshBVTree(
      navMesh: NavMesh,
    ): Array<{ type: "lines" | "tris" | "quads"; vertices: any[] }>;
    dispose(): void;
  }
}

declare module "recast-navigation/generators" {
  import type { NavMesh } from "recast-navigation";
  export function generateTileCache(
    positions: number[],
    indices: number[],
    config: any,
    buildNavMeshToo?: boolean,
  ): {
    success: boolean;
    navMesh: NavMesh;
    tileCache: {
      addBoxObstacle(
        center: { x: number; y: number; z: number },
        halfExtents: { x: number; y: number; z: number },
        angle: number,
      ): { obstacle: unknown } | null;
      removeObstacle(obstacle: unknown): unknown;
      update(navMesh: NavMesh): { upToDate?: boolean } | null;
    };
    intermediates?: {
      tileIntermediates?: Array<{
        heightfield?: unknown;
        compactHeightfield?: unknown;
      }>;
    };
  };
}
