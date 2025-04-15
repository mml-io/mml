import { AttributeHandler, parseBoolAttribute, parseFloatAttribute } from "../attributes";
import { OrientedBoundingBox } from "../bounding-box";
import { StaticHTMLFrameInstance, WebSocketFrameInstance } from "../frame";
import { GraphicsAdapter } from "../graphics";
import { FrameGraphics } from "../graphics/FrameGraphics";
import { Vect3 } from "../math/Vect3";
import { getRelativePositionAndRotationRelativeToObject } from "../position";
import { TransformableElement } from "./TransformableElement";

const defaultUnloadRange = 1;
const defaultFrameDebug = false;

export type MFrameProps = {
  src: string | null;
  loadRange: number | null;
  unloadRange: number;

  debug: boolean;

  minX: number | null;
  maxX: number | null;
  minY: number | null;
  maxY: number | null;
  minZ: number | null;
  maxZ: number | null;
};

export class Frame<G extends GraphicsAdapter = GraphicsAdapter> extends TransformableElement<G> {
  static tagName = "m-frame";
  private frameGraphics: FrameGraphics<G> | null;
  private hasInitialized = false;

  private static attributeHandler = new AttributeHandler<Frame<GraphicsAdapter>>({
    src: (instance, newValue) => {
      instance.props.src = newValue;
      if (instance.frameContentsInstance) {
        instance.disposeInstance();
      }
      instance.syncLoadState();
      instance.frameGraphics?.setSrc(instance.props.src, instance.props);
    },
    "load-range": (instance, newValue) => {
      instance.props.loadRange = parseFloatAttribute(newValue, null);
      instance.syncLoadState();
      instance.frameGraphics?.setLoadRange(instance.props.loadRange, instance.props);
    },
    "unload-range": (instance, newValue) => {
      instance.props.unloadRange = parseFloatAttribute(newValue, defaultUnloadRange);
      instance.syncLoadState();
      instance.frameGraphics?.setUnloadRange(instance.props.unloadRange, instance.props);
    },
    debug: (instance, newValue) => {
      instance.props.debug = parseBoolAttribute(newValue, defaultFrameDebug);
      instance.frameGraphics?.setDebug(instance.props.debug, instance.props);
    },
    "min-x": (instance, newValue) => {
      instance.props.minX = parseFloatAttribute(newValue, null);
      instance.boundsUpdated();
      instance.frameGraphics?.setMinX(instance.props.minX, instance.props);
    },
    "max-x": (instance, newValue) => {
      instance.props.maxX = parseFloatAttribute(newValue, null);
      instance.boundsUpdated();
      instance.frameGraphics?.setMaxX(instance.props.maxX, instance.props);
    },
    "min-y": (instance, newValue) => {
      instance.props.minY = parseFloatAttribute(newValue, null);
      instance.boundsUpdated();
      instance.frameGraphics?.setMinY(instance.props.minY, instance.props);
    },
    "max-y": (instance, newValue) => {
      instance.props.maxY = parseFloatAttribute(newValue, null);
      instance.boundsUpdated();
      instance.frameGraphics?.setMaxY(instance.props.maxY, instance.props);
    },
    "min-z": (instance, newValue) => {
      instance.props.minZ = parseFloatAttribute(newValue, null);
      instance.boundsUpdated();
      instance.frameGraphics?.setMinZ(instance.props.minZ, instance.props);
    },
    "max-z": (instance, newValue) => {
      instance.props.maxZ = parseFloatAttribute(newValue, null);
      instance.boundsUpdated();
      instance.frameGraphics?.setMaxZ(instance.props.maxZ, instance.props);
    },
  });

  protected enable() {
    // no-op
  }

  protected disable() {
    // no-op
  }

  private frameContentsInstance: WebSocketFrameInstance<G> | StaticHTMLFrameInstance<G> | null =
    null;
  private isActivelyLoaded = false;
  private timer: NodeJS.Timeout | null = null;

  private boundsUpdated() {
    if (!this.transformableElementGraphics) {
      return;
    }
    const boxBounds = this.getDefinedBoxBounds();
    if (boxBounds) {
      const [minX, maxX, minY, maxY, minZ, maxZ] = boxBounds;
      const obb = OrientedBoundingBox.fromSizeMatrixWorldAndCenter(
        new Vect3(maxX - minX, maxY - minY, maxZ - minZ),
        this.transformableElementGraphics.getWorldMatrix(),
        new Vect3((maxX + minX) / 2, (maxY + minY) / 2, (maxZ + minZ) / 2),
      );
      this.addOrUpdateParentBound(this, obb);
    } else {
      this.removeParentBound(this);
    }
  }

  public props: MFrameProps = {
    src: null,
    loadRange: null,
    unloadRange: defaultUnloadRange,

    debug: defaultFrameDebug,

    minX: null,
    maxX: null,
    minY: null,
    maxY: null,
    minZ: null,
    maxZ: null,
  };

  private shouldBeLoaded() {
    if (!this.hasInitialized) {
      return false;
    }
    if (!this.isConnected) {
      return false;
    }
    if (this.props.loadRange === null) {
      return true;
    }

    const userPositionAndRotation = this.getUserPositionAndRotation();
    const elementRelative = getRelativePositionAndRotationRelativeToObject(
      userPositionAndRotation,
      this,
    );

    let boxBounds = this.getDefinedBoxBounds();
    if (!boxBounds) {
      boxBounds = [0, 0, 0, 0, 0, 0];
    }
    const [minX, maxX, minY, maxY, minZ, maxZ] = boxBounds;
    if (
      elementRelative.position.x >= minX - this.props.loadRange &&
      elementRelative.position.x <= maxX + this.props.loadRange &&
      elementRelative.position.y >= minY - this.props.loadRange &&
      elementRelative.position.y <= maxY + this.props.loadRange &&
      elementRelative.position.z >= minZ - this.props.loadRange &&
      elementRelative.position.z <= maxZ + this.props.loadRange
    ) {
      return true;
    }
    // If the user is within the unload-range range, keep the current state
    if (
      elementRelative.position.x >= minX - this.props.loadRange - this.props.unloadRange &&
      elementRelative.position.x <= maxX + this.props.loadRange + this.props.unloadRange &&
      elementRelative.position.y >= minY - this.props.loadRange - this.props.unloadRange &&
      elementRelative.position.y <= maxY + this.props.loadRange + this.props.unloadRange &&
      elementRelative.position.z >= minZ - this.props.loadRange - this.props.unloadRange &&
      elementRelative.position.z <= maxZ + this.props.loadRange + this.props.unloadRange
    ) {
      return this.isActivelyLoaded;
    }
  }

  private syncLoadState() {
    const shouldBeLoaded = this.shouldBeLoaded();
    if (shouldBeLoaded && !this.isActivelyLoaded) {
      if (this.props.src) {
        this.isActivelyLoaded = true;
        this.createFrameContentsInstance(this.props.src);
      }
    } else if (!shouldBeLoaded && this.isActivelyLoaded) {
      this.isActivelyLoaded = false;
      this.disposeInstance();
    }
  }

  static get observedAttributes(): Array<string> {
    return [...TransformableElement.observedAttributes, ...Frame.attributeHandler.getAttributes()];
  }

  constructor() {
    super();
  }

  public getContentBounds(): OrientedBoundingBox | null {
    return null;
  }

  public parentTransformed(): void {
    this.boundsUpdated();
  }

  public isClickable(): boolean {
    return true;
  }

  private startEmitting() {
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = setInterval(() => {
      this.syncLoadState();
    }, 100);
  }

  private createFrameContentsInstance(src: string) {
    if (this.frameContentsInstance) {
      if (this.frameContentsInstance.src !== src) {
        console.error("Instance already existed with a different src");
        this.disposeInstance();
      } else {
        return;
      }
    }

    if (src.startsWith("ws://") || src.startsWith("wss://")) {
      this.frameContentsInstance = new WebSocketFrameInstance(this, src, this.getScene());
    } else {
      this.frameContentsInstance = new StaticHTMLFrameInstance(this, src, this.getScene());
    }
  }

  public getDefinedBoxBounds(): [number, number, number, number, number, number] | null {
    if (
      this.props.minX !== null ||
      this.props.maxX !== null ||
      this.props.minY !== null ||
      this.props.maxY !== null ||
      this.props.minZ !== null ||
      this.props.maxZ !== null
    ) {
      const minX = this.props.minX ?? this.props.maxX ?? 0;
      let maxX = this.props.maxX ?? this.props.minX ?? 0;
      const minY = this.props.minY ?? this.props.maxY ?? 0;
      let maxY = this.props.maxY ?? this.props.minY ?? 0;
      const minZ = this.props.minZ ?? this.props.maxZ ?? 0;
      let maxZ = this.props.maxZ ?? this.props.minZ ?? 0;
      // If any bounds are incorrect make them equal (and therefore not able to contain anything, but visually debuggable)
      if (minX > maxX) {
        maxX = minX;
      }
      if (minY > maxY) {
        maxY = minY;
      }
      if (minZ > maxZ) {
        maxZ = minZ;
      }
      return [minX, maxX, minY, maxY, minZ, maxZ];
    }
    return null;
  }

  private disposeInstance() {
    if (this.frameContentsInstance !== null) {
      this.frameContentsInstance.dispose();
      this.frameContentsInstance = null;
      this.isActivelyLoaded = false;
    }
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
    if (!this.frameGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    Frame.attributeHandler.handle(this, name, newValue);
  }

  public connectedCallback(): void {
    super.connectedCallback();

    if (!this.getScene().hasGraphicsAdapter() || this.frameGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();

    this.frameGraphics = graphicsAdapter
      .getGraphicsAdapterFactory()
      .MMLFrameGraphicsInterface(this);

    for (const name of Frame.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }

    // Don't allow the frame to be loaded until after all attributes have been observed
    this.hasInitialized = true;
    this.startEmitting();
    this.syncLoadState();

    this.applyBounds();
  }

  public disconnectedCallback(): void {
    this.frameGraphics?.dispose();
    this.frameGraphics = null;

    if (this.timer) {
      clearInterval(this.timer);
    }
    this.disposeInstance();
    super.disconnectedCallback();
  }
}
