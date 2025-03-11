import { MMLColor, parseColorAttribute } from "../src";

describe("Color Parsing - Extended Tests", () => {
  const cases: Array<[string, MMLColor | null]> = [
    // --- HEX Colors (Edge Cases) ---
    ["#000", { r: 0, g: 0, b: 0 }], // Short hex
    ["#FFF", { r: 1, g: 1, b: 1 }], // Short hex
    ["#AFA", { r: 0.6667, g: 1, b: 0.6667 }], // Short hex

    // --- Invalid HEX Colors ---
    ["#12345", null], // Wrong length
    ["#ZZZZZZ", null], // Invalid characters
    ["#1234567", null], // Too long
    ["#1G3456", null], // Invalid characters

    // --- RGB Colors (Edge Cases) ---
    ["rgb(255, 0, 0)", { r: 1, g: 0, b: 0 }], // Red
    ["rgb(0, 255, 0)", { r: 0, g: 1, b: 0 }], // Green
    ["rgb(0, 0, 255)", { r: 0, g: 0, b: 1 }], // Blue
    ["rgb(256, 256, 256)", { r: 1, g: 1, b: 1 }], // Clamping test
    ["rgb(1000, 1000, 1000)", { r: 1, g: 1, b: 1 }], // Clamping test
    ["rgb(-1, -1, -1)", { r: 0, g: 0, b: 0 }], // Clamping test
    ["rgb(0.5, 0.5, 0.5)", { r: 0.5 / 255, g: 0.5 / 255, b: 0.5 / 255 }], // Small fractional values
    ["rgb(255.9, 255.9, 255.9)", { r: 1, g: 1, b: 1 }], // Clamping floating point

    // --- Malformed RGB Inputs ---
    ["rgb(10, 20)", null], // Missing one value
    ["rgb(10, 20, 30, 40)", null], // Too many values
    ["rgb(10, 20, )", null], // Trailing comma
    ["rgb(10, , 30)", null], // Missing value
    ["rgb( 10,20,30)", { r: 10 / 255, g: 20 / 255, b: 30 / 255 }], // No space after commas

    // --- RGBA Colors (Edge Cases) ---
    ["rgba(255, 255, 255, 0)", { r: 1, g: 1, b: 1, a: 0 }], // Transparent white
    ["rgba(255, 255, 255, 1)", { r: 1, g: 1, b: 1, a: 1 }], // Opaque white
    ["rgba(255, 255, 255, -1)", { r: 1, g: 1, b: 1, a: 0 }], // Alpha clamping
    ["rgba(255, 255, 255, 2)", { r: 1, g: 1, b: 1, a: 1 }], // Alpha clamping
    ["rgba(10, 20, 30, 0.123456)", { r: 10 / 255, g: 20 / 255, b: 30 / 255, a: 0.123 }], // Alpha precision

    // --- Malformed RGBA Inputs ---
    ["rgba(10, 20, 30)", null], // Missing alpha
    ["rgba(10, 20, 30, )", null], // Trailing comma
    ["rgba(10, , 30, 0.5)", null], // Missing value

    // --- HSL Colors (Edge Cases) ---
    ["hsl(0, 100%, 50%)", { r: 1, g: 0, b: 0 }], // Red
    ["hsl(120, 100%, 50%)", { r: 0, g: 1, b: 0 }], // Green
    ["hsl(240, 100%, 50%)", { r: 0, g: 0, b: 1 }], // Blue
    ["hsl(360, 100%, 50%)", { r: 1, g: 0, b: 0 }], // Wrap-around hue
    ["hsl(720, 100%, 50%)", { r: 1, g: 0, b: 0 }], // Double wrap-around
    ["hsl(-360, 100%, 50%)", { r: 1, g: 0, b: 0 }], // Negative wrap-around
    ["hsl(400, 50%, 50%)", { r: 0.75, g: 0.5833, b: 0.25 }], // Hue normalization

    // --- Malformed HSL Inputs ---
    ["hsl(10, 20)", null], // Missing one value
    ["hsl(10, 20, 30, 40)", null], // Too many values
    ["hsl(10, 20, )", null], // Trailing comma
    ["hsl(10, , 30)", null], // Missing value
    ["hsl( 10,20,30)", { r: 0.36, g: 0.26, b: 0.24 }], // No space after commas should be valid

    // --- HSLA Colors (Edge Cases) ---
    ["hsla(0, 100%, 50%, 0)", { r: 1, g: 0, b: 0, a: 0 }], // Transparent red
    ["hsla(0, 100%, 50%, 1)", { r: 1, g: 0, b: 0, a: 1 }], // Opaque red
    ["hsla(0, 100%, 50%, -1)", { r: 1, g: 0, b: 0, a: 0 }], // Alpha clamping
    ["hsla(0, 100%, 50%, 2)", { r: 1, g: 0, b: 0, a: 1 }], // Alpha clamping

    // --- Malformed HSLA Inputs ---
    ["hsla(10, 20, 30)", null], // Missing alpha
    ["hsla(10, 20, 30, )", null], // Trailing comma
    ["hsla(10, , 30, 0.5)", null], // Missing value

    // --- Completely Invalid Inputs ---
    ["random", null], // Random string
    ["", null], // Empty string
    ["hsla()", null], // Empty function
    ["rgb()", null], // Empty function

    // --- Standard Named Colors ---
    ["red", { r: 1, g: 0, b: 0 }],
    ["blue", { r: 0, g: 0, b: 1 }],
    ["green", { r: 0, g: 0.5, b: 0 }],
    ["black", { r: 0, g: 0, b: 0 }],
    ["white", { r: 1, g: 1, b: 1 }],
    ["cyan", { r: 0, g: 1, b: 1 }],
    ["magenta", { r: 1, g: 0, b: 1 }],
    ["yellow", { r: 1, g: 1, b: 0 }],
    ["gray", { r: 0.5, g: 0.5, b: 0.5 }],
    ["grey", { r: 0.5, g: 0.5, b: 0.5 }], // Both spellings should work

    // --- Named Colors with Leading and Trailing Spaces ---
    [" red", { r: 1, g: 0, b: 0 }], // browsers trim leading spaces internally
    ["blue ", { r: 0, g: 0, b: 1 }], // browsers trim trailing spaces internally
    [" green ", { r: 0, g: 0.5, b: 0 }], // browsers trim leading and trailing spaces internally
    ["  black  ", { r: 0, g: 0, b: 0 }],
    [" white   ", { r: 1, g: 1, b: 1 }],
    ["    cyan", { r: 0, g: 1, b: 1 }],
    [" magenta ", { r: 1, g: 0, b: 1 }],
    ["yellow  ", { r: 1, g: 1, b: 0 }],
    ["  gray  ", { r: 0.5, g: 0.5, b: 0.5 }],
    [" grey ", { r: 0.5, g: 0.5, b: 0.5 }],
    [" darkred", { r: 0.5451, g: 0, b: 0 }],

    // --- Invalid Named Colors (Should Return Null) ---
    [" purplish", null], // Not a valid named color
    ["bluish ", null], // Not a valid named color
    [" whitish ", null], // Not a valid named color
    ["redd", null], // Misspelled name
    [" blackk", null], // Extra letter
    ["123", null], // Not a valid color
    [" ", null], // Just a space
  ];

  test.each(cases)(
    "Parsing color %p should return %p",
    (input: string, expected: MMLColor | null) => {
      const result = parseColorAttribute(input, null);

      if (expected === null) {
        expect(result).toBeNull();
      } else {
        expect(result).not.toBeNull();
        // Using a precision of 2 to handle floating-point
        // oddities like 0.000649939999999 vs 0
        expect(result!.r).toBeCloseTo(expected.r, 2);
        expect(result!.g).toBeCloseTo(expected.g, 2);
        expect(result!.b).toBeCloseTo(expected.b, 2);
        if ("a" in expected) {
          expect(result!.a).toBeCloseTo(expected.a!, 2);
        } else {
          expect(result!.a).toBeUndefined();
        }
      }
    },
  );
});
