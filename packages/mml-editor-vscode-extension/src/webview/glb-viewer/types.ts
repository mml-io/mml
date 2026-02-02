import * as THREE from "three";

export interface TextureInfo {
  name: string;
  width: number;
  height: number;
  format: string;
  slot: string;
  dataUrl: string | null;
  thumbnailUrl: string | null;
}

export interface AnimationInfo {
  name: string;
  duration: number;
  trackCount: number;
}

export interface SkeletonInfo {
  isRigged: boolean;
  boneNames: Set<string>;
  boneCount: number;
  rootBone: string | null;
}

export interface ExternalAnimationFile {
  uri: string;
  relativePath: string;
  fileName: string;
}

export interface ExternalAnimation {
  file: ExternalAnimationFile;
  clips: THREE.AnimationClip[];
  clipInfos: AnimationInfo[];
}

export interface ModelStats {
  fileSize: number;
  vertices: number;
  triangles: number;
  meshes: number;
  materials: number;
  textures: TextureInfo[];
  animations: AnimationInfo[];
  boundingBox: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
    size: { x: number; y: number; z: number };
  } | null;
  colliderVertices: number;
  colliderTriangles: number;
}

export type TextureChannel = "rgba" | "rgb" | "r" | "g" | "b" | "a";

export interface AnimationCompatibility {
  compatible: boolean;
  matchedBones: number;
  totalBones: number;
}
