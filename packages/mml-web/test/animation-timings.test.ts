/**
 * @jest-environment jsdom
 */

import {
  EndOfAnimationSymbol,
  getEasedRatioForTime,
  StartOfAnimationSymbol,
} from "../src/utils/animation-timings";

const defaults = {
  startTime: 0,
  pauseTime: null,
  animDuration: 1000,
  loop: true,
  pingPong: false,
  pingPongDelay: 0,
  easing: "",
};

function assertEasedRatioForTime(
  docTime: number,
  props: Partial<typeof defaults>,
  expectedState: typeof StartOfAnimationSymbol | number | typeof EndOfAnimationSymbol,
  expectedTimeOffset: number,
) {
  const [state, timeOffset] = getEasedRatioForTime(docTime, { ...defaults, ...props });
  if (typeof expectedState === "number" && typeof state === "number") {
    expect(state).toBeCloseTo(expectedState, 5);
  } else {
    expect(state).toBe(expectedState);
  }
  expect(timeOffset).toBeCloseTo(expectedTimeOffset, 5);
}

describe("animation timings", () => {
  test("non-looping linear animation", () => {
    assertEasedRatioForTime(0, { loop: false }, 0, 0);
    assertEasedRatioForTime(500, { loop: false }, 0.5, 0);
    assertEasedRatioForTime(900, { loop: false }, 0.9, 0);
    assertEasedRatioForTime(1000, { loop: false }, EndOfAnimationSymbol, 0);
    assertEasedRatioForTime(2000, { loop: false }, EndOfAnimationSymbol, 1000);
  });

  test("paused linear animation", () => {
    assertEasedRatioForTime(0, { loop: false, pauseTime: 750 }, 0, 0);
    assertEasedRatioForTime(500, { loop: false, pauseTime: 750 }, 0.5, 0);
    assertEasedRatioForTime(750, { loop: false, pauseTime: 750 }, 0.75, 0);
    assertEasedRatioForTime(900, { loop: false, pauseTime: 750 }, 0.75, 0);
    assertEasedRatioForTime(1000, { loop: false, pauseTime: 750 }, 0.75, 0);
    assertEasedRatioForTime(2000, { loop: false, pauseTime: 750 }, 0.75, 0);
  });

  test("non-looping eased animation", () => {
    assertEasedRatioForTime(0, { loop: false, easing: "easeInOutSine" }, 0, 0);
    assertEasedRatioForTime(100, { loop: false, easing: "easeInOutSine" }, 0.024471741852423234, 0);
    assertEasedRatioForTime(200, { loop: false, easing: "easeInOutSine" }, 0.09549150281252627, 0);
    assertEasedRatioForTime(300, { loop: false, easing: "easeInOutSine" }, 0.20610737385376343, 0);
    assertEasedRatioForTime(400, { loop: false, easing: "easeInOutSine" }, 0.3454915028125263, 0);
    assertEasedRatioForTime(500, { loop: false, easing: "easeInOutSine" }, 0.5, 0);
    assertEasedRatioForTime(600, { loop: false, easing: "easeInOutSine" }, 0.6545084971874737, 0);
    assertEasedRatioForTime(700, { loop: false, easing: "easeInOutSine" }, 0.7938926261462365, 0);
    assertEasedRatioForTime(800, { loop: false, easing: "easeInOutSine" }, 0.9045084971874737, 0);
    assertEasedRatioForTime(900, { loop: false, easing: "easeInOutSine" }, 0.9755282581475768, 0);
    assertEasedRatioForTime(
      1000,
      { loop: false, easing: "easeInOutSine" },
      EndOfAnimationSymbol,
      0,
    );
    assertEasedRatioForTime(
      2000,
      { loop: false, easing: "easeInOutSine" },
      EndOfAnimationSymbol,
      1000,
    );
  });

  test("delayed start non-looping linear animation", () => {
    assertEasedRatioForTime(0, { loop: false, startTime: 1000 }, StartOfAnimationSymbol, -1000);
    assertEasedRatioForTime(500, { loop: false, startTime: 1000 }, StartOfAnimationSymbol, -500);
    assertEasedRatioForTime(1000, { loop: false, startTime: 1000 }, 0, 0);
    assertEasedRatioForTime(1500, { loop: false, startTime: 1000 }, 0.5, 0);
    assertEasedRatioForTime(1900, { loop: false, startTime: 1000 }, 0.9, 0);
    assertEasedRatioForTime(2000, { loop: false, startTime: 1000 }, EndOfAnimationSymbol, 0);
    assertEasedRatioForTime(3000, { loop: false, startTime: 1000 }, EndOfAnimationSymbol, 1000);
  });

  test("delayed start looping animation", () => {
    assertEasedRatioForTime(0, { startTime: 1000 }, StartOfAnimationSymbol, -1000);
    assertEasedRatioForTime(500, { startTime: 1000 }, StartOfAnimationSymbol, -500);
    assertEasedRatioForTime(1000, { startTime: 1000 }, 0, 0);
    assertEasedRatioForTime(1500, { startTime: 1000 }, 0.5, 0);
    assertEasedRatioForTime(1900, { startTime: 1000 }, 0.9, 0);
    assertEasedRatioForTime(2000, { startTime: 1000 }, 0, 0);
    assertEasedRatioForTime(2500, { startTime: 1000 }, 0.5, 0);
    assertEasedRatioForTime(3000, { startTime: 1000 }, 0, 0);
  });

  test("delayed start ping-pong non-looping animation", () => {
    assertEasedRatioForTime(
      0,
      { loop: false, pingPong: true, startTime: 1000 },
      StartOfAnimationSymbol,
      -1000,
    );
    assertEasedRatioForTime(
      500,
      { loop: false, pingPong: true, startTime: 1000 },
      StartOfAnimationSymbol,
      -500,
    );
    assertEasedRatioForTime(1000, { loop: false, pingPong: true, startTime: 1000 }, 0, 0);
    assertEasedRatioForTime(1250, { loop: false, pingPong: true, startTime: 1000 }, 0.5, 0);
    assertEasedRatioForTime(1500, { loop: false, pingPong: true, startTime: 1000 }, 1, 0);
    assertEasedRatioForTime(1900, { loop: false, pingPong: true, startTime: 1000 }, 0.2, 0);
    assertEasedRatioForTime(
      2000,
      { loop: false, pingPong: true, startTime: 1000 },
      StartOfAnimationSymbol,
      0,
    );
    assertEasedRatioForTime(
      2500,
      { loop: false, pingPong: true, startTime: 1000 },
      StartOfAnimationSymbol,
      500,
    );
    assertEasedRatioForTime(
      3000,
      { loop: false, pingPong: true, startTime: 1000 },
      StartOfAnimationSymbol,
      1000,
    );
  });

  test("delayed start ping-pong looping animation", () => {
    assertEasedRatioForTime(
      0,
      { loop: true, pingPong: true, startTime: 1000 },
      StartOfAnimationSymbol,
      -1000,
    );
    assertEasedRatioForTime(
      500,
      { loop: true, pingPong: true, startTime: 1000 },
      StartOfAnimationSymbol,
      -500,
    );
    assertEasedRatioForTime(1000, { loop: true, pingPong: true, startTime: 1000 }, 0, 0);
    assertEasedRatioForTime(1250, { loop: true, pingPong: true, startTime: 1000 }, 0.5, 0);
    assertEasedRatioForTime(1500, { loop: true, pingPong: true, startTime: 1000 }, 1, 0);
    assertEasedRatioForTime(1900, { loop: true, pingPong: true, startTime: 1000 }, 0.2, 0);
    assertEasedRatioForTime(2000, { loop: true, pingPong: true, startTime: 1000 }, 0, 0);
    assertEasedRatioForTime(2500, { loop: true, pingPong: true, startTime: 1000 }, 1, 0);
    assertEasedRatioForTime(2900, { loop: true, pingPong: true, startTime: 1000 }, 0.2, 0);
    assertEasedRatioForTime(3000, { loop: true, pingPong: true, startTime: 1000 }, 0, 0);
  });

  test("delayed start ping-pong ping-pong-delayed looping animation", () => {
    assertEasedRatioForTime(
      0,
      { loop: true, pingPong: true, pingPongDelay: 100, startTime: 1000 },
      StartOfAnimationSymbol,
      -1000,
    );
    assertEasedRatioForTime(
      500,
      { loop: true, pingPong: true, pingPongDelay: 100, startTime: 1000 },
      StartOfAnimationSymbol,
      -500,
    );
    assertEasedRatioForTime(
      1000,
      { loop: true, pingPong: true, pingPongDelay: 100, startTime: 1000 },
      0,
      0,
    );
    assertEasedRatioForTime(
      1025,
      { loop: true, pingPong: true, pingPongDelay: 100, startTime: 1000 },
      0,
      0,
    );
    assertEasedRatioForTime(
      1050,
      { loop: true, pingPong: true, pingPongDelay: 100, startTime: 1000 },
      0,
      0,
    );
    assertEasedRatioForTime(
      1250,
      { loop: true, pingPong: true, pingPongDelay: 100, startTime: 1000 },
      0.5,
      0,
    );
    assertEasedRatioForTime(
      1450,
      { loop: true, pingPong: true, pingPongDelay: 100, startTime: 1000 },
      1,
      0,
    );
    assertEasedRatioForTime(
      1550,
      { loop: true, pingPong: true, pingPongDelay: 100, startTime: 1000 },
      1,
      0,
    );
    assertEasedRatioForTime(
      1750,
      { loop: true, pingPong: true, pingPongDelay: 100, startTime: 1000 },
      0.5,
      0,
    );
    assertEasedRatioForTime(
      1950,
      { loop: true, pingPong: true, pingPongDelay: 100, startTime: 1000 },
      0,
      0,
    );
    assertEasedRatioForTime(
      2000,
      { loop: true, pingPong: true, pingPongDelay: 100, startTime: 1000 },
      0,
      0,
    );
    assertEasedRatioForTime(
      2500,
      { loop: true, pingPong: true, pingPongDelay: 100, startTime: 1000 },
      1,
      0,
    );
    assertEasedRatioForTime(
      2950,
      { loop: true, pingPong: true, pingPongDelay: 100, startTime: 1000 },
      0,
      0,
    );
    assertEasedRatioForTime(
      3000,
      { loop: true, pingPong: true, pingPongDelay: 100, startTime: 1000 },
      0,
      0,
    );
  });

  test("ping-pong ping-pong-delayed looping animation", () => {
    assertEasedRatioForTime(
      0,
      { loop: true, pingPong: true, pingPongDelay: 400, animDuration: 1000 },
      0,
      0,
    );
    assertEasedRatioForTime(
      200,
      { loop: true, pingPong: true, pingPongDelay: 400, animDuration: 1000 },
      0,
      0,
    );
    assertEasedRatioForTime(
      250,
      { loop: true, pingPong: true, pingPongDelay: 400, animDuration: 1000 },
      0.5,
      0,
    );
    assertEasedRatioForTime(
      300,
      { loop: true, pingPong: true, pingPongDelay: 400, animDuration: 1000 },
      1,
      0,
    );
    assertEasedRatioForTime(
      450,
      { loop: true, pingPong: true, pingPongDelay: 400, animDuration: 1000 },
      1,
      0,
    );
    assertEasedRatioForTime(
      500,
      { loop: true, pingPong: true, pingPongDelay: 400, animDuration: 1000 },
      1,
      0,
    );
    assertEasedRatioForTime(
      550,
      { loop: true, pingPong: true, pingPongDelay: 400, animDuration: 1000 },
      1,
      0,
    );
    assertEasedRatioForTime(
      600,
      { loop: true, pingPong: true, pingPongDelay: 400, animDuration: 1000 },
      1,
      0,
    );
    assertEasedRatioForTime(
      700,
      { loop: true, pingPong: true, pingPongDelay: 400, animDuration: 1000 },
      1,
      0,
    );
    assertEasedRatioForTime(
      750,
      { loop: true, pingPong: true, pingPongDelay: 400, animDuration: 1000 },
      0.5,
      0,
    );
    assertEasedRatioForTime(
      800,
      { loop: true, pingPong: true, pingPongDelay: 400, animDuration: 1000 },
      0,
      0,
    );
    assertEasedRatioForTime(
      1000,
      { loop: true, pingPong: true, pingPongDelay: 400, animDuration: 1000 },
      0,
      0,
    );
    assertEasedRatioForTime(
      1100,
      { loop: true, pingPong: true, pingPongDelay: 400, animDuration: 1000 },
      0,
      0,
    );
    assertEasedRatioForTime(
      1500,
      { loop: true, pingPong: true, pingPongDelay: 400, animDuration: 1000 },
      1,
      0,
    );
  });
});
