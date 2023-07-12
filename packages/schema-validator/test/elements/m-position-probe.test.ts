import { validateMMLDocument } from "../../src";

test("<m-position-probe>", () => {
  const validationErrors = validateMMLDocument(`
<m-position-probe
  id="my-position-probe"
  class="some-position-probe-class"
  debug="true"
  range="20" 
  x="1.1" 
  y="2.2" 
  z="3.3" 
  rx="45.45" 
  ry="90.90" 
  rz="135.135" 
  sx="1.1" 
  sy="2.2" 
  sz="3.3"
  onpositionenter="console.log('positionenter', event)"
  onpositionmove="console.log('positionmove', event)"
  onpositionleave="console.log('positionleave', event)"
></m-position-probe>
`);
  expect(validationErrors).toBeNull();
});
