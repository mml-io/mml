import { validateMMLDocument } from "../../src";

test("<m-label>", () => {
  const validationErrors = validateMMLDocument(`
<m-label
  id="my-label"
  class="some-label-class" 
  x="1.1" 
  y="2.2" 
  z="3.3" 
  rx="45.45" 
  ry="90.90" 
  rz="135.135" 
  sx="1.1" 
  sy="2.2" 
  sz="3.3"
  content="Hello, World!"
  font-size="26"
  color="#FFFFFF"
  alignment="center"
></m-label>
`);
  expect(validationErrors).toBeNull();
});
