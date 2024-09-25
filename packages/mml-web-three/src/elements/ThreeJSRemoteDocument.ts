import { RemoteDocument, RemoteDocumentGraphics } from "mml-web";
import * as THREE from "three";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";
import { getThreeJSReconnectingStatus } from "../ThreeJSReconnectingStatus";

export class ThreeJSRemoteDocument extends RemoteDocumentGraphics<ThreeJSGraphicsAdapter> {
  private statusElement: THREE.Mesh | null = null;

  constructor(private element: RemoteDocument<ThreeJSGraphicsAdapter>) {
    super(element);
  }

  public showError(showError: boolean): void {
    if (!showError) {
      if (this.statusElement !== null) {
        this.element.getContainer().remove(this.statusElement);
        this.statusElement = null;
      }
    } else {
      if (this.statusElement === null) {
        const { geometry, material, height } = getThreeJSReconnectingStatus();
        const mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> = new THREE.Mesh(
          geometry,
          material,
        );
        mesh.position.set(0, height / 2, 0);
        this.statusElement = mesh;
        this.element.getContainer().add(this.statusElement);
      }
    }
  }

  public dispose() {}
}
