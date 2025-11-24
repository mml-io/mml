import { CONSTANTS } from "./constants.js";
import { distance3D, Position } from "./helpers.js";

export class Player {
  public connectionId: number;

  public characterController: any | null;

  public characterModel: HTMLElement;
  public rifleModel: HTMLElement;

  public idleAnim: HTMLElement;
  public runAnim: HTMLElement;
  public airAnim: HTMLElement;
  public strafeLeftAnim: HTMLElement;
  public strafeRightAnim: HTMLElement;
  public runBackwardAnim: HTMLElement;

  public position: Position;
  public rotation: number;
  public rotationRadians: number;

  public debugSphere: HTMLElement;

  private sceneGroup: HTMLElement;

  constructor(connectionId: number, sceneGroup: HTMLElement) {
    this.connectionId = connectionId;
    this.sceneGroup = sceneGroup;
    this.position = { x: 0, y: 0, z: 0 };
    this.rotation = 0;
    this.rotationRadians = 0;
    this.characterController = null;
    this.createCharacter();
    this.createDebugSphere();
  }

  private createDebugSphere(): void {
    this.debugSphere = document.createElement("m-sphere");
    this.debugSphere.setAttribute("id", `muzzle-debug-${this.connectionId}`);
    this.debugSphere.setAttribute("radius", "0.05");
    this.debugSphere.setAttribute("color", "#ff0000");
    this.debugSphere.setAttribute("collide", "false");
    this.debugSphere.setAttribute("visible", "false");
    this.sceneGroup.appendChild(this.debugSphere);
  }

  public updateDebugSphere(): void {
    if (!this.debugSphere) return;

    // apply rotated muzzle offset
    const rotRad = (this.rotation * Math.PI) / 180;
    const cosRot = Math.cos(rotRad);
    const sinRot = Math.sin(rotRad);

    const muzzle = CONSTANTS.GUN_MUZZLE_OFFSET;
    const muzzlePos = {
      x: this.position.x + muzzle.x * cosRot + muzzle.z * sinRot,
      y: this.position.y + muzzle.y,
      z: this.position.z - muzzle.x * sinRot + muzzle.z * cosRot,
    };

    this.debugSphere.setAttribute("x", muzzlePos.x.toString());
    this.debugSphere.setAttribute("y", muzzlePos.y.toString());
    this.debugSphere.setAttribute("z", muzzlePos.z.toString());
  }

  private createCharacter(): void {
    this.characterModel = document.createElement("m-character");
    this.characterModel.setAttribute("id", `player-${this.connectionId}`);
    this.characterModel.setAttribute("collide", "false");
    this.characterModel.setAttribute("src", CONSTANTS.CHARACTER_BODY);
    (this.characterModel as any).dataset.connectionId = this.connectionId.toString();
    this.characterModel.setAttribute("state", "idle");
    this.addLerp(this.characterModel, 100, "x,y,z,ry");
    this.setTransform(this.characterModel, Math.random() * 4 - 2, 0, Math.random() * 4 - 2, 0);
    this.sceneGroup.appendChild(this.characterModel);

    this.rifleModel = document.createElement("m-model");
    this.rifleModel.setAttribute("socket", "mixamorigRightHand");
    this.rifleModel.setAttribute("collide", "false");
    this.rifleModel.setAttribute("x", "-5");
    this.rifleModel.setAttribute("y", "10");
    this.rifleModel.setAttribute("z", "5");
    this.rifleModel.setAttribute("rx", "180");
    this.rifleModel.setAttribute("ry", "180");
    this.rifleModel.setAttribute("rz", "90");
    this.rifleModel.setAttribute("src", CONSTANTS.RIFLE);
    this.rifleModel.setAttribute("sx", "100");
    this.rifleModel.setAttribute("sy", "100");
    this.rifleModel.setAttribute("sz", "100");
    this.rifleModel.setAttribute("visible", "true");
    this.characterModel.appendChild(this.rifleModel);

    this.characterController = this.createController();
    this.characterModel.appendChild(this.characterController);

    this.idleAnim = this.createAnimation("idle");
    this.runAnim = this.createAnimation("run");
    this.airAnim = this.createAnimation("air");
    this.strafeLeftAnim = this.createAnimation("strafe-left");
    this.strafeRightAnim = this.createAnimation("strafe-right");
    this.runBackwardAnim = this.createAnimation("run-backward");

    this.characterModel.addEventListener("character-move", (event: any) => {
      const { position, rotation, state } = event.detail;
      this.setTransform(this.characterModel, position.x, position.y, position.z, rotation.ry);
      this.characterModel.setAttribute("state", state);
      this.position = position;
      this.rotation = rotation.ry;
      this.rotationRadians = (rotation.ry * Math.PI) / 180;
    });
  }

  public createController(): HTMLElement {
    const controller = document.createElement("m-topdown-shooter-controller");
    controller.setAttribute("visible-to", this.connectionId.toString());
    this.characterController = controller;
    return controller;
  }

  private createAnimation(state: string): HTMLElement {
    const animName = `ANIM_${state.toUpperCase().replace(/-/g, "_")}`;
    const animSrc = CONSTANTS[animName as keyof typeof CONSTANTS];
    const animation = document.createElement("m-animation");
    animation.setAttribute("src", animSrc.toString());
    animation.setAttribute("state", state);
    this.addLerp(animation, 150, "weight");
    this.characterModel.appendChild(animation);
    return animation;
  }

  private addLerp(element: HTMLElement, duration: number, attrs: string): void {
    const lerp = document.createElement("m-attr-lerp");
    lerp.setAttribute("attr", attrs);
    lerp.setAttribute("duration", duration.toString());
    element.appendChild(lerp);
  }

  public setTransform(element: HTMLElement, x: number, y: number, z: number, ry: number): void {
    element.setAttribute("x", x.toString());
    element.setAttribute("y", y.toString());
    element.setAttribute("z", z.toString());
    element.setAttribute("ry", ry.toString());
  }

  public getPosition(): Position {
    return this.position;
  }

  public getCurrentRotationDegrees(): number {
    return this.rotation;
  }

  public distanceTo(target: Position): number {
    return distance3D(this.getPosition(), target);
  }

  public respawn(x: number, y: number, z: number): void {
    console.log(`Respawning Player ID [${this.connectionId}] at (${x}, ${y}, ${z})`);

    if (this.characterController && this.characterModel.contains(this.characterController)) {
      this.characterModel.removeChild(this.characterController);
      this.characterController = null;
    }

    this.setTransform(this.characterModel, x, y, z, 0);
    this.position = { x, y, z };

    this.characterController = this.createController();
    this.characterModel.appendChild(this.characterController);
  }

  public dispose(): void {
    if (this.rifleModel && this.rifleModel.parentNode) {
      this.rifleModel.remove();
    }
    if (this.characterModel && this.characterModel.parentNode) {
      this.characterModel.remove();
    }
    if (this.debugSphere && this.debugSphere.parentNode) {
      this.debugSphere.remove();
    }
  }
}
