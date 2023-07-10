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
  readonly detail: PositionAndRotation & RemoteEvent["detail"];
}
