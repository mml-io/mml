import * as THREE from "three";

import { AnimationType } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";
import { AnimatedAttributeHelper } from "../utils/AnimatedAttributeHelper";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { OrientedBoundingBox } from "../utils/OrientedBoundingBox";
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

  private positionProbeAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    range: [
      AnimationType.Number,
      defaultPositionProbeRange,
      (newValue: number) => {
        this.props.range = newValue;
        this.updateDebugVisualisation();
        this.applyBounds();
      },
    ],
  });

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
      instance.positionProbeAnimatedAttributeHelper.elementSetAttribute(
        "range",
        parseFloatAttribute(newValue, defaultPositionProbeRange),
      );
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

  private timer: NodeJS.Timeout | null = null;

  private currentlyInRange = false;

  constructor() {
    super();
  }

  protected enable() {
    // no-op
  }

  protected disable() {
    // no-op
  }

  protected getContentBounds(): OrientedBoundingBox | null {
    return OrientedBoundingBox.fromSizeAndMatrixWorldProvider(
      new THREE.Vector3(this.props.range * 2, this.props.range * 2, this.props.range * 2),
      this.container,
    );
  }

  public addSideEffectChild(child: MElement): void {
    this.positionProbeAnimatedAttributeHelper.addSideEffectChild(child);

    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement): void {
    this.positionProbeAnimatedAttributeHelper.removeSideEffectChild(child);

    super.removeSideEffectChild(child);
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
    const elementRelative = getRelativePositionAndRotationRelativeToObject(
      userPositionAndRotation,
      this.getContainer(),
    );

    // Check if the position is within range
    const distance = new THREE.Vector3().copy(elementRelative.position as THREE.Vector3).length();

    let withinBounds = true;
    this.getAppliedBounds().forEach((bounds) => {
      if (!bounds.containsPoint(userPositionAndRotation.position as THREE.Vector3)) {
        withinBounds = false;
      }
    });

    if (withinBounds && distance <= this.props.range) {
      const elementRelativePositionAndRotation = {
        position: elementRelative.position,
        rotation: {
          x: THREE.MathUtils.radToDeg(elementRelative.rotation.x),
          y: THREE.MathUtils.radToDeg(elementRelative.rotation.y),
          z: THREE.MathUtils.radToDeg(elementRelative.rotation.z),
        },
      };

      let documentRoot;
      const remoteDocument = this.getRemoteDocument();
      if (remoteDocument) {
        documentRoot = remoteDocument.getContainer();
      } else {
        documentRoot = this.getScene().getRootContainer();
      }
      const documentRelative = getRelativePositionAndRotationRelativeToObject(
        userPositionAndRotation,
        documentRoot,
      );
      const documentRelativePositionAndRotation = {
        position: documentRelative.position,
        rotation: {
          x: THREE.MathUtils.radToDeg(documentRelative.rotation.x),
          y: THREE.MathUtils.radToDeg(documentRelative.rotation.y),
          z: THREE.MathUtils.radToDeg(documentRelative.rotation.z),
        },
      };
      if (!this.currentlyInRange) {
        this.currentlyInRange = true;
        this.dispatchEvent(
          new CustomEvent(positionProbeEnterEventName, {
            detail: {
              elementRelative: elementRelativePositionAndRotation,
              documentRelative: documentRelativePositionAndRotation,
            },
          }),
        );
      } else {
        this.dispatchEvent(
          new CustomEvent(positionProbePositionMoveEventName, {
            detail: {
              elementRelative: elementRelativePositionAndRotation,
              documentRelative: documentRelativePositionAndRotation,
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
      this.debugMesh = null;
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
