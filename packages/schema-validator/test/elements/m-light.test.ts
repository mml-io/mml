import { validateMMLDocument } from "../../src";

test("<m-light>", () => {
  const validationErrors = validateMMLDocument(`
<m-light
  id="my-light"
  class="some-light-class"
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
  debug="true"
  intensity="0.1" 
  enabled="true"
  distance="1.1"
  type="spotlight"
  angle="45.45"
></m-light>
`);
  expect(validationErrors).toBeNull();
});
