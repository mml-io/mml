import { validateMMLDocument } from "../../src";

test("<m-attr-anim>", () => {
  const validationErrors = validateMMLDocument(`
<m-attr-anim
  id="my-attr-anim"
  class="some-attr-anim-class" 
  attr="x"
  start="1"
  end="2"
  start-time="3000"
  pause-time="4000"
  duration="5000"
  loop="true"
  easing="easeInOutSine"
  ping-pong="true"
  ping-pong-delay="500" 
></m-attr-anim>
`);
  expect(validationErrors).toBeNull();
});
