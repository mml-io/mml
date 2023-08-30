import { validateMMLDocument } from "../src";

test("basic cubes", () => {
  const validationErrors = validateMMLDocument(`
<m-cube color="red">
  <m-cube color="green">
    <m-cube color="blue"></m-cube>
  </m-cube>
</m-cube>
`);
  expect(validationErrors).toBeNull();
});

test("basic cubes document inside html tag", () => {
  const validationErrors = validateMMLDocument(`
<html>
  <head></head>
  <body>
    <m-cube color="red">
      <m-cube color="green">
        <m-cube color="blue"></m-cube>
      </m-cube>
    </m-cube>
  </body>
</html>
`);
  expect(validationErrors).toBeNull();
});

test("invalid tag throws error", () => {
  const validationErrors: Array<Error> = validateMMLDocument(`
<html>
  <head></head>
  <body>
    <m-notathing color="red">
      <m-cube color="green">
        <m-cube color="blue"></m-cube>
      </m-cube>
    </m-notathing>
  </body>
</html>
`)!;
  expect(validationErrors[0].message).toContain(
    "Element 'm-notathing': This element is not expected.",
  );
});

test("invalid attribute throws error", () => {
  const validationErrors: Array<Error> = validateMMLDocument(`
<html>
  <head></head>
  <body>
    <m-cube notathing="foo">
      <m-cube color="green">
        <m-cube color="blue"></m-cube>
      </m-cube>
    </m-cube>
  </body>
</html>
`)!;
  expect(validationErrors[0].message).toContain(
    "attribute 'notathing': The attribute 'notathing' is not allowed.",
  );
});
