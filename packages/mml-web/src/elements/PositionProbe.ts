import { AnimatedAttributeHelper } from "../attribute-animation";
import { AttributeHandler, parseBoolAttribute, parseFloatAttribute } from "../attributes";
import { OrientedBoundingBox } from "../bounding-box";
import { GraphicsAdapter, PositionProbeGraphics } from "../graphics";
import { Vect3 } from "../math";
import { getRelativePositionAndRotationRelativeToObject } from "../position";
import { AnimationType } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";

const defaultPositionProbeRange = 10;
const defaultPositionProbeInterval = 1000;
const defaultPositionProbeMinimumInterval = 100;
const defaultPositionProbeDebug = false;
const positionProbeEnterEventName = "positionenter";
const positionProbePositionMoveEventName = "positionmove";
const positionProbeLeaveEventName = "positionleave";

export type MPositionProbeProps = {
  intervalMs: number;
  debug: boolean;
  range: number;
};

export class PositionProbe<
  G extends GraphicsAdapter = GraphicsAdapter,
> extends TransformableElement<G> {
  static tagName = "m-position-probe";
  private positionProbeGraphics: PositionProbeGraphics<G> | null;

  private positionProbeAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    range: [
      AnimationType.Number,
      defaultPositionProbeRange,
      (newValue: number) => {
        this.props.range = newValue;
        this.positionProbeGraphics?.setRange(newValue, this.props);
        this.applyBounds();
      },
    ],
  });

  public props: MPositionProbeProps = {
    intervalMs: defaultPositionProbeInterval,
    debug: defaultPositionProbeDebug,
    range: defaultPositionProbeRange,
  };

  private static attributeHandler = new AttributeHandler<PositionProbe<GraphicsAdapter>>({
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
      instance.positionProbeGraphics?.setDebug(instance.props.debug, instance.props);
    },
  });

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...PositionProbe.attributeHandler.getAttributes(),
    ];
  }

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

  public parentTransformed() {
    // no-op
  }

  public getContentBounds(): OrientedBoundingBox | null {
    if (!this.transformableElementGraphics) {
      return null;
    }
    return OrientedBoundingBox.fromSizeAndMatrixWorld(
      new Vect3(this.props.range * 2, this.props.range * 2, this.props.range * 2),
      this.transformableElementGraphics.getWorldMatrix(),
    );
  }

  public addSideEffectChild(child: MElement<G>): void {
    this.positionProbeAnimatedAttributeHelper.addSideEffectChild(child);
    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement<G>): void {
    this.positionProbeAnimatedAttributeHelper.removeSideEffectChild(child);
    super.removeSideEffectChild(child);
  }

  public isClickable(): boolean {
    return false;
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
    if (!this.positionProbeGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    PositionProbe.attributeHandler.handle(this, name, newValue);
  }

  private emitPosition() {
    const userPositionAndRotation = this.getUserPositionAndRotation();
    const elementRelative = getRelativePositionAndRotationRelativeToObject(
      userPositionAndRotation,
      this,
    );

    // Check if the position is within range
    const distance = new Vect3().copy(elementRelative.position).length();

    let withinBounds = true;
    this.getAppliedBounds().forEach((bounds) => {
      if (!bounds.containsPoint(userPositionAndRotation.position)) {
        withinBounds = false;
      }
    });

    if (withinBounds && distance <= this.props.range) {
      const elementRelativePositionAndRotation = {
        position: elementRelative.position,
        rotation: {
          x: elementRelative.rotation.x,
          y: elementRelative.rotation.y,
          z: elementRelative.rotation.z,
        },
      };

      let documentRoot: MElement<G> | null = null;
      const remoteDocument = this.getInitiatedRemoteDocument();
      if (remoteDocument) {
        documentRoot = remoteDocument;
      }
      const documentRelative =
        documentRoot !== null
          ? getRelativePositionAndRotationRelativeToObject(userPositionAndRotation, documentRoot)
          : userPositionAndRotation;

      const documentRelativePositionAndRotation = {
        position: documentRelative.position,
        rotation: {
          x: documentRelative.rotation.x,
          y: documentRelative.rotation.y,
          z: documentRelative.rotation.z,
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

  public connectedCallback(): void {
    super.connectedCallback();

    const graphicsAdapter = this.getScene().getGraphicsAdapter();
    if (!graphicsAdapter || this.positionProbeGraphics) {
      return;
    }

    this.positionProbeGraphics = graphicsAdapter
      .getGraphicsAdapterFactory()
      .MMLPositionProbeGraphicsInterface(this);

    for (const name of PositionProbe.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }

    this.applyBounds();
    this.startEmitting();
  }

  public disconnectedCallback(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.positionProbeAnimatedAttributeHelper.reset();
    this.positionProbeGraphics?.dispose();
    this.positionProbeGraphics = null;
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
}
