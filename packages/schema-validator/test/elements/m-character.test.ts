import { validateMMLDocument } from "../../src";

test("<m-character>", () => {
  const validationErrors = validateMMLDocument(`
<m-character
  id="my-character"
  class="some-character-class" 
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
></m-character>
`);
  expect(validationErrors).toBeNull();
});
