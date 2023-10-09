/**
 * A class that extends {@link Event | `Event`}.
 */
export interface RemoteEvent extends Event {
  readonly detail: {
    /**
     * The unique numeric id of the connection that sent the event.
     */
    readonly connectionId: number;
  };
}

export interface ConnectionEvent extends RemoteEvent {
  readonly type: "disconnected" | "connected";
}

/**
 * Received when a user interacts with an m-interaction.
 */
export interface MMLInteractionEvent extends RemoteEvent {
  readonly type: "interact";
}

/**
 * Received when a user triggers a prompt with a value.
 */
export interface MMLPromptEvent extends RemoteEvent {
  readonly type: "prompt";
  readonly detail: {
    /**
     * The value of the prompt.
     */
    readonly value: string;
  } & RemoteEvent["detail"];
}

/**
 * Received when a user clicks on a 3D object.
 */
export interface MMLClickEvent extends RemoteEvent {
  readonly type: "click";

  readonly detail: {
    /**
     * The position of the click relative to the element's origin
     */
    readonly position: {
      x: number;
      y: number;
      z: number;
    };
  } & RemoteEvent["detail"];
}

type PositionAndRotation = {
  /**
   * The position as x, y, and z coordinates.
   */
  position: {
    x: number;
    y: number;
    z: number;
  };
  /**
   * The rotation as Euler XYZ-ordered angles in degrees.
   */
  rotation: {
    x: number;
    y: number;
    z: number;
  };
};

/**
 * Received when a user enters the range of an m-position-probe.
 */
export interface MMLPositionEnterEvent extends RemoteEvent {
  readonly type: "positionenter";
  readonly detail: {
    /**
     * The location of the user relative to the target element.
     */
    readonly elementRelative: PositionAndRotation;
    /**
     * The location of the user relative to the target element.
     */
    readonly documentRelative: PositionAndRotation;
  } & RemoteEvent["detail"];
}

/**
 * Received when a user moves after having entered the range of an m-position-probe.
 */
export interface MMLPositionMoveEvent extends RemoteEvent {
  readonly type: "positionmove";
  readonly detail: {
    /**
     * The location of the user relative to the target element.
     */
    readonly elementRelative: PositionAndRotation;
    /**
     * The location of the user relative to the target element.
     */
    readonly documentRelative: PositionAndRotation;
  } & RemoteEvent["detail"];
}

/**
 * Received when a user leaves the range of an m-position-probe after having entered.
 */
export interface MMLPositionLeaveEvent extends RemoteEvent {
  readonly type: "positionleave";
}

/**
 * Received when a user starts colliding with an element.
 */
export interface MMLCollisionStartEvent extends RemoteEvent {
  readonly type: "collisionstart";
  readonly detail: {
    /**
     * The position of the collision relative to the element's origin
     */
    readonly position: {
      x: number;
      y: number;
      z: number;
    };
  } & RemoteEvent["detail"];
}

/**
 * Received when a user moves the collision point they are colliding at on an element.
 */
export interface MMLCollisionMoveEvent extends RemoteEvent {
  readonly type: "collisionmove";
  readonly detail: {
    /**
     * The position of the collision relative to the element's origin
     */
    readonly position: {
      x: number;
      y: number;
      z: number;
    };
  } & RemoteEvent["detail"];
}

/**
 * Received when a user stops colliding with an element.
 */
export interface MMLCollisionEndEvent extends RemoteEvent {
  readonly type: "collisionend";
}

export interface MMLChatEvent extends RemoteEvent {
  readonly type: "chat";
}
