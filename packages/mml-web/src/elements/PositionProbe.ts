import * as THREE from "three";

import { TransformableElement } from "./TransformableElement";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { getRelativePositionAndRotationRelativeToObject } from "../utils/position-utils";

const defaultPositionProbeRange = 10;
const defaultPositionProbeInterval = 1000;
const defaultPositionProbeMinimumInterval = 100;
const defaultPositionProbeDebug = false;
const positionProbeEnterEventName = "positionenter";
const positionProbePositionMoveEventName = "positionmove";
const positionProbeLeaveEventName = "positionleave";

export class PositionProbe extends TransformableElement {
  static tagName = "m-position-probe";

  private props = {
    intervalMs: defaultPositionProbeInterval,
    debug: defaultPositionProbeDebug,
    range: defaultPositionProbeRange,
  };

  private static DebugGeometry = new THREE.SphereGeometry(1, 16, 16, 1);
  private static DebugMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    wireframe: true,
    transparent: true,
    opacity: 0.3,
  });

  private static attributeHandler = new AttributeHandler<PositionProbe>({
    range: (instance, newValue) => {
      instance.props.range = parseFloatAttribute(newValue, defaultPositionProbeRange);
    },
    interval: (instance, newValue) => {
      instance.props.intervalMs = Math.max(
        defaultPositionProbeMinimumInterval,
        parseFloatAttribute(newValue, defaultPositionProbeInterval),
      );
      instance.startEmitting();
    },
    debug: (instance, newValue) => {
      instance.props.debug = parseBoolAttribute(newValue, defaultPositionProbeDebug);
    },
  });

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...PositionProbe.attributeHandler.getAttributes(),
    ];
  }

  private debugMesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> | null = null;

  private timer: NodeJS.Timer | null = null;

  private currentlyInRange = false;

  constructor() {
    super();
  }

  public parentTransformed(): void {
    this.updateDebugVisualisation();
  }

  public isClickable(): boolean {
    return false;
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    PositionProbe.attributeHandler.handle(this, name, newValue);
    this.updateDebugVisualisation();
  }

  private emitPosition() {
    const userPositionAndRotation = this.getUserPositionAndRotation();
    const relativeUserPositionAndRotation = getRelativePositionAndRotationRelativeToObject(
      userPositionAndRotation,
      this.getContainer(),
    );

    // Check if the position is within range
    const distance = new THREE.Vector3()
      .copy(relativeUserPositionAndRotation.position as THREE.Vector3)
      .length();

    if (distance <= this.props.range) {
      const positionAndRotation = {
        position: relativeUserPositionAndRotation.position,
        rotation: {
          x: THREE.MathUtils.radToDeg(relativeUserPositionAndRotation.rotation.x),
          y: THREE.MathUtils.radToDeg(relativeUserPositionAndRotation.rotation.y),
          z: THREE.MathUtils.radToDeg(relativeUserPositionAndRotation.rotation.z),
        },
      };
      if (!this.currentlyInRange) {
        this.currentlyInRange = true;
        this.dispatchEvent(
          new CustomEvent(positionProbeEnterEventName, {
            detail: {
              position: positionAndRotation.position,
              rotation: positionAndRotation.rotation,
            },
          }),
        );
      } else {
        this.dispatchEvent(
          new CustomEvent(positionProbePositionMoveEventName, {
            detail: {
              position: positionAndRotation.position,
              rotation: positionAndRotation.rotation,
            },
          }),
        );
      }
    } else {
      if (this.currentlyInRange) {
        this.currentlyInRange = false;
        this.dispatchEvent(new CustomEvent(positionProbeLeaveEventName, {}));
      }
    }
  }

  connectedCallback() {
    super.connectedCallback();
    this.startEmitting();
    this.updateDebugVisualisation();
  }

  disconnectedCallback() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.clearDebugVisualisation();
    super.disconnectedCallback();
  }

  private startEmitting() {
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = setInterval(() => {
      this.emitPosition();
    }, this.props.intervalMs);
  }

  private clearDebugVisualisation() {
    if (this.debugMesh) {
      this.debugMesh.removeFromParent();
    }
  }

  private updateDebugVisualisation() {
    if (!this.props.debug) {
      this.clearDebugVisualisation();
    } else {
      if (this.isConnected && !this.debugMesh) {
        const mesh = new THREE.Mesh(PositionProbe.DebugGeometry, PositionProbe.DebugMaterial);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        this.debugMesh = mesh;
        this.container.add(this.debugMesh);
      }

      if (this.debugMesh) {
        this.debugMesh.scale.set(this.props.range, this.props.range, this.props.range);
      }
    }
  }
}
