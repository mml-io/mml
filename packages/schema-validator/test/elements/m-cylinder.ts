import { validateMMLDocument } from "../../src";

test("<m-cylinder>", () => {
  const validationErrors = validateMMLDocument(`
<m-cylinder
  id="my-button"
  class="some-button-class" 
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
  width="1.1" 
  height="2.2" 
  depth="3.3"
  collide="true"
  onclick="doSomething();"
></m-cylinder>
`);
  expect(validationErrors).toBeNull();
});
