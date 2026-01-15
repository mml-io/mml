import { ModelLoader } from "@mml-io/model-loader";
import {
  computeWorldTransformFor as mathComputeWorldTransformFor,
  quaternionToEulerXYZ,
  Vec3,
} from "mml-game-math-system";
import {
  ElementSystem,
  extractGeometryFromModel,
  initElementSystem,
} from "mml-game-systems-common";
import {
  createFindNearestPolyResult,
  createNavMeshHelper,
  type DebugPrimitive,
  DebugPrimitiveType,
  findNearestPoly,
  type NavMesh,
  type NodeRef,
  type QueryFilter,
} from "navcat";
import { crowd, generateSoloNavMesh, type SoloNavMeshOptions } from "navcat/blocks";

type DebugDrawMode = "navmesh" | "staticGeometry" | "obstacles";

type NavigationConfig = {
  tileSize?: number;
  cellSize?: number;
  cellHeight?: number;
  walkableHeight?: number;
  walkableRadius?: number;
  walkableClimb?: number;
  walkableSlopeAngle?: number;
  debug?: boolean;
  debugDrawMode?: DebugDrawMode;
};

type AgentState = {
  element: Element;
  agentId: string;
  speed: number;
  radius: number;
  height: number;
};

type Position = { x: number; y: number; z: number };

// Default query filter that allows all polygons
const defaultQueryFilter: QueryFilter = {
  passFilter: (_nodeRef: NodeRef, _navMesh: NavMesh) => true,
  getCost: (
    pa: [number, number, number],
    pb: [number, number, number],
    _navMesh: NavMesh,
    _prevRef: NodeRef | undefined,
    _curRef: NodeRef,
    _nextRef: NodeRef | undefined,
  ) => {
    const dx = pb[0] - pa[0];
    const dy = pb[1] - pa[1];
    const dz = pb[2] - pa[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  },
};

// Default half extents for spatial queries - large to find polygons even with sparse navmesh
const defaultHalfExtents: [number, number, number] = [10.0, 10.0, 10.0];

class NavigationSystem implements ElementSystem {
  private navMesh: NavMesh | null = null;
  private crowdState: ReturnType<typeof crowd.create> | null = null;
  private debugVertices: Float32Array | null = null;
  private debugColors: Float32Array | null = null;
  private debugTriVertices: Float32Array | null = null;
  private debugTriColors: Float32Array | null = null;
  private debugObstacleVertices: Float32Array | null = null;
  private debugObstacleColors: Float32Array | null = null;
  private lastNetworkTime = 0;
  private elementToAgent = new Map<Element, AgentState>();
  private obstacles = new Map<
    Element,
    {
      lastCenter: Position;
      lastHalfExtents: Position;
      lastAngle: number;
    }
  >();
  private lastDebugRebuildMs = 0;
  private agentWaypoints = new Map<string, Array<Position>>();
  private agentCurrentTarget = new Map<string, Position>();
  private agentCurrentTargetRef = new Map<string, NodeRef>();
  private agentDebugLastLog = new Map<string, number>();
  private agentWaypointIndex = new Map<string, number>();
  private agentWaitUntil = new Map<string, number | null>();
  private modelLoader = new ModelLoader();
  private config: Required<NavigationConfig> = {
    tileSize: 32,
    cellSize: 0.1,
    cellHeight: 0.05,
    walkableHeight: 2,
    walkableRadius: 0.5,
    walkableClimb: 2,
    walkableSlopeAngle: 60,
    debug: false,
    debugDrawMode: "navmesh",
  };

  private getGeneratorOptions(): SoloNavMeshOptions {
    const cellSize = Math.max(0.05, Math.min(2, this.config.cellSize));
    const cellHeight = Math.max(0.05, Math.min(2, this.config.cellHeight));
    const walkableRadiusWorld = this.config.walkableRadius;
    const walkableHeightWorld = this.config.walkableHeight;
    const walkableClimbWorld = this.config.walkableClimb;
    const walkableSlopeAngleDegrees = this.config.walkableSlopeAngle;

    // Convert world units to voxel units
    const walkableRadiusVoxels = Math.ceil(walkableRadiusWorld / cellSize);
    const walkableHeightVoxels = Math.ceil(walkableHeightWorld / cellHeight);
    const walkableClimbVoxels = Math.floor(walkableClimbWorld / cellHeight);

    return {
      cellSize,
      cellHeight,
      walkableRadiusVoxels,
      walkableRadiusWorld,
      walkableClimbVoxels,
      walkableClimbWorld,
      walkableHeightVoxels,
      walkableHeightWorld,
      walkableSlopeAngleDegrees,
      borderSize: walkableRadiusVoxels + 3,
      minRegionArea: 8,
      mergeRegionArea: 20,
      maxSimplificationError: 1.3,
      maxEdgeLength: 12,
      maxVerticesPerPoly: 6,
      detailSampleDistance: 6,
      detailSampleMaxError: 1,
    };
  }

  private computeWorldTransformFor(element: Element | null) {
    return mathComputeWorldTransformFor(element, {
      getBodyForElement: () => null,
    });
  }

  private deriveAgentDimensionsFromElement(element: Element): { radius: number; height: number } {
    const world = this.computeWorldTransformFor(element);

    const width = Math.abs(world.scale.x);
    const depth = Math.abs(world.scale.z);
    const height = Math.abs(world.scale.y);

    const radius = Math.max(0.1, Math.min(width, depth) / 2);
    return { radius, height: Math.max(0.5, height) };
  }

  private navMeshNeedsRebuild = true;
  private rebuildPromise: Promise<void> | null = null;

  init(config: NavigationConfig = {}): Promise<void> {
    // navcat is pure JavaScript - no WASM initialization needed
    this.config = { ...this.config, ...config };
    // Mark navmesh as needing rebuild - it will be built when first needed
    // or when elements with nav-mesh attribute are processed
    this.navMeshNeedsRebuild = true;
    console.log("[navigation] init:done");
    return Promise.resolve();
  }

  private async ensureNavMeshBuilt(): Promise<void> {
    if (!this.navMeshNeedsRebuild && this.navMesh) {
      return;
    }
    if (this.rebuildPromise) {
      return this.rebuildPromise;
    }
    this.rebuildPromise = this.rebuildNavMeshFromScene();
    await this.rebuildPromise;
    this.rebuildPromise = null;
    this.navMeshNeedsRebuild = false;
  }

  private async collectStaticGeometry(): Promise<{ positions: number[]; indices: number[] }> {
    const positions: number[] = [];
    const indices: number[] = [];

    const elements = document.querySelectorAll("m-cube, m-cylinder, m-sphere, m-plane, m-model");
    let vertexOffset = 0;

    for (const element of Array.from(elements)) {
      // Skip agents and explicitly dynamic nav obstacles
      if (element.hasAttribute("nav-agent") || element.hasAttribute("nav-obstacle")) {
        continue;
      }

      // Check if element should be included in navmesh
      const hasNavMesh = element.hasAttribute("nav-mesh");
      const navMeshValue = element.getAttribute("nav-mesh");

      // Skip elements that explicitly have nav-mesh="false"
      if (hasNavMesh && navMeshValue === "false") {
        continue;
      }

      // Only include static/kinematic colliders as navigation obstacles
      const isDynamic = element.hasAttribute("rigidbody") && !element.hasAttribute("kinematic");
      if (isDynamic) continue;

      const tag = element.tagName.toLowerCase();

      // Handle m-model elements with GLB files
      if (tag === "m-model") {
        // Only process m-model elements that have nav-mesh="true"
        const isNavMeshEnabled = hasNavMesh && navMeshValue !== "false";
        if (!isNavMeshEnabled) {
          continue;
        }

        const src = element.getAttribute("src");
        if (!src) {
          console.warn("[Navigation] m-model element has no src attribute, skipping");
          continue;
        }

        console.log(`[Navigation] Processing m-model for navmesh: ${src}`);
        const geometry = await extractGeometryFromModel(src, {
          logPrefix: "[Navigation]",
          modelLoader: this.modelLoader,
        });
        if (geometry) {
          const world = this.computeWorldTransformFor(element);

          // Scale vertices by world transform
          for (let i = 0; i < geometry.vertices.length; i += 3) {
            const x = geometry.vertices[i];
            const y = geometry.vertices[i + 1];
            const z = geometry.vertices[i + 2];

            // Apply world scale
            const scaled = new Vec3(
              x * Math.abs(world.scale.x),
              y * Math.abs(world.scale.y),
              z * Math.abs(world.scale.z),
            );

            // Apply world rotation
            const rotated = world.rotation.rotateVector(scaled);

            // Apply world translation
            const final = rotated.add(world.position);

            positions.push(final.x, final.y, final.z);
          }

          // Add indices with offset
          for (let i = 0; i < geometry.indices.length; i++) {
            indices.push(geometry.indices[i] + vertexOffset);
          }

          vertexOffset += geometry.vertices.length / 3;
          console.log(
            `[Navigation] Added m-model geometry: ${geometry.vertices.length / 3} vertices, ${geometry.indices.length / 3} triangles`,
          );
        } else {
          console.warn(`[Navigation] Failed to extract geometry from m-model: ${src}`);
        }
        continue;
      }

      const world = this.computeWorldTransformFor(element);

      if (tag === "m-cube" || tag === "m-plane") {
        const hw = Math.abs(world.scale.x) / 2;
        const hh = Math.abs(world.scale.y) / 2;
        const hd = Math.abs(world.scale.z) / 2;

        const corners: Array<Vec3> = [
          new Vec3(-hw, -hh, -hd),
          new Vec3(hw, -hh, -hd),
          new Vec3(hw, -hh, hd),
          new Vec3(-hw, -hh, hd),
          new Vec3(-hw, hh, -hd),
          new Vec3(hw, hh, -hd),
          new Vec3(hw, hh, hd),
          new Vec3(-hw, hh, hd),
        ].map((local) => world.rotation.rotateVector(local).add(world.position));

        const verts = corners.flatMap((v) => [v.x, v.y, v.z]);
        positions.push(...verts);
        const boxIndices = [
          // bottom (normal -Y)
          0, 1, 2, 0, 2, 3,
          // top (normal +Y)
          4, 6, 5, 4, 7, 6,
          // front
          0, 1, 5, 0, 5, 4,
          // back
          2, 3, 7, 2, 7, 6,
          // left
          0, 4, 7, 0, 7, 3,
          // right
          1, 2, 6, 1, 6, 5,
        ].map((i) => i + vertexOffset);
        indices.push(...boxIndices);
        vertexOffset += 8;
      }
      // For cylinders/spheres, approximate with bounding box for now
      if (tag === "m-cylinder") {
        const rx = Math.max(Math.abs(world.scale.x), Math.abs(world.scale.z)) / 2;
        const rh = Math.abs(world.scale.y) / 2;
        const corners: Array<Vec3> = [
          new Vec3(-rx, -rh, -rx),
          new Vec3(rx, -rh, -rx),
          new Vec3(rx, -rh, rx),
          new Vec3(-rx, -rh, rx),
          new Vec3(-rx, rh, -rx),
          new Vec3(rx, rh, -rx),
          new Vec3(rx, rh, rx),
          new Vec3(-rx, rh, rx),
        ].map((local) => world.rotation.rotateVector(local).add(world.position));
        const verts = corners.flatMap((v) => [v.x, v.y, v.z]);
        positions.push(...verts);
        const inds = [
          // bottom (normal -Y)
          0, 1, 2, 0, 2, 3,
          // top (normal +Y)
          4, 6, 5, 4, 7, 6,
          // front
          0, 1, 5, 0, 5, 4,
          // back
          2, 3, 7, 2, 7, 6,
          // left
          0, 4, 7, 0, 7, 3,
          // right
          1, 2, 6, 1, 6, 5,
        ].map((i) => i + vertexOffset);
        indices.push(...inds);
        vertexOffset += 8;
      }
    }

    return { positions, indices };
  }

  private async rebuildNavMeshFromScene() {
    this.agentWaypoints.clear();
    this.agentCurrentTarget.clear();
    this.agentCurrentTargetRef.clear();
    this.agentDebugLastLog.clear();
    this.agentWaypointIndex.clear();
    this.agentWaitUntil.clear();

    // Snapshot current agents to re-add after rebuild
    const currentAgents = Array.from(this.elementToAgent.values()).map((a) => ({
      element: a.element,
      speed: a.speed,
    }));

    const { positions, indices } = await this.collectStaticGeometry();
    if (positions.length === 0 || indices.length === 0) {
      this.navMesh = null;
      this.crowdState = null;
      console.warn("[navigation] rebuild: no geometry found");
      return;
    }

    const options = this.getGeneratorOptions();

    try {
      const result = generateSoloNavMesh({ positions, indices }, options);

      if (!result.navMesh) {
        console.error("[navigation] rebuild: failed to generate navmesh");
        return;
      }

      this.navMesh = result.navMesh;

      // Log navmesh details for debugging - calculate actual walkable bounds
      const tileCount = Object.keys(this.navMesh.tiles).length;
      console.log(`[navigation] navmesh has ${tileCount} tiles`);
      let totalPolys = 0;
      let totalVerts = 0;
      let minX = Infinity,
        maxX = -Infinity,
        minZ = Infinity,
        maxZ = -Infinity;
      for (const tile of Object.values(this.navMesh.tiles)) {
        if (tile) {
          totalPolys += tile.polys.length;
          totalVerts += tile.vertices.length / 3;
          for (let i = 0; i < tile.vertices.length; i += 3) {
            const x = tile.vertices[i];
            const z = tile.vertices[i + 2];
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (z < minZ) minZ = z;
            if (z > maxZ) maxZ = z;
          }
        }
      }
      console.log("[navigation] navmesh generated:", {
        polys: totalPolys,
        bounds:
          totalPolys > 0
            ? `x:[${minX.toFixed(1)},${maxX.toFixed(1)}] z:[${minZ.toFixed(1)},${maxZ.toFixed(1)}]`
            : "none",
        config: { walkableRadius: this.config.walkableRadius, cellSize: this.config.cellSize },
      });
      console.log(`[navigation] total vertices in navmesh: ${totalVerts}`);

      // Create crowd with max agent radius
      let maxDerivedRadius = this.config.walkableRadius;
      const agentElements = Array.from(document.querySelectorAll("[nav-agent]"));
      for (const el of agentElements) {
        const dims = this.deriveAgentDimensionsFromElement(el);
        if (dims.radius > maxDerivedRadius) maxDerivedRadius = dims.radius;
      }

      this.crowdState = crowd.create(maxDerivedRadius * 2);

      // Rebuild debug buffers for visualization
      this.buildDebugBuffers();

      // Re-add agents to new crowd at current positions
      this.elementToAgent.clear();
      currentAgents.forEach(({ element, speed }) => {
        const world = this.computeWorldTransformFor(element);
        const pos: Position = { x: world.position.x, y: world.position.y, z: world.position.z };
        const accelAttr = parseFloat(element.getAttribute("nav-acceleration") || "");
        const maxAcceleration = isFinite(accelAttr) && accelAttr > 0 ? accelAttr : 8.0;
        const dims = this.deriveAgentDimensionsFromElement(element);
        this.addAgentInternal(element, pos, speed, maxAcceleration, dims);
      });
      console.log("[navigation] rebuild:done", { agents: this.elementToAgent.size });
    } catch (err) {
      console.error("[navigation] rebuild: error generating navmesh", err);
    }
  }

  private addAgentInternal(
    element: Element,
    position: Position,
    maxSpeed: number,
    maxAcceleration: number,
    dims: { radius: number; height: number },
  ): string | null {
    if (!this.crowdState || !this.navMesh) return null;

    const agentParams: crowd.AgentParams = {
      radius: dims.radius,
      height: dims.height,
      maxAcceleration,
      maxSpeed,
      collisionQueryRange: dims.radius * 12.0,
      pathOptimizationRange: dims.radius * 30.0,
      separationWeight: 0.5,
      updateFlags:
        crowd.CrowdUpdateFlags.ANTICIPATE_TURNS |
        crowd.CrowdUpdateFlags.OBSTACLE_AVOIDANCE |
        crowd.CrowdUpdateFlags.SEPARATION |
        crowd.CrowdUpdateFlags.OPTIMIZE_VIS |
        crowd.CrowdUpdateFlags.OPTIMIZE_TOPO,
      queryFilter: defaultQueryFilter,
    };

    const agentId = crowd.addAgent(
      this.crowdState,
      this.navMesh,
      [position.x, position.y, position.z],
      agentParams,
    );

    if (!agentId) {
      console.warn("[navigation] Failed to add agent");
      return null;
    }

    this.elementToAgent.set(element, {
      element,
      agentId,
      speed: maxSpeed,
      radius: dims.radius,
      height: dims.height,
    });

    return agentId;
  }

  start() {}

  private stepLogCounter = 0;

  step(_deltaTime: number) {
    if (!this.crowdState || !this.navMesh) return;

    // Advance crowd simulation at ~60Hz
    const dt = Math.max(1 / 240, Math.min(_deltaTime || 1 / 60, 1 / 30));
    crowd.update(this.crowdState, this.navMesh, dt);

    this.stepLogCounter++;

    // Update dynamic obstacles (simplified - just track positions)
    this.obstacles.forEach((state, element) => {
      const box = this.computeBoxObstacleFromElement(element);
      if (!box) return;
      const { center, halfExtents, angle } = box;
      const moved =
        Math.abs(center.x - state.lastCenter.x) > 1e-3 ||
        Math.abs(center.y - state.lastCenter.y) > 1e-3 ||
        Math.abs(center.z - state.lastCenter.z) > 1e-3;
      const resized =
        Math.abs(halfExtents.x - state.lastHalfExtents.x) > 1e-3 ||
        Math.abs(halfExtents.y - state.lastHalfExtents.y) > 1e-3 ||
        Math.abs(halfExtents.z - state.lastHalfExtents.z) > 1e-3;
      const rotated = Math.abs(angle - state.lastAngle) > 1e-3;
      if (moved || resized || rotated) {
        state.lastCenter = center;
        state.lastHalfExtents = halfExtents;
        state.lastAngle = angle;
      }
    });

    // Sync agent positions to scene
    this.elementToAgent.forEach((state) => {
      if (!this.crowdState) return;
      const agent = this.crowdState.agents[state.agentId];
      if (!agent) return;
      const p = agent.position;
      const parentWorld = this.computeWorldTransformFor(state.element.parentElement);
      const elementWorld = this.computeWorldTransformFor(state.element);
      // navcat positions agents at ground level (feet), so no yOffset needed
      const worldPos = new Vec3(p[0], p[1], p[2]);

      // Determine yaw to preserve
      let yawRadians = 0;
      const ryAttr = state.element.getAttribute("ry");
      if (ryAttr !== null) {
        const parsed = parseFloat(ryAttr);
        if (isFinite(parsed)) yawRadians = (parsed * Math.PI) / 180;
      } else {
        const eulerForRotation = quaternionToEulerXYZ(elementWorld.rotation);
        yawRadians = eulerForRotation.y;
      }

      // Attempt to move via physics kinematic API if available
      // @ts-expect-error - physics is added at runtime
      const physics: any = window.physics;
      let movedByPhysics = false;
      if (physics && typeof physics.moveKinematic === "function") {
        try {
          movedByPhysics = !!physics.moveKinematic(state.element, worldPos, { yawRadians });
        } catch {
          // Ignore physics movement errors
        }
      }

      if (!movedByPhysics) {
        // Fallback: write local transform attributes
        const localPos = parentWorld.rotation
          .conjugate()
          .rotateVector(worldPos.sub(parentWorld.position))
          .div(parentWorld.scale);
        state.element.setAttribute("x", localPos.x.toFixed(3));
        state.element.setAttribute("y", localPos.y.toFixed(3));
        state.element.setAttribute("z", localPos.z.toFixed(3));
      }
    });

    // Patrol progression
    this.elementToAgent.forEach((state) => {
      const wps = this.agentWaypoints.get(state.agentId);
      if (!wps || wps.length === 0 || !this.crowdState) return;
      const agent = this.crowdState.agents[state.agentId];
      if (!agent) return;
      const pos = agent.position;
      const idx = this.agentWaypointIndex.get(state.agentId) ?? 0;
      const tgt = this.agentCurrentTarget.get(state.agentId) || null;

      // If no current target set, set to current waypoint
      if (!tgt) {
        this.requestMoveToWaypoint(state.agentId, wps[idx]);
        return;
      }

      const dx = pos[0] - tgt.x;
      const dy = pos[1] - tgt.y;
      const dz = pos[2] - tgt.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq < 1.0) {
        const waitUntil = this.agentWaitUntil.get(state.agentId) ?? null;
        const now =
          typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
        if (waitUntil === null) {
          this.agentWaitUntil.set(state.agentId, now + 1000);
        } else if (now >= waitUntil) {
          const nextIdx = (idx + 1) % wps.length;
          this.agentWaypointIndex.set(state.agentId, nextIdx);
          this.agentWaitUntil.set(state.agentId, null);
          this.requestMoveToWaypoint(state.agentId, wps[nextIdx]);
        }
      }
    });

    // Emit navmesh debug buffers (throttled) if enabled
    if (this.config.debug && this.debugVertices && this.debugColors) {
      const now = (document.timeline.currentTime as number) || 0;
      if (now > this.lastNetworkTime + 100) {
        this.lastNetworkTime = now;
        this.emitDebugBuffers(now);
      }
    }
  }

  private requestMoveToWaypoint(agentId: string, waypoint: Position): boolean {
    if (!this.crowdState || !this.navMesh) return false;

    const result = createFindNearestPolyResult();
    findNearestPoly(
      result,
      this.navMesh,
      [waypoint.x, waypoint.y, waypoint.z],
      defaultHalfExtents,
      defaultQueryFilter,
    );

    if (result.success && result.nodeRef) {
      crowd.requestMoveTarget(this.crowdState, agentId, result.nodeRef, result.position);
      this.agentCurrentTarget.set(agentId, {
        x: result.position[0],
        y: result.position[1],
        z: result.position[2],
      });
      this.agentCurrentTargetRef.set(agentId, result.nodeRef);
      return true;
    }
    return false;
  }

  private emitDebugBuffers(_now: number) {
    // Build dynamic agent and waypoint debug lines
    const dynPositions: number[] = [];
    const dynColors: number[] = [];
    const dynTriPositions: number[] = [];
    const dynTriColors: number[] = [];

    const pushLine = (
      ax: number,
      ay: number,
      az: number,
      bx: number,
      by: number,
      bz: number,
      r: number,
      g: number,
      b: number,
      a: number,
    ) => {
      dynPositions.push(ax, ay, az, bx, by, bz);
      dynColors.push(r, g, b, a, r, g, b, a);
    };

    const pushTri = (
      ax: number,
      ay: number,
      az: number,
      bx: number,
      by: number,
      bz: number,
      cx: number,
      cy: number,
      cz: number,
      r0: number,
      g0: number,
      b0: number,
      a0: number,
      r1: number,
      g1: number,
      b1: number,
      a1: number,
      r2: number,
      g2: number,
      b2: number,
      a2: number,
    ) => {
      dynTriPositions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
      dynTriColors.push(r0, g0, b0, a0, r1, g1, b1, a1, r2, g2, b2, a2);
    };

    // Per-agent markers and target lines
    this.elementToAgent.forEach((state) => {
      if (!this.crowdState) return;
      const agent = this.crowdState.agents[state.agentId];
      if (!agent) return;
      const p = agent.position;

      // Agent cross marker (yellow)
      const s = 0.25;
      pushLine(p[0] - s, p[1], p[2], p[0] + s, p[1], p[2], 1.0, 1.0, 0.0, 1.0);
      pushLine(p[0], p[1] - s, p[2], p[0], p[1] + s, p[2], 1.0, 1.0, 0.0, 1.0);
      pushLine(p[0], p[1], p[2] - s, p[0], p[1], p[2] + s, 1.0, 1.0, 0.0, 1.0);

      // Current target line (red)
      const tgt = this.agentCurrentTarget.get(state.agentId);
      if (tgt) {
        pushLine(p[0], p[1], p[2], tgt.x, tgt.y, tgt.z, 1.0, 0.0, 0.0, 1.0);
        const ts = 0.18;
        pushLine(tgt.x - ts, tgt.y, tgt.z, tgt.x + ts, tgt.y, tgt.z, 1.0, 0.0, 0.0, 1.0);
        pushLine(tgt.x, tgt.y - ts, tgt.z, tgt.x, tgt.y + ts, tgt.z, 1.0, 0.0, 0.0, 1.0);
        pushLine(tgt.x, tgt.y, tgt.z - ts, tgt.x, tgt.y, tgt.z + ts, 1.0, 0.0, 0.0, 1.0);
      }

      // Waypoints markers and polyline (green)
      const wps = this.agentWaypoints.get(state.agentId) || [];
      const ws = 0.18;
      for (let i = 0; i < wps.length; i++) {
        const wp = wps[i];
        pushLine(wp.x - ws, wp.y, wp.z, wp.x + ws, wp.y, wp.z, 0.2, 1.0, 0.2, 1.0);
        pushLine(wp.x, wp.y - ws, wp.z, wp.x, wp.y + ws, wp.z, 0.2, 1.0, 0.2, 1.0);
        pushLine(wp.x, wp.y, wp.z - ws, wp.x, wp.y, wp.z + ws, 0.2, 1.0, 0.2, 1.0);
        if (i + 1 < wps.length) {
          const next = wps[i + 1];
          pushLine(wp.x, wp.y, wp.z, next.x, next.y, next.z, 0.2, 1.0, 0.2, 1.0);
        }
      }
      if (wps.length > 1) {
        const first = wps[0];
        const last = wps[wps.length - 1];
        pushLine(last.x, last.y, last.z, first.x, first.y, first.z, 0.2, 1.0, 0.2, 1.0);
      }

      // Agent footprint disc (filled, translucent yellow)
      const discSegments = 20;
      const radius = Math.max(0.05, state.radius);
      const cy = p[1] + 0.02;
      for (let i = 0; i < discSegments; i++) {
        const a0 = (i / discSegments) * Math.PI * 2;
        const a1 = ((i + 1) / discSegments) * Math.PI * 2;
        const x0 = p[0] + Math.cos(a0) * radius;
        const z0 = p[2] + Math.sin(a0) * radius;
        const x1 = p[0] + Math.cos(a1) * radius;
        const z1 = p[2] + Math.sin(a1) * radius;
        pushTri(
          p[0],
          cy,
          p[2],
          x0,
          cy,
          z0,
          x1,
          cy,
          z1,
          1.0,
          1.0,
          0.0,
          0.35,
          1.0,
          1.0,
          0.0,
          0.35,
          1.0,
          1.0,
          0.0,
          0.35,
        );
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const baseVerts = this.debugVertices!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const baseCols = this.debugColors!;
    const outVerts = new Float32Array(baseVerts.length + dynPositions.length);
    outVerts.set(baseVerts, 0);
    outVerts.set(new Float32Array(dynPositions), baseVerts.length);
    const outCols = new Float32Array(baseCols.length + dynColors.length);
    outCols.set(baseCols, 0);
    outCols.set(new Float32Array(dynColors), baseCols.length);

    const baseTriVerts = this.debugTriVertices ?? new Float32Array(0);
    const baseTriCols = this.debugTriColors ?? new Float32Array(0);
    const outTriVerts = new Float32Array(baseTriVerts.length + dynTriPositions.length);
    outTriVerts.set(baseTriVerts, 0);
    outTriVerts.set(new Float32Array(dynTriPositions), baseTriVerts.length);
    const outTriCols = new Float32Array(baseTriCols.length + dynTriColors.length);
    outTriCols.set(baseTriCols, 0);
    outTriCols.set(new Float32Array(dynTriColors), baseTriCols.length);

    try {
      window.parent.postMessage(
        {
          source: "ai-game-creator",
          type: "navmesh-debug-buffers",
          vertices: outVerts,
          colors: outCols,
          triVertices: outTriVerts,
          triColors: outTriCols,
          obstacleVertices: this.debugObstacleVertices ?? new Float32Array(0),
          obstacleColors: this.debugObstacleColors ?? new Float32Array(0),
        },
        "*",
      );
    } catch (e) {
      console.warn("Navigation debug render failed:", e);
    }
  }

  dispose() {
    this.elementToAgent.clear();
    this.obstacles.clear();
    this.navMesh = null;
    this.crowdState = null;
  }

  processElement(element: Element, attributes: Array<{ attributeName: string; value: any }>) {
    const isAgent = attributes.some((a) => a.attributeName === "nav-agent");
    const isObstacle = attributes.some((a) => a.attributeName === "nav-obstacle");

    // Check if this is a nav-mesh element that should trigger a rebuild
    const tag = element.tagName.toLowerCase();
    const isNavMeshElement =
      element.hasAttribute("nav-mesh") &&
      element.getAttribute("nav-mesh") !== "false" &&
      (tag === "m-model" || tag === "m-cube" || tag === "m-plane" || tag === "m-cylinder");

    if (isNavMeshElement && this.navMeshNeedsRebuild) {
      this.ensureNavMeshBuilt().catch((err) => {
        console.error("[navigation] rebuild triggered by element failed:", err);
      });
    }

    // If navMesh not ready yet and this is an agent, defer processing
    if (!this.navMesh) {
      if (isAgent) {
        // Queue this agent to be processed after navmesh is built
        this.ensureNavMeshBuilt()
          .then(() => {
            this.processElement(element, attributes);
          })
          .catch((err) => {
            console.error("[navigation] deferred agent processing failed:", err);
          });
      }
      return;
    }
    const speedAttr = attributes.find((a) => a.attributeName === "nav-speed");
    const accelAttr = attributes.find((a) => a.attributeName === "nav-acceleration");
    const waypointsAttr = attributes.find((a) => a.attributeName === "nav-waypoints");

    // Dynamic obstacle support - track position for debug visualization
    if (isObstacle) {
      if (!this.obstacles.has(element)) {
        const box = this.computeBoxObstacleFromElement(element);
        if (box) {
          this.obstacles.set(element, {
            lastCenter: box.center,
            lastHalfExtents: box.halfExtents,
            lastAngle: box.angle,
          });
        }
      }
      if (!isAgent) return;
    }

    if (!isAgent) {
      return;
    }

    if (isAgent && this.crowdState && !this.elementToAgent.has(element)) {
      const world = this.computeWorldTransformFor(element);
      const pos: Position = { x: world.position.x, y: world.position.y, z: world.position.z };
      const parsedSpeed =
        typeof speedAttr?.value === "number"
          ? (speedAttr.value as number)
          : parseFloat(String(speedAttr?.value ?? ""));
      const maxSpeed = isFinite(parsedSpeed) && parsedSpeed > 0 ? parsedSpeed : 3.5;
      const parsedAccel =
        typeof accelAttr?.value === "number"
          ? (accelAttr.value as number)
          : parseFloat(String(accelAttr?.value ?? ""));
      const maxAcceleration = isFinite(parsedAccel) && parsedAccel > 0 ? parsedAccel : 8.0;
      const dims = this.deriveAgentDimensionsFromElement(element);
      const agentId = this.addAgentInternal(element, pos, maxSpeed, maxAcceleration, dims);

      // If waypoints are defined declaratively, start patrol
      if (
        agentId &&
        waypointsAttr &&
        typeof waypointsAttr.value === "string" &&
        waypointsAttr.value.length > 0
      ) {
        this.setupPatrolIfDeclared(element, agentId, waypointsAttr.value);
      }
    }
  }

  private setupPatrolIfDeclared(element: Element, agentId: string, waypointsString?: string) {
    const raw = waypointsString ?? element.getAttribute("nav-waypoints") ?? "";
    if (!raw) return;
    const points = raw
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((triple) => {
        const [x, y, z] = triple.split(",").map((n) => parseFloat(n.trim()));
        return { x, y, z } as Position;
      })
      .filter((p) => isFinite(p.x) && isFinite(p.y) && isFinite(p.z));
    if (points.length < 2) return;
    this.agentWaypoints.set(agentId, points);
    this.agentWaypointIndex.set(agentId, 0);
    this.agentWaitUntil.set(agentId, null);

    // Kick off by moving to the first waypoint
    this.requestMoveToWaypoint(agentId, points[0]);
  }

  onElementRemoved(element: Element) {
    const agent = this.elementToAgent.get(element);
    if (agent && this.crowdState) {
      crowd.removeAgent(this.crowdState, agent.agentId);
      this.elementToAgent.delete(element);
      this.agentWaypoints.delete(agent.agentId);
      this.agentCurrentTarget.delete(agent.agentId);
      this.agentCurrentTargetRef.delete(agent.agentId);
      this.agentWaypointIndex.delete(agent.agentId);
      this.agentWaitUntil.delete(agent.agentId);
    }
    if (this.obstacles.has(element)) {
      this.obstacles.delete(element);
    }
  }

  // Public API - throttled warning log
  private lastGoToWarningTime = 0;

  goTo(element: Element, target: Position) {
    // If navmesh not ready, trigger build and defer navigation
    if (!this.crowdState || !this.navMesh) {
      if (this.navMeshNeedsRebuild) {
        this.ensureNavMeshBuilt()
          .then(() => {
            this.goTo(element, target);
          })
          .catch((err) => {
            console.error("[navigation] goTo deferred navigation failed:", err);
          });
      }
      return;
    }

    let agentState = this.elementToAgent.get(element);
    if (!agentState) {
      this.processElement(element, [{ attributeName: "nav-agent", value: true }]);
      agentState = this.elementToAgent.get(element);
    }
    if (!agentState) return;

    const result = createFindNearestPolyResult();
    findNearestPoly(
      result,
      this.navMesh,
      [target.x, target.y, target.z],
      defaultHalfExtents,
      defaultQueryFilter,
    );

    if (!result.success || !result.nodeRef) {
      // Throttle warning to once per 2 seconds
      const now = Date.now();
      if (now - this.lastGoToWarningTime > 2000) {
        this.lastGoToWarningTime = now;
        console.warn("[navigation] goTo: target not on navmesh", {
          target: `(${target.x.toFixed(1)}, ${target.y.toFixed(1)}, ${target.z.toFixed(1)})`,
          agentCount: this.elementToAgent.size,
        });
      }
      return;
    }

    crowd.requestMoveTarget(this.crowdState, agentState.agentId, result.nodeRef, result.position);
    this.agentCurrentTarget.set(agentState.agentId, {
      x: result.position[0],
      y: result.position[1],
      z: result.position[2],
    });
    this.agentCurrentTargetRef.set(agentState.agentId, result.nodeRef);
  }

  stop(element: Element) {
    if (!this.crowdState) return;
    const agentState = this.elementToAgent.get(element);
    if (!agentState) return;

    crowd.resetMoveTarget(this.crowdState, agentState.agentId);
    this.agentCurrentTarget.delete(agentState.agentId);
    this.agentCurrentTargetRef.delete(agentState.agentId);
  }

  private computeBoxObstacleFromElement(element: Element): {
    center: Position;
    halfExtents: Position;
    angle: number;
  } | null {
    const tag = element.tagName.toLowerCase();
    const world = this.computeWorldTransformFor(element);
    const euler = quaternionToEulerXYZ(world.rotation);
    const yaw = euler.y;

    let width = 1;
    let height = 1;
    let depth = 1;

    if (tag === "m-cube" || tag === "m-plane") {
      width = Math.abs(world.scale.x);
      height = Math.abs(world.scale.y);
      depth = Math.abs(world.scale.z);
    } else if (tag === "m-cylinder") {
      const rx = Math.max(Math.abs(world.scale.x), Math.abs(world.scale.z));
      width = rx;
      depth = rx;
      height = Math.abs(world.scale.y);
    } else {
      return null;
    }

    const halfExtents = {
      x: width / 2,
      y: height / 2,
      z: depth / 2,
    };

    let center: Position = { x: world.position.x, y: world.position.y, z: world.position.z };
    try {
      const anyEl: any = element;
      if (anyEl && typeof anyEl.getWorldPosition === "function") {
        const p = anyEl.getWorldPosition();
        if (p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)) {
          center = { x: p.x, y: p.y, z: p.z };
        }
      }
    } catch {
      // Ignore errors getting world position
    }

    return { center, halfExtents, angle: yaw };
  }

  async rebuild() {
    await this.rebuildNavMeshFromScene();
  }

  setDebugEnabled(enabled: boolean) {
    this.config.debug = enabled;
    if (enabled) {
      // Build debug buffers when enabling
      this.buildDebugBuffers().catch((err) =>
        console.error("[Navigation] Failed to build debug buffers:", err),
      );
    }
  }

  setDebugDrawMode(mode: DebugDrawMode) {
    this.config.debugDrawMode = mode;
    this.buildDebugBuffers();
  }

  private buildDebugBuffers() {
    if (!this.navMesh) {
      this.debugVertices = new Float32Array(0);
      this.debugColors = new Float32Array(0);
      this.debugTriVertices = new Float32Array(0);
      this.debugTriColors = new Float32Array(0);
      this.debugObstacleVertices = new Float32Array(0);
      this.debugObstacleColors = new Float32Array(0);
      return;
    }

    const linePositions: number[] = [];
    const lineColors: number[] = [];
    const triPositions: number[] = [];
    const triColors: number[] = [];

    // Use navcat's official debug helper for navmesh visualization
    if (this.config.debugDrawMode === "navmesh") {
      const primitives: DebugPrimitive[] = createNavMeshHelper(this.navMesh);
      for (const prim of primitives) {
        if (prim.type === DebugPrimitiveType.Triangles) {
          // Expand indexed triangles to non-indexed for our buffer format
          for (let i = 0; i < prim.indices.length; i += 3) {
            const i0 = prim.indices[i];
            const i1 = prim.indices[i + 1];
            const i2 = prim.indices[i + 2];
            // Positions
            triPositions.push(
              prim.positions[i0 * 3],
              prim.positions[i0 * 3 + 1],
              prim.positions[i0 * 3 + 2],
              prim.positions[i1 * 3],
              prim.positions[i1 * 3 + 1],
              prim.positions[i1 * 3 + 2],
              prim.positions[i2 * 3],
              prim.positions[i2 * 3 + 1],
              prim.positions[i2 * 3 + 2],
            );
            // Colors (RGBA per vertex)
            const opacity = prim.opacity ?? 1.0;
            triColors.push(
              prim.colors[i0 * 3],
              prim.colors[i0 * 3 + 1],
              prim.colors[i0 * 3 + 2],
              opacity,
              prim.colors[i1 * 3],
              prim.colors[i1 * 3 + 1],
              prim.colors[i1 * 3 + 2],
              opacity,
              prim.colors[i2 * 3],
              prim.colors[i2 * 3 + 1],
              prim.colors[i2 * 3 + 2],
              opacity,
            );
          }
        } else if (prim.type === DebugPrimitiveType.Lines) {
          // Lines: positions are pairs of vertices
          for (let i = 0; i < prim.positions.length; i += 6) {
            linePositions.push(
              prim.positions[i],
              prim.positions[i + 1],
              prim.positions[i + 2],
              prim.positions[i + 3],
              prim.positions[i + 4],
              prim.positions[i + 5],
            );
            const opacity = prim.opacity ?? 1.0;
            // Colors for both endpoints
            const ci = (i / 3) * 3; // color index
            lineColors.push(
              prim.colors[ci] ?? 1,
              prim.colors[ci + 1] ?? 1,
              prim.colors[ci + 2] ?? 1,
              opacity,
              prim.colors[ci + 3] ?? 1,
              prim.colors[ci + 4] ?? 1,
              prim.colors[ci + 5] ?? 1,
              opacity,
            );
          }
        }
      }
    }

    // Draw obstacles
    const obstaclePositions: number[] = [];
    const obstacleColors: number[] = [];
    const obsColor: [number, number, number, number] = [1.0, 0.5, 0.0, 1.0];

    this.obstacles.forEach((state) => {
      const hx = state.lastHalfExtents.x;
      const hy = state.lastHalfExtents.y;
      const hz = state.lastHalfExtents.z;
      const angle = state.lastAngle;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const localCorners: Array<[number, number, number]> = [
        [-hx, -hy, -hz],
        [hx, -hy, -hz],
        [hx, -hy, hz],
        [-hx, -hy, hz],
        [-hx, hy, -hz],
        [hx, hy, -hz],
        [hx, hy, hz],
        [-hx, hy, hz],
      ];
      const worldCorners = localCorners.map(([x, y, z]) => {
        const rx = x * cos - z * sin;
        const rz = x * sin + z * cos;
        return [state.lastCenter.x + rx, state.lastCenter.y + y, state.lastCenter.z + rz] as [
          number,
          number,
          number,
        ];
      });
      const edges: Array<[number, number]> = [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0],
        [4, 5],
        [5, 6],
        [6, 7],
        [7, 4],
        [0, 4],
        [1, 5],
        [2, 6],
        [3, 7],
      ];
      for (const [ia, ib] of edges) {
        const a = worldCorners[ia];
        const b = worldCorners[ib];
        obstaclePositions.push(a[0], a[1], a[2], b[0], b[1], b[2]);
        obstacleColors.push(...obsColor, ...obsColor);
      }
    });

    this.debugVertices = new Float32Array(linePositions);
    this.debugColors = new Float32Array(lineColors);
    this.debugTriVertices = new Float32Array(triPositions);
    this.debugTriColors = new Float32Array(triColors);
    this.debugObstacleVertices = new Float32Array(obstaclePositions);
    this.debugObstacleColors = new Float32Array(obstacleColors);

    console.log("[navigation] navmesh debug built:", {
      lines: linePositions.length / 6,
      triangles: triPositions.length / 9,
      obstacles: this.obstacles.size,
    });
  }
}

const navigationSystem = new NavigationSystem();
initElementSystem("navigation", navigationSystem, [
  "nav-mesh",
  "nav-obstacle",
  "nav-agent",
  "nav-speed",
  "nav-acceleration",
  "nav-goal-x",
  "nav-goal-y",
  "nav-goal-z",
  "nav-waypoints",
]);

export default navigationSystem;
