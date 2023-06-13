import { validateMMLDocument } from "../../src";

test("<m-plane>", () => {
  const validationErrors = validateMMLDocument(`
<m-plane
  id="my-plane"
  class="some-plane-class" 
  color="#FFFFFF" 
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
  width="1.1"
  height="2.2"
></m-plane>
`);
  expect(validationErrors).toBeNull();
});
