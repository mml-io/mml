import { RemoteDocument, RemoteDocumentGraphics } from "@mml-io/mml-web";
import * as THREE from "three";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";
import { getThreeJSReconnectingStatus } from "../ThreeJSReconnectingStatus";

export class ThreeJSRemoteDocument extends RemoteDocumentGraphics<ThreeJSGraphicsAdapter> {
  private statusUI: THREE.Mesh | null = null;

  constructor(private element: RemoteDocument<ThreeJSGraphicsAdapter>) {
    super(element);
  }

  public showError(showError: boolean): void {
    if (!showError) {
      if (this.statusUI !== null) {
        this.element.getContainer().remove(this.statusUI);
        this.statusUI = null;
      }
    } else {
      if (this.statusUI === null) {
        const { geometry, material, height } = getThreeJSReconnectingStatus();
        const mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> = new THREE.Mesh(
          geometry,
          material,
        );
        mesh.position.set(0, height / 2, 0);
        this.statusUI = mesh;
        this.element.getContainer().add(this.statusUI);
      }
    }
  }

  public dispose() {}
}
