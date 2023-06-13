import { validateMMLDocument } from "../../src";

test("<m-frame>", () => {
  const validationErrors = validateMMLDocument(`
<m-frame
  id="my-frame"
  class="some-frame-class" 
  x="1.1" 
  y="2.2" 
  z="3.3" 
  rx="45.45" 
  ry="90.90" 
  rz="135.135" 
  sx="1.1" 
  sy="2.2" 
  sz="3.3"
  src="wss://example.com/some-other-live.mml"
></m-frame>
`);
  expect(validationErrors).toBeNull();
});
