import { validateMMLDocument } from "../../src";

test("<m-model>", () => {
  const validationErrors = validateMMLDocument(`
<m-model
  id="my-model"
  class="some-model-class" 
  x="1.1" 
  y="2.2" 
  z="3.3" 
  rx="45.45" 
  ry="90.90" 
  rz="135.135" 
  sx="1.1" 
  sy="2.2" 
  sz="3.3"
  collide="true"
  src="https://example.com/some.glb"
></m-model>
`);
  expect(validationErrors).toBeNull();
});
