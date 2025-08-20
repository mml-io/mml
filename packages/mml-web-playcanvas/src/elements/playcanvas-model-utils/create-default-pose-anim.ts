import * as playcanvas from "playcanvas";

export function createDefaultPoseClip(
  entity: playcanvas.Entity,
  bones: Map<string, playcanvas.GraphNode>,
): playcanvas.AnimClip {
  if (!bones) {
    throw new Error("Cannot create default pose clip - no loaded model");
  }

  // Create no-op curves for all bones in the skeleton
  const inputs: playcanvas.AnimData[] = [];
  const outputs: playcanvas.AnimData[] = [];
  const curves: playcanvas.AnimCurve[] = [];
  const events = new playcanvas.AnimEvents([]);

  // Single time keyframe at t=0 for no-op animation
  const timeInput = new playcanvas.AnimData(1, [0.0]);
  inputs.push(timeInput);

  // Create curves for each bone
  let curveIndex = 0;
  const validBones: Array<{ name: string; bone: playcanvas.GraphNode }> = [];

  bones.forEach((bone, boneName) => {
    // Skip if bone name is undefined or empty
    if (!boneName || boneName.trim() === "") {
      return;
    }

    validBones.push({ name: boneName, bone });
  });

  for (const { name: boneName, bone } of validBones) {
    // check bone name is valid
    if (boneName === undefined || boneName === null || boneName === "") {
      continue;
    }

    // Get current transform values for bind pose
    const position = bone.getLocalPosition();
    const rotation = bone.getLocalRotation();
    const scale = bone.getLocalScale();

    const entityPath: string[] = [];
    let currentNode: playcanvas.GraphNode | null = bone;

    if (currentNode === entity) {
      continue;
    }

    // Walk up the hierarchy to build the path
    while (currentNode && currentNode !== entity) {
      entityPath.unshift(currentNode.name);
      currentNode = currentNode.parent;
    }

    // Ensure we have a valid path
    if (entityPath.length === 0 || entityPath.some((name) => !name || name.trim() === "")) {
      console.error(`Invalid entity path for bone "${boneName}" - skipping`);
      continue;
    }

    // Position curve (3 components: x, y, z)
    const positionOutput = new playcanvas.AnimData(3, [position.x, position.y, position.z]);
    outputs.push(positionOutput);
    const positionCurve = new playcanvas.AnimCurve(
      [
        // @ts-expect-error - the playcanvas types are not correct
        {
          entityPath: [...entityPath],
          component: "graph",
          propertyPath: ["localPosition"],
        },
      ],
      0, // input index (time)
      curveIndex, // output index
      playcanvas.INTERPOLATION_LINEAR,
    );
    curves.push(positionCurve);
    curveIndex++;

    // Rotation curve (4 components: x, y, z, w quaternion)
    const rotationOutput = new playcanvas.AnimData(4, [
      rotation.x,
      rotation.y,
      rotation.z,
      rotation.w,
    ]);
    outputs.push(rotationOutput);
    const rotationCurve = new playcanvas.AnimCurve(
      [
        // @ts-expect-error - the playcanvas types are not correct
        {
          entityPath: [...entityPath],
          component: "graph",
          propertyPath: ["localRotation"],
        },
      ],
      0, // input index (time)
      curveIndex, // output index
      playcanvas.INTERPOLATION_LINEAR,
    );
    curves.push(rotationCurve);
    curveIndex++;

    // Scale curve (3 components: x, y, z)
    const scaleOutput = new playcanvas.AnimData(3, [scale.x, scale.y, scale.z]);
    outputs.push(scaleOutput);
    const scaleCurve = new playcanvas.AnimCurve(
      [
        // @ts-expect-error - the playcanvas types are not correct
        {
          entityPath: [...entityPath],
          component: "graph",
          propertyPath: ["localScale"],
        },
      ],
      0, // input index (time)
      curveIndex, // output index
      playcanvas.INTERPOLATION_LINEAR,
    );
    curves.push(scaleCurve);
    curveIndex++;
  }

  const templateTrack = new playcanvas.AnimTrack(
    "DefaultBindPose",
    1.0, // 1 second duration
    inputs,
    outputs,
    curves,
    events,
  );

  // Create the default pose clip using template
  const defaultPoseClip = new playcanvas.AnimClip(
    templateTrack,
    0.0, // start time
    0.0, // speed = 0 to stay at bind pose
    true, // playing
    true, // loop
  );
  defaultPoseClip.name = "DefaultBindPose";
  defaultPoseClip.blendWeight = 1.0;

  return defaultPoseClip;
}
