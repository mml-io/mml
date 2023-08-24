import { easingsByName } from "./easings";

export const StartOfAnimationSymbol = Symbol("Start");
export const EndOfAnimationSymbol = Symbol("End");

// Returns [current ratio | start | end symbols, state (negative if before start, zero if running, positive if after end)]
export function getEasedRatioForTime(
  docTimeMs: number,
  props: {
    startTime: number;
    pauseTime: number | null;
    animDuration: number;
    loop: boolean;
    pingPong: boolean;
    pingPongDelay: number;
    easing: string;
  },
): [typeof StartOfAnimationSymbol | number | typeof EndOfAnimationSymbol, number] {
  if (props.pauseTime !== null && docTimeMs >= props.pauseTime) {
    docTimeMs = props.pauseTime;
  }
  let elapsedTime = docTimeMs - props.startTime;
  if (elapsedTime < 0) {
    return [StartOfAnimationSymbol, elapsedTime];
  } else if (elapsedTime < props.animDuration || props.loop) {
    if (props.loop) {
      elapsedTime = elapsedTime % props.animDuration;
    }
    let elapsedRatio = elapsedTime / props.animDuration;
    if (props.pingPong) {
      let pingPongDelayRatio = props.pingPongDelay / props.animDuration;
      if (pingPongDelayRatio < 0) {
        pingPongDelayRatio = 0;
      }
      if (pingPongDelayRatio > 0.5) {
        pingPongDelayRatio = 0.5;
      }

      /*
       ping-pong-delay describes how long the animation should stay at the start and end values.
       The attribute describes the delay at each end - therefore a ping-pong-delay of 1000 on a duration of 10000 means
       that the animation should stay at the start value for 500ms, then animate to the end value up until 4500ms,
       before waiting for 1000ms at the end value, and then animating back to the start value until 9500ms
      */

      if (elapsedRatio < pingPongDelayRatio / 2) {
        elapsedRatio = 0;
      } else if (
        elapsedRatio > 0.5 - pingPongDelayRatio / 2 &&
        elapsedRatio < 0.5 + pingPongDelayRatio / 2
      ) {
        elapsedRatio = 1;
      } else if (elapsedRatio > 1 - pingPongDelayRatio / 2) {
        elapsedRatio = 0;
      } else {
        // The loop should reach the end value at half the time and then return
        // to the start value at the end of the loop.
        if (elapsedRatio > 0.5) {
          elapsedRatio =
            ((elapsedRatio - 0.5 - pingPongDelayRatio / 2) * 2) / (1 - pingPongDelayRatio * 2);
          elapsedRatio = 1 - elapsedRatio;
        } else {
          elapsedRatio =
            ((elapsedRatio - pingPongDelayRatio / 2) * 2) / (1 - pingPongDelayRatio * 2);
        }
      }
    }
    let newValue;
    const easingFunction = easingsByName[props.easing];
    if (easingFunction) {
      newValue = easingFunction(elapsedRatio, 0, 1, 1);
    } else {
      newValue = elapsedRatio;
    }
    return [newValue, 0];
  } else {
    if (props.pingPong) {
      // ping-pong animations return to the start value at the end of their duration so the "final" state should be the start value.
      return [StartOfAnimationSymbol, elapsedTime - props.animDuration];
    }
    return [EndOfAnimationSymbol, elapsedTime - props.animDuration];
  }
}
