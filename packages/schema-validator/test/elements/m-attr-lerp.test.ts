import { validateMMLDocument } from "../../src";

test("<m-attr-lerp>", () => {
  const validationErrors = validateMMLDocument(`
<m-attr-lerp
  id="my-attr-lerp"
  class="some-attr-lerp-class" 
  attr="x"
  duration="5000"
  easing="easeInOutSine"
></m-attr-lerp>
`);
  expect(validationErrors).toBeNull();
});
