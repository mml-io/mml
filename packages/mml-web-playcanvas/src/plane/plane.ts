import * as playcanvas from "playcanvas";

export function createPlaneMesh(app: playcanvas.AppBase): playcanvas.Mesh {
  const vertices = [
    // First triangle
    // bottom left
    -0.5, -0.5, 0,
    // bottom right
    0.5, -0.5, 0,
    // top left
    -0.5, 0.5, 0,

    // Second triangle
    // bottom right
    0.5, -0.5, 0,
    // top right
    0.5, 0.5, 0,
    // top left
    -0.5, 0.5, 0,

    // First triangle
    // top left
    -0.5, 0.5, 0,
    // bottom right
    0.5, -0.5, 0,
    // bottom left
    -0.5, -0.5, 0,

    // Second triangle
    // top left
    -0.5, 0.5, 0,
    // top right
    0.5, 0.5, 0,
    // bottom right
    0.5, -0.5, 0,
  ];

  const uvs = [
    // First triangle
    // bottom left
    0, 1,
    // bottom right
    1, 1,
    // top left
    0, 0,

    // Second triangle
    // bottom right
    1, 1,
    // top right
    1, 0,
    // top left
    0, 0,

    // First triangle
    // top left
    0, 0,
    // bottom right
    1, 1,
    // bottom left
    0, 1,

    // Second triangle
    // top left
    0, 0,
    // top right
    1, 0,
    // bottom right
    1, 1,
  ];

  const normals = Array.from({ length: vertices.length / 3 }).flatMap((value, index) => {
    return index < 6 ? [0, 0, 1] : [0, 0, -1];
  });

  const mesh = new playcanvas.Mesh(app.graphicsDevice);
  mesh.setPositions(vertices);
  mesh.setUvs(0, uvs);
  mesh.setNormals(normals);
  mesh.update();
  return mesh;
}

export function createPlaneModel(app: playcanvas.AppBase, material: playcanvas.StandardMaterial) {
  const mesh = createPlaneMesh(app);
  const rootNode = new playcanvas.GraphNode();
  const meshInstance = new playcanvas.MeshInstance(mesh, material, rootNode);
  meshInstance.renderStyle = playcanvas.RENDERSTYLE_SOLID;
  const model = new playcanvas.Model();
  model.graph = rootNode;
  model.meshInstances.push(meshInstance);
  return { model, meshInstance };
}
