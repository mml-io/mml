import { DebugHelper, DebugHelperGraphics } from "mml-web";
import * as playcanvas from "playcanvas";

import { PlayCanvasGraphicsAdapter } from "../PlayCanvasGraphicsAdapter";

// TODO - improve and make parent scale-independent
// TODO - disable casting shadows
function createAxisLine(
  app: playcanvas.AppBase,
  color: playcanvas.Color,
  start: playcanvas.Vec3,
  end: playcanvas.Vec3,
) {
  const line = new playcanvas.Entity("line", app);

  // Vertices including position and color interleaved
  const vertices = [
    start.x,
    start.y,
    start.z,
    color.r,
    color.g,
    color.b, // Start vertex
    end.x,
    end.y,
    end.z,
    color.r,
    color.g,
    color.b, // End vertex
  ];

  const vertexFormat = new playcanvas.VertexFormat(app.graphicsDevice, [
    { semantic: playcanvas.SEMANTIC_POSITION, components: 3, type: playcanvas.TYPE_FLOAT32 },
    { semantic: playcanvas.SEMANTIC_COLOR, components: 3, type: playcanvas.TYPE_FLOAT32 },
  ]);

  const vertexBuffer = new playcanvas.VertexBuffer(app.graphicsDevice, vertexFormat, 2);

  const typedArray = new Float32Array(vertexBuffer.lock());
  typedArray.set(vertices);
  vertexBuffer.unlock();

  const mesh = new playcanvas.Mesh(app.graphicsDevice);
  mesh.vertexBuffer = vertexBuffer;
  mesh.primitive[0] = {
    type: playcanvas.PRIMITIVE_LINES,
    base: 0,
    count: 2,
    indexed: false,
  };

  const material = new playcanvas.BasicMaterial();
  material.color = color;
  material.update();

  const rootNode = new playcanvas.GraphNode();

  const meshInstance = new playcanvas.MeshInstance(mesh, material, rootNode);
  meshInstance.renderStyle = playcanvas.RENDERSTYLE_WIREFRAME;
  meshInstance.castShadow = false;

  const model = new playcanvas.Model();
  model.graph = rootNode;
  model.meshInstances.push(meshInstance);

  const modelComponent = line.addComponent("model") as playcanvas.ModelComponent;
  modelComponent.model = model;

  return line;
}

export class PlayCanvasDebugHelper extends DebugHelperGraphics<PlayCanvasGraphicsAdapter> {
  private debugAxes: playcanvas.Entity | null = null;

  constructor(private debugHelper: DebugHelper<PlayCanvasGraphicsAdapter>) {
    super(debugHelper);

    // Create a parent entity for the axes
    const playcanvasApp = this.debugHelper.element
      .getScene()
      .getGraphicsAdapter()
      .getPlayCanvasApp();

    const playcanvasEntity: playcanvas.Entity = this.debugHelper.getContainer();
    this.debugAxes = new playcanvas.Entity("axes", playcanvasApp);

    playcanvasEntity.addChild(this.debugAxes);

    // Create and add X axis (red)
    const xAxis = createAxisLine(
      playcanvasApp,
      new playcanvas.Color(1, 0, 0),
      new playcanvas.Vec3(0, 0, 0),
      new playcanvas.Vec3(1, 0, 0),
    );
    this.debugAxes.addChild(xAxis);

    // Create and add Y axis (green)
    const yAxis = createAxisLine(
      playcanvasApp,
      new playcanvas.Color(0, 1, 0),
      new playcanvas.Vec3(0, 0, 0),
      new playcanvas.Vec3(0, 1, 0),
    );
    this.debugAxes.addChild(yAxis);

    // Create and add Z axis (blue)
    const zAxis = createAxisLine(
      playcanvasApp,
      new playcanvas.Color(0, 0, 1),
      new playcanvas.Vec3(0, 0, 0),
      new playcanvas.Vec3(0, 0, 1),
    );
    this.debugAxes.addChild(zAxis);
  }

  dispose() {
    if (this.debugAxes) {
      this.debugHelper.getContainer().removeChild(this.debugAxes);
      this.debugAxes.destroy();
    }
    this.debugAxes = null;
  }
}
