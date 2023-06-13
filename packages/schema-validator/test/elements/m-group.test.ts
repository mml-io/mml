import { validateMMLDocument } from "../../src";

test("<m-group>", () => {
  const validationErrors = validateMMLDocument(`
<m-group
  id="my-group"
  class="some-group-class" 
  x="1.1" 
  y="2.2" 
  z="3.3" 
  rx="45.45" 
  ry="90.90" 
  rz="135.135" 
  sx="1.1" 
  sy="2.2" 
  sz="3.3"
></m-group>
`);
  expect(validationErrors).toBeNull();
});
