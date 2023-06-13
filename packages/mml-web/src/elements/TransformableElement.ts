import * as THREE from "three";

import { MElement } from "./MElement";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { DebugHelper } from "../utils/DebugHelper";

// Workaround for zero-scale values breaking audio playback in THREE PositionalAudio
function minimumNonZero(value: number): number {
  return value === 0 ? 0.000001 : value;
}

export abstract class TransformableElement extends MElement {
  private static TransformableElementAttributeHandler = new AttributeHandler<TransformableElement>({
    x: (instance, newValue) => {
      instance.container.position.x = parseFloatAttribute(newValue, 0);
    },
    y: (instance, newValue) => {
      instance.container.position.y = parseFloatAttribute(newValue, 0);
    },
    z: (instance, newValue) => {
      instance.container.position.z = parseFloatAttribute(newValue, 0);
    },
    rx: (instance, newValue) => {
      instance.container.rotation.x = parseFloatAttribute(newValue, 0) * THREE.MathUtils.DEG2RAD;
    },
    ry: (instance, newValue) => {
      instance.container.rotation.y = parseFloatAttribute(newValue, 0) * THREE.MathUtils.DEG2RAD;
    },
    rz: (instance, newValue) => {
      instance.container.rotation.z = parseFloatAttribute(newValue, 0) * THREE.MathUtils.DEG2RAD;
    },
    sx: (instance, newValue) => {
      instance.container.scale.x = minimumNonZero(parseFloatAttribute(newValue, 1));
    },
    sy: (instance, newValue) => {
      instance.container.scale.y = minimumNonZero(parseFloatAttribute(newValue, 1));
    },
    sz: (instance, newValue) => {
      instance.container.scale.z = minimumNonZero(parseFloatAttribute(newValue, 1));
    },
    visible: (instance, newValue) => {
      instance.container.visible = parseBoolAttribute(newValue, true);
    },
  });

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.TransformableElementAttributeHandler.getAttributes(),
      ...DebugHelper.observedAttributes,
    ];
  }

  private debugHelper = new DebugHelper(this);

  constructor() {
    super();
  }

  getBounds(): THREE.Box3 {
    return new THREE.Box3().setFromObject(this.container);
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (TransformableElement.TransformableElementAttributeHandler.handle(this, name, newValue)) {
      // Traverse the children and update their colliders as well
      traverseChildren(this, (child) => {
        if (child instanceof MElement) {
          child.parentTransformed();
        }
      });
    }
    this.debugHelper.handle(name, newValue);
  }
}

function traverseChildren(element: ChildNode, callback: (element: ChildNode) => void) {
  element.childNodes.forEach((child) => {
    callback(child);
    traverseChildren(child, callback);
  });
}
