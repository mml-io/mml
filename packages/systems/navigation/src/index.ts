import { ElementSystem, initElementSystem } from "mml-game-systems-common";
import { computeWorldTransformFor as mathComputeWorldTransformFor, Vec3 } from "mml-game-math-system";
import {
  init as recastInit,
  NavMesh,
  NavMeshQuery,
  Crowd,
  DebugDrawerUtils,
} from "recast-navigation";
import { generateTileCache } from "recast-navigation/generators";

type DebugDrawMode =
  | "navmesh"
  | "heightfieldWalkable"
  | "heightfieldSolid"
  | "compactHeightfieldSolid"
  | "compactHeightfieldRegions"
  | "compactHeightfieldDistance"
  | "navmeshBVTree"
  | "staticGeometry";

type NavigationConfig = {
  tileSize?: number;
  cellSize?: number;
  cellHeight?: number;
  agentHeight?: number;
  agentRadius?: number;
  agentMaxClimb?: number;
  agentMaxSlope?: number;
  debug?: boolean;
  debugDrawMode?: DebugDrawMode;
};

type AgentState = {
  element: Element;
  agentId: number;
  speed: number;
};

class NavigationSystem implements ElementSystem {
  private navMesh: NavMesh | null = null;
  private navQuery: NavMeshQuery | null = null;
  private crowd: Crowd | null = null;
  private tileCache: any | null = null;
  private generatorIntermediates: any | null = null;
  private debugVertices: Float32Array | null = null;
  private debugColors: Float32Array | null = null;
  private lastNetworkTime = 0;
  private elementToAgent = new Map<Element, AgentState>();
  private obstacles = new Map<Element, unknown>();
  private agentWaypoints = new Map<number, Array<{ x: number; y: number; z: number }>>();
  private agentCurrentTarget = new Map<number, { x: number; y: number; z: number }>();
  private agentDebugLastLog = new Map<number, number>();
  private agentWaypointIndex = new Map<number, number>();
  private agentWaitUntil = new Map<number, number | null>();
  private config: Required<NavigationConfig> = {
    tileSize: 32,
    cellSize: 0.3,
    cellHeight: 0.2,
    agentHeight: 2.0,
    agentRadius: 0.6,
    agentMaxClimb: 0.9,
    agentMaxSlope: 45,
    debug: false,
    debugDrawMode: "navmesh",
  };

  private computeWorldTransformFor(element: Element | null) {
    return mathComputeWorldTransformFor(element, {
      getBodyForElement: () => null,
    });
  }

  async init(config: NavigationConfig = {}) {
    console.log("[navigation] init:start", config);
    await recastInit();
    this.config = { ...this.config, ...config };
    // Build initial navmesh from current scene
    this.rebuildNavMeshFromScene();
    console.log("[navigation] init:done");
  }

  private collectStaticGeometry(): { positions: number[]; indices: number[] } {
    // Use mml-web colliders as geometry source similar to physics approach
    // Fallback: approximate primitives into simple meshes
    const positions: number[] = [];
    const indices: number[] = [];

    const elements = document.querySelectorAll("m-cube, m-cylinder, m-sphere, m-plane, m-model");
    let vertexOffset = 0;

    elements.forEach((element) => {
      // Only include elements explicitly marked as nav obstacles
      if (element.hasAttribute("nav-agent")) {
        console.log("[navigation] obstacle:skipped", element);
        return;
      }

      // Only include static/kinematic colliders as navigation obstacles
      const isDynamic = element.hasAttribute("rigidbody") && !element.hasAttribute("kinematic");
      if (isDynamic) return;

      const tag = element.tagName.toLowerCase();
      const world = this.computeWorldTransformFor(element);

      if (tag === "m-cube" || tag === "m-plane") {
        const width = parseFloat(element.getAttribute("width") || (tag === "m-plane" ? "10" : "1"));
        const height = parseFloat(element.getAttribute("height") || "1");
        const depth = parseFloat(element.getAttribute("depth") || (tag === "m-plane" ? "10" : "1"));

        const hw = (width * world.scale.x) / 2;
        const hh = (height * world.scale.y) / 2;
        const hd = (depth * world.scale.z) / 2;

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
        const radius = parseFloat(element.getAttribute("radius") || "0.5");
        const height = parseFloat(element.getAttribute("height") || "1");
        const rx = radius * Math.max(world.scale.x, world.scale.z);
        const rh = (height * world.scale.y) / 2;
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
    });

    return { positions, indices };
  }

  private rebuildNavMeshFromScene() {
    console.log("[navigation] rebuild:begin");
    this.agentWaypoints.clear();
    this.agentCurrentTarget.clear();
    this.agentDebugLastLog.clear();
    this.agentWaypointIndex.clear();
    this.agentWaitUntil.clear();

    // Snapshot current agents to re-add after rebuild
    const currentAgents = Array.from(this.elementToAgent.values()).map((a) => a.element);

    const { positions, indices } = this.collectStaticGeometry();
    console.log("[navigation] geometry", { vertexCount: positions.length / 3, triangleCount: indices.length / 3 });
    if (positions.length === 0 || indices.length === 0) {
      this.navMesh = null;
      this.navQuery = null;
      this.crowd = null;
      this.tileCache = null;
      console.warn("[navigation] rebuild: no geometry found");
      return;
    }

    const { success, navMesh, tileCache, intermediates } = generateTileCache(positions, indices, {
      tileSize: this.config.tileSize,
      cellSize: this.config.cellSize,
      cellHeight: this.config.cellHeight,
      agentHeight: this.config.agentHeight,
      agentRadius: this.config.agentRadius,
      agentMaxClimb: this.config.agentMaxClimb,
      agentMaxSlope: this.config.agentMaxSlope,
    } as any, true as any);


    if (!success) {
      console.error("[navigation] rebuild: failed to generate navmesh");
      return;
    }
    

    this.navMesh = navMesh;
    this.navQuery = new NavMeshQuery(navMesh);
    this.crowd = new Crowd(navMesh, { maxAgents: 128, maxAgentRadius: this.config.agentRadius });
    this.tileCache = tileCache as any;
    this.generatorIntermediates = intermediates as any;

    (this.tileCache as any).update(navMesh);

    // Rebuild debug buffers for visualization
    this.buildDebugBuffers();

    // Re-add agents to new crowd at current positions
    this.elementToAgent.clear();
    currentAgents.forEach((el) => {
      const world = this.computeWorldTransformFor(el);
      const pos = { x: world.position.x, y: world.position.y, z: world.position.z };
      const speedAttr = parseFloat(el.getAttribute("nav-speed") || "");
      const maxSpeed = isFinite(speedAttr) && speedAttr > 0 ? speedAttr : 3.5;
      const params = {
        radius: this.config.agentRadius,
        height: this.config.agentHeight,
        maxAcceleration: 8.0,
        maxSpeed,
        collisionQueryRange: this.config.agentRadius * 12.0,
        pathOptimizationRange: this.config.agentRadius * 30.0,
        separationWeight: 0.5,
      } as any;
      const agent = this.crowd!.addAgent(pos, params) as any;
      const agentId: number = agent.agentIndex;
      this.elementToAgent.set(el, { element: el, agentId, speed: maxSpeed });
      console.log("[navigation] agent:readded", { agentId, pos });
      this.setupPatrolIfDeclared(el, agentId);
    });
    console.log("[navigation] rebuild:done", { agents: this.elementToAgent.size });
  }

  // Mutation observer intentionally removed: static navmesh only, no dynamic rebuilds

  start() {}

  step(_deltaTime: number) {
    if (!this.crowd) return;
    // Advance crowd simulation at ~60Hz
    const dt = Math.max(1 / 240, Math.min(_deltaTime || 1 / 60, 1 / 30));
    this.crowd.update(dt);

    // Sync agent positions to DOM (position only)
    this.elementToAgent.forEach((state) => {
      const ag = this.crowd!.getAgent(state.agentId);
      if (!ag) return;
      const p = ag.position();
      const parentWorld = this.computeWorldTransformFor(state.element.parentElement);
      const elementWorld = this.computeWorldTransformFor(state.element);
      const renderHeight = parseFloat(state.element.getAttribute("height") || "1");
      const worldRenderHeight = renderHeight * (elementWorld?.scale?.y ?? 1);
      const yOffset = (worldRenderHeight - this.config.agentHeight) / 2;
      const worldPos = new Vec3(p.x, p.y + yOffset, p.z);
      const localPos = parentWorld.rotation
        .conjugate()
        .rotateVector(worldPos.sub(parentWorld.position))
        .div(parentWorld.scale);
      state.element.setAttribute("x", localPos.x.toFixed(3));
      state.element.setAttribute("y", localPos.y.toFixed(3));
      state.element.setAttribute("z", localPos.z.toFixed(3));
    });

    // Patrol progression (no intervals or repathing)
    this.elementToAgent.forEach((state) => {
      const wps = this.agentWaypoints.get(state.agentId);
      if (!wps || wps.length === 0) return;
      const ag = this.crowd!.getAgent(state.agentId);
      if (!ag) return;
      const pos = ag.position();
      const idx = this.agentWaypointIndex.get(state.agentId) ?? 0;
      let tgt = this.agentCurrentTarget.get(state.agentId) || null;

      // If no current target set (e.g., after reload), set to current waypoint
      if (!tgt) {
        const result = this.navQuery!.findClosestPoint(wps[idx]);
        if (result && result.success) {
          ag.requestMoveTarget(result.point);
          this.agentCurrentTarget.set(state.agentId, result.point);
        }
        return;
      }

      const dx = pos.x - tgt.x;
      const dy = pos.y - tgt.y;
      const dz = pos.z - tgt.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq < 1.0) {
        const waitUntil = this.agentWaitUntil.get(state.agentId) ?? null;
        const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
        if (waitUntil === null) {
          this.agentWaitUntil.set(state.agentId, now + 1000);
        } else if (now >= waitUntil) {
          const nextIdx = (idx + 1) % wps.length;
          this.agentWaypointIndex.set(state.agentId, nextIdx);
          this.agentWaitUntil.set(state.agentId, null);
          const result = this.navQuery!.findClosestPoint(wps[nextIdx]);
          if (result && result.success) {
            ag.requestMoveTarget(result.point);
            this.agentCurrentTarget.set(state.agentId, result.point);
          }
        }
      }
    });

    // Emit navmesh debug buffers (throttled) if enabled
    if (this.config.debug && this.debugVertices && this.debugColors) {
      const now = (document.timeline.currentTime as number) || 0;
      if (now > this.lastNetworkTime + 100) {
        this.lastNetworkTime = now;
        // Build dynamic agent and waypoint debug lines on top of static navmesh lines
        const dynPositions: number[] = [];
        const dynColors: number[] = [];

        const pushLine = (
          ax: number, ay: number, az: number,
          bx: number, by: number, bz: number,
          r: number, g: number, b: number, a: number,
        ) => {
          dynPositions.push(ax, ay, az, bx, by, bz);
          dynColors.push(r, g, b, a, r, g, b, a);
        };

        // Per-agent markers and target lines
        this.elementToAgent.forEach((state) => {
          const ag = this.crowd!.getAgent(state.agentId);
          if (!ag) return;
          const p = ag.position();

          // Agent cross marker (yellow)
          const s = 0.25;
          pushLine(p.x - s, p.y, p.z, p.x + s, p.y, p.z, 1.0, 1.0, 0.0, 1.0);
          pushLine(p.x, p.y - s, p.z, p.x, p.y + s, p.z, 1.0, 1.0, 0.0, 1.0);
          pushLine(p.x, p.y, p.z - s, p.x, p.y, p.z + s, 1.0, 1.0, 0.0, 1.0);

          // Current target line (red)
          const tgt = this.agentCurrentTarget.get(state.agentId);
          if (tgt) {
            pushLine(p.x, p.y, p.z, tgt.x, tgt.y, tgt.z, 1.0, 0.0, 0.0, 1.0);
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

          // Periodic state logging when debug is enabled
          if (this.config.debug) {
            const last = this.agentDebugLastLog.get(state.agentId) || 0;
            if (now - last > 1000) {
              this.agentDebugLastLog.set(state.agentId, now);
              const mode = wps.length > 0 ? "patrol" : (tgt ? "goal" : "idle");
              const dist = tgt ? Math.hypot(p.x - tgt.x, p.y - tgt.y, p.z - tgt.z) : null;
              console.log("[navigation] agent:state", {
                agentId: state.agentId,
                mode,
                position: { x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3) },
                target: tgt ? { x: +tgt.x.toFixed(3), y: +tgt.y.toFixed(3), z: +tgt.z.toFixed(3) } : null,
                distanceToTarget: dist !== null ? +dist.toFixed(3) : null,
                waypointsCount: wps.length,
              });
            }
          }
        });

        const baseVerts = this.debugVertices;
        const baseCols = this.debugColors;
        const outVerts = new Float32Array(baseVerts.length + dynPositions.length);
        outVerts.set(baseVerts, 0);
        outVerts.set(new Float32Array(dynPositions), baseVerts.length);
        const outCols = new Float32Array(baseCols.length + dynColors.length);
        outCols.set(baseCols, 0);
        outCols.set(new Float32Array(dynColors), baseCols.length);

        try {
          window.parent.postMessage(
            {
              source: "ai-game-creator",
              type: "navmesh-debug-buffers",
              vertices: outVerts,
              colors: outCols,
            },
            "*",
          );
        } catch (e) {
          console.warn("Navigation debug render failed:", e);
        }
      }
    }
  }

  dispose() {
    this.elementToAgent.clear();
    this.obstacles.clear();
    this.navMesh = null;
    this.navQuery = null;
    this.crowd = null;
    this.tileCache = null;
  }

  processElement(element: Element, attributes: Array<{ attributeName: string; value: any }>) {
    if (!this.navMesh) return;
    const isAgent = attributes.some((a) => a.attributeName === "nav-agent");
    const speedAttr = attributes.find((a) => a.attributeName === "nav-speed");
    const waypointsAttr = attributes.find((a) => a.attributeName === "nav-waypoints");

    if (!isAgent) {
      return;
    }

    if (isAgent && this.crowd && !this.elementToAgent.has(element)) {
      const world = this.computeWorldTransformFor(element);
      const pos = { x: world.position.x, y: world.position.y, z: world.position.z };
      const parsedSpeed = typeof speedAttr?.value === "number" ? speedAttr!.value as number : parseFloat(String(speedAttr?.value ?? ""));
      const maxSpeed = isFinite(parsedSpeed) && parsedSpeed > 0 ? parsedSpeed : 3.5;
      const params = {
        radius: this.config.agentRadius,
        height: this.config.agentHeight,
        maxAcceleration: 8.0,
        maxSpeed,
        collisionQueryRange: this.config.agentRadius * 12.0,
        pathOptimizationRange: this.config.agentRadius * 30.0,
        separationWeight: 0.5,
      } as any;
      const agent = this.crowd!.addAgent(pos, params) as any;
      const agentId: number = agent.agentIndex;
      this.elementToAgent.set(element, { element, agentId, speed: maxSpeed });
      console.log("[navigation] agent:added", { agentId, pos });

      // If waypoints are defined declaratively, start patrol without window APIs
      if (waypointsAttr && typeof waypointsAttr.value === "string" && waypointsAttr.value.length > 0) {
        this.setupPatrolIfDeclared(element, agentId, waypointsAttr.value);
      }
    }
  }

  private setupPatrolIfDeclared(element: Element, agentId: number, waypointsString?: string) {
    const raw = waypointsString ?? element.getAttribute("nav-waypoints") ?? "";
    if (!raw) return;
    const points = raw
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((triple) => {
        const [x, y, z] = triple.split(",").map((n) => parseFloat(n.trim()));
        return { x, y, z } as { x: number; y: number; z: number };
      })
      .filter((p) => isFinite(p.x) && isFinite(p.y) && isFinite(p.z));
    if (points.length < 2) return;
    console.log("[navigation] patrol:start", { agentId, waypointsParsed: points.length, points });
    this.agentWaypoints.set(agentId, points);
    // Initialize patrol state
    this.agentWaypointIndex.set(agentId, 0);
    this.agentWaitUntil.set(agentId, null);

    // No background intervals; handled in step

    const requestMoveToIndex = (idx: number, logType: "move" | "repath" = "move") => {
      if (!this.crowd || !this.navQuery) return;
      const target = points[idx];
      const result = this.navQuery.findClosestPoint(target);
      if (result && result.success) {
        const ag = this.crowd.getAgent(agentId);
        ag?.requestMoveTarget(result.point);
        this.agentCurrentTarget.set(agentId, result.point);
        console.log(`[navigation] patrol:${logType}` as const, { agentId, index: idx, target: result.point });
      } else {
        console.log("[navigation] patrol:closestPoint:fail", { agentId, index: idx, candidate: target });
      }
    };

    // Kick off by moving to the first waypoint; subsequent progression handled in step
    requestMoveToIndex(0);
  }

  onElementRemoved(element: Element) {
    const agent = this.elementToAgent.get(element);
    if (agent && this.crowd) {
      (this.crowd as any).removeAgent(agent.agentId);
      this.elementToAgent.delete(element);
      this.agentWaypoints.delete(agent.agentId);
      this.agentCurrentTarget.delete(agent.agentId);
      this.agentWaypointIndex.delete(agent.agentId);
      this.agentWaitUntil.delete(agent.agentId);
    }
  }

  // Public API (simplified): no dynamic repath/intervals
  goTo(element: Element, target: { x: number; y: number; z: number }) {
    if (!this.crowd || !this.navQuery) return;
    let agentState = this.elementToAgent.get(element);
    if (!agentState) {
      this.processElement(element, [{ attributeName: "nav-agent", value: true }]);
      agentState = this.elementToAgent.get(element) || null as any;
    }
    if (!agentState) return;
    const result = this.navQuery.findClosestPoint(target);
    if (!result || !result.success) return;
    const ag = this.crowd.getAgent(agentState.agentId);
    ag?.requestMoveTarget(result.point);
    this.agentCurrentTarget.set(agentState.agentId, result.point);
    console.log("[navigation] goTo", { agentId: agentState.agentId, target: result.point });
  }

  addBoxObstacle(center: { x: number; y: number; z: number }, halfExtents: { x: number; y: number; z: number }, angleRad = 0) {
    if (!this.navMesh || !this.tileCache) return null;
    const res = (this.tileCache as any).addBoxObstacle(center, halfExtents, angleRad);
    (this.tileCache as any).update(this.navMesh);
    return res?.obstacle ?? null;
  }

  rebuild() {
    this.rebuildNavMeshFromScene();
  }

  setDebugDrawMode(mode: DebugDrawMode) {
    this.config.debugDrawMode = mode;
    this.buildDebugBuffers();
  }

  private buildDebugBuffers() {
    if (!this.navMesh) {
      this.debugVertices = null;
      this.debugColors = null;
      return;
    }

    const debugDrawer = new DebugDrawerUtils();
    const primitives: Array<ReturnType<typeof debugDrawer.drawNavMesh>[number]> = [] as any;

    switch (this.config.debugDrawMode) {
      case "navmesh": {
        primitives.push(...debugDrawer.drawNavMesh(this.navMesh));
        break;
      }
      case "heightfieldWalkable": {
        const tiles = this.generatorIntermediates?.tileIntermediates || [];
        for (const t of tiles) {
          if (t.heightfield) {
            primitives.push(...debugDrawer.drawHeightfieldWalkable(t.heightfield));
          }
        }
        break;
      }
      case "heightfieldSolid": {
        const tiles = this.generatorIntermediates?.tileIntermediates || [];
        for (const t of tiles) {
          if (t.heightfield) {
            primitives.push(...debugDrawer.drawHeightfieldSolid(t.heightfield));
          }
        }
        break;
      }
      case "compactHeightfieldSolid": {
        const tiles = this.generatorIntermediates?.tileIntermediates || [];
        for (const t of tiles) {
          if (t.compactHeightfield) {
            primitives.push(...debugDrawer.drawCompactHeightfieldSolid(t.compactHeightfield));
          }
        }
        break;
      }
      case "compactHeightfieldRegions": {
        const tiles = this.generatorIntermediates?.tileIntermediates || [];
        for (const t of tiles) {
          if (t.compactHeightfield) {
            primitives.push(...debugDrawer.drawCompactHeightfieldRegions(t.compactHeightfield));
          }
        }
        break;
      }
      case "compactHeightfieldDistance": {
        const tiles = this.generatorIntermediates?.tileIntermediates || [];
        for (const t of tiles) {
          if (t.compactHeightfield) {
            primitives.push(...debugDrawer.drawCompactHeightfieldDistance(t.compactHeightfield));
          }
        }
        break;
      }
      case "navmeshBVTree": {
        primitives.push(...debugDrawer.drawNavMeshBVTree(this.navMesh));
        break;
      }
      case "staticGeometry": {
        const { positions: geomPositions, indices: geomIndices } = this.collectStaticGeometry();
        const staticLines: { type: "lines"; vertices: [number, number, number, number, number, number, number][] } = {
          type: "lines",
          vertices: [],
        };
        const color: [number, number, number, number] = [0.2, 0.8, 1.0, 1.0];
        for (let i = 0; i + 2 < geomIndices.length; i += 3) {
          const i0 = geomIndices[i] * 3;
          const i1 = geomIndices[i + 1] * 3;
          const i2 = geomIndices[i + 2] * 3;
          const v0: [number, number, number, number, number, number, number] = [
            geomPositions[i0 + 0],
            geomPositions[i0 + 1],
            geomPositions[i0 + 2],
            color[0], color[1], color[2], color[3],
          ];
          const v1: [number, number, number, number, number, number, number] = [
            geomPositions[i1 + 0],
            geomPositions[i1 + 1],
            geomPositions[i1 + 2],
            color[0], color[1], color[2], color[3],
          ];
          const v2: [number, number, number, number, number, number, number] = [
            geomPositions[i2 + 0],
            geomPositions[i2 + 1],
            geomPositions[i2 + 2],
            color[0], color[1], color[2], color[3],
          ];
          // edges: 0-1, 1-2, 2-0
          staticLines.vertices.push(v0, v1);
          staticLines.vertices.push(v1, v2);
          staticLines.vertices.push(v2, v0);
        }
        primitives.push(staticLines);
        break;
      }
      default: {
        primitives.push(...debugDrawer.drawNavMesh(this.navMesh));
        break;
      }
    }

    const positions: number[] = [];
    const colors: number[] = [];

    console.log("[navigation] buildDebugBuffers:primitives", primitives);
    for (const prim of primitives) {
      const verts = prim.vertices;
      if (prim.type === "lines") {
        for (let i = 0; i + 1 < verts.length; i += 2) {
          const a = verts[i];
          const b = verts[i + 1];
          positions.push(a[0], a[1], a[2], b[0], b[1], b[2]);
          colors.push(a[3], a[4], a[5], a[6] ?? 1, b[3], b[4], b[5], b[6] ?? 1);
        }
      } else if (prim.type === "tris") {
        for (let i = 0; i + 2 < verts.length; i += 3) {
          const v0 = verts[i];
          const v1 = verts[i + 1];
          const v2 = verts[i + 2];
          // Edge 0-1
          positions.push(v0[0], v0[1], v0[2], v1[0], v1[1], v1[2]);
          colors.push(v0[3], v0[4], v0[5], v0[6] ?? 1, v1[3], v1[4], v1[5], v1[6] ?? 1);
          // Edge 1-2
          positions.push(v1[0], v1[1], v1[2], v2[0], v2[1], v2[2]);
          colors.push(v1[3], v1[4], v1[5], v1[6] ?? 1, v2[3], v2[4], v2[5], v2[6] ?? 1);
          // Edge 2-0
          positions.push(v2[0], v2[1], v2[2], v0[0], v0[1], v0[2]);
          colors.push(v2[3], v2[4], v2[5], v2[6] ?? 1, v0[3], v0[4], v0[5], v0[6] ?? 1);
        }
      } else if (prim.type === "quads") {
        for (let i = 0; i + 3 < verts.length; i += 4) {
          const v0 = verts[i];
          const v1 = verts[i + 1];
          const v2 = verts[i + 2];
          const v3 = verts[i + 3];
          // 0-1, 1-2, 2-3, 3-0
          positions.push(v0[0], v0[1], v0[2], v1[0], v1[1], v1[2]);
          colors.push(v0[3], v0[4], v0[5], v0[6] ?? 1, v1[3], v1[4], v1[5], v1[6] ?? 1);
          positions.push(v1[0], v1[1], v1[2], v2[0], v2[1], v2[2]);
          colors.push(v1[3], v1[4], v1[5], v1[6] ?? 1, v2[3], v2[4], v2[5], v2[6] ?? 1);
          positions.push(v2[0], v2[1], v2[2], v3[0], v3[1], v3[2]);
          colors.push(v2[3], v2[4], v2[5], v2[6] ?? 1, v3[3], v3[4], v3[5], v3[6] ?? 1);
          positions.push(v3[0], v3[1], v3[2], v0[0], v0[1], v0[2]);
          colors.push(v3[3], v3[4], v3[5], v3[6] ?? 1, v0[3], v0[4], v0[5], v0[6] ?? 1);
        }
      }
      // points are ignored for line rendering
    }

    this.debugVertices = new Float32Array(positions);
    this.debugColors = new Float32Array(colors);

    debugDrawer.dispose();
  }
}

const navigationSystem = new NavigationSystem();
initElementSystem("navigation", navigationSystem, [
  "nav-obstacle",
  "nav-agent",
  "nav-speed",
  "nav-goal-x",
  "nav-goal-y",
  "nav-goal-z",
  "nav-waypoints"
]);

export default navigationSystem;

